import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import request from "supertest";
import { hashPassword } from "../../../src/features/auth/password.service.js";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

type AuthRepository = typeof import("../../../src/features/auth/auth.repository.js");

let teardown: () => void;
let app: import("express").Express;
let createUser: AuthRepository["createUser"];
let findTheUser: AuthRepository["findTheUser"];
let updateUserPassword: AuthRepository["updateUserPassword"];
let db: import("better-sqlite3").Database;

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
  db = testDb.db;
  teardown = testDb.teardown;

  ({ createUser, findTheUser, updateUserPassword } = await import(
    "../../../src/features/auth/auth.repository.js"
  ));
  const { createApp } = await import("../../../src/app.js");
  app = createApp();

  createUser({
    username: "admin",
    passwordHash: await hashPassword(PASSWORD),
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

describe("credential metadata through login", () => {
  it("exposes repaired legacy PIN metadata in login, authenticated user, and public status responses", async () => {
    const user = findTheUser()!;
    updateUserPassword(user.id, await hashPassword("012345"), "password");
    try {
      assert.equal((await request(app).get("/api/setup/status")).body.credentialType, "password");
      const agent = request.agent(app);
      const response = await agent.post("/api/auth/login").send({ password: "012345" });

      assert.equal(response.status, 200);
      assert.equal(response.body.user.credentialType, "pin");
      const me = await agent.get("/api/auth/me");
      assert.equal(me.status, 200);
      assert.equal(me.body.credentialType, "pin");
      assert.equal((await request(app).get("/api/setup/status")).body.credentialType, "pin");
    } finally {
      updateUserPassword(user.id, user.password, user.credential_type);
    }
  });
});

describe("session settings", () => {
  it("requires credential confirmation without clearing a valid session on rejection", async () => {
    const agent = await loginAgent();
    const initial = await agent.get("/api/auth/settings/session");
    assert.equal(initial.status, 200);
    assert.deepEqual(initial.body.settings, { maxAgeDays: 7, idleHours: 24 });
    const rejected = await agent.post("/api/auth/settings/session").send({ settings: { maxAgeDays: 1, idleHours: 1 }, currentPassword: "incorrect" });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers["set-cookie"], undefined);
    assert.equal((await agent.get("/api/auth/me")).status, 200);
    const invalid = await agent.post("/api/auth/settings/session").send({ settings: { maxAgeDays: "7", idleHours: 1 }, currentPassword: PASSWORD });
    assert.equal(invalid.status, 400);
  });

  it("clears the cookie when a shorter policy expires the caller and accepts PIN confirmation", async () => {
    const user = findTheUser()!;
    updateUserPassword(user.id, await hashPassword("012345"), "pin");
    const agent = await loginAgent("012345");
    db.prepare("UPDATE sessions SET created_at=?").run(new Date(Date.now() - 2 * 86400000).toISOString());
    const result = await agent.post("/api/auth/settings/session").send({ settings: { maxAgeDays: 1, idleHours: 1 }, currentPassword: "012345" });
    assert.equal(result.status, 200);
    assert.equal(result.body.currentSessionExpired, true);
    assert.equal(clearsSessionCookie(result.headers["set-cookie"]), true);
    assert.equal((await agent.get("/api/auth/me")).status, 401);
    const fresh = await loginAgent("012345");
    assert.deepEqual((await fresh.get("/api/auth/settings/session")).body.settings, { maxAgeDays: 1, idleHours: 1 });
  });
});
