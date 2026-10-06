import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

const STATE_FILE = "last-applied-manifest.json";

export type AppliedImages = { frontend: string; backend: string };

export type LastAppliedManifest = {
  createdAt: string | null;
  version: string | null;
  // null for legacy files written before images were recorded. See docs/adr/0029-verified-version-identity.md.
  images: AppliedImages | null;
};

function statePath(): string {
  return path.join(env.stateDirInContainer, STATE_FILE);
}

/** Returns the parsed state file, or null if none has been recorded yet or it is unreadable. */
export async function getLastAppliedManifest(): Promise<LastAppliedManifest | null> {
  try {
    const raw = await readFile(statePath(), "utf8");
    const parsed = JSON.parse(raw) as { createdAt?: string; version?: string; images?: Partial<AppliedImages> };
    const images = parsed.images?.frontend && parsed.images.backend
      ? { frontend: parsed.images.frontend, backend: parsed.images.backend }
      : null;
    return { createdAt: parsed.createdAt || null, version: parsed.version ?? null, images };
  } catch {
    return null;
  }
}

/**
 * Returns the createdAt (epoch ms) of the last manifest whose update was
 * successfully applied, or null if none has been recorded yet.
 */
export async function getLastAppliedManifestTimestamp(): Promise<number | null> {
  const state = await getLastAppliedManifest();
  if (!state?.createdAt) return null;
  const timestamp = Date.parse(state.createdAt);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export async function recordAppliedManifest(createdAt: string, version: string, images: AppliedImages): Promise<void> {
  await mkdir(env.stateDirInContainer, { recursive: true });
  await writeFile(statePath(), JSON.stringify({ createdAt, version, images }, null, 2));
}
