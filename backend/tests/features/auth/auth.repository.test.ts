import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let authRepository: typeof import("../../../src/features/auth/auth.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  authRepository = await import("../../../src/features/auth/auth.repository.js");
});

afterAll(() => {
  teardown();
});

describe("credential metadata", () => {
  it("reads only the local credential type and returns null without a user", () => {
    assert.equal(authRepository.getLocalAdminCredentialType(), null);
    const userId = authRepository.createUser({
      username: "admin",
      passwordHash: "verified-hash",
      credentialType: "password"
    });
    const original = authRepository.findUserById(userId)!;
    assert.equal(authRepository.getLocalAdminCredentialType(), "password");

    assert.equal(authRepository.updateUserCredentialType(userId, "verified-hash", "pin"), true);
    assert.equal(authRepository.getLocalAdminCredentialType(), "pin");
    assert.deepEqual(authRepository.findUserById(userId), { ...original, credential_type: "pin" });
  });

  it("rejects correction against a stale hash without changing any user fields", () => {
    const user = authRepository.findTheUser()!;
    authRepository.updateUserPassword(user.id, "replacement-hash", "password");
    const current = authRepository.findUserById(user.id);

    assert.equal(authRepository.updateUserCredentialType(user.id, "verified-hash", "pin"), false);
    assert.deepEqual(authRepository.findUserById(user.id), current);
    assert.equal(authRepository.updateUserCredentialType("missing-user", "replacement-hash", "pin"), false);
  });
});

describe("password hash replacement", () => {
  it("replaces the hash only while the verified hash is still stored", () => {
    const user = authRepository.findTheUser()!;
    authRepository.updateUserPassword(user.id, "legacy-hash", "pin");
    const original = authRepository.findUserById(user.id)!;

    assert.equal(authRepository.replaceUserPasswordHash(user.id, "legacy-hash", "rehashed"), true);
    assert.deepEqual(authRepository.findUserById(user.id), { ...original, password: "rehashed" });
  });

  it("does not overwrite a hash changed after verification", () => {
    const user = authRepository.findTheUser()!;
    authRepository.updateUserPassword(user.id, "changed-hash", "password");
    const current = authRepository.findUserById(user.id);

    assert.equal(authRepository.replaceUserPasswordHash(user.id, "legacy-hash", "rehashed"), false);
    assert.deepEqual(authRepository.findUserById(user.id), current);
    assert.equal(authRepository.replaceUserPasswordHash("missing-user", "changed-hash", "rehashed"), false);
  });
});
