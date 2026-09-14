import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import request from "supertest";
import { setupTestDatabase } from "./helpers/testDatabase.js";

let teardown: () => void;
let app: import("express").Express;

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  const { createApp } = await import("../src/app.js");
  app = createApp();
});

afterAll(() => {
  teardown();
});

// Every path below `app.use(requireAuth)` in src/app.ts is protected by that single
// global gate, regardless of whether the exact method/path matches a real route
// handler — requireAuth runs and short-circuits before Express attempts route
// matching. So a bare GET against each mounted router's prefix is enough to prove
// that router sits behind the gate; it does not need to be a real endpoint.
const protectedPrefixes = [
  "/api/auth",
  "/api/user",
  "/api/status",
  "/api/minima",
  "/api/integritas",
  "/api/data-sources",
  "/api/data-reads",
  "/api/automation",
  "/api/feedback",
  "/api/files",
  "/api/wallet",
  "/api/wallet/address-book",
  "/api/tokens",
  "/api/debug"
];

describe("app 401 smoke test", () => {
  describe("protected routes reject requests without a session cookie", () => {
    for (const prefix of protectedPrefixes) {
      it(`GET ${prefix} -> 401`, async () => {
        const response = await request(app).get(prefix);
        assert.equal(response.status, 401);
      });
    }
  });

  describe("public routes stay reachable without a session cookie", () => {
    it("GET /api/health does not require auth", async () => {
      const response = await request(app).get("/api/health");
      assert.notEqual(response.status, 401);
    });

    it("GET /api/setup/status does not require auth", async () => {
      const response = await request(app).get("/api/setup/status");
      assert.notEqual(response.status, 401);
    });

    it("POST /api/setup/complete does not require auth", async () => {
      const response = await request(app).post("/api/setup/complete").send({});
      assert.notEqual(response.status, 401);
    });

    it("POST /api/auth/login does not require auth", async () => {
      // Login itself legitimately responds 401 on bad credentials, so status
      // alone can't distinguish that from requireAuth's gate (also 401) — assert
      // on the body instead: requireAuth's default message is "Unauthorized",
      // login's credential-check failure message is "Invalid credentials".
      const response = await request(app).post("/api/auth/login").send({});
      assert.equal(response.status, 401);
      assert.equal(response.body.error, "Invalid credentials");
    });

    it("POST /api/data-source-webhooks/:token does not require auth", async () => {
      const response = await request(app).post("/api/data-source-webhooks/nonexistent-token").send({});
      assert.notEqual(response.status, 401);
    });
  });
});
