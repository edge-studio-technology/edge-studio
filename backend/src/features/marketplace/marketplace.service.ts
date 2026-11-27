import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { fetchJsonWithTimeout } from "../../shared/http.js";
import type { UserRole } from "../auth/auth.types.js";
import { getDataSource, listDataSources, type DataSourceRecord } from "../data-sources/dataSources.repository.js";
import { getReadyProofsForDataSource } from "../integritas/integritas.repository.js";
import { runMinimaPathCommand } from "../minima/minima.rpc.js";

// The Data Marketplace is a separate service. Edge Studio's backend is its only client here: it holds the
// installation key, states the acting user and role on every call, and pushes this installation's data sources.
// The marketplace URL is deployment configuration, so it uses fetchJsonWithTimeout, not the egress policy (ADR 0014).

export type MarketplaceRole = "owner" | "publisher" | "viewer";
export type MarketplaceActor = { userId: string; role: MarketplaceRole };
/** `status` 0 means the marketplace could not be reached. */
// next: the marketplace's X-Next-Cursor, when the answer is one page of a longer list.
export type MarketplaceResult = { status: number; body: unknown; next?: string | null };

const REQUEST_TIMEOUT_MS = 10_000;
const SYNC_DELAY_MS = 1_000;
const SYNC_RETRY_MS = 60_000;
/** Edge Studio itself, for pushes and delivery-service relays that no signed-in user makes. */
export const SYSTEM_USER_ID = "edge-studio";

/** Edge Studio has only `admin` today; it owns the installation. Anything else is read-only. */
export function marketplaceRoleFor(role: UserRole | string): MarketplaceRole {
  return role === "admin" ? "owner" : "viewer";
}

export function isMarketplaceConfigured() {
  if (!env.marketplaceInstallationKey) return false;
  try {
    const url = new URL(env.marketplaceUrl);
    // The key travels in a header, so plain HTTP is only for a marketplace on this machine (development).
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch {
    return false;
  }
}

export async function marketplaceRequest(method: string, path: string, actor: MarketplaceActor, body?: unknown): Promise<MarketplaceResult> {
  try {
    const { response, body: parsed } = await fetchJsonWithTimeout(
      `${env.marketplaceUrl.replace(/\/+$/, "")}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${env.marketplaceInstallationKey}`,
          "X-Edge-Studio-User": actor.userId,
          "X-Edge-Studio-Role": actor.role,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error", // the key is never sent on to another address
      },
      REQUEST_TIMEOUT_MS
    );
    return { status: response.status, body: parsed, next: response.headers?.get("x-next-cursor") ?? null };
  } catch {
    return { status: 0, body: null };
  }
}

/** Constant-time check of the delivery service's `Authorization: Bearer <secret>`. Refuses all while the secret
 * is unset or shorter than 32 characters: whoever holds it decides where buyers are sent. */
export const MIN_DELIVERY_SECRET_LENGTH = 32;
export function isDeliveryAuthorized(header: string | undefined) {
  const secret = env.marketplaceDeliverySecret;
  const given = /^Bearer (\S+)$/.exec(header ?? "")?.[1];
  if (!secret || secret.length < MIN_DELIVERY_SECRET_LENGTH || !given) return false;
  const digest = (value: string) => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(digest(given), digest(secret));
}

// ---- Source push: the marketplace never reads Edge Studio, so every change to a source or its proofs is pushed.

const isOutputTarget = (source: DataSourceRecord) => source.type.endsWith("-output") || source.type === "spi-display";

/** The local node's first managed signing key: the key the marketplace shows as the attesting node. */
export async function readNodePublicKey() {
  try {
    const { body } = await runMinimaPathCommand("keys");
    const keys = (body as { response?: { keys?: unknown } } | null)?.response?.keys;
    if (!Array.isArray(keys)) return null;
    const key = keys.find((item) => /^0x[0-9a-f]+$/i.test(String((item as { publickey?: unknown } | null)?.publickey ?? ""))) as { publickey: string } | undefined;
    return key?.publickey ?? null;
  } catch {
    return null;
  }
}

/** PUT body for one source. Null when its proof exists but the node key cannot be read (retry, do not downgrade). */
export function sourcePushBody(source: DataSourceRecord, nodePublicKey: string | null) {
  const { count, latest } = getReadyProofsForDataSource(source.id);
  if (latest?.proof_uid && !nodePublicKey) return null;
  return {
    name: source.name,
    verified: count > 0,
    attestations: count,
    proof: latest?.proof_uid
      ? { nodePublicKey, reference: `integritas:uid:${latest.proof_uid}`, fingerprint: latest.hash, attestedAt: latest.created_at }
      : null,
  };
}

const system: MarketplaceActor = { userId: SYSTEM_USER_ID, role: "owner" };

/** Pushes one source (or removes it when deleted or an output target). True when it should be retried. */
async function pushSource(id: string, nodeKey: () => Promise<string | null>) {
  const path = `/api/integration/sources/${encodeURIComponent(id)}`;
  // The node key is read first and the source after it: a source deleted during that wait is removed, never
  // pushed again with stale data.
  const key = getDataSource(id) ? await nodeKey() : null;
  const source = getDataSource(id);
  let result: MarketplaceResult;
  if (!source || isOutputTarget(source)) {
    result = await marketplaceRequest("DELETE", path, system);
    if (result.status === 404) return false;
  } else {
    const body = sourcePushBody(source, key);
    if (!body) return true;
    result = await marketplaceRequest("PUT", path, system, body);
  }
  if (result.status === 0 || result.status >= 500) return true;
  if (result.status >= 400) console.warn(`Marketplace refused source ${id}: HTTP ${result.status}`, result.body);
  return false;
}

const queued = new Set<string>();
let timer: NodeJS.Timeout | null = null;
let dueAt = 0;
let running = false; // one flush at a time

// A sooner push replaces a later one already planned (a new change is not held behind a 60 s retry).
function schedule(delayMs: number) {
  if (timer && dueAt <= Date.now() + delayMs) return;
  if (timer) clearTimeout(timer);
  dueAt = Date.now() + delayMs;
  timer = setTimeout(() => void flushMarketplaceSync(), delayMs);
  timer.unref?.();
}

/** Queues sources for a push shortly; changes in quick succession share one push. No-op when not configured. */
export function queueMarketplaceSourceSync(...ids: string[]) {
  if (!isMarketplaceConfigured() || ids.length === 0) return;
  ids.forEach((id) => queued.add(id));
  schedule(SYNC_DELAY_MS);
}

export async function flushMarketplaceSync() {
  if (running) return; // the running flush, or the push it schedules, picks up what was queued meanwhile
  running = true;
  if (timer) clearTimeout(timer);
  timer = null;
  try {
  let key: Promise<string | null> | null = null;
  const nodeKey = () => (key ??= readNodePublicKey());
  let retry = false;
  for (const id of [...queued]) {
    queued.delete(id);
    if (await pushSource(id, nodeKey)) {
      queued.add(id);
      retry = true;
    }
  }
  // ponytail: in-memory queue; a restart drops pending removals (start-up pushes current sources again).
  if (retry) schedule(SYNC_RETRY_MS);
  } finally {
    running = false;
  }
}

export function startMarketplaceSourceSync() {
  // Queue outputs too so an older build that pushed one removes that stale marketplace record on restart.
  queueMarketplaceSourceSync(...listDataSources().map((source) => source.id));
}

export function stopMarketplaceSourceSync() {
  if (timer) clearTimeout(timer);
  timer = null;
  queued.clear();
}
