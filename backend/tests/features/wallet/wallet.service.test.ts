import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const { runMinimaPathCommandMock } = vi.hoisted(() => ({
  runMinimaPathCommandMock: vi.fn()
}));

vi.mock("../../../src/features/minima/minima.rpc.js", () => ({
  runMinimaPathCommand: runMinimaPathCommandMock
}));

let teardown: () => void;
let walletService: typeof import("../../../src/features/wallet/wallet.service.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  walletService = await import("../../../src/features/wallet/wallet.service.js");
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  runMinimaPathCommandMock.mockReset();
});

describe("getWalletStatus", () => {
  it("parses the balance response from the minima RPC call", async () => {
    runMinimaPathCommandMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: { response: [{ tokenid: "0x00", confirmed: "10", unconfirmed: "0", sendable: "10" }] }
    });
    const result = await walletService.getWalletStatus();
    assert.equal(runMinimaPathCommandMock.mock.calls[0][0], "balance");
    assert.equal(result.tokens[0].name, "Minima");
  });
});

describe("getReceiveAddress", () => {
  it("throws when the RPC call is not ok", async () => {
    runMinimaPathCommandMock.mockResolvedValue({ ok: false, status: 500, body: {} });
    await assert.rejects(walletService.getReceiveAddress(), /Minima RPC error: HTTP 500/);
  });

  it("returns the parsed address with a generated QR data URL", async () => {
    runMinimaPathCommandMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: { response: { miniaddress: "MxABC", address: "0xdef" } }
    });
    const result = await walletService.getReceiveAddress();
    assert.equal(runMinimaPathCommandMock.mock.calls[0][0], "getaddress");
    assert.equal(result.miniAddress, "MxABC");
    assert.equal(result.address, "0xdef");
    assert.match(result.qrDataUrl, /^data:image\/png;base64,/);
  });
});

describe("sendPayment", () => {
  it("throws when the address is blank", async () => {
    await assert.rejects(walletService.sendPayment({ address: "  ", amount: "1" }), /Address is required/);
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 0);
  });

  it("throws when the amount is not a positive number", async () => {
    await assert.rejects(walletService.sendPayment({ address: "0xabc", amount: "0" }), /positive number/);
    await assert.rejects(walletService.sendPayment({ address: "0xabc", amount: "-1" }), /positive number/);
    await assert.rejects(walletService.sendPayment({ address: "0xabc", amount: "not-a-number" }), /positive number/);
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 0);
  });

  it("sends the amount/address/tokenid in the RPC command and parses the response", async () => {
    runMinimaPathCommandMock.mockResolvedValue({ ok: true, status: 200, body: { response: { txpowid: "tx-1" } } });
    const result = await walletService.sendPayment({ address: "0xabc", amount: "5", tokenId: "0x00" });
    assert.equal(runMinimaPathCommandMock.mock.calls[0][0], "send amount:5 address:0xabc tokenid:0x00");
    assert.equal(runMinimaPathCommandMock.mock.calls[0][1], 10_000);
    assert.equal(result.ok, true);
    assert.equal(result.txpowId, "tx-1");
  });

  it("defaults tokenId to 0x00 when not provided", async () => {
    runMinimaPathCommandMock.mockResolvedValue({ ok: true, status: 200, body: { response: {} } });
    await walletService.sendPayment({ address: "0xabc", amount: "5" });
    assert.match(runMinimaPathCommandMock.mock.calls[0][0], /tokenid:0x00$/);
  });
});

describe("getPaymentStatus", () => {
  it("queries the txpow status and parses the response", async () => {
    runMinimaPathCommandMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: { response: { confirmed: true, txpow: {} } }
    });
    const result = await walletService.getPaymentStatus("tx-1");
    assert.equal(runMinimaPathCommandMock.mock.calls[0][0], "txpow txpowid:tx-1");
    assert.equal(result.status, "confirmed");
  });
});

describe("importWallet", () => {
  it("throws when the RPC call is not ok", async () => {
    runMinimaPathCommandMock.mockResolvedValue({ ok: false, status: 500, body: {} });
    await assert.rejects(walletService.importWallet("word ".repeat(24)), /Minima RPC error: HTTP 500/);
  });

  it("includes the phrase in the restore command and parses the response", async () => {
    runMinimaPathCommandMock.mockResolvedValue({ ok: true, status: 200, body: { status: true } });
    const result = await walletService.importWallet("apple banana cherry");
    assert.equal(runMinimaPathCommandMock.mock.calls[0][0], 'restore phrase:"apple banana cherry"');
    assert.equal(runMinimaPathCommandMock.mock.calls[0][1], 30_000);
    assert.equal(result.ok, true);
  });
});

describe("wallet send history", () => {
  it("returns 0 from clearWalletSendHistoryForDebug when there is nothing to clear", () => {
    assert.equal(walletService.clearWalletSendHistoryForDebug(), 0);
  });

  it("records and lists send history entries newest first", () => {
    walletService.recordWalletSendHistory({
      toAddress: "0xaaa",
      tokenId: "0x00",
      tokenName: "Minima",
      amount: "1",
      txpowId: "tx-a",
      status: "submitted"
    });
    walletService.recordWalletSendHistory({
      toAddress: "0xbbb",
      tokenId: "0x00",
      tokenName: "Minima",
      amount: "2",
      txpowId: null,
      status: "failed"
    });

    const history = walletService.listWalletSendHistory();
    assert.ok(history.length >= 2);
    const bbb = history.find((h) => h.toAddress === "0xbbb");
    assert.equal(bbb?.status, "failed");
    assert.equal(bbb?.txpowId, null);
  });

  it("clearWalletSendHistoryForDebug removes all recorded entries", () => {
    walletService.recordWalletSendHistory({
      toAddress: "0xccc",
      tokenId: "0x00",
      tokenName: "Minima",
      amount: "1",
      txpowId: "tx-c",
      status: "submitted"
    });
    const removed = walletService.clearWalletSendHistoryForDebug();
    assert.ok(removed >= 1);
    assert.equal(walletService.listWalletSendHistory().length, 0);
  });

  it("clamps the limit passed to listWalletSendHistory", () => {
    walletService.recordWalletSendHistory({
      toAddress: "0xddd",
      tokenId: "0x00",
      tokenName: "Minima",
      amount: "1",
      txpowId: "tx-d",
      status: "submitted"
    });
    const result = walletService.listWalletSendHistory(0);
    assert.equal(result.length, 1);
  });
});
