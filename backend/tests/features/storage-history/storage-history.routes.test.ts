import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const mocks = vi.hoisted(() => ({ verifyCurrentPassword: vi.fn(), recordAuditEvent: vi.fn() }));

vi.mock("../../../src/features/minima/minima-backup.service.js", () => ({
  MinimaBackupError: class MinimaBackupError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  verifyCurrentPassword: mocks.verifyCurrentPassword,
}));

vi.mock("../../../src/features/auth/audit.service.js", () => ({ recordAuditEvent: mocks.recordAuditEvent }));

let teardown: () => void;
let app: express.Express;

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  const { storageHistoryRouter } = await import("../../../src/features/storage-history/storage-history.routes.js");
  app = express();
  app.use(express.json());
  app.use((_req, _res, next) => {
    _req.user = { id: "admin-1", displayName: "Admin", role: "admin", lastLogin: null, credentialType: "pin" };
    next();
  });
  app.use(storageHistoryRouter);
});

afterAll(() => teardown());

beforeEach(async () => {
  mocks.verifyCurrentPassword.mockReset();
  const { authRateLimiter, fileOperationRateLimiter } = await import("../../../src/features/auth/rate-limit.middleware.js");
  await authRateLimiter.resetKey("::ffff:127.0.0.1");
  await fileOperationRateLimiter.resetKey("::ffff:127.0.0.1");
});

describe("POST /export", () => {
  it("re-authenticates, audits, and sends a JSON attachment", async () => {
    const response = await request(app).post("/export").send({ currentPassword: "001234" });

    assert.equal(response.status, 200);
    expect(mocks.verifyCurrentPassword).toHaveBeenCalledWith("admin-1", "001234");
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith("storage_history.exported", { userId: "admin-1" });
    assert.match(response.headers["content-disposition"], /attachment; filename="edge-studio-history-/);
    assert.equal(response.body.format, "edge-studio-history");
  });

  it("limits failed credential checks before performing another export", async () => {
    const { MinimaBackupError } = await import("../../../src/features/minima/minima-backup.service.js");
    mocks.verifyCurrentPassword.mockRejectedValue(new MinimaBackupError("Invalid current credential", 401));
    for (let index = 0; index < 5; index += 1) {
      assert.equal((await request(app).post("/export").send({ currentPassword: "wrong" })).status, 401);
    }
    assert.equal((await request(app).post("/export").send({ currentPassword: "wrong" })).status, 429);
    assert.equal(mocks.verifyCurrentPassword.mock.calls.length, 5);
  });
});

describe("history file operation limit", () => {
  it("rejects imports and exports after the shared file limit without checking credentials", async () => {
    for (let index = 0; index < 30; index += 1) {
      assert.equal((await request(app).post("/imports")).status, 400);
    }
    assert.equal((await request(app).post("/imports")).status, 429);
    assert.equal((await request(app).post("/export").send({ currentPassword: "001234" })).status, 429);
    assert.equal(mocks.verifyCurrentPassword.mock.calls.length, 0);
    assert.equal((await request(app).get("/inventory")).status, 200);
  });
});
