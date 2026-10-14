import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const { sendPaymentMock, importWalletMock, recordWalletSendHistoryMock } = vi.hoisted(() => ({
  sendPaymentMock: vi.fn(), importWalletMock: vi.fn(), recordWalletSendHistoryMock: vi.fn()
}));

vi.mock("../../../src/features/wallet/wallet.service.js", () => ({
  clearWalletSendHistoryForDebug: vi.fn(),
  getPaymentStatus: vi.fn(),
  getReceiveAddress: vi.fn(),
  getWalletStatus: vi.fn(),
  importWallet: importWalletMock,
  recordWalletSendHistory: recordWalletSendHistoryMock,
  sendPayment: sendPaymentMock
}));
const { listWalletHistoryMock, clearPreviousMock, syncIfStaleMock, verifyCurrentPasswordMock } = vi.hoisted(() => ({
  listWalletHistoryMock: vi.fn(), clearPreviousMock: vi.fn(), syncIfStaleMock: vi.fn(), verifyCurrentPasswordMock: vi.fn()
}));
vi.mock("../../../src/features/wallet/wallet-history.service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/features/wallet/wallet-history.service.js")>()),
  listWalletHistory: listWalletHistoryMock,
  clearPreviousWalletHistory: clearPreviousMock,
  syncWalletHistoryIfStale: syncIfStaleMock
}));
vi.mock("../../../src/features/minima/minima-backup.service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/features/minima/minima-backup.service.js")>()),
  verifyCurrentPassword: verifyCurrentPasswordMock
}));
vi.mock("../../../src/features/auth/rate-limit.middleware.js", () => ({
  authRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next()
}));
const { recordAuditEventMock } = vi.hoisted(() => ({ recordAuditEventMock: vi.fn() }));
vi.mock("../../../src/features/auth/audit.service.js", () => ({ recordAuditEvent: recordAuditEventMock }));
vi.mock("../../../src/features/auth/auth.middleware.js", () => ({
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

let walletRouter: express.Router;
let repo: typeof import("../../../src/features/address-book/address-book.repository.js");
let db: import("better-sqlite3").Database;
let teardown: () => void;
beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;
  repo = await import("../../../src/features/address-book/address-book.repository.js");
  ({ walletRouter } = await import("../../../src/features/wallet/wallet.routes.js"));
});
afterAll(() => teardown());

function testApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/wallet", walletRouter);
  return app;
}

