import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it, vi } from "vitest";
import request from "supertest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";
import { currentToken } from "../../helpers/totp.js";

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
        totpSecretEncrypted: "private-totp-secret",
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

describe("TOTP setup routes with TOTP disabled", () => {
  for (const path of ["/api/setup/totp/init", "/api/setup/totp/verify"]) {
    it(`POST ${path} returns 404 before an admin exists`, async () => {
      const response = await request(app).post(path).send({});

      assert.equal(response.status, 404);

      const trailingSlashResponse = await request(app).post(`${path}/`).send({});
      assert.equal(trailingSlashResponse.status, 404);
    });
  }

  it("leaves unrelated setup paths behind the global auth gate", async () => {
    const response = await request(app).post("/api/setup/not-a-route").send({});

    assert.equal(response.status, 401);
  });
});

describe("TOTP setup routes with TOTP enabled", () => {
  let totpTeardown: () => void;
  let totpApp: import("express").Express;
  let previousDatabasePath: string | undefined;

  beforeAll(async () => {
    previousDatabasePath = process.env.DATABASE_PATH;
    vi.resetModules();
    vi.doMock("../../../src/features/auth/auth.constants.js", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../../../src/features/auth/auth.constants.js")>()),
      TOTP_ENABLED: true
    }));

    ({ teardown: totpTeardown } = await setupTestDatabase());
    const { createApp } = await import("../../../src/app.js");
    totpApp = createApp();
  });

  afterAll(() => {
    totpTeardown();
    vi.doUnmock("../../../src/features/auth/auth.constants.js");
    vi.resetModules();
    process.env.DATABASE_PATH = previousDatabasePath;
  });

  it("initializes enrollment before an admin exists", async () => {
    const response = await request(totpApp).post("/api/setup/totp/init").send({});

    assert.equal(response.status, 200);
    assert.match(response.body.secret, /^[A-Z2-7]{32}$/);
    assert.match(response.body.qrCodePngBase64, /^data:image\/png;base64,/);
  });

  it("verifies a valid enrollment token", async () => {
    const initResponse = await request(totpApp).post("/api/setup/totp/init").send({});
    assert.equal(initResponse.status, 200);

    const response = await request(totpApp)
      .post("/api/setup/totp/verify")
      .send({ totpToken: currentToken(initResponse.body.secret) });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { valid: true });
  });
});
