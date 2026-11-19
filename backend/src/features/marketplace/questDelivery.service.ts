// A delivery for a funded data quest (#1380, Edge Studio Data Marketplace V1; the publisher's side of UAT-Q06–Q11).
//
// The publisher gives the file they collected for their slot. Edge Studio, on the same machine as the publisher's
// delivery service:
//   1. keeps the file under DATA_DIR/marketplace-deliveries, where the delivery service can serve it;
//   2. fingerprints it (SHA3-256 of its bytes) and counts its rows per device, from the file itself;
//   3. signs the quest manifest (quest, version, slot, fingerprint, counts) with this node's Maxima key, the key the
//      marketplace knows as the source's attesting node (marketplace.service.ts readNodePublicKey);
//   4. submits it to the marketplace, which checks the signature with maxverify before accepting the submission.
// The buyer then sees the signed counts before accepting, and can check the file's fingerprint after download.
// The delivery service serves an accepted delivery as the file entry "quest-<submission id>" (its DELIVERY_CONFIG).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env.js";
import { sha3HashHex } from "../../shared/crypto.js";
import { runMinimaPathCommand } from "../minima/minima.rpc.js";
import {
  marketplaceRequest,
  type MarketplaceActor,
  type MarketplaceResult,
} from "./marketplace.service.js";

const DEVICE = /^[\w.:-]{1,128}$/; // the marketplace's device id rule (parseCounts)
const MAX_DEVICES = 1_000; // the marketplace's limit (parseCounts)

/**
 * Rows per device. NDJSON: one JSON object per line with a "device_id" text field. CSV: a header row with a
 * "device_id" column. Null when the file has no row with a usable device id (nothing could be counted).
 */
function countDevices(bytes: Buffer, fileName: string): Record<string, number> | null {
  // No prototype: a device may be called "constructor" or "__proto__" (review 2026-11-19).
  const counts: Record<string, number> = Object.create(null) as Record<string, number>;
  const lines = bytes
    .toString("utf8")
    .replace(/^\uFEFF/, "") // a byte-order mark before the first line
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  const add = (device: unknown) => {
    if (typeof device === "string" && DEVICE.test(device))
      counts[device] = (counts[device] ?? 0) + 1;
  };
  if (/\.csv$/i.test(fileName)) {
    // ponytail: a plain comma split (no quoted commas); a CSV library if deliveries ever carry quoted fields.
    const column = (lines[0] ?? "")
      .split(",")
      .map((h) => h.trim())
      .indexOf("device_id");
    if (column < 0) return null;
    for (const line of lines.slice(1)) add(line.split(",")[column]?.trim());
  } else {
    for (const line of lines) {
      try {
        add((JSON.parse(line) as { device_id?: unknown } | null)?.device_id);
      } catch {
        // not a JSON line: not counted
      }
    }
  }
  // As a plain JSON object for the answer and the manifest; JSON keeps "__proto__" as an ordinary key.
  return Object.keys(counts).length > 0 ? (JSON.parse(JSON.stringify(counts)) as Record<string, number>) : null;
}

/** The text the marketplace verifies; the same as its manifestText (src/domain/quest.ts in the marketplace). */
function questManifestText(m: {
  questId: string;
  questVersion: number;
  slot: number;
  fingerprint: string;
  counts: Record<string, number>;
}) {
  const counts = Object.fromEntries(
    Object.keys(m.counts)
      .sort()
      .map((k) => [k, m.counts[k]]),
  );
  return `edge-marketplace-quest-manifest:${JSON.stringify({ questId: m.questId, questVersion: m.questVersion, slot: m.slot, fingerprint: m.fingerprint.toLowerCase(), counts })}`;
}

type Outcome =
  | {
      status: 201;
      body: {
        submissionId: string;
        fingerprint: string;
        counts: Record<string, number>;
        deliveryConfig: Record<string, { path: string; fingerprint: string }>;
      };
    }
  | { status: 422 | 503; error: string }
  | { status: "relay"; result: MarketplaceResult };

export async function submitQuestDelivery(
  input: { questId: string; slot: number; sourceId: string; fileName: string; bytes: Buffer },
  actor: MarketplaceActor,
): Promise<Outcome> {
  const counts = countDevices(input.bytes, input.fileName);
  if (!counts)
    return {
      status: 422,
      error:
        'The file has no rows with a device_id (NDJSON lines with a "device_id" field, or a CSV with a device_id column).',
    };
  const devices = Object.keys(counts).length;
  if (devices > MAX_DEVICES)
    return { status: 422, error: `The file names ${devices} devices; a delivery may count at most ${MAX_DEVICES}. Nothing was signed or submitted.` };
  if (!Number.isInteger(input.slot) || input.slot < 1) return { status: 422, error: "The slot must be a whole number from 1." };
  const fingerprint = sha3HashHex(input.bytes);

  // The manifest names the quest version the delivery answers: the quest as the marketplace has it now.
  const quest = await marketplaceRequest(
    "GET",
    `/api/quests/${encodeURIComponent(input.questId)}`,
    actor,
  );
  if (quest.status !== 200) return { status: "relay", result: quest };
  const questVersion = (quest.body as { version?: unknown } | null)?.version;
  if (!Number.isInteger(questVersion))
    return {
      status: 503,
      error: "The marketplace did not say which version of the quest this is.",
    };

  const text = questManifestText({
    questId: input.questId,
    questVersion: questVersion as number,
    slot: input.slot,
    fingerprint,
    counts,
  });
  let signature: unknown;
  try {
    const signed = await runMinimaPathCommand(
      `maxsign data:0x${Buffer.from(text, "utf8").toString("hex").toUpperCase()}`,
    );
    const body = signed.body as { status?: unknown; response?: { signature?: unknown } } | null;
    signature = body?.status === true ? body.response?.signature : undefined;
  } catch {
    signature = undefined;
  }
  if (typeof signature !== "string" || !signature)
    return {
      status: 503,
      error: "This node could not sign the delivery (is Maxima running?). Nothing was submitted.",
    };

  // Kept before submitting, so an accepted delivery always has its file; removed again if the submission fails.
  // Each request writes a file of its own (a unique name, never overwriting), so a failed resubmission of the same
  // bytes can never remove the file an earlier, live delivery is served from (review 2026-11-19).
  const folder = path.join(env.dataDir, "marketplace-deliveries");
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(
    folder,
    `quest-${input.questId.replace(/[^\w-]/g, "_")}-slot-${input.slot}-${fingerprint}-${crypto.randomUUID()}${path.extname(input.fileName).replace(/[^\w.]/g, "")}`,
  );
  fs.writeFileSync(file, input.bytes, { flag: "wx" });

  const result = await marketplaceRequest(
    "POST",
    `/api/quests/${encodeURIComponent(input.questId)}/submissions`,
    actor,
    {
      slot: input.slot,
      questVersion,
      sourceId: input.sourceId,
      fingerprint,
      manifest: { counts, signature },
    },
  );
  const id = (result.body as { id?: unknown } | null)?.id;
  if (result.status !== 201 || typeof id !== "string") {
    fs.rmSync(file, { force: true }); // only this request's own file
    const code = (result.body as { error?: unknown } | null)?.error;
    if (result.status === 422 && typeof code === "string" && code.includes("signature"))
      return { status: 422, error: "The marketplace did not accept this node's signature: this node is not the attesting node of the source's proof. Deliver from the Edge Studio that attests the source." };
    return { status: "relay", result };
  }
  return {
    status: 201,
    body: {
      submissionId: id,
      fingerprint,
      counts,
      deliveryConfig: { [`quest-${id}`]: { path: file, fingerprint } },
    },
  };
}
