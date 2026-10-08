import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let authRepository: typeof import("../../../src/features/auth/auth.repository.js");
let db: import("better-sqlite3").Database;

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;
  authRepository = await import("../../../src/features/auth/auth.repository.js");
});

afterAll(() => {
  teardown();
});

function futureIso(msFromNow: number) {
  return new Date(Date.now() + msFromNow).toISOString();
}

describe("setup-pending lifecycle", () => {
  it("createSetupPending stores a row retrievable via getLatestSetupPending", () => {
    const expiresAt = futureIso(15 * 60 * 1000);
    authRepository.createSetupPending("encrypted-secret", expiresAt);

    const pending = authRepository.getLatestSetupPending();
    assert.ok(pending);
    assert.equal(pending?.totp_secret, "encrypted-secret");
    assert.equal(pending?.expires_at, expiresAt);
    assert.equal(pending?.verified_at, null);
  });

  it("createSetupPending clears any prior pending row, keeping only the latest", () => {
    authRepository.createSetupPending("first-secret", futureIso(15 * 60 * 1000));
    authRepository.createSetupPending("second-secret", futureIso(15 * 60 * 1000));

    const count = db.prepare("SELECT COUNT(*) AS count FROM setup_pending").get() as { count: number };
    assert.equal(count.count, 1);

    const pending = authRepository.getLatestSetupPending();
    assert.equal(pending?.totp_secret, "second-secret");
  });

  it("markSetupPendingVerified updates verified_at and expires_at", () => {
    authRepository.createSetupPending("secret", futureIso(15 * 60 * 1000));
    const pending = authRepository.getLatestSetupPending();
    assert.ok(pending);

    const verifiedAt = new Date().toISOString();
    const newExpiresAt = futureIso(30 * 60 * 1000);
    authRepository.markSetupPendingVerified(pending!.id, verifiedAt, newExpiresAt);

    const updated = authRepository.getLatestSetupPending();
    assert.equal(updated?.verified_at, verifiedAt);
    assert.equal(updated?.expires_at, newExpiresAt);
  });

  it("getLatestSetupPending purges an expired row instead of returning it", () => {
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    authRepository.createSetupPending("expired-secret", pastExpiry);

    assert.equal(authRepository.getLatestSetupPending(), undefined);
  });

  it("clearSetupPending removes all pending rows", () => {
    authRepository.createSetupPending("secret", futureIso(15 * 60 * 1000));
    authRepository.clearSetupPending();

    assert.equal(authRepository.getLatestSetupPending(), undefined);
  });
});

describe("credential metadata", () => {
  it("reads only the local credential type and returns null without a user", () => {
    assert.equal(authRepository.getLocalAdminCredentialType(), null);
    const userId = authRepository.createUser({
      username: "admin",
      passwordHash: "verified-hash",
      totpSecretEncrypted: "encrypted-secret",
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
