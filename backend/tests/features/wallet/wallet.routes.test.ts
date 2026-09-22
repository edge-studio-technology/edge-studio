import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { beforeEach, describe, it, vi } from "vitest";

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

const { walletRouter } = await import("../../../src/features/wallet/wallet.routes.js");

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
