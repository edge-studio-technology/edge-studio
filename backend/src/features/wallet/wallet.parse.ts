import { canonicalMinimaAddress } from "../../shared/minima-address.js";
import type {
  ChainHistoryEntry,
  ImportWalletResult,
  PaymentStatus,
  ReceiveAddress,
  SendPaymentResult,
  TokenBalance,
  TxPowOnChain,
  WalletStatus
} from "./wallet.types.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function tokenDisplayName(tokenId: string, rawName: unknown): string {
  if (tokenId === "0x00") return "Minima";
  if (typeof rawName === "string" && rawName.trim()) return rawName.trim();
  // Minima returns custom-token metadata as a JSON object: { name, description, url, ... }
  const meta = asRecord(rawName);
  const metaName = typeof meta?.name === "string" ? meta.name.trim() : "";
  return metaName || tokenId;
}

function parseToken(raw: unknown): TokenBalance | null {
  const item = asRecord(raw);
  if (!item) return null;

  const tokenId = asString(item.tokenid, "");
  if (!tokenId) return null;

  const isNative = tokenId === "0x00";
  return {
    tokenId,
    name: tokenDisplayName(tokenId, item.token),
    confirmed: asString(item.confirmed, "0"),
    unconfirmed: asString(item.unconfirmed, "0"),
    sendable: asString(item.sendable, "0"),
    isNative
  };
}

export function parseBalanceResponse(body: unknown): WalletStatus {
  const checkedAt = new Date().toISOString();
  const record = asRecord(body);
  const response = record?.response;

  if (!Array.isArray(response)) {
    return { checkedAt, tokens: [] };
  }

  const tokens: TokenBalance[] = [];
  for (const item of response) {
    const token = parseToken(item);
    if (token) tokens.push(token);
  }

  return { checkedAt, tokens };
}

export function parseAddressResponse(body: unknown): Omit<ReceiveAddress, "qrDataUrl"> {
  const record = asRecord(body);
  const response = asRecord(record?.response);
  const miniAddress = asString(response?.miniaddress, "");
  const address = asString(response?.address, "");
  if (!miniAddress && !address) throw new Error("Minima did not return an address");
  const publicKey = typeof response?.publickey === "string" ? response.publickey : undefined;
  return { miniAddress: miniAddress || address, address: address || miniAddress, publicKey };
}

function scriptsResponseRows(body: unknown): unknown[] {
  const record = asRecord(body);
  if (record?.status !== true || !Array.isArray(record.response)) {
    throw new Error("Minima did not return a successful scripts response");
  }
  return record.response;
}

export function parseLocalWalletAddressesResponse(body: unknown): string[] {
  const rows = scriptsResponseRows(body);

  const addresses: string[] = [];
  for (const raw of rows) {
    const item = asRecord(raw);
    if (!item || typeof item.default !== "boolean" || typeof item.simple !== "boolean") {
      throw new Error("Minima returned malformed script flags");
    }
    if (!item.default || !item.simple) continue;

    const address = typeof item.address === "string" ? item.address.trim() : "";
    const miniAddress = typeof item.miniaddress === "string" ? item.miniaddress.trim() : "";
    const canonical = canonicalMinimaAddress(address);
    if (!canonical || !/^0x/i.test(address) || !/^mx/i.test(miniAddress) ||
      canonicalMinimaAddress(miniAddress) !== canonical) {
      throw new Error("Minima returned invalid local wallet address data");
    }
    addresses.push(miniAddress);
  }
  return addresses;
}

/** Canonical 0x addresses of every tracked script — the set Minima uses to decide history relevance. */
export function parseTrackedScriptAddressesResponse(body: unknown): Set<string> {
  const addresses = new Set<string>();
  for (const raw of scriptsResponseRows(body)) {
    const item = asRecord(raw);
    if (item?.track !== true || typeof item.address !== "string") continue;
    const canonical = canonicalMinimaAddress(item.address);
    if (canonical) addresses.add(canonical);
  }
  return addresses;
}

export function parseSendResponse(body: unknown): SendPaymentResult {
  const record = asRecord(body);
  if (record?.status === false) {
    return {
      ok: false,
      txpowId: null,
      transactionId: null,
      status: "failed",
      message: asString(record.error ?? record.message, "Send failed")
    };
  }
  const response = asRecord(record?.response);
  const inner = asRecord(response?.txpow);
  const txpowId = asString(response?.txpowid ?? inner?.txpowid, "") || null;
  const txn = asRecord(asRecord((inner ?? response)?.body)?.txn);
  const transactionId = asString(txn?.transactionid, "") || null;
  return { ok: true, txpowId, transactionId, status: "pending" };
}

export function isTxPowId(value: string): boolean {
  return /^0x[0-9a-f]{1,128}$/i.test(value);
}

// `txpow txpowid:` returns the TxPoW itself as `response`; a TxPoW the node knows but has not
// found on chain is pending.
export function parsePaymentStatusResponse(body: unknown, txpowId: string): PaymentStatus {
  const checkedAt = new Date().toISOString();
  const record = asRecord(body);
  const response = asRecord(record?.response);
  const known = record?.status === true && typeof response?.txpowid === "string"
    && response.txpowid.toLowerCase() === txpowId.toLowerCase();
  return { txpowId, status: known ? "pending" : "unknown", checkedAt };
}

