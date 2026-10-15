import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

describe("POST /export", () => {
  it("re-authenticates, audits, and sends a JSON attachment", async () => {
    const response = await request(app).post("/export").send({ currentPassword: "001234" });

    assert.equal(response.status, 200);
    expect(mocks.verifyCurrentPassword).toHaveBeenCalledWith("admin-1", "001234");
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith("storage_history.exported", { userId: "admin-1" });
    assert.match(response.headers["content-disposition"], /attachment; filename="edge-studio-history-/);
    assert.equal(response.body.format, "edge-studio-history");
  });
});
