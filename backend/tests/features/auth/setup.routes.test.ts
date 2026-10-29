import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import request from "supertest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let app: import("express").Express;
let db: import("better-sqlite3").Database;
let authRepository: typeof import("../../../src/features/auth/auth.repository.js");

beforeAll(async () => {
  ({ db, teardown } = await setupTestDatabase());
  authRepository = await import("../../../src/features/auth/auth.repository.js");
  const { createApp } = await import("../../../src/app.js");
  app = createApp();
});

afterAll(() => {
  teardown();
});

describe("public setup status", () => {
  it("returns null credential metadata before setup and prevents caching", async () => {
    const response = await request(app).get("/api/setup/status");

    assert.equal(response.status, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.deepEqual(response.body, {
      localAdminCreated: false,
      setupComplete: false,
      credentialType: null
    });
  });

  for (const credentialType of ["pin", "password"] as const) {
    it(`returns only status flags and stored ${credentialType} metadata without authentication`, async () => {
      const userId = authRepository.createUser({
        username: "admin",
        passwordHash: "private-hash",
        credentialType
      });
      try {
        const response = await request(app).get("/api/setup/status");

        assert.equal(response.status, 200);
        assert.equal(response.headers["cache-control"], "no-store");
        assert.deepEqual(response.body, {
          localAdminCreated: true,
          setupComplete: false,
          credentialType
        });
      } finally {
        db.prepare("DELETE FROM users WHERE id = ?").run(userId);
      }
    });
  }
});

describe("unknown setup routes", () => {
  it("leaves unrelated setup paths behind the global auth gate", async () => {
    const response = await request(app).post("/api/setup/not-a-route").send({});

    assert.equal(response.status, 401);
  });
});
