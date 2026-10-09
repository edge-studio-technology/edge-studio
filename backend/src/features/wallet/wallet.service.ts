import QRCode from "qrcode";
import { runWalletReplacement } from "../address-book/wallet-replacement.service.js";
import { runMinimaPathCommand } from "../minima/minima.rpc.js";
import { db } from "../../db/database.js";
import { isMinimaAddress } from "../../shared/minima-address.js";
import { getComposeServiceContainer, inspectContainer } from "../status/docker.service.js";
import { getWalletFingerprint } from "./wallet-history.service.js";
import { isTxPowId, parseAddressResponse, parseBalanceResponse, parseImportResponse, parseLocalWalletAddressesResponse, parseOnchainResponse, parsePaymentStatusResponse, parseSendResponse } from "./wallet.parse.js";
import type {
  ImportWalletResult,
  PaymentStatus,
  ReceiveAddress,
  SendPaymentRequest,
  SendPaymentResult,
  WalletStatus
} from "./wallet.types.js";

export async function getWalletStatus(): Promise<WalletStatus> {
  const result = await runMinimaPathCommand("balance");
  return parseBalanceResponse(result.body);
}

export async function getLocalWalletAddresses(): Promise<string[]> {
  const result = await runMinimaPathCommand("scripts");
  if (!result.ok) throw new Error(`Minima RPC error: HTTP ${result.status}`);
  return parseLocalWalletAddressesResponse(result.body);
}

export async function isLocalWalletReadyForVerification(revision: string): Promise<boolean> {
  const result = await runMinimaPathCommand("checkrestore");
  const body = result.body as { status?: unknown; error?: unknown; response?: { restoring?: unknown; shuttingdown?: unknown; complete?: unknown } } | null;
  if (result.ok && body?.status === false && body.error === "Command not found") {
    const dispatchedAt = Number(revision.split("@")[1]);
    if (!Number.isFinite(dispatchedAt) || dispatchedAt <= 0) return false;
    const container = await getComposeServiceContainer("minima");
    if (!container) return false;
    const { State } = await inspectContainer(container.Id);
    if (!State.Running || !(Date.parse(State.StartedAt) > dispatchedAt)) return false;
    const status = await runMinimaPathCommand("status");
    const statusBody = status.body as { status?: unknown; response?: { locked?: unknown } } | null;
    return status.ok && statusBody?.status === true && statusBody.response?.locked === false;
  }
  return result.ok && body?.status === true && body.response?.restoring === false
    && body.response.shuttingdown === false && body.response.complete === false;
}

// Returns one of the 64 pre-created default wallet addresses at random.
// Uses getaddress — does NOT create new key material (that would be newaddress).
export async function getReceiveAddress(): Promise<ReceiveAddress> {
  const result = await runMinimaPathCommand("getaddress");
  if (!result.ok) throw new Error(`Minima RPC error: HTTP ${result.status}`);
  const address = parseAddressResponse(result.body);
  const qrDataUrl = await QRCode.toDataURL(address.miniAddress, { type: "image/png", margin: 1 });
  return { ...address, qrDataUrl };
}

export async function sendPayment({ address, amount, tokenId = "0x00" }: SendPaymentRequest): Promise<SendPaymentResult> {
  if (!address.trim()) throw new Error("Address is required");
  if (!isMinimaAddress(address)) throw new Error("Address must be a valid Minima Mx or 0x address");
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Amount must be a positive number");
  const result = await runMinimaPathCommand(`send amount:${amount} address:${address} tokenid:${tokenId}`, 10_000);
  return parseSendResponse(result.body);
}

export async function getPaymentStatus(txpowId: string): Promise<PaymentStatus> {
  if (!isTxPowId(txpowId)) throw new Error("TxPoW ID must be a 0x hex value");
  const onchain = await runMinimaPathCommand(`txpow onchain:${txpowId}`);
  if (parseOnchainResponse(onchain.body).found) {
    return { txpowId, status: "confirmed", checkedAt: new Date().toISOString() };
  }
  const result = await runMinimaPathCommand(`txpow txpowid:${txpowId}`);
  return parsePaymentStatusResponse(result.body, txpowId);
}

// Restores wallet from a 24-word seed phrase via Minima restore RPC.
// The phrase must never be logged — do not pass it to recordAuditEvent detail.
export async function importWallet(phrase: string): Promise<ImportWalletResult> {
  const result = await runWalletReplacement(() => runMinimaPathCommand(`restore phrase:"${phrase}"`, 30_000));
  if (!result.ok) throw new Error(`Minima RPC error: HTTP ${result.status}`);
  return parseImportResponse(result.body);
}

export function clearWalletSendHistoryForDebug(): number {
  const result = db.prepare("DELETE FROM wallet_send_history").run();
  return result.changes;
}

/** `txpowId` is the pre-mined ID `send` returned; `transactionId` links the row to the mined TxPoW. */
export async function recordWalletSendHistory(input: {
  toAddress: string;
  tokenId: string;
  tokenName: string;
  amount: string;
  txpowId: string | null;
  transactionId: string | null;
  status: "submitted" | "failed";
  origin: "manual" | "automation";
}) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  // The payment is already sent; a fingerprint lookup failure must not lose the record.
  const walletFingerprint = await getWalletFingerprint().catch(() => null);
  db.prepare(`
    INSERT INTO wallet_send_history (
      id, created_at, from_account_label, from_account_address, to_address, token_id, token_name, amount, txpow_id, status,
      wallet_fingerprint, origin, transaction_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    createdAt,
    null,
    null,
    input.toAddress,
    input.tokenId,
    input.tokenName,
    input.amount,
    input.txpowId,
    input.status,
    walletFingerprint,
    input.origin,
    input.transactionId
  );
}