function asNonNegativeInteger(value: unknown): number | null {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

/** TxPoW time from a `txpow txpowid:` response, in epoch milliseconds. */
export function parseTxPowTimeResponse(body: unknown, txpowId: string): number {
  const record = asRecord(body);
  const response = asRecord(record?.response);
  const timeMillis = asNonNegativeInteger(asRecord(response?.header)?.timemilli);
  if (record?.status !== true || typeof response?.txpowid !== "string"
    || response.txpowid.toLowerCase() !== txpowId.toLowerCase() || timeMillis === null) {
    throw new Error("Minima did not return the requested TxPoW");
  }
  return timeMillis;
}

export function parseOnchainResponse(body: unknown): TxPowOnChain {
  const record = asRecord(body);
  const response = asRecord(record?.response);
  if (record?.status !== true || !response || typeof response.found !== "boolean") {
    throw new Error("Minima did not return a successful txpow onchain response");
  }
  if (!response.found) return { found: false };

  const block = asNonNegativeInteger(response.block);
  const confirmations = asNonNegativeInteger(response.confirmations);
  const blockId = typeof response.blockid === "string" ? response.blockid : "";
  if (block === null || confirmations === null || !blockId) {
    throw new Error("Minima returned malformed txpow onchain data");
  }
  return { found: true, block, blockId, confirmations };
}

export function parseHistorySizeResponse(body: unknown): number {
  const record = asRecord(body);
  const size = record?.status === true ? asNonNegativeInteger(asRecord(record.response)?.size) : null;
  if (size === null) throw new Error("Minima did not return a successful history size response");
  return size;
}

const decimalPattern = /^-?\d+(\.\d+)?$/;

function coinsOf(txn: Record<string, unknown> | null, key: "inputs" | "outputs"): Record<string, unknown>[] {
  const coins = txn?.[key];
  return Array.isArray(coins) ? coins.map(asRecord).filter((coin): coin is Record<string, unknown> => coin !== null) : [];
}

function sameTokenId(coin: Record<string, unknown>, tokenId: string) {
  return typeof coin.tokenid === "string" && coin.tokenid.toLowerCase() === tokenId.toLowerCase();
}

function isLocalCoin(coin: Record<string, unknown>, localAddresses: Set<string>) {
  const canonical = typeof coin.address === "string" ? canonicalMinimaAddress(coin.address) : null;
  return canonical !== null && localAddresses.has(canonical);
}

function coinMiniAddress(coin: Record<string, unknown>): string | null {
  if (typeof coin.miniaddress === "string" && coin.miniaddress.trim()) return coin.miniaddress.trim();
  return typeof coin.address === "string" && coin.address.trim() ? coin.address.trim() : null;
}

/**
 * Projects `history` into one entry per TxPoW and token. `details[i].difference` is relevant outputs
 * minus relevant inputs, so its sign gives the direction. Malformed TxPoWs are skipped, not thrown,
 * so one odd entry never stops a sync.
 */
export function parseHistoryResponse(body: unknown, localAddresses: Set<string>): ChainHistoryEntry[] {
  const record = asRecord(body);
  const response = asRecord(record?.response);
  const txpows = response?.txpows;
  const details = response?.details;
  if (record?.status !== true || !Array.isArray(txpows) || !Array.isArray(details)) {
    throw new Error("Minima did not return a successful history response");
  }

  const entries: ChainHistoryEntry[] = [];
  txpows.forEach((rawTxpow, index) => {
    const txpow = asRecord(rawTxpow);
    const difference = asRecord(asRecord(details[index])?.difference);
    const txpowId = typeof txpow?.txpowid === "string" ? txpow.txpowid : "";
    const timeMillis = asNonNegativeInteger(asRecord(txpow?.header)?.timemilli);
    if (!txpowId || timeMillis === null || !difference) return;

    const txn = asRecord(asRecord(txpow?.body)?.txn);
    const transactionId = typeof txn?.transactionid === "string" && txn.transactionid ? txn.transactionid : null;
    const inputs = coinsOf(txn, "inputs");
    const outputs = coinsOf(txn, "outputs");

    for (const [tokenId, rawDifference] of Object.entries(difference)) {
      if (typeof rawDifference !== "string" || !decimalPattern.test(rawDifference)) continue;
      const negative = rawDifference.startsWith("-");
      const amount = negative ? rawDifference.slice(1) : rawDifference;
      const direction = /^[0.]+$/.test(amount) ? "self" : negative ? "out" : "in";

      const otherSide = direction === "in" ? inputs : outputs;
      const counterpartyCoin = direction === "self"
        ? undefined
        : otherSide.find((coin) => sameTokenId(coin, tokenId) && !isLocalCoin(coin, localAddresses));
      const tokenCoin = [...outputs, ...inputs].find((coin) => sameTokenId(coin, tokenId));

      entries.push({
        txpowId,
        transactionId,
        tokenId,
        tokenName: tokenDisplayName(tokenId, asRecord(tokenCoin?.token)?.name),
        amount,
        direction,
        timeMillis,
        counterparty: counterpartyCoin ? coinMiniAddress(counterpartyCoin) : null
      });
    }
  });
  return entries;
}

export function parseImportResponse(body: unknown): ImportWalletResult {
  const record = asRecord(body);
  if (record?.status === false) {
    return { ok: false, message: asString(record.error ?? record.message, "Import failed") };
  }
  return { ok: true, message: "Wallet restored. The node may restart to apply the new seed." };
}
