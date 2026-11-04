import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, beforeEach, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let db: import("better-sqlite3").Database;
let teardown: () => void;
let service: typeof import("../../../src/features/auth/session-settings.service.js");
let sessions: typeof import("../../../src/features/auth/session.service.js");
let repo: typeof import("../../../src/features/auth/auth.repository.js");
let env: typeof import("../../../src/config/env.js")["env"];
let userId: string;
let passwordHash: string;
const password = "Current1!Password";
const defaults = { maxAgeDays: 7, idleHours: 24 };

beforeAll(async () => {
  ({ db, teardown } = await setupTestDatabase());
  ({ env } = await import("../../../src/config/env.js"));
  service = await import("../../../src/features/auth/session-settings.service.js");
  sessions = await import("../../../src/features/auth/session.service.js");
  repo = await import("../../../src/features/auth/auth.repository.js");
  const { hashPassword } = await import("../../../src/features/auth/password.service.js");
  passwordHash = await hashPassword(password);
  userId = repo.createUser({ username: "admin", passwordHash, credentialType: "password" });
});
beforeEach(() => {
  db.exec("DELETE FROM sessions; DELETE FROM settings; DELETE FROM audit_events;");
  repo.updateUserPassword(userId, passwordHash, "password");
  env.sessionMaxAgeDays = 7;
  env.sessionIdleHours = 24;
});
afterEach(() => vi.useRealTimers());
afterAll(() => teardown());
function stored() { return db.prepare("SELECT * FROM sessions ORDER BY created_at").all() as { created_at: string; expires_at: string; last_seen_at: string }[]; }
function atHoursAgo(hours: number) { return new Date(Date.now() - hours * 3600000).toISOString(); }

it("seeds valid environment values once and leaves SQLite authoritative", () => {
  env.sessionMaxAgeDays = 10; env.sessionIdleHours = 48;
  assert.deepEqual(service.getSessionSettings(), { maxAgeDays: 10, idleHours: 48 });
  env.sessionMaxAgeDays = 2; env.sessionIdleHours = 3;
  assert.deepEqual(service.getSessionSettings(), { maxAgeDays: 10, idleHours: 48 });
});

it("uses safe defaults for invalid bootstrap values but fails closed on malformed stored settings", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    for (const value of [NaN, 0, -1, 1.5, 1000]) {
      db.exec("DELETE FROM settings"); env.sessionMaxAgeDays = value; env.sessionIdleHours = value;
      assert.deepEqual(service.getSessionSettings(), defaults);
    }
    db.prepare("UPDATE settings SET value='{}' WHERE key='session_settings'").run();
    assert.throws(() => service.getSessionSettings());
    db.prepare("UPDATE settings SET value='broken' WHERE key='session_settings'").run();
    assert.throws(() => service.getSessionSettings());
  } finally { warn.mockRestore(); }
});

it("rejects missing, fractional, string and out-of-range input without changes", async () => {
  const token = sessions.createSession(userId);
  for (const input of [null, {}, ...Object.entries(service.SESSION_LIMITS).flatMap(([key, range]) => [range.min - 1, range.max + 1, 1.5, "7", NaN].map((value) => ({ ...defaults, [key]: value })))]) {
    await assert.rejects(service.saveSessionSettings(userId, input, password, token), (error: unknown) => error instanceof service.SessionSettingsError && error.status === 400);
  }
  assert.deepEqual(service.getSessionSettings(), defaults);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM audit_events").get() as { n: number }).n, 0);
});

it("requires the current credential and an existing admin session", async () => {
  const token = sessions.createSession(userId);
  await assert.rejects(service.saveSessionSettings(userId, { maxAgeDays: 1, idleHours: 1 }, "wrong", token), (error: unknown) => error instanceof service.SessionSettingsError && error.status === 403);
  await assert.rejects(service.saveSessionSettings("missing", defaults, password, token));
  await assert.rejects(service.saveSessionSettings(userId, defaults, password, "missing"));
  assert.deepEqual(service.getSessionSettings(), defaults);
  assert.ok(sessions.validateSession(token));
});

