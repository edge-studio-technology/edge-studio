import { describe, expect, it } from "vitest";
import {
  counterpartyLabel,
  DEFAULT_WALLET_HISTORY_FILTERS,
  emptyWalletHistoryPage,
  isCustomRangeInvalid,
  signedAmountLabel,
  walletHistoryQuery,
  type WalletHistoryFilters,
} from "../../../src/features/wallet/walletHistory";

// Local time, so the expectations hold in any test time zone.
const NOW = new Date(2026, 9, 9, 15, 30);

function filters(overrides: Partial<WalletHistoryFilters> = {}): WalletHistoryFilters {
  return { ...DEFAULT_WALLET_HISTORY_FILTERS, ...overrides };
}

describe("walletHistoryQuery", () => {
  it("omits empty filters", () => {
    expect(walletHistoryQuery(filters({ q: "  " }), NOW)).toEqual({
      page: 1,
      pageSize: 10,
      status: undefined,
      direction: undefined,
      q: undefined,
      from: undefined,
      to: undefined,
    });
  });

  it("passes status, direction, trimmed search, and paging", () => {
    expect(walletHistoryQuery(filters({ page: 3, pageSize: 50, status: "failed", direction: "out", q: " Mx1 " }), NOW)).toMatchObject({
      page: 3,
      pageSize: 50,
      status: "failed",
      direction: "out",
      q: "Mx1",
    });
  });

  it.each([
    ["today", new Date(2026, 9, 9)],
    ["7d", new Date(2026, 9, 3)],
    ["30d", new Date(2026, 8, 10)],
    ["month", new Date(2026, 9, 1)],
  ] as const)("starts the %s preset at local midnight with no end", (datePreset, from) => {
    expect(walletHistoryQuery(filters({ datePreset }), NOW)).toMatchObject({ from: from.toISOString(), to: undefined });
  });

  it("makes a custom range inclusive of both local days", () => {
    expect(walletHistoryQuery(filters({ datePreset: "custom", customFrom: "2026-08-01", customTo: "2026-08-31" }), NOW)).toMatchObject({
      from: new Date(2026, 7, 1).toISOString(),
      to: new Date(2026, 8, 1).toISOString(),
    });
  });

  it("allows an open-ended custom range and ignores malformed dates", () => {
    expect(walletHistoryQuery(filters({ datePreset: "custom", customFrom: "", customTo: "2026-08-31" }), NOW)).toMatchObject({
      from: undefined,
      to: new Date(2026, 8, 1).toISOString(),
    });
    expect(walletHistoryQuery(filters({ datePreset: "custom", customFrom: "08/01/2026" }), NOW)).toMatchObject({
      from: undefined,
      to: undefined,
    });
  });

  it("ignores custom dates under another preset", () => {
    expect(walletHistoryQuery(filters({ customFrom: "2026-08-01", customTo: "2026-08-31" }), NOW)).toMatchObject({
      from: undefined,
      to: undefined,
    });
  });
});

describe("isCustomRangeInvalid", () => {
  it("flags only a custom range that ends before it starts", () => {
    expect(isCustomRangeInvalid(filters({ datePreset: "custom", customFrom: "2026-08-02", customTo: "2026-08-01" }))).toBe(true);
    expect(isCustomRangeInvalid(filters({ datePreset: "custom", customFrom: "2026-08-01", customTo: "2026-08-01" }))).toBe(false);
    expect(isCustomRangeInvalid(filters({ datePreset: "custom", customFrom: "2026-08-02" }))).toBe(false);
    expect(isCustomRangeInvalid(filters({ customFrom: "2026-08-02", customTo: "2026-08-01" }))).toBe(false);
  });
});

describe("history display helpers", () => {
  it("signs amounts by direction", () => {
    expect(signedAmountLabel({ amount: "1.5", direction: "in" })).toBe("+1.5");
    expect(signedAmountLabel({ amount: "1.5", direction: "out" })).toBe("−1.5");
    expect(signedAmountLabel({ amount: "0", direction: "self" })).toBe("0");
  });

  it("prefers the contact label, then the address, and names self-transfers", () => {
    expect(counterpartyLabel({ direction: "in", counterparty: "Mx1", counterpartyLabel: "Alice" })).toBe("Alice");
    expect(counterpartyLabel({ direction: "out", counterparty: "Mx1", counterpartyLabel: null })).toBe("Mx1");
    expect(counterpartyLabel({ direction: "self", counterparty: null, counterpartyLabel: null })).toBe("This wallet");
  });

  it("starts with an empty page and no previous-wallet items", () => {
    expect(emptyWalletHistoryPage()).toEqual({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0, previousWalletItems: 0 });
  });
});
