import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

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
    assert.equal(result.user.credentialType, "password");
    assert.equal(authRepository.findTheUser()?.credential_type, "password");

    const auditRow = db.prepare("SELECT * FROM audit_events WHERE action = 'setup.complete'").get();
    assert.ok(auditRow);
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

describe("PIN setup", () => {
  it("stores and returns the PIN type with its authenticated session", async () => {
    db.prepare("DELETE FROM sessions").run();
    db.prepare("DELETE FROM users").run();
    const result = await setupService.completeSetup({ password: "012345" });
    const { validateSession } = await import("../../../src/features/auth/session.service.js");

    assert.equal(result.user.credentialType, "pin");
    assert.equal(authRepository.findTheUser()?.credential_type, "pin");
    assert.equal(validateSession(result.sessionToken)?.credentialType, "pin");
  });
});
