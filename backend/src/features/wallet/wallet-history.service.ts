import crypto from "node:crypto";
import { db } from "../../db/database.js";
import { canonicalMinimaAddress, miniMinimaAddress } from "../../shared/minima-address.js";
import { listAddressBookEntries } from "../address-book/address-book.repository.js";
import { getWalletReplacementCount, isWalletReplacementInProgress } from "../address-book/wallet-replacement.service.js";
import { parseBlockCommandResponse } from "../minima/minima.parse.js";
import { runMinimaPathCommand } from "../minima/minima.rpc.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";
import {
  isTxPowId,
  parseHistoryResponse,
  parseHistorySizeResponse,
  parseLocalWalletAddressesResponse,
  parseOnchainResponse,
  parseTrackedScriptAddressesResponse,
  parseTxPowTimeResponse
} from "./wallet.parse.js";
import type { ChainHistoryEntry, WalletHistoryItem, WalletHistoryQuery } from "./wallet.types.js";

export const HISTORY_PAGE_SIZE = 100;
export const MAX_HISTORY_PAGES_PER_SYNC = 5;
export const CONFIRMATION_BATCH_SIZE = 20;
export const READ_SYNC_MAX_AGE_MS = 5_000;
const SYNC_STATE_KEY = "wallet_history_sync_state";

/** `backfillOffset` is where an unfinished scan continues; rows only shift to higher offsets as new ones arrive. */
type SyncState = { fingerprint: string; size: number; backfillOffset: number | null };

let cachedFingerprint: { value: string; replacementCount: number } | null = null;
let syncInFlight: Promise<void> | null = null;
let lastSyncFinishedAt = 0;

async function readWalletScripts() {
  const replacementCount = getWalletReplacementCount();
  const result = await runMinimaPathCommand("scripts");
  if (!result.ok) throw new Error(`Minima RPC error: HTTP ${result.status}`);
  const defaults = parseLocalWalletAddressesResponse(result.body)
    .map((address) => canonicalMinimaAddress(address))
    .filter((address): address is string => address !== null)
    .sort();
  if (defaults.length === 0) throw new Error("Minima returned no default wallet addresses");
  const fingerprint = crypto.createHash("sha256").update(defaults.join("\n")).digest("hex");
  cachedFingerprint = { value: fingerprint, replacementCount };
  return { fingerprint, trackedAddresses: parseTrackedScriptAddressesResponse(result.body) };
}

/**
 * SHA-256 of the wallet's sorted default addresses; identifies which wallet a history row belongs to.
 * Cached until the next wallet replacement finishes.
 */
export async function getWalletFingerprint(): Promise<string> {
  if (cachedFingerprint?.replacementCount === getWalletReplacementCount()) return cachedFingerprint.value;
  return (await readWalletScripts()).fingerprint;
}

function readSyncState(): SyncState | null {
  try {
    const state = JSON.parse(getSetting(SYNC_STATE_KEY)) as SyncState;
    return typeof state.fingerprint === "string" && typeof state.size === "number" ? state : null;
  } catch {
    return null;
  }
}

async function fetchHistoryPage(offset: number, trackedAddresses: Set<string>) {
  const result = await runMinimaPathCommand(`history max:${HISTORY_PAGE_SIZE} offset:${offset}`);
  const body = result.body as { response?: { txpows?: unknown } } | null;
  const entries = parseHistoryResponse(result.body, trackedAddresses);
  const txpowCount = Array.isArray(body?.response?.txpows) ? body.response.txpows.length : 0;
  return { entries, isLastPage: txpowCount < HISTORY_PAGE_SIZE };
}

function isKnownEntry(entry: ChainHistoryEntry, fingerprint: string) {
  return db.prepare("SELECT 1 FROM wallet_transactions WHERE txpow_id = ? AND token_id = ? AND wallet_fingerprint = ?")
    .get(entry.txpowId, entry.tokenId, fingerprint) !== undefined;
}

