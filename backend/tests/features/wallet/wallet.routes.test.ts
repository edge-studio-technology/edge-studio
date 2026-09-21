import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { beforeEach, describe, it, vi } from "vitest";

const { sendPaymentMock } = vi.hoisted(() => ({ sendPaymentMock: vi.fn() }));

vi.mock("../../../src/features/wallet/wallet.service.js", () => ({
  clearWalletSendHistoryForDebug: vi.fn(),
  getPaymentStatus: vi.fn(),
  getReceiveAddress: vi.fn(),
  getWalletStatus: vi.fn(),
  importWallet: vi.fn(),
  listWalletSendHistory: vi.fn(),
  recordWalletSendHistory: vi.fn(),
  sendPayment: sendPaymentMock
}));
vi.mock("../../../src/features/auth/audit.service.js", () => ({ recordAuditEvent: vi.fn() }));
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
  beforeEach(() => sendPaymentMock.mockReset());

  it("rejects a malformed prefix-matching recipient before calling sendPayment", async () => {
    const response = await request(testApp())
      .post("/api/wallet/send-payment")
      .send({ address: "0xnot-hex", amount: "1" });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /valid Minima Mx or 0x address/);
    assert.equal(sendPaymentMock.mock.calls.length, 0);
  });
});
