import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { hashPassword, needsRehash, verifyPassword } from "../../../src/features/auth/password.service.js";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

type AuthRepository = typeof import("../../../src/features/auth/auth.repository.js");

let teardown: () => void;
let createUser: AuthRepository["createUser"];
let findUserById: AuthRepository["findUserById"];
let updateUserPassword: AuthRepository["updateUserPassword"];
let db: import("better-sqlite3").Database;
let authService: typeof import("../../../src/features/auth/auth.service.js");
let sessionService: typeof import("../../../src/features/auth/session.service.js");

let userId: string;
const PASSWORD = "Abcdef1!";

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;

  ({
    createUser,
    findUserById,
    updateUserPassword
  } = await import("../../../src/features/auth/auth.repository.js"));
  authService = await import("../../../src/features/auth/auth.service.js");
  sessionService = await import("../../../src/features/auth/session.service.js");

  const passwordHash = await hashPassword(PASSWORD);
  userId = createUser({
    username: "admin",
    passwordHash,
    credentialType: "password"
  });
});

afterAll(() => {
  teardown();
});

describe("login", () => {
  it("succeeds with the correct password and returns a session token", async () => {
    const result = await authService.login({ password: PASSWORD });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.sessionToken);
      assert.equal(result.user.role, "admin");
      assert.equal(result.user.credentialType, "password");
    }
  });

  it("updates last_login on success", async () => {
    await authService.login({ password: PASSWORD });
    const user = findUserById(userId);
    assert.ok(user?.last_login);
  });

  it("records an audit event on success", async () => {
    await authService.login({ password: PASSWORD });
    const events = db.prepare("SELECT action FROM audit_events WHERE action = 'login.success'").all();
    assert.ok(events.length > 0);
  });

  it("fails with an incorrect password", async () => {
    const result = await authService.login({ password: "wrong-password" });
    assert.equal(result.ok, false);
  });

  it("records an audit event on failure", async () => {
    await authService.login({ password: "wrong-password" });
    const events = db.prepare("SELECT action FROM audit_events WHERE action = 'login.failure'").all();
    assert.ok(events.length > 0);
  });
});

describe("legacy credential metadata on login", () => {
  const PIN = "012345";
  let originalUser: NonNullable<ReturnType<AuthRepository["findUserById"]>>;
  let pinHash: string;

  beforeAll(async () => {
    pinHash = await hashPassword(PIN);
  });

  beforeEach(() => {
    originalUser = findUserById(userId)!;
    updateUserPassword(userId, pinHash, "password");
  });

  afterEach(() => {
    updateUserPassword(userId, originalUser.password, originalUser.credential_type);
    sessionService.deleteAllUserSessions(userId);
  });

  it("repairs a leading-zero legacy PIN only after successful login and returns it in the session", async () => {
    const result = await authService.login({ password: PIN });

    assert.equal(result.ok, true);
    assert.equal(findUserById(userId)?.credential_type, "pin");
    assert.equal(findUserById(userId)?.password, pinHash);
    if (result.ok) {
      assert.equal(result.user.credentialType, "pin");
      assert.equal(sessionService.validateSession(result.sessionToken)?.credentialType, "pin");
    }
  });

  it("does not repair metadata or create a session on failed password verification", async () => {
    const original = findUserById(userId);
    const result = await authService.login({ password: "654321" });

    assert.equal(result.ok, false);
    assert.deepEqual(findUserById(userId), original);
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM sessions").get() as { count: number }).count, 0);
  });

  it("rejects the login and preserves a credential change made while the old PIN is being verified", async () => {
    const replacementHash = await hashPassword(PASSWORD);
    const pendingLogin = authService.login({ password: PIN });
    updateUserPassword(userId, replacementHash, "password");
    const result = await pendingLogin;

    assert.equal(result.ok, false);
    assert.equal(findUserById(userId)?.password, replacementHash);
    assert.equal(findUserById(userId)?.credential_type, "password");
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM sessions").get() as { count: number }).count, 0);
  });

  it("accepts an existing password without applying the new-password strength policy", async () => {
    updateUserPassword(userId, await hashPassword("legacy"), "pin");
    const result = await authService.login({ password: "legacy" });

    assert.equal(result.ok, true);
    assert.equal(findUserById(userId)?.credential_type, "password");
    if (result.ok) assert.equal(result.user.credentialType, "password");
  });
});