it("saves atomically, clips existing expiry dates and affects future cookies and logins", async () => {
  const token = sessions.createSession(userId);
  const before = stored()[0];
  const result = await service.saveSessionSettings(userId, { maxAgeDays: 2, idleHours: 3 }, password, token);
  assert.equal(result.currentSessionExpired, false);
  assert.equal(Date.parse(stored()[0].expires_at), Date.parse(before.created_at) + 2 * 86400000);
  assert.equal(sessions.sessionCookieOptions().maxAge, 2 * 86400000);
  const event = db.prepare("SELECT detail FROM audit_events WHERE action='auth.session_settings_changed'").get() as { detail: string };
  assert.deepEqual(JSON.parse(event.detail), { previous: defaults, settings: result.settings, revokedSessions: 0 });
  assert.equal(event.detail.includes(password), false);
  assert.equal(event.detail.includes(token), false);
  assert.ok(sessions.validateSession(token));
});

it("revokes older active sessions immediately, including the caller when its new maximum is exceeded", async () => {
  const token = sessions.createSession(userId);
  db.prepare("UPDATE sessions SET created_at=?").run(atHoursAgo(48));
  const result = await service.saveSessionSettings(userId, { maxAgeDays: 1, idleHours: 24 }, password, token);
  assert.equal(result.currentSessionExpired, true);
  assert.equal(result.revokedSessions, 1);
  assert.equal(sessions.validateSession(token), null);
});

it("never extends existing absolute expiry or revives sessions already idle under the old policy", async () => {
  const token = sessions.createSession(userId);
  await service.saveSessionSettings(userId, { maxAgeDays: 2, idleHours: 1 }, password, token);
  const before = stored()[0].expires_at;
  sessions.createSession(userId);
  db.prepare("UPDATE sessions SET last_seen_at=? WHERE id=(SELECT id FROM sessions ORDER BY rowid DESC LIMIT 1)").run(atHoursAgo(2));
  const result = await service.saveSessionSettings(userId, { maxAgeDays: 30, idleHours: 168 }, password, token);
  assert.equal(result.revokedSessions, 1);
  assert.equal(stored().length, 1);
  assert.equal(stored()[0].expires_at, before);
  const fresh = sessions.createSession(userId);
  assert.ok(sessions.validateSession(fresh));
  assert.ok(stored().some((row) => Date.parse(row.expires_at) > Date.now() + 29 * 86400000));
});

it("rejects credential changes or session revocation during verification", async () => {
  let token = sessions.createSession(userId);
  const credentialChange = service.saveSessionSettings(userId, { maxAgeDays: 30, idleHours: 168 }, password, token);
  repo.updateUserPassword(userId, "new-hash", "password");
  await assert.rejects(credentialChange);
  repo.updateUserPassword(userId, passwordHash, "password");
  token = sessions.createSession(userId);
  const revoked = service.saveSessionSettings(userId, { maxAgeDays: 30, idleHours: 168 }, password, token);
  sessions.deleteSession(token);
  await assert.rejects(revoked);
  assert.deepEqual(service.getSessionSettings(), defaults);
});

it("rejects a session that expires during verification", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const token = sessions.createSession(userId);
  const pending = service.saveSessionSettings(userId, { maxAgeDays: 30, idleHours: 168 }, password, token);
  vi.setSystemTime(Date.now() + 8 * 86400000);
  await assert.rejects(pending);
});

it("rolls back policy, expiry changes and revocations if auditing fails", async () => {
  const token = sessions.createSession(userId);
  const before = stored();
  db.exec("CREATE TEMP TRIGGER fail_session_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT, 'audit failure'); END;");
  try { await assert.rejects(service.saveSessionSettings(userId, { maxAgeDays: 1, idleHours: 1 }, password, token)); }
  finally { db.exec("DROP TRIGGER fail_session_audit"); }
  assert.deepEqual(service.getSessionSettings(), defaults);
  assert.deepEqual(stored(), before);
});

it("treats exact deadlines and malformed stored timestamps as expired", () => {
  const now = Date.now();
  const session = { created_at: new Date(now - 86400000).toISOString(), last_seen_at: new Date(now).toISOString(), expires_at: new Date(now + 86400000).toISOString() };
  assert.equal(service.isSessionExpired(session, { maxAgeDays: 1, idleHours: 24 }, now), true);
  assert.equal(service.isSessionExpired({ ...session, created_at: "invalid" }, defaults, now), true);
});
