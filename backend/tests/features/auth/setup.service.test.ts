import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";
import { currentToken, wrongToken } from "../../helpers/totp.js";

let teardown: () => void;
let authRepository: typeof import("../../../src/features/auth/auth.repository.js");
let settingsRepository: typeof import("../../../src/features/settings/settings.repository.js");
let integritasAuthRepository: typeof import("../../../src/features/integritas-auth/integritas-auth.repository.js");
let setupService: typeof import("../../../src/features/auth/setup.service.js");
let db: import("better-sqlite3").Database;

const VALID_PASSWORD = "Abcdef1!";

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;

  authRepository = await import("../../../src/features/auth/auth.repository.js");
  settingsRepository = await import("../../../src/features/settings/settings.repository.js");
  integritasAuthRepository = await import("../../../src/features/integritas-auth/integritas-auth.repository.js");
  setupService = await import("../../../src/features/auth/setup.service.js");
});

afterAll(() => {
  teardown();
});

describe("before the local admin is created", () => {
  it("isLocalAdminCreated and isSetupComplete are both false", () => {
    assert.equal(setupService.isLocalAdminCreated(), false);
    assert.equal(setupService.isSetupComplete(), false);
  });

  it("assertLocalAdminNotCreated does not throw", () => {
    assert.doesNotThrow(() => setupService.assertLocalAdminNotCreated());
  });

  it("markSetupComplete is a no-op with no admin created", () => {
    setupService.markSetupComplete();
    assert.equal(setupService.isSetupComplete(), false);
  });

  it("initSetupTotp returns a QR code, secret, and expiry", async () => {
    const result = await setupService.initSetupTotp();
    assert.match(result.qrCodePngBase64, /^data:image\/png;base64,/);
    assert.ok(result.secret.length > 0);
    assert.ok(new Date(result.expiresAt).getTime() > Date.now());
  });

  it("verifySetupTotp rejects a malformed token", async () => {
    await assert.rejects(
      () => setupService.verifySetupTotp("abc"),
      (error: unknown) => error instanceof setupService.SetupError && error.status === 400
    );
  });

  it("verifySetupTotp rejects a token that does not match the pending secret", async () => {
    const { secret } = await setupService.initSetupTotp();
    await assert.rejects(
      () => setupService.verifySetupTotp(wrongToken(secret)),
      (error: unknown) => error instanceof setupService.SetupError && error.status === 400
    );
  });

  it("verifySetupTotp marks the pending setup verified for a valid token", async () => {
    const { secret } = await setupService.initSetupTotp();

    const result = await setupService.verifySetupTotp(currentToken(secret));

    assert.deepEqual(result, { valid: true });
    const pending = authRepository.getLatestSetupPending();
    assert.ok(pending?.verified_at);
  });

  it("verifySetupTotp rejects when no pending setup exists", async () => {
    authRepository.clearSetupPending();
    await assert.rejects(
      () => setupService.verifySetupTotp("123456"),
      (error: unknown) => error instanceof setupService.SetupError && error.status === 400
    );
  });

  it("completeSetup rejects an invalid password", async () => {
    await assert.rejects(
      () => setupService.completeSetup({ password: "short" }),
      (error: unknown) => error instanceof setupService.SetupError && error.status === 400
    );
  });

  it("completeSetup creates the admin user and returns a session", async () => {
    const result = await setupService.completeSetup({ password: VALID_PASSWORD });

    assert.ok(result.sessionToken);
    assert.equal(result.user.role, "admin");

    const auditRow = db.prepare("SELECT * FROM audit_events WHERE action = 'setup.complete'").get();
    assert.ok(auditRow);
    assert.equal(authRepository.getLatestSetupPending(), undefined);
  });
});

