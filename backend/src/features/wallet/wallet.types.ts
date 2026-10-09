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
  miniAddress: string;  // Mx… — Minima native format; use this for sharing/display
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
  /** Stable across mining, unlike the pre-mined `txpowId` `send` returns; links the send log to chain rows. */
  transactionId: string | null;
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

export const WALLET_HISTORY_STATUSES = ["pending", "confirmed", "failed"] as const;
export type WalletHistoryStatus = (typeof WALLET_HISTORY_STATUSES)[number];

/** One row of Wallet history: a synced chain movement, or an app send not seen on chain yet. */
export type WalletHistoryItem = {
  id: string;
  direction: WalletHistoryDirection;
  status: WalletHistoryStatus;
  /** Unsigned decimal string; `direction` carries the sign. */
  amount: string;
  tokenId: string;
  tokenName: string;
  counterparty: string | null;
  /** Address-book label of `counterparty`, when it is a saved contact. */
  counterpartyLabel: string | null;
  /** TxPoW time for chain rows, send time for unsynced sends. */
  time: string;
  /** Mined TxPoW ID; null for sends not seen on chain. */
  txpowId: string | null;
  transactionId: string | null;
  block: number | null;
  /** Blocks on top of `block` at read time. */
  confirmations: number | null;
  confirmedAt: string | null;
  origin: "manual" | "automation" | null;
  /** Minima's failure message for a failed send; null otherwise or when not recorded. */
  error: string | null;
  isPreviousWallet: boolean;
};

export type WalletHistoryQuery = {
  page: number;
  pageSize: number;
  status?: WalletHistoryStatus;
  q?: string;
  direction?: WalletHistoryDirection;
  /** Inclusive, epoch milliseconds. */
  fromMillis?: number;
  /** Exclusive, epoch milliseconds. */
  toMillis?: number;
};

/** One token movement of one relevant TxPoW, derived from Minima's `history` command. */
export type ChainHistoryEntry = {
  txpowId: string;
  transactionId: string | null;
  tokenId: string;
  tokenName: string;
  amount: string;
  direction: WalletHistoryDirection;
  timeMillis: number;
  counterparty: string | null;
};

export type TxPowOnChain =
  | { found: false }
  | { found: true; block: number; blockId: string; confirmations: number };