describe("legacy bcrypt hash migration on login", () => {
  let originalUser: NonNullable<ReturnType<AuthRepository["findUserById"]>>;
  let bcryptHash: string;

  beforeAll(async () => {
    bcryptHash = await bcrypt.hash(PASSWORD, 12);
  });

  beforeEach(() => {
    originalUser = findUserById(userId)!;
    updateUserPassword(userId, bcryptHash, "password");
  });

  afterEach(() => {
    updateUserPassword(userId, originalUser.password, originalUser.credential_type);
    sessionService.deleteAllUserSessions(userId);
  });

  it("replaces a bcrypt hash with a current scrypt hash after a successful login", async () => {
    const result = await authService.login({ password: PASSWORD });

    assert.equal(result.ok, true);
    const migrated = findUserById(userId)!;
    assert.match(migrated.password, /^scrypt\$/);
    assert.equal(needsRehash(migrated.password), false);
    assert.equal(await verifyPassword(PASSWORD, migrated.password), true);
    assert.equal(migrated.credential_type, "password");
  });

  it("logs in again with the migrated hash without rewriting it", async () => {
    await authService.login({ password: PASSWORD });
    const migratedHash = findUserById(userId)!.password;

    const result = await authService.login({ password: PASSWORD });

    assert.equal(result.ok, true);
    assert.equal(findUserById(userId)?.password, migratedHash);
  });

  it("leaves the bcrypt hash unchanged after a failed login", async () => {
    const result = await authService.login({ password: "wrong-password" });

    assert.equal(result.ok, false);
    assert.equal(findUserById(userId)?.password, bcryptHash);
  });

  it("does not rewrite a current scrypt hash", async () => {
    const currentHash = await hashPassword(PASSWORD);
    updateUserPassword(userId, currentHash, "password");

    const result = await authService.login({ password: PASSWORD });

    assert.equal(result.ok, true);
    assert.equal(findUserById(userId)?.password, currentHash);
  });

  it("rejects the login and keeps a credential change made while the bcrypt hash is being verified", async () => {
    const replacementHash = await hashPassword("Replaced1!");
    const pendingLogin = authService.login({ password: PASSWORD });
    updateUserPassword(userId, replacementHash, "password");
    const result = await pendingLogin;

    assert.equal(result.ok, false);
    assert.equal(findUserById(userId)?.password, replacementHash);
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM sessions").get() as { count: number }).count, 0);
  });

  describe("credential change while the replacement hash is computed", () => {
    afterEach(() => {
      vi.doUnmock("../../../src/features/auth/password.service.js");
      vi.resetModules();
    });

    it("rejects the login, keeps the changed hash, and creates no session", async () => {
      const replacementHash = await hashPassword("Replaced1!");
      vi.resetModules();
      vi.doMock("../../../src/features/auth/password.service.js", async (importOriginal) => {
        const original = await importOriginal<typeof import("../../../src/features/auth/password.service.js")>();
        return {
          ...original,
          hashPassword: async (plain: string) => {
            const hash = await original.hashPassword(plain);
            updateUserPassword(userId, replacementHash, "password");
            return hash;
          }
        };
      });
      const racingAuthService = await import("../../../src/features/auth/auth.service.js");

      const result = await racingAuthService.login({ password: PASSWORD });

      assert.equal(result.ok, false);
      assert.equal(findUserById(userId)?.password, replacementHash);
      assert.equal((db.prepare("SELECT COUNT(*) AS count FROM sessions").get() as { count: number }).count, 0);
    });
  });
});

