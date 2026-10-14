import { describe, expect, it, vi } from "vitest";

const getJson = vi.fn();
const postJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
}));

import {
  clearWalletHistoryForDebug,
  getPaymentStatus,
  getReceiveAddress,
  getWalletStatus,
  importWallet,
  listWalletHistory,
  clearPreviousWalletHistory,
  sendPayment,
} from "../../../src/features/wallet/walletApi";

describe("walletApi", () => {
  it("getWalletStatus GETs the wallet endpoint", async () => {
    const response = { checkedAt: "2026-01-01T00:00:00Z", tokens: [] };
    getJson.mockResolvedValue(response);

    const result = await getWalletStatus();

    expect(getJson).toHaveBeenCalledWith("/api/wallet");
    expect(result).toBe(response);
  });

  it("getReceiveAddress POSTs to the receive-address endpoint with no body", async () => {
    const response = { miniAddress: "Mx1", address: "0x1", qrDataUrl: "data:image/png;base64,abc" };
    postJson.mockResolvedValue(response);

    const result = await getReceiveAddress();

    expect(postJson).toHaveBeenCalledWith("/api/wallet/receive-address");
    expect(result).toBe(response);
  });

  it("sendPayment POSTs the payment request body", async () => {
    const response = { ok: true, txpowId: "0xabc", status: "sent" as const };
    postJson.mockResolvedValue(response);

    const body = { address: "Mx2", amount: "1", tokenId: "0x00", tokenName: "Minima" };
    const result = await sendPayment(body);

    expect(postJson).toHaveBeenCalledWith("/api/wallet/send-payment", body);
    expect(result).toBe(response);
  });

  it("getPaymentStatus GETs the payment-status endpoint with an encoded txpowId", async () => {
    const response = { txpowId: "0x ab", status: "confirmed" as const, checkedAt: "2026-01-01T00:00:00Z" };
    getJson.mockResolvedValue(response);

    const result = await getPaymentStatus("0x ab");

    expect(getJson).toHaveBeenCalledWith("/api/wallet/payment-status/0x%20ab");
    expect(result).toBe(response);
  });

  it("importWallet POSTs the seed phrase", async () => {
    const response = { ok: true, message: "Wallet imported." };
    postJson.mockResolvedValue(response);

    const result = await importWallet("word1 word2 word3");

    expect(postJson).toHaveBeenCalledWith("/api/wallet/import", { phrase: "word1 word2 word3" });
    expect(result).toBe(response);
  });

  it("clearWalletHistoryForDebug POSTs to the debug clear endpoint", async () => {
    const response = { ok: true, deleted: 3 };
    postJson.mockResolvedValue(response);

    const result = await clearWalletHistoryForDebug();

    expect(postJson).toHaveBeenCalledWith("/api/wallet/debug/clear-wallet-history");
    expect(result).toBe(response);
  });

  it("listWalletHistory GETs the history endpoint without a query by default", async () => {
    const response = { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0, previousWalletItems: 0 };
    getJson.mockResolvedValue(response);

    const result = await listWalletHistory();

    expect(getJson).toHaveBeenCalledWith("/api/wallet/history");
    expect(result).toBe(response);
  });

  it("listWalletHistory sends paging, filters, and the date range", async () => {
    getJson.mockResolvedValue({});

    await listWalletHistory({
      page: 2,
      pageSize: 10,
      status: "pending",
      q: "Mx1",
      direction: "in",
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-02T00:00:00.000Z",
    });

    expect(getJson).toHaveBeenCalledWith(
      "/api/wallet/history?page=2&pageSize=10&status=pending&q=Mx1&direction=in&from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-02T00%3A00%3A00.000Z",
    );
  });

  it("clearPreviousWalletHistory POSTs the current credential", async () => {
    postJson.mockResolvedValue({ deleted: 2 });

    const result = await clearPreviousWalletHistory("123456");

    expect(postJson).toHaveBeenCalledWith("/api/wallet/history/clear-previous", { currentPassword: "123456" });
    expect(result).toEqual({ deleted: 2 });
  });
});
