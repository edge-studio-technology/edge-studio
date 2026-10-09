import { getJson, postJson } from "../../lib/api";
import { buildListQueryString } from "../../lib/paginated";
import type {
  ImportWalletResult,
  PaymentStatus,
  ReceiveAddress,
  SendPaymentRequest,
  SendPaymentResult,
  WalletHistoryPage,
  WalletHistoryQuery,
  WalletStatus,
} from "./walletTypes";

export function getWalletStatus() {
  return getJson<WalletStatus>("/api/wallet");
}

export function getReceiveAddress() {
  return postJson<ReceiveAddress>("/api/wallet/receive-address");
}

export function sendPayment(body: SendPaymentRequest) {
  return postJson<SendPaymentResult>("/api/wallet/send-payment", body);
}

export function getPaymentStatus(txpowId: string) {
  return getJson<PaymentStatus>(`/api/wallet/payment-status/${encodeURIComponent(txpowId)}`);
}

export function importWallet(phrase: string) {
  return postJson<ImportWalletResult>("/api/wallet/import", { phrase });
}

export function clearWalletHistoryForDebug() {
  return postJson<{ ok: boolean; deleted: number }>("/api/wallet/debug/clear-wallet-history");
}

export function listWalletHistory({ direction, from, to, ...listQuery }: WalletHistoryQuery = {}) {
  const search = new URLSearchParams(buildListQueryString(listQuery));
  if (direction) search.set("direction", direction);
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const value = search.toString();
  return getJson<WalletHistoryPage>(`/api/wallet/history${value ? `?${value}` : ""}`);
}

export function clearPreviousWalletHistory(currentPassword: string) {
  return postJson<{ deleted: number }>("/api/wallet/history/clear-previous", { currentPassword });
}