describe("login without a local admin", () => {
  afterEach(() => {
    vi.doUnmock("../../../src/features/auth/auth.repository.js");
    vi.doUnmock("../../../src/features/auth/password.service.js");
    vi.resetModules();
  });

  it("verifies against the current dummy hash and fails", async () => {
    vi.resetModules();
    vi.doMock("../../../src/features/auth/auth.repository.js", async (importOriginal) => ({
      ...(await importOriginal<AuthRepository>()),
      findTheUser: () => undefined
    }));
    vi.doMock("../../../src/features/auth/password.service.js", async (importOriginal) => {
      const original = await importOriginal<typeof import("../../../src/features/auth/password.service.js")>();
      return { ...original, verifyPassword: vi.fn(original.verifyPassword) };
    });
    const passwordService = await import("../../../src/features/auth/password.service.js");
    const noUserAuthService = await import("../../../src/features/auth/auth.service.js");

    const result = await noUserAuthService.login({ password: PASSWORD });

    assert.equal(result.ok, false);
    assert.deepEqual(vi.mocked(passwordService.verifyPassword).mock.calls, [[PASSWORD, passwordService.DUMMY_PASSWORD_HASH]]);
    assert.equal(needsRehash(passwordService.DUMMY_PASSWORD_HASH), false);
  });
});

describe("changePassword", () => {
  it("throws a 404 error for an unknown user", async () => {
    await assert.rejects(
      () =>
        authService.changePassword("not-a-real-user-id", {
          currentPassword: PASSWORD,
          newPassword: "Newpass1!"
        }),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 404
    );
  });

  it("throws a 401 error for an incorrect current password", async () => {
    await assert.rejects(
      () =>
        authService.changePassword(userId, {
          currentPassword: "wrong-password",
          newPassword: "Newpass1!"
        }),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 401
    );
  });

  it("throws a 400 error for an invalid new password", async () => {
    await assert.rejects(
      () =>
        authService.changePassword(userId, {
          currentPassword: PASSWORD,
          newPassword: "short"
        }),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 400
    );
  });

  it("updates the password hash on success", async () => {
    const newPassword = "Newpass1!";
    await authService.changePassword(userId, { currentPassword: PASSWORD, newPassword });

    const user = findUserById(userId);
    assert.ok(user);
    assert.equal(await verifyPassword(newPassword, user!.password), true);
    assert.equal(await verifyPassword(PASSWORD, user!.password), false);
  });

  it("revokes every session on success", async () => {
    const currentPassword = "Newpass1!";
    const tokenA = sessionService.createSession(userId);
    const tokenB = sessionService.createSession(userId);

    await authService.changePassword(userId, { currentPassword, newPassword: "Revoked1!" });

    assert.equal(sessionService.validateSession(tokenA), null);
    assert.equal(sessionService.validateSession(tokenB), null);
  });

  it("leaves sessions in place when the change is rejected", async () => {
    const token = sessionService.createSession(userId);

    await assert.rejects(() =>
      authService.changePassword(userId, { currentPassword: "wrong-password", newPassword: "Other1!aa" })
    );

    assert.ok(sessionService.validateSession(token));
    sessionService.deleteAllUserSessions(userId);
  });

  it("stores each changed credential type and revokes the previous session in both directions", async () => {
    const original = findUserById(userId)!;
    let currentPassword = "Revoked1!";
    try {
      for (const [newPassword, credentialType] of [["012345", "pin"], [PASSWORD, "password"]] as const) {
        const token = sessionService.createSession(userId);
        await authService.changePassword(userId, { currentPassword, newPassword });

        assert.equal(findUserById(userId)?.credential_type, credentialType);
        assert.equal(await verifyPassword(newPassword, findUserById(userId)!.password), true);
        assert.equal(sessionService.validateSession(token), null);
        const result = await authService.login({ password: newPassword });
        assert.equal(result.ok, true);
        if (result.ok) assert.equal(result.user.credentialType, credentialType);
        currentPassword = newPassword;
      }
    } finally {
      updateUserPassword(userId, original.password, original.credential_type);
      sessionService.deleteAllUserSessions(userId);
    }
  });
});
