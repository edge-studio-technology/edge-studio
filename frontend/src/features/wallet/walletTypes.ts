import type { ListQueryParams, PaginatedResponse } from "../../lib/paginated";

export type TokenBalance = {
  tokenId: string;
  name: string;
  confirmed: string;
  unconfirmed: string;
  sendable: string;
  isNative: boolean;
};

export type WalletStatus = {
  checkedAt: string;
  tokens: TokenBalance[];
};

export type ReceiveAddress = {
  miniAddress: string;  // Mx… — Minima native format; use this for display/sharing
  address: string;      // 0x… — hex format
  publicKey?: string;
  qrDataUrl: string;    // data:image/png;base64,… QR code encoding miniAddress
};

export type SendPaymentRequest = {
  recipientAddressBookId?: string;
  address: string;
  amount: string;
  tokenId?: string;
  tokenName?: string;
};

export type SendPaymentResult = {
  ok: boolean;
  txpowId: string | null;
  status: "pending" | "sent" | "failed";
  message?: string;
};

export type PaymentStatus = {
  txpowId: string;
  status: "pending" | "confirmed" | "failed" | "unknown";
  checkedAt: string;
};

export type ImportWalletResult = {
  ok: boolean;
  message: string;
};

export type WalletHistoryDirection = "in" | "out" | "self";
export type WalletHistoryStatus = "pending" | "confirmed" | "failed";

export type WalletHistoryItem = {
  id: string;
  direction: WalletHistoryDirection;
  status: WalletHistoryStatus;
  /** Unsigned decimal string; `direction` carries the sign. */
  amount: string;
  tokenId: string;
  tokenName: string;
  counterparty: string | null;
  counterpartyLabel: string | null;
  /** TxPoW time for chain rows, send time for sends not seen on chain. */
  time: string;
  txpowId: string | null;
  transactionId: string | null;
  block: number | null;
  confirmations: number | null;
  confirmedAt: string | null;
  origin: "manual" | "automation" | null;
  /** Minima's failure message for a failed send. */
  error: string | null;
  isPreviousWallet: boolean;
};

export type WalletHistoryPage = PaginatedResponse<WalletHistoryItem> & {
  previousWalletItems: number;
};

export type WalletHistoryQuery = ListQueryParams & {
  direction?: WalletHistoryDirection;
  /** Inclusive ISO instant. */
  from?: string;
  /** Exclusive ISO instant. */
  to?: string;
};
