import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it, vi } from "vitest";
import request from "supertest";
import { hashPassword } from "../../../src/features/auth/password.service.js";
import { setupTestDatabase } from "../../helpers/testDatabase.js";
import { currentToken } from "../../helpers/totp.js";

type AuthRepository = typeof import("../../../src/features/auth/auth.repository.js");

let teardown: () => void;
let app: import("express").Express;
let createUser: AuthRepository["createUser"];
let findTheUser: AuthRepository["findTheUser"];
let updateUserPassword: AuthRepository["updateUserPassword"];

const PASSWORD = "Abcdef1!";

/** `Set-Cookie` for a cleared cookie: empty value plus an expiry in the past. */
function clearsSessionCookie(header: string | string[] | undefined) {
  const cookies = header === undefined ? [] : Array.isArray(header) ? header : [header];
  const cookie = cookies.find((value) => value.startsWith("session="));
  if (!cookie) return false;
  const [, value] = /^session=([^;]*)/.exec(cookie) ?? [];
  const [, expires] = /Expires=([^;]+)/i.exec(cookie) ?? [];
  return value === "" && !!expires && new Date(expires).getTime() < Date.now();
}

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;

  ({ createUser, findTheUser, updateUserPassword } = await import(
    "../../../src/features/auth/auth.repository.js"
  ));
  const { createApp } = await import("../../../src/app.js");
  app = createApp();

  createUser({
    username: "admin",
    passwordHash: await hashPassword(PASSWORD),
    totpSecretEncrypted: "irrelevant-secret",
    credentialType: "password"
  });
});

afterAll(() => {
  teardown();
});

async function loginAgent(password = PASSWORD) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ password });
  assert.equal(response.status, 200);
  return agent;
}

describe("POST /api/auth/settings/password", () => {
  it("clears the session cookie and leaves the caller logged out", async () => {
    const agent = await loginAgent();
    assert.equal((await agent.get("/api/auth/me")).status, 200);

    const response = await agent
      .post("/api/auth/settings/password")
      .send({ currentPassword: PASSWORD, newPassword: "Newpass1!" });

    assert.equal(response.status, 200);
    assert.equal(response.body.sessionsRevoked, true);
    assert.equal(clearsSessionCookie(response.headers["set-cookie"]), true);
    assert.equal((await agent.get("/api/auth/me")).status, 401);
  });

  it("does not clear the cookie when the change is rejected", async () => {
    updateUserPassword(findTheUser()!.id, await hashPassword(PASSWORD), "password");
    const agent = await loginAgent();

    const response = await agent
      .post("/api/auth/settings/password")
      .send({ currentPassword: "wrong-password", newPassword: "Newpass1!" });

    assert.equal(response.status, 401);
    assert.equal(response.headers["set-cookie"], undefined);
    assert.equal((await agent.get("/api/auth/me")).status, 200);
  });
});

describe("TOTP settings routes with TOTP disabled", () => {
  for (const path of ["/api/auth/settings/totp/init", "/api/auth/settings/totp/verify"]) {
    it(`POST ${path} returns 404 for an authenticated admin`, async () => {
      const unauthenticatedResponse = await request(app).post(path).send({});
      assert.equal(unauthenticatedResponse.status, 401);

      const agent = await loginAgent();

      const response = await agent.post(path).send({});

      assert.equal(response.status, 404);
      assert.equal((await agent.get("/api/auth/me")).status, 200);
    });
  }
});

describe("TOTP settings routes with TOTP enabled", () => {
  const TOTP_PASSWORD = "Totproute1!";
  let totpTeardown: () => void;
  let totpApp: import("express").Express;
  let currentSecret: string;
  let previousDatabasePath: string | undefined;

  beforeAll(async () => {
    previousDatabasePath = process.env.DATABASE_PATH;
    vi.resetModules();
    vi.doMock("../../../src/features/auth/auth.constants.js", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../../../src/features/auth/auth.constants.js")>()),
      TOTP_ENABLED: true
    }));

    ({ teardown: totpTeardown } = await setupTestDatabase());
    const authRepository = await import("../../../src/features/auth/auth.repository.js");
    const enabledTotpService = await import("../../../src/features/auth/totp.service.js");
    const enabledPasswordService = await import("../../../src/features/auth/password.service.js");
    const { createApp } = await import("../../../src/app.js");

    currentSecret = enabledTotpService.generateSecret();
    authRepository.createUser({
      username: "admin",
      passwordHash: await enabledPasswordService.hashPassword(TOTP_PASSWORD),
      totpSecretEncrypted: enabledTotpService.encryptTotpSecret(currentSecret),
      credentialType: "password"
    });
    totpApp = createApp();
  });

  afterAll(() => {
    totpTeardown();
    vi.doUnmock("../../../src/features/auth/auth.constants.js");
    vi.resetModules();
    process.env.DATABASE_PATH = previousDatabasePath;
  });

  async function loginTotpAgent() {
    const agent = request.agent(totpApp);
    const response = await agent
      .post("/api/auth/login")
      .send({ password: TOTP_PASSWORD, totpToken: currentToken(currentSecret) });
    assert.equal(response.status, 200);
    return agent;
  }

  it("allows an authenticated admin to initialize a reset", async () => {
    const agent = await loginTotpAgent();

    const response = await agent.post("/api/auth/settings/totp/init").send({
      currentPassword: TOTP_PASSWORD,
      totpToken: currentToken(currentSecret)
    });

    assert.equal(response.status, 200);
    assert.match(response.body.secret, /^[A-Z2-7]{32}$/);
    assert.match(response.body.qrCodePngBase64, /^data:image\/png;base64,/);
  });

  it("verifies the reset, clears the session cookie, and leaves the caller logged out", async () => {
    const agent = await loginTotpAgent();
    const initResponse = await agent.post("/api/auth/settings/totp/init").send({
      currentPassword: TOTP_PASSWORD,
      totpToken: currentToken(currentSecret)
    });
    assert.equal(initResponse.status, 200);

    const response = await agent
      .post("/api/auth/settings/totp/verify")
      .send({ totpToken: currentToken(initResponse.body.secret) });

    assert.equal(response.status, 200);
    assert.equal(response.body.sessionsRevoked, true);
    assert.equal(clearsSessionCookie(response.headers["set-cookie"]), true);
    assert.equal((await agent.get("/api/auth/me")).status, 401);
  });
});
