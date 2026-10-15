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
