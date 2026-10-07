import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const { runMinimaPathCommandMock, getContainerMock, inspectMock } = vi.hoisted(() => ({
  runMinimaPathCommandMock: vi.fn(), getContainerMock: vi.fn(), inspectMock: vi.fn()
}));

vi.mock("../../../src/features/status/docker.service.js", () => ({
  getComposeServiceContainer: getContainerMock, inspectContainer: inspectMock
}));

vi.mock("../../../src/features/minima/minima.rpc.js", () => ({
  runMinimaPathCommand: runMinimaPathCommandMock
}));

let teardown: () => void;
let walletService: typeof import("../../../src/features/wallet/wallet.service.js");
let repo: typeof import("../../../src/features/address-book/address-book.repository.js");
let db: import("better-sqlite3").Database;

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  repo = await import("../../../src/features/address-book/address-book.repository.js");
  walletService = await import("../../../src/features/wallet/wallet.service.js");
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  runMinimaPathCommandMock.mockReset();
  getContainerMock.mockReset();
  inspectMock.mockReset();
  db.prepare("DELETE FROM address_book").run();
  db.prepare("DELETE FROM settings WHERE key='address_book_local_wallet_verification'").run();
});

describe("wallet replacement readiness", () => {
  const started = Date.parse("2026-10-07T10:00:00Z");
  const revision = `replacement@${started}`;
  const missing = { status: false, error: "Command not found" };

  beforeEach(() => {
    runMinimaPathCommandMock.mockResolvedValueOnce({ ok: true, body: missing })
      .mockResolvedValue({ ok: true, body: { status: true, response: { locked: false } } });
    getContainerMock.mockResolvedValue({ Id: "minima" });
    inspectMock.mockResolvedValue({ State: { Running: true, StartedAt: "2026-10-07T10:00:01Z" } });
  });

  it("verifies legacy nodes only after a later node start and successful unlocked status", async () => {
    assert.equal(await walletService.isLocalWalletReadyForVerification(revision), true);
    assert.deepEqual(runMinimaPathCommandMock.mock.calls.map(call => call[0]), ["checkrestore", "status"]);
    assert.equal(getContainerMock.mock.calls[0][0], "minima");
  });

  it("uses supported restore flags without requiring a legacy restart timestamp", async () => {
    runMinimaPathCommandMock.mockReset().mockResolvedValue({ ok: true, body: {
      status: true, response: { restoring: false, shuttingdown: false, complete: false }
    } });
    assert.equal(await walletService.isLocalWalletReadyForVerification("old-revision"), true);
    assert.equal(getContainerMock.mock.calls.length, 0);
  });

  it("propagates Docker discovery failure so initialization can retry without re-enabling a recipient", async () => {
    getContainerMock.mockRejectedValue(new Error("Docker unavailable"));
    await assert.rejects(walletService.isLocalWalletReadyForVerification(revision), /Docker unavailable/);
  });

  for (const state of [
    { Running: true, StartedAt: "2026-10-07T09:59:59Z" },
    { Running: true, StartedAt: "2026-10-07T10:00:00Z" },
    { Running: true, StartedAt: "invalid" },
    { Running: false, StartedAt: "2026-10-07T10:00:01Z" }
  ]) {
    it(`keeps legacy recipients blocked for node state ${JSON.stringify(state)}`, async () => {
      inspectMock.mockResolvedValue({ State: state });
      assert.equal(await walletService.isLocalWalletReadyForVerification(revision), false);
      assert.equal(runMinimaPathCommandMock.mock.calls.length, 1);
    });
  }

  it("does not infer readiness when the dispatch timestamp or container is missing", async () => {
    assert.equal(await walletService.isLocalWalletReadyForVerification("old-revision"), false);
    runMinimaPathCommandMock.mockResolvedValueOnce({ ok: true, body: missing });
    getContainerMock.mockResolvedValue(null);
    assert.equal(await walletService.isLocalWalletReadyForVerification(revision), false);
  });

  for (const result of [
    { ok: false, body: missing },
    { ok: true, body: { status: false, error: "Restoring" } },
    { ok: true, body: { status: true, response: {} } },
    { ok: true, body: { status: true, response: { restoring: true, shuttingdown: false, complete: false } } }
  ]) {
    it(`does not fall back for unrelated failure or malformed supported state ${JSON.stringify(result)}`, async () => {
      runMinimaPathCommandMock.mockReset().mockResolvedValue(result);
      assert.equal(await walletService.isLocalWalletReadyForVerification(revision), false);
      assert.equal(getContainerMock.mock.calls.length, 0);
    });
  }

  for (const result of [
    { ok: false, body: { status: true, response: { locked: false } } },
    { ok: true, body: { status: false, response: { locked: false } } },
    { ok: true, body: { status: true, response: { locked: true } } },
    { ok: true, body: { status: true, response: {} } }
  ]) {
    it(`rejects unsafe status after a legacy node restart ${JSON.stringify(result)}`, async () => {
      runMinimaPathCommandMock.mockResolvedValueOnce(result);
      assert.equal(await walletService.isLocalWalletReadyForVerification(revision), false);
    });
  }
});