describe("after the local admin is created", () => {
  it("isLocalAdminCreated is true", () => {
    assert.equal(setupService.isLocalAdminCreated(), true);
  });

  it("assertLocalAdminNotCreated throws a 403", () => {
    assert.throws(
      () => setupService.assertLocalAdminNotCreated(),
      (error: unknown) => error instanceof setupService.SetupError && error.status === 403
    );
  });

  it("initSetupTotp is guarded against re-running setup", async () => {
    await assert.rejects(
      () => setupService.initSetupTotp(),
      (error: unknown) => error instanceof setupService.SetupError && error.status === 403
    );
  });

  it("completeSetup is guarded against re-running setup", async () => {
    await assert.rejects(
      () => setupService.completeSetup({ password: VALID_PASSWORD }),
      (error: unknown) => error instanceof setupService.SetupError && error.status === 403
    );
  });

  it("markSetupComplete stays a no-op until Integritas is connected", () => {
    setupService.markSetupComplete();
    assert.equal(setupService.isSetupComplete(), false);
  });

  it("markSetupComplete marks setup complete once Integritas is connected", () => {
    integritasAuthRepository.upsertIntegritasAuth({
      connectedDeviceId: "device-1",
      integritasUserId: "user-1",
      accessTokenEnc: "enc-access",
      refreshTokenEnc: "enc-refresh",
      apiKeyEnc: null,
      tokenExpiresAt: new Date(Date.now() + 3600_000).toISOString()
    });

    setupService.markSetupComplete();

    assert.equal(setupService.isSetupComplete(), true);
    assert.ok(settingsRepository.getSetting("setup.completed_at"));
  });
});

/**
 * `TOTP_ENABLED` is a compile-time constant that ships as `false` (password-only auth), so the
 * TOTP branch of `completeSetup` is only reachable with the constants module mocked. Runs against
 * its own database because the flow under test creates the local admin.
 */
describe("completeSetup with TOTP enforcement enabled", () => {
  let totpTeardown: () => void;
  let totpSetupService: typeof import("../../../src/features/auth/setup.service.js");
  let totpAuthRepository: typeof import("../../../src/features/auth/auth.repository.js");
  let totpService: typeof import("../../../src/features/auth/totp.service.js");
  const previousDatabasePath = process.env.DATABASE_PATH;

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("../../../src/features/auth/auth.constants.js", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../../../src/features/auth/auth.constants.js")>()),
      TOTP_ENABLED: true
    }));

    ({ teardown: totpTeardown } = await setupTestDatabase());
    totpSetupService = await import("../../../src/features/auth/setup.service.js");
    totpAuthRepository = await import("../../../src/features/auth/auth.repository.js");
    totpService = await import("../../../src/features/auth/totp.service.js");
  });

  afterAll(() => {
    totpTeardown();
    vi.doUnmock("../../../src/features/auth/auth.constants.js");
    vi.resetModules();
    process.env.DATABASE_PATH = previousDatabasePath;
  });

  it("rejects completing setup when no TOTP setup was initialized", async () => {
    await assert.rejects(
      () => totpSetupService.completeSetup({ password: VALID_PASSWORD }),
      (error: unknown) => error instanceof totpSetupService.SetupError && error.status === 400
    );
  });

  it("rejects completing setup while the pending TOTP secret is unverified", async () => {
    await totpSetupService.initSetupTotp();

    await assert.rejects(
      () => totpSetupService.completeSetup({ password: VALID_PASSWORD }),
      (error: unknown) => error instanceof totpSetupService.SetupError && error.status === 400
    );
    assert.equal(totpSetupService.isLocalAdminCreated(), false);
  });

  it("stores the verified TOTP secret on the admin user once setup completes", async () => {
    const { secret } = await totpSetupService.initSetupTotp();
    await totpSetupService.verifySetupTotp(currentToken(secret));

    const result = await totpSetupService.completeSetup({ password: VALID_PASSWORD });

    assert.ok(result.sessionToken);
    const user = totpAuthRepository.findTheUser();
    assert.equal(totpService.decryptTotpSecret(user!.totp_secret), secret);
    assert.equal(totpAuthRepository.getLatestSetupPending(), undefined);
  });
});
