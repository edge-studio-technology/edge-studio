import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it, vi } from "vitest";
import request from "supertest";
import { setupTestDatabase } from "./helpers/testDatabase.js";

// A non-admin session, which `UserRole` cannot express today — the admin-gate matrix below
// needs one to tell requireRole's 403 apart from requireAuth's 401.
const VIEWER_TOKEN = "viewer-session-token";

vi.mock("../src/features/auth/session.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/features/auth/session.service.js")>();
  return {
    ...actual,
    validateSession: (token: string) =>
      token === VIEWER_TOKEN ? { id: "u-1", username: "viewer", role: "viewer" as unknown as "admin" } : null
  };
});

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

// The admin-gate matrix. `UserRole` has one member today, so this cannot be driven through a
// real login — it mounts the same routers behind a stub that sets a non-admin role, which is
// what a second role would look like. Listing every route here is the point: the gates were
// asymmetric on the same primitives (health vs. read, resync/config vs. peers/add), and the
// failure mode is a new route quietly shipping ungated.
const adminOnlyRoutes: [method: "get" | "post" | "patch" | "delete", path: string][] = [
  ["get", "/api/files"],
  ["get", "/api/data-sources/src-1/health"],
  ["post", "/api/data-sources/src-1/read"],
  ["post", "/api/data-sources"],
  ["post", "/api/minima/config"],
  ["post", "/api/minima/megammrsync/resync"],
  ["post", "/api/minima/peers/add"],
  ["post", "/api/minima/restart"],
  ["post", "/api/minima/console/run"],
  ["get", "/api/minima/console/whitelist"],
  ["post", "/api/minima/backups"],
  ["post", "/api/integritas/stamp"],
  ["post", "/api/integritas/stamp-file"],
  ["post", "/api/integritas/history/delete-selected"],
  ["post", "/api/integritas/history/rec-1/poll"],
  ["post", "/api/integritas/history/rec-1/verify"],
  ["post", "/api/automation/workflows"],
  ["post", "/api/wallet/send-payment"],
  ["post", "/api/tokens/create"]
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

  // requireAuth runs before any requireRole, so the non-admin case is driven by stubbing
  // session validation rather than by mounting the routers a second time.
  describe("admin-gated routes reject an authenticated non-admin", () => {
    for (const [method, path] of adminOnlyRoutes) {
      it(`${method.toUpperCase()} ${path} -> 403`, async () => {
        const response = await request(app)[method](path).set("Cookie", `session=${VIEWER_TOKEN}`);
        assert.equal(response.status, 403);
      });
    }
  });
});
