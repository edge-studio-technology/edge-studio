import { getCachedJson, getJson, postJson } from "../../lib/api";
import type { ReadOptions } from "../../lib/readCache";
import { buildListQueryString } from "../../lib/paginated";
import type {
  ReceiveAddress,
  SendPaymentRequest,
  SendPaymentResult,
  WalletHistoryPage,
  WalletHistoryQuery,
  WalletStatus,
} from "./walletTypes";

export function getWalletStatus(options?: ReadOptions) {
  return options
    ? getJson<WalletStatus>("/api/wallet", options)
    : getJson<WalletStatus>("/api/wallet");
}

export function getReceiveAddress() {
  return postJson<ReceiveAddress>("/api/wallet/receive-address");
}

export function sendPayment(body: SendPaymentRequest) {
  return postJson<SendPaymentResult>("/api/wallet/send-payment", body);
}

function walletHistoryUrl({ direction, from, to, ...listQuery }: WalletHistoryQuery = {}) {
  const search = new URLSearchParams(buildListQueryString(listQuery));
  if (direction) search.set("direction", direction);
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const value = search.toString();
  return `/api/wallet/history${value ? `?${value}` : ""}`;
}

export function listWalletHistory(query: WalletHistoryQuery = {}, options?: ReadOptions) {
  return options
    ? getJson<WalletHistoryPage>(walletHistoryUrl(query), options)
    : getJson<WalletHistoryPage>(walletHistoryUrl(query));
}

export function getCachedWalletHistory(query: WalletHistoryQuery) {
  return getCachedJson<WalletHistoryPage>(walletHistoryUrl(query));
}

export function clearPreviousWalletHistory(currentPassword: string) {
  return postJson<{ deleted: number }>("/api/wallet/history/clear-previous", { currentPassword });
}