function upsertEntries(entries: ChainHistoryEntry[], fingerprint: string) {
  const syncedAt = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO wallet_transactions (
      txpow_id, token_id, transaction_id, direction, amount, token_name, counterparty, time_millis, wallet_fingerprint, synced_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(txpow_id, token_id) DO UPDATE SET
      transaction_id = excluded.transaction_id,
      direction = excluded.direction,
      amount = excluded.amount,
      token_name = excluded.token_name,
      counterparty = excluded.counterparty,
      time_millis = excluded.time_millis,
      wallet_fingerprint = excluded.wallet_fingerprint,
      synced_at = excluded.synced_at
  `);
  db.transaction(() => {
    for (const entry of entries) {
      upsert.run(entry.txpowId, entry.tokenId, entry.transactionId, entry.direction, entry.amount, entry.tokenName,
        entry.counterparty, entry.timeMillis, fingerprint, syncedAt);
    }
  })();
}

async function runSync() {
  const size = parseHistorySizeResponse((await runMinimaPathCommand("history action:size")).body);
  const previous = readSyncState();
  const fingerprint = await getWalletFingerprint();
  if (previous?.fingerprint === fingerprint && previous.size === size && previous.backfillOffset === null) return;

  const { fingerprint: freshFingerprint, trackedAddresses } = await readWalletScripts();
  const continuing = previous?.fingerprint === freshFingerprint;
  let backfillOffset = continuing ? previous.backfillOffset : null;
  let pagesLeft = MAX_HISTORY_PAGES_PER_SYNC;

  // Newest first until a page holds nothing new or history ends.
  let offset = 0;
  for (;;) {
    if (pagesLeft === 0) {
      backfillOffset = offset;
      break;
    }
    pagesLeft -= 1;
    const page = await fetchHistoryPage(offset, trackedAddresses);
    const allKnown = page.entries.length > 0 && page.entries.every((entry) => isKnownEntry(entry, freshFingerprint));
    upsertEntries(page.entries, freshFingerprint);
    if (page.isLastPage) {
      backfillOffset = null;
      break;
    }
    if (allKnown) break;
    offset += HISTORY_PAGE_SIZE;
  }

  // Older rows an earlier capped scan did not reach.
  while (backfillOffset !== null && pagesLeft > 0) {
    pagesLeft -= 1;
    const page = await fetchHistoryPage(backfillOffset, trackedAddresses);
    upsertEntries(page.entries, freshFingerprint);
    backfillOffset = page.isLastPage ? null : backfillOffset + HISTORY_PAGE_SIZE;
  }

  saveSetting(SYNC_STATE_KEY, JSON.stringify({ fingerprint: freshFingerprint, size, backfillOffset } satisfies SyncState));
}

/**
 * Copies new relevant TxPoWs from Minima's `history` into `wallet_transactions`. Skips while the
 * wallet is being replaced; a call during a running sync waits for that sync. RPC failures leave
 * stored rows untouched.
 */
export function syncWalletHistory(): Promise<void> {
  if (isWalletReplacementInProgress()) return Promise.resolve();
  syncInFlight ??= runSync()
    .catch((error) => {
      console.error("Wallet history sync failed:", error instanceof Error ? error.message : "unknown error");
    })
    .finally(() => {
      lastSyncFinishedAt = Date.now();
      syncInFlight = null;
    });
  return syncInFlight;
}

/** Syncs before a history read unless a sync finished within the last few seconds. */
export function syncWalletHistoryIfStale(): Promise<void> {
  if (Date.now() - lastSyncFinishedAt < READ_SYNC_MAX_AGE_MS) return Promise.resolve();
  return syncWalletHistory();
}

/** Marks a bounded batch of the current wallet's unconfirmed rows confirmed once `txpow onchain:` finds them. Skips while the wallet is being replaced. */
export async function refreshPendingConfirmations(): Promise<void> {
  if (isWalletReplacementInProgress()) return;
  try {
    const fingerprint = await getWalletFingerprint();
    const pending = db.prepare(`
      SELECT DISTINCT txpow_id FROM wallet_transactions
      WHERE confirmed_at IS NULL AND wallet_fingerprint = ?
      ORDER BY time_millis DESC
      LIMIT ?
    `).all(fingerprint, CONFIRMATION_BATCH_SIZE) as { txpow_id: string }[];

    const confirm = db.prepare(`
      UPDATE wallet_transactions SET block = ?, confirmations = ?, confirmed_at = ? WHERE txpow_id = ?
    `);
    for (const { txpow_id: txpowId } of pending) {
      if (!isTxPowId(txpowId)) continue;
      const onchain = parseOnchainResponse((await runMinimaPathCommand(`txpow onchain:${txpowId}`)).body);
      if (!onchain.found || !isTxPowId(onchain.blockId)) continue;
      const blockTime = parseTxPowTimeResponse((await runMinimaPathCommand(`txpow txpowid:${onchain.blockId}`)).body, onchain.blockId);
      confirm.run(onchain.block, onchain.confirmations, new Date(blockTime).toISOString(), txpowId);
    }
  } catch (error) {
    console.error("Wallet confirmation refresh failed:", error instanceof Error ? error.message : "unknown error");
  }
}

// Chain rows, plus app sends that failed or are not on chain yet. Sends recorded before
// transaction IDs were stored cannot be matched to their chain row, so only failed ones are listed.
const HISTORY_ROWS = `
  SELECT t.txpow_id || ':' || t.token_id AS id, t.direction,
    CASE WHEN t.confirmed_at IS NULL THEN 'pending' ELSE 'confirmed' END AS status,
    t.amount, t.token_id, t.token_name, t.counterparty, t.time_millis, t.txpow_id, t.transaction_id,
    t.block, t.confirmed_at, t.wallet_fingerprint,
    (SELECT s.origin FROM wallet_send_history s WHERE s.transaction_id = t.transaction_id LIMIT 1) AS origin,
    NULL AS error
  FROM wallet_transactions t
  UNION ALL
  SELECT s.id, 'out', CASE WHEN s.status = 'failed' THEN 'failed' ELSE 'pending' END,
    s.amount, s.token_id, s.token_name, s.to_address,
    CAST(ROUND((julianday(s.created_at) - 2440587.5) * 86400000) AS INTEGER), NULL, s.transaction_id,
    NULL, NULL, s.wallet_fingerprint, s.origin, s.error
  FROM wallet_send_history s
  WHERE s.status = 'failed'
    OR (s.transaction_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM wallet_transactions t WHERE t.transaction_id = s.transaction_id))
`;

type HistoryRow = {
  id: string;
  direction: WalletHistoryItem["direction"];
  status: WalletHistoryItem["status"];
  amount: string;
  token_id: string;
  token_name: string;
  counterparty: string | null;
  time_millis: number;
  txpow_id: string | null;
  transaction_id: string | null;
  block: number | null;
  confirmed_at: string | null;
  wallet_fingerprint: string | null;
  origin: WalletHistoryItem["origin"];
  error: string | null;
};

/** `contactAddresses` are the addresses of contacts whose label matches `q`, in both 0x and Mx form. */
function buildHistoryWhere(query: Omit<WalletHistoryQuery, "page" | "pageSize">, contactAddresses: string[]) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (query.status) {
    clauses.push("status = ?");
    params.push(query.status);
  }
  if (query.direction) {
    clauses.push("direction = ?");
    params.push(query.direction);
  }
  if (query.fromMillis !== undefined) {
    clauses.push("time_millis >= ?");
    params.push(query.fromMillis);
  }
  if (query.toMillis !== undefined) {
    clauses.push("time_millis < ?");
    params.push(query.toMillis);
  }
  if (query.q) {
    const like = `%${query.q}%`;
    const contactMatch = contactAddresses.length > 0
      ? ` OR counterparty COLLATE NOCASE IN (${contactAddresses.map(() => "?").join(", ")})`
      : "";
    clauses.push(`(counterparty LIKE ? OR txpow_id LIKE ? OR transaction_id LIKE ? OR token_name LIKE ? OR token_id LIKE ?${contactMatch})`);
    params.push(like, like, like, like, like, ...contactAddresses);
  }
  return { where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

async function readTipBlock(): Promise<number | null> {
  try {
    return parseBlockCommandResponse((await runMinimaPathCommand("block")).body).block;
  } catch {
    return null;
  }
}

async function readCurrentFingerprint(): Promise<string | null> {
  try {
    return await getWalletFingerprint();
  } catch {
    return null;
  }
}

/**
 * One page of Wallet history, newest first. While Minima is unreachable, stored rows are still
 * returned, with no confirmation counts and no row marked as previous-wallet.
 */
export async function listWalletHistory(query: WalletHistoryQuery) {
  const [tip, fingerprint] = await Promise.all([readTipBlock(), readCurrentFingerprint()]);
  const contacts = listAddressBookEntries();
  const needle = query.q?.toLowerCase();
  const contactAddresses = needle
    ? contacts
      .filter((entry) => entry.label.toLowerCase().includes(needle))
      .flatMap((entry) => [canonicalMinimaAddress(entry.address), miniMinimaAddress(entry.address)])
      .filter((address): address is string => address !== null)
    : [];
  const { where, params } = buildHistoryWhere(query, contactAddresses);
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM (${HISTORY_ROWS}) ${where}`).get(...params) as { count: number }).count;
  const rows = db.prepare(`
    SELECT * FROM (${HISTORY_ROWS}) ${where}
    ORDER BY time_millis DESC, id
    LIMIT ? OFFSET ?
  `).all(...params, query.pageSize, (query.page - 1) * query.pageSize) as HistoryRow[];
  const previousWalletItems = fingerprint === null ? 0 : (db.prepare(`
    SELECT COUNT(*) AS count FROM (${HISTORY_ROWS}) WHERE wallet_fingerprint IS NOT NULL AND wallet_fingerprint != ?
  `).get(fingerprint) as { count: number }).count;
  const contactLabels = new Map(contacts.map((entry) => [canonicalMinimaAddress(entry.address), entry.label]));

  const items = rows.map((row): WalletHistoryItem => ({
    id: row.id,
    direction: row.direction,
    status: row.status,
    amount: row.amount,
    tokenId: row.token_id,
    tokenName: row.token_name,
    counterparty: row.counterparty,
    counterpartyLabel: (row.counterparty && contactLabels.get(canonicalMinimaAddress(row.counterparty))) ?? null,
    time: new Date(row.time_millis).toISOString(),
    txpowId: row.txpow_id,
    transactionId: row.transaction_id,
    block: row.block,
    confirmations: row.block !== null && tip !== null ? Math.max(0, tip - row.block) : null,
    confirmedAt: row.confirmed_at,
    origin: row.origin,
    error: row.error,
    isPreviousWallet: fingerprint !== null && row.wallet_fingerprint !== null && row.wallet_fingerprint !== fingerprint
  }));
  return { items, total, previousWalletItems };
}

export class WalletReplacementBusyError extends Error {
  constructor() {
    super("The wallet is being replaced. Try again when it has finished.");
  }
}

/** Deletes history rows recorded under another wallet. Returns the number of rows deleted. */
export async function clearPreviousWalletHistory(): Promise<number> {
  const replacementCount = getWalletReplacementCount();
  if (isWalletReplacementInProgress()) throw new WalletReplacementBusyError();
  const fingerprint = await getWalletFingerprint();
  if (isWalletReplacementInProgress() || getWalletReplacementCount() !== replacementCount) throw new WalletReplacementBusyError();

  return db.transaction(() => {
    const chain = db.prepare("DELETE FROM wallet_transactions WHERE wallet_fingerprint != ?").run(fingerprint).changes;
    const sends = db.prepare(
      "DELETE FROM wallet_send_history WHERE wallet_fingerprint IS NOT NULL AND wallet_fingerprint != ?"
    ).run(fingerprint).changes;
    return chain + sends;
  })();
}
