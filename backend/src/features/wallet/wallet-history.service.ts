import crypto from "node:crypto";
import { db } from "../../db/database.js";
import { canonicalMinimaAddress } from "../../shared/minima-address.js";
import { getWalletReplacementCount, isWalletReplacementInProgress } from "../address-book/wallet-replacement.service.js";
import { runMinimaPathCommand } from "../minima/minima.rpc.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";
import {
  isTxPowId,
  parseHistoryResponse,
  parseHistorySizeResponse,
  parseLocalWalletAddressesResponse,
  parseOnchainResponse,
  parseTrackedScriptAddressesResponse
} from "./wallet.parse.js";
import type { ChainHistoryEntry } from "./wallet.types.js";

export const HISTORY_PAGE_SIZE = 100;
export const MAX_HISTORY_PAGES_PER_SYNC = 5;
export const CONFIRMATION_BATCH_SIZE = 20;
const SYNC_STATE_KEY = "wallet_history_sync_state";

/** `backfillOffset` is where an unfinished scan continues; rows only shift to higher offsets as new ones arrive. */
type SyncState = { fingerprint: string; size: number; backfillOffset: number | null };

let cachedFingerprint: { value: string; replacementCount: number } | null = null;
let syncInFlight: Promise<void> | null = null;

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
      syncInFlight = null;
    });
  return syncInFlight;
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
      if (onchain.found) confirm.run(onchain.block, onchain.confirmations, new Date().toISOString(), txpowId);
    }
  } catch (error) {
    console.error("Wallet confirmation refresh failed:", error instanceof Error ? error.message : "unknown error");
  }
}