describe("wallet routes", () => {
  beforeEach(() => {
    sendPaymentMock.mockReset();
    importWalletMock.mockReset();
    recordAuditEventMock.mockReset();
    recordWalletSendHistoryMock.mockReset();
    listWalletHistoryMock.mockReset().mockResolvedValue({ items: [], total: 0, previousWalletItems: 0 });
    clearPreviousMock.mockReset();
    syncIfStaleMock.mockReset().mockResolvedValue(undefined);
    verifyCurrentPasswordMock.mockReset().mockResolvedValue(undefined);
    db.prepare("DELETE FROM address_book").run();
    db.prepare("DELETE FROM settings").run();
  });

  it("resolves a selected contact to its current address instead of a stale dialog address", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    repo.markLocalWalletVerificationPending();
    repo.reconcileLocalAddressBookEntry(["0x02"], repo.getLocalWalletVerificationRevision());
    sendPaymentMock.mockResolvedValue({ ok: true, status: "sent" });
    const response = await request(testApp()).post("/api/wallet/send-payment")
      .send({ address: local.address, recipientAddressBookId: local.id, amount: "1" });
    assert.equal(response.status, 200);
    assert.equal(sendPaymentMock.mock.calls[0][0].address, "0x02");
  });

  it("records a manual send with its transaction ID", async () => {
    sendPaymentMock.mockResolvedValue({ ok: true, status: "sent", txpowId: "0x01", transactionId: "0x02" });
    const response = await request(testApp()).post("/api/wallet/send-payment")
      .send({ address: "0x03", amount: "1" });
    assert.equal(response.status, 200);
    assert.deepEqual(recordWalletSendHistoryMock.mock.calls[0][0], {
      toAddress: "0x03", tokenId: "0x00", tokenName: "Minima", amount: "1",
      txpowId: "0x01", transactionId: "0x02", status: "submitted", origin: "manual", error: undefined
    });
  });

  it("records a failed manual send with Minima's message", async () => {
    sendPaymentMock.mockResolvedValue({
      ok: false, status: "failed", txpowId: null, transactionId: null, message: "Insufficient funds.. you only have 1 require:5"
    });
    const response = await request(testApp()).post("/api/wallet/send-payment")
      .send({ address: "0x03", amount: "5" });
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, false);
    assert.deepEqual(recordWalletSendHistoryMock.mock.calls[0][0], {
      toAddress: "0x03", tokenId: "0x00", tokenName: "Minima", amount: "5",
      txpowId: null, transactionId: null, status: "failed", origin: "manual",
      error: "Insufficient funds.. you only have 1 require:5"
    });
  });

  it("blocks pending local recipients without blocking manual copies or external addresses", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    const manual = repo.insertAddressBookEntry({ label: "Mine", address: local.address, notes: null });
    repo.markLocalWalletVerificationPending();
    const response = await request(testApp()).post("/api/wallet/send-payment")
      .send({ address: local.address, recipientAddressBookId: local.id, amount: "1" });
    assert.equal(response.status, 409);
    assert.match(response.body.error, /awaiting wallet verification/);
    assert.equal(sendPaymentMock.mock.calls.length, 0);
    sendPaymentMock.mockResolvedValue({ ok: true, status: "sent" });
    for (const recipientAddressBookId of [manual.id, undefined]) {
      const sent = await request(testApp()).post("/api/wallet/send-payment")
        .send({ address: local.address, recipientAddressBookId, amount: "1" });
      assert.equal(sent.status, 200);
    }
    assert.equal(sendPaymentMock.mock.calls.length, 2);
  });

  it("rejects a missing contact ID without falling back to the supplied address", async () => {
    const response = await request(testApp()).post("/api/wallet/send-payment")
      .send({ address: "0x01", recipientAddressBookId: "missing", amount: "1" });
    assert.equal(response.status, 409);
    assert.equal(sendPaymentMock.mock.calls.length, 0);
  });

  it("rejects a malformed prefix-matching recipient before calling sendPayment", async () => {
    const response = await request(testApp())
      .post("/api/wallet/send-payment")
      .send({ address: "0xnot-hex", amount: "1" });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /valid Minima Mx or 0x address/);
    assert.equal(sendPaymentMock.mock.calls.length, 0);
  });

  it("rejects a non-hex TxPoW ID before it reaches the Minima command", async () => {
    const response = await request(testApp()).get(`/api/wallet/payment-status/${encodeURIComponent("0xAB max:1")}`);
    assert.equal(response.status, 400);
    assert.match(response.body.error, /txpowid must be a 0x hex value/);
  });

  it("never echoes the imported seed phrase back to the client", async () => {
    const phrase = "canary alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo";
    importWalletMock.mockResolvedValue({ ok: true, message: "Restore complete" });

    const response = await request(testApp()).post("/api/wallet/import").send({ phrase });

    assert.equal(response.status, 200);
    assert.equal(importWalletMock.mock.calls[0][0], phrase);
    assert.equal(response.text.includes("canary"), false, `seed phrase in response body: ${response.text}`);
    assert.equal(JSON.stringify(recordAuditEventMock.mock.calls).includes("canary"), false, "seed phrase in audit event");
  });

  it("never echoes the imported seed phrase back in an import failure", async () => {
    const phrase = "canary alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo";
    importWalletMock.mockRejectedValue(new Error(`Minima RPC error for restore phrase:"${phrase}"`));

    const response = await request(testApp()).post("/api/wallet/import").send({ phrase });

    assert.equal(response.status, 502);
    // The upstream message still reaches the client — only the phrase argument is redacted.
    assert.match(response.body.error, /Minima RPC error/);
    assert.equal(response.text.includes("canary"), false, `seed phrase in error body: ${response.text}`);
  });

  it("syncs, then returns a page of history with the parsed filters", async () => {
    const item = { id: "0x0A:0x00", direction: "in" };
    listWalletHistoryMock.mockResolvedValue({ items: [item], total: 26, previousWalletItems: 2 });

    const response = await request(testApp()).get("/api/wallet/history")
      .query({ page: "2", pageSize: "25", status: "pending", direction: "in", q: "Mx", from: "2026-10-01T00:00:00Z", to: "2026-10-02T00:00:00+02:00" });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { items: [item], page: 2, pageSize: 25, total: 26, totalPages: 2, previousWalletItems: 2 });
    assert.equal(syncIfStaleMock.mock.calls.length, 1);
    assert.deepEqual(listWalletHistoryMock.mock.calls[0][0], {
      page: 2, pageSize: 25, status: "pending", q: "Mx", direction: "in",
      fromMillis: Date.parse("2026-10-01T00:00:00Z"), toMillis: Date.parse("2026-10-01T22:00:00Z")
    });
  });

  for (const [query, field] of [
    [{ status: "submitted" }, "status"],
    [{ direction: "sideways" }, "direction"],
    [{ from: "2026-10-01" }, "from"],
    [{ to: "yesterday" }, "to"],
    [{ from: "2026-10-02T00:00:00Z", to: "2026-10-01T00:00:00Z" }, "from"]
  ] as const) {
    it(`rejects an invalid ${field} filter (${JSON.stringify(query)})`, async () => {
      const response = await request(testApp()).get("/api/wallet/history").query(query);
      assert.equal(response.status, 400);
      assert.equal(listWalletHistoryMock.mock.calls.length, 0);
    });
  }

  it("clears previous-wallet history after re-authentication and audits the count", async () => {
    clearPreviousMock.mockResolvedValue(3);
    const response = await request(testApp()).post("/api/wallet/history/clear-previous").send({ currentPassword: "123123" });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { deleted: 3 });
    assert.equal(verifyCurrentPasswordMock.mock.calls[0][1], "123123");
    assert.deepEqual(recordAuditEventMock.mock.calls[0], ["wallet.history.clear_previous", { userId: undefined, detail: JSON.stringify({ deleted: 3 }) }]);
  });

  it("rejects a wrong credential as invalid_credential without clearing", async () => {
    const { MinimaBackupError } = await import("../../../src/features/minima/minima-backup.service.js");
    verifyCurrentPasswordMock.mockRejectedValue(new MinimaBackupError("Invalid current credential", 401));
    const response = await request(testApp()).post("/api/wallet/history/clear-previous").send({ currentPassword: "nope" });
    assert.equal(response.status, 401);
    assert.equal(response.body.errorCode, "invalid_credential");
    assert.equal(clearPreviousMock.mock.calls.length, 0);
  });

  it("returns 409 during a wallet replacement and 502 when the wallet cannot be read", async () => {
    const { WalletReplacementBusyError } = await import("../../../src/features/wallet/wallet-history.service.js");
    clearPreviousMock.mockRejectedValueOnce(new WalletReplacementBusyError()).mockRejectedValueOnce(new Error("Minima RPC error: HTTP 500"));
    const busy = await request(testApp()).post("/api/wallet/history/clear-previous").send({ currentPassword: "123123" });
    const down = await request(testApp()).post("/api/wallet/history/clear-previous").send({ currentPassword: "123123" });
    assert.deepEqual([busy.status, down.status], [409, 502]);
    assert.equal(recordAuditEventMock.mock.calls.length, 0);
  });
});