describe("wallet import recipient protection", () => {
  it("makes the local recipient unavailable before seed import dispatch and preserves manual copies", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    const manual = repo.insertAddressBookEntry({ label: "Mine", address: local.address, notes: null });
    runMinimaPathCommandMock.mockImplementation(async () => {
      assert.throws(() => repo.getAddressBookPaymentRecipient(local.id), /awaiting/);
      assert.deepEqual(repo.getAddressBookPaymentRecipient(manual.id), manual);
      return { ok: true, status: 200, body: { status: true } };
    });
    await walletService.importWallet("test seed");
    assert.equal(repo.getLocalAddressBookEntry()!.isLocalDevicePending, true);
  });
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

describe("getLocalWalletAddresses", () => {
  it("rejects transport failure even when the body claims RPC success", async () => {
    runMinimaPathCommandMock.mockResolvedValue({ ok: false, status: 503, body: { status: true, response: [] } });
    await assert.rejects(walletService.getLocalWalletAddresses(), /Minima RPC error: HTTP 503/);
    assert.equal(runMinimaPathCommandMock.mock.calls[0][0], "scripts");
  });

  it("requires RPC success and returns only validated default receive addresses", async () => {
    const miniaddress = "MxG086U24F17MT50Y6VUPBPD6VJKTYVMR71WRSYURYUVZDN1VMG25FF39M0458A";
    runMinimaPathCommandMock.mockResolvedValueOnce({ ok: true, status: 200, body: { status: false, response: [] } });
    await assert.rejects(walletService.getLocalWalletAddresses(), /successful scripts response/);
    runMinimaPathCommandMock.mockResolvedValueOnce({ ok: true, status: 200, body: { status: true, response: [{
      address: "0xDE111E13DBA5054DFF657969BF3A76BFB6CE196F95F6EBEFE1B70FED0115EF1A",
      miniaddress, default: true, simple: true, publickey: "0xABCD", script: "RETURN SIGNEDBY(0xABCD)"
    }] } });
    assert.deepEqual(await walletService.getLocalWalletAddresses(), [miniaddress]);
  });
});

describe("sendPayment", () => {
  it("throws when the address is blank", async () => {
    await assert.rejects(walletService.sendPayment({ address: "  ", amount: "1" }), /Address is required/);
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 0);
  });

  it("rejects a malformed prefix-matching address before calling Minima RPC", async () => {
    await assert.rejects(
      walletService.sendPayment({ address: "0xnot-hex", amount: "1" }),
      /valid Minima Mx or 0x address/
    );
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
    const result = await walletService.sendPayment({ address: "0xabc", amount: "5", tokenId: "0x01" });
    assert.equal(runMinimaPathCommandMock.mock.calls[0][0], "send amount:5 address:0xabc tokenid:0x01");
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
