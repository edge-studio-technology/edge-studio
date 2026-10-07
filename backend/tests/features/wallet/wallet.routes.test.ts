import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const { sendPaymentMock, importWalletMock } = vi.hoisted(() => ({ sendPaymentMock: vi.fn(), importWalletMock: vi.fn() }));

vi.mock("../../../src/features/wallet/wallet.service.js", () => ({
  clearWalletSendHistoryForDebug: vi.fn(),
  getPaymentStatus: vi.fn(),
  getReceiveAddress: vi.fn(),
  getWalletStatus: vi.fn(),
  importWallet: importWalletMock,
  listWalletSendHistory: vi.fn(),
  recordWalletSendHistory: vi.fn(),
  sendPayment: sendPaymentMock
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
});
