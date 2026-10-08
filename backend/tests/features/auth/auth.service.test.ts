import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "../../../src/features/auth/password.service.js";
import { setupTestDatabase } from "../../helpers/testDatabase.js";
import { currentToken, wrongToken } from "../../helpers/totp.js";

type AuthRepository = typeof import("../../../src/features/auth/auth.repository.js");

let teardown: () => void;
let createUser: AuthRepository["createUser"];
let findUserById: AuthRepository["findUserById"];
let clearSetupPending: AuthRepository["clearSetupPending"];
let createSetupPending: AuthRepository["createSetupPending"];
let getLatestSetupPending: AuthRepository["getLatestSetupPending"];
let updateUserPassword: AuthRepository["updateUserPassword"];
let updateUserTotpSecret: AuthRepository["updateUserTotpSecret"];
let db: import("better-sqlite3").Database;
let authService: typeof import("../../../src/features/auth/auth.service.js");
let sessionService: typeof import("../../../src/features/auth/session.service.js");
let totpService: typeof import("../../../src/features/auth/totp.service.js");

let userId: string;
const PASSWORD = "Abcdef1!";

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;

  ({
    createUser,
    findUserById,
    clearSetupPending,
    createSetupPending,
    getLatestSetupPending,
    updateUserPassword,
    updateUserTotpSecret
  } = await import("../../../src/features/auth/auth.repository.js"));
  authService = await import("../../../src/features/auth/auth.service.js");
  sessionService = await import("../../../src/features/auth/session.service.js");
  totpService = await import("../../../src/features/auth/totp.service.js");

  const passwordHash = await hashPassword(PASSWORD);
  userId = createUser({
    username: "admin",
    passwordHash,
    totpSecretEncrypted: "irrelevant-secret",
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

  it("preserves a concurrent credential change while the old PIN is being verified", async () => {
    const replacementHash = await hashPassword(PASSWORD);
    const pendingLogin = authService.login({ password: PIN });
    updateUserPassword(userId, replacementHash, "password");
    const result = await pendingLogin;

    assert.equal(findUserById(userId)?.password, replacementHash);
    assert.equal(findUserById(userId)?.credential_type, "password");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.user.credentialType, "password");
  });

  it("accepts an existing password without applying the new-password strength policy", async () => {
    updateUserPassword(userId, await hashPassword("legacy"), "pin");
    const result = await authService.login({ password: "legacy" });

    assert.equal(result.ok, true);
    assert.equal(findUserById(userId)?.credential_type, "password");
    if (result.ok) assert.equal(result.user.credentialType, "password");
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

describe("initTotpReset", () => {
  const CURRENT_PASSWORD = "Totpinit1!";
  let secret: string;

  beforeAll(async () => {
    secret = totpService.generateSecret();
    updateUserPassword(userId, await hashPassword(CURRENT_PASSWORD), "password");
    updateUserTotpSecret(userId, totpService.encryptTotpSecret(secret));
    clearSetupPending();
  });

  it("throws a 404 error for an unknown user", async () => {
    await assert.rejects(
      () =>
        authService.initTotpReset("not-a-real-user-id", {
          currentPassword: CURRENT_PASSWORD,
          totpToken: currentToken(secret)
        }),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 404
    );
  });

  it("throws a 401 error for an incorrect current password", async () => {
    await assert.rejects(
      () =>
        authService.initTotpReset(userId, {
          currentPassword: "wrong-password",
          totpToken: currentToken(secret)
        }),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 401
    );
  });

  it("throws a 400 error when the TOTP code is not 6 digits", async () => {
    await assert.rejects(
      () => authService.initTotpReset(userId, { currentPassword: CURRENT_PASSWORD, totpToken: "12345" }),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 400
    );
  });

  it("throws a 401 error for a wrong TOTP code", async () => {
    await assert.rejects(
      () =>
        authService.initTotpReset(userId, {
          currentPassword: CURRENT_PASSWORD,
          totpToken: wrongToken(secret)
        }),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 401
    );
  });

  it("throws a 401 error when the stored TOTP secret cannot be decrypted", async () => {
    updateUserTotpSecret(userId, "not-encrypted-json");

    await assert.rejects(
      () =>
        authService.initTotpReset(userId, {
          currentPassword: CURRENT_PASSWORD,
          totpToken: currentToken(secret)
        }),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 401
    );

    updateUserTotpSecret(userId, totpService.encryptTotpSecret(secret));
  });

  it("does not create a pending reset for a rejected attempt", () => {
    assert.equal(getLatestSetupPending(), undefined);
  });

  it("returns a new secret with a QR code and stores it as a pending reset", async () => {
    const result = await authService.initTotpReset(userId, {
      currentPassword: CURRENT_PASSWORD,
      totpToken: currentToken(secret)
    });

    assert.match(result.secret, /^[A-Z2-7]{32}$/);
    assert.notEqual(result.secret, secret);
    assert.ok(result.qrCodePngBase64.startsWith("data:image/png;base64,"));
    assert.ok(new Date(result.expiresAt).getTime() > Date.now());

    const pending = getLatestSetupPending();
    assert.ok(pending);
    assert.equal(totpService.decryptTotpSecret(pending!.totp_secret), result.secret);
    assert.equal(pending!.verified_at, null);
  });

  it("leaves the user's existing secret in place until the reset is verified", () => {
    const user = findUserById(userId);
    assert.equal(totpService.decryptTotpSecret(user!.totp_secret), secret);
  });
});

describe("verifyTotpReset", () => {
  let pendingSecret: string;

  beforeAll(() => {
    clearSetupPending();
  });

  it("throws a 400 error when no reset was initialized", async () => {
    await assert.rejects(
      () => authService.verifyTotpReset(userId, "123456"),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 400
    );
  });

  it("throws a 400 error when the TOTP code is not 6 digits", async () => {
    pendingSecret = totpService.generateSecret();
    createSetupPending(
      totpService.encryptTotpSecret(pendingSecret),
      new Date(Date.now() + 60_000).toISOString()
    );

    await assert.rejects(
      () => authService.verifyTotpReset(userId, "12345"),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 400
    );
  });

  it("throws a 400 error for a code that does not match the pending secret", async () => {
    await assert.rejects(
      () => authService.verifyTotpReset(userId, wrongToken(pendingSecret)),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 400
    );
  });

  it("keeps the pending reset after a failed verification", () => {
    assert.ok(getLatestSetupPending());
  });

  it("promotes the pending secret, clears it, revokes sessions, and records an audit event on success", async () => {
    const sessionToken = sessionService.createSession(userId);

    await authService.verifyTotpReset(userId, currentToken(pendingSecret));

    assert.equal(sessionService.validateSession(sessionToken), null);

    const user = findUserById(userId);
    assert.equal(totpService.decryptTotpSecret(user!.totp_secret), pendingSecret);
    assert.equal(getLatestSetupPending(), undefined);

    const events = db
      .prepare("SELECT user_id FROM audit_events WHERE action = 'settings.totp_reset'")
      .all() as { user_id: string }[];
    assert.equal(events.length, 1);
    assert.equal(events[0].user_id, userId);
  });

  it("throws a 400 error when an expired reset is the only pending one", async () => {
    createSetupPending(
      totpService.encryptTotpSecret(totpService.generateSecret()),
      new Date(Date.now() - 60_000).toISOString()
    );

    await assert.rejects(
      () => authService.verifyTotpReset(userId, "123456"),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 400
    );
  });
});

/**
 * `TOTP_ENABLED` is a compile-time constant that ships as `false` (password-only auth), so the
 * second factor in `login` is only reachable with the constants module mocked.
 */
describe("login with TOTP enforcement enabled", () => {
  const TOTP_PASSWORD = "Totplogin1!";
  let totpAuthService: typeof import("../../../src/features/auth/auth.service.js");
  let secret: string;

  beforeAll(async () => {
    secret = totpService.generateSecret();
    updateUserPassword(userId, await hashPassword(TOTP_PASSWORD), "password");
    updateUserTotpSecret(userId, totpService.encryptTotpSecret(secret));

    vi.resetModules();
    vi.doMock("../../../src/features/auth/auth.constants.js", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../../../src/features/auth/auth.constants.js")>()),
      TOTP_ENABLED: true
    }));
    totpAuthService = await import("../../../src/features/auth/auth.service.js");
  });

  afterAll(() => {
    vi.doUnmock("../../../src/features/auth/auth.constants.js");
    vi.resetModules();
  });

  it("rejects a correct password with no TOTP code", async () => {
    const result = await totpAuthService.login({ password: TOTP_PASSWORD });
    assert.equal(result.ok, false);
  });

  it("rejects a correct password with a malformed TOTP code", async () => {
    const result = await totpAuthService.login({ password: TOTP_PASSWORD, totpToken: "12345" });
    assert.equal(result.ok, false);
  });

  it("rejects a correct password with a wrong TOTP code", async () => {
    const result = await totpAuthService.login({
      password: TOTP_PASSWORD,
      totpToken: wrongToken(secret)
    });
    assert.equal(result.ok, false);
  });

  it("rejects a valid TOTP code paired with the wrong password", async () => {
    const result = await totpAuthService.login({
      password: "wrong-password",
      totpToken: currentToken(secret)
    });
    assert.equal(result.ok, false);
  });

  it("accepts a correct password with a valid TOTP code", async () => {
    const result = await totpAuthService.login({
      password: TOTP_PASSWORD,
      totpToken: ` ${currentToken(secret)} `
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.sessionToken);
      assert.equal(result.user.role, "admin");
    }
  });

  it("rejects login when the stored TOTP secret cannot be decrypted", async () => {
    updateUserTotpSecret(userId, "not-encrypted-json");

    const result = await totpAuthService.login({
      password: TOTP_PASSWORD,
      totpToken: currentToken(secret)
    });
    assert.equal(result.ok, false);

    updateUserTotpSecret(userId, totpService.encryptTotpSecret(secret));
  });

  describe("changePassword", () => {
    it("throws a 400 error when the TOTP code is not 6 digits", async () => {
      await assert.rejects(
        () =>
          totpAuthService.changePassword(userId, {
            currentPassword: TOTP_PASSWORD,
            newPassword: "Newtotp1!"
          }),
        (error: unknown) => error instanceof totpAuthService.AuthSettingsError && error.status === 400
      );
    });

    it("throws a 401 error for a wrong TOTP code", async () => {
      await assert.rejects(
        () =>
          totpAuthService.changePassword(userId, {
            currentPassword: TOTP_PASSWORD,
            newPassword: "Newtotp1!",
            totpToken: wrongToken(secret)
          }),
        (error: unknown) => error instanceof totpAuthService.AuthSettingsError && error.status === 401
      );
    });

    it("throws a 401 error when the stored TOTP secret cannot be decrypted", async () => {
      updateUserTotpSecret(userId, "not-encrypted-json");

      await assert.rejects(
        () =>
          totpAuthService.changePassword(userId, {
            currentPassword: TOTP_PASSWORD,
            newPassword: "Newtotp1!",
            totpToken: currentToken(secret)
          }),
        (error: unknown) => error instanceof totpAuthService.AuthSettingsError && error.status === 401
      );

      updateUserTotpSecret(userId, totpService.encryptTotpSecret(secret));
    });

    it("leaves the password unchanged when the TOTP code is rejected", async () => {
      const user = findUserById(userId);
      assert.equal(await verifyPassword(TOTP_PASSWORD, user!.password), true);
    });

    it("updates the password hash with a valid TOTP code", async () => {
      const newPassword = "Newtotp1!";
      await totpAuthService.changePassword(userId, {
        currentPassword: TOTP_PASSWORD,
        newPassword,
        totpToken: currentToken(secret)
      });

      const user = findUserById(userId);
      assert.equal(await verifyPassword(newPassword, user!.password), true);
    });
  });

  describe("legacy PIN metadata with TOTP enabled", () => {
    const PIN = "012345";
    let pinHash: string;

    beforeAll(async () => {
      pinHash = await hashPassword(PIN);
    });

    beforeEach(() => {
      updateUserPassword(userId, pinHash, "password");
      sessionService.deleteAllUserSessions(userId);
    });

    for (const tokenKind of ["missing", "malformed", "wrong"] as const) {
      it(`does not correct metadata when the TOTP code is ${tokenKind}`, async () => {
        const original = findUserById(userId);
        const totpToken = tokenKind === "missing" ? undefined : tokenKind === "malformed" ? "12345" : wrongToken(secret);
        const result = await totpAuthService.login({ password: PIN, totpToken });

        assert.equal(result.ok, false);
        assert.deepEqual(findUserById(userId), original);
        assert.equal((db.prepare("SELECT COUNT(*) AS count FROM sessions").get() as { count: number }).count, 0);
      });
    }

    it("corrects metadata only once both the PIN and TOTP are verified", async () => {
      const result = await totpAuthService.login({ password: PIN, totpToken: currentToken(secret) });

      assert.equal(result.ok, true);
      assert.equal(findUserById(userId)?.credential_type, "pin");
      assert.equal(findUserById(userId)?.password, pinHash);
      if (result.ok) assert.equal(result.user.credentialType, "pin");
    });
  });
});
