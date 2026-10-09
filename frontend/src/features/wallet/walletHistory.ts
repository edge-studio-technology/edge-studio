import type { Tone } from "../../app/types";
import { DEFAULT_PAGE_SIZE_OPTIONS, emptyPaginatedPage } from "../../lib/paginated";
import { formatMinimaAmount } from "../../lib/format";
import type {
  WalletHistoryDirection,
  WalletHistoryItem,
  WalletHistoryPage,
  WalletHistoryQuery,
  WalletHistoryStatus,
} from "./walletTypes";

export type WalletHistoryDatePreset = "" | "today" | "7d" | "30d" | "month" | "custom";

export type WalletHistoryFilters = {
  page: number;
  pageSize: number;
  status: "" | WalletHistoryStatus;
  direction: "" | WalletHistoryDirection;
  q: string;
  datePreset: WalletHistoryDatePreset;
  /** Local `yyyy-mm-dd`, inclusive; used by the custom preset only. */
  customFrom: string;
  customTo: string;
};

export const DEFAULT_WALLET_HISTORY_FILTERS: WalletHistoryFilters = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE_OPTIONS[0],
  status: "",
  direction: "",
  q: "",
  datePreset: "",
  customFrom: "",
  customTo: "",
};

export function emptyWalletHistoryPage(): WalletHistoryPage {
  return { ...emptyPaginatedPage<WalletHistoryItem>(DEFAULT_WALLET_HISTORY_FILTERS.pageSize), previousWalletItems: 0 };
}

export const WALLET_HISTORY_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "failed", label: "Failed" },
] as const;

export const WALLET_HISTORY_DIRECTION_OPTIONS = [
  { value: "", label: "All" },
  { value: "in", label: "Received" },
  { value: "out", label: "Sent" },
  { value: "self", label: "Self" },
] as const;

export const WALLET_HISTORY_DATE_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
] as const;

export const DIRECTION_LABEL: Record<WalletHistoryDirection, string> = {
  in: "Received",
  out: "Sent",
  self: "Self",
};

export const STATUS_LABEL: Record<WalletHistoryStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  failed: "Failed",
};

export const STATUS_TONE: Record<WalletHistoryStatus, Tone> = {
  pending: "warn",
  confirmed: "good",
  failed: "error",
};

export const ORIGIN_LABEL: Record<NonNullable<WalletHistoryItem["origin"]>, string> = {
  manual: "Manual",
  automation: "Automation",
};

export function signedAmountLabel(item: Pick<WalletHistoryItem, "amount" | "direction">) {
  const amount = formatMinimaAmount(item.amount, 12);
  if (item.direction === "in") return `+${amount}`;
  if (item.direction === "out") return `−${amount}`;
  return amount;
}

export function counterpartyLabel(item: Pick<WalletHistoryItem, "counterparty" | "counterpartyLabel" | "direction">) {
  if (item.direction === "self") return "This wallet";
  return item.counterpartyLabel ?? item.counterparty;
}

export function isCustomRangeInvalid(filters: WalletHistoryFilters) {
  return filters.datePreset === "custom" && Boolean(filters.customFrom && filters.customTo) && filters.customFrom > filters.customTo;
}

function localDay(date: Date, offsetDays = 0) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays);
}

function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function dateBounds(filters: WalletHistoryFilters, now: Date): { from?: Date; to?: Date } {
  switch (filters.datePreset) {
    case "today":
      return { from: localDay(now) };
    case "7d":
      return { from: localDay(now, -6) };
    case "30d":
      return { from: localDay(now, -29) };
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1) };
    case "custom": {
      const from = parseLocalDate(filters.customFrom) ?? undefined;
      const toDay = parseLocalDate(filters.customTo);
      return { from, to: toDay ? localDay(toDay, 1) : undefined };
    }
    default:
      return {};
  }
}

export function walletHistoryQuery(filters: WalletHistoryFilters, now = new Date()): WalletHistoryQuery {
  const { from, to } = dateBounds(filters, now);
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    status: filters.status || undefined,
    direction: filters.direction || undefined,
    q: filters.q.trim() || undefined,
    from: from?.toISOString(),
    to: to?.toISOString(),
  };
}
