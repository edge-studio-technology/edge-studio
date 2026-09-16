import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let createUser: typeof import("../../../src/features/auth/auth.repository.js").createUser;
let createSessionRow: typeof import("../../../src/features/auth/auth.repository.js").createSessionRow;
let findSessionByTokenHash: typeof import("../../../src/features/auth/auth.repository.js").findSessionByTokenHash;
let sha256Hex: typeof import("../../../src/shared/crypto.js").sha256Hex;
let sessionService: typeof import("../../../src/features/auth/session.service.js");
let db: import("better-sqlite3").Database;

let userId: string;

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;

  ({ createUser, createSessionRow, findSessionByTokenHash } = await import(
    "../../../src/features/auth/auth.repository.js"
  ));
  ({ sha256Hex } = await import("../../../src/shared/crypto.js"));
  sessionService = await import("../../../src/features/auth/session.service.js");

  userId = createUser({
    username: "admin",
    passwordHash: "irrelevant-hash",
    totpSecretEncrypted: "irrelevant-secret",
    credentialType: "password"
  });
});

afterAll(() => {
  teardown();
});

describe("createSession / validateSession", () => {
  it("validates a freshly created session and returns the session user", () => {
    const rawToken = sessionService.createSession(userId);
    const sessionUser = sessionService.validateSession(rawToken);

    assert.ok(sessionUser);
    assert.equal(sessionUser?.id, userId);
    assert.equal(sessionUser?.role, "admin");
  });

  it("returns null for an unknown token", () => {
    assert.equal(sessionService.validateSession("not-a-real-token"), null);
  });

  it("returns null for an empty token", () => {
    assert.equal(sessionService.validateSession(""), null);
  });

  it("rejects and deletes an expired session", () => {
    const rawToken = "expired-session-token";
    const tokenHash = sha256Hex(rawToken);
    const expiredAt = new Date(Date.now() - 1000).toISOString();
    createSessionRow({ userId, tokenHash, expiresAt: expiredAt });

    assert.equal(sessionService.validateSession(rawToken), null);
    assert.equal(findSessionByTokenHash(tokenHash), undefined);
  });

  it("rejects and deletes a session idle past the idle timeout", () => {
    const rawToken = sessionService.createSession(userId);
    const tokenHash = sha256Hex(rawToken);
    const staleLastSeen = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").run(staleLastSeen, tokenHash);

    assert.equal(sessionService.validateSession(rawToken), null);
    assert.equal(findSessionByTokenHash(tokenHash), undefined);
  });
});

describe("deleteSession", () => {
  it("removes the session so it no longer validates", () => {
    const rawToken = sessionService.createSession(userId);
    sessionService.deleteSession(rawToken);
    assert.equal(sessionService.validateSession(rawToken), null);
  });

  it("is a no-op for an empty token", () => {
    assert.doesNotThrow(() => sessionService.deleteSession(""));
  });
});

describe("deleteAllUserSessions", () => {
  it("removes every session for the user", () => {
    const tokenA = sessionService.createSession(userId);
    const tokenB = sessionService.createSession(userId);

    sessionService.deleteAllUserSessions(userId);

    assert.equal(sessionService.validateSession(tokenA), null);
    assert.equal(sessionService.validateSession(tokenB), null);
  });
});

describe("sessionCookieOptions", () => {
  it("returns httpOnly, path, and sameSite options matching env config", () => {
    const options = sessionService.sessionCookieOptions();
    assert.equal(options.httpOnly, true);
    assert.equal(options.path, "/");
    assert.equal(options.sameSite, "strict");
    assert.equal(options.maxAge, 7 * 24 * 60 * 60 * 1000);
  });

  it("omits maxAge from the clear-cookie options so the expiry is not overwritten", () => {
    const options = sessionService.sessionClearCookieOptions();
    assert.equal(options.httpOnly, true);
    assert.equal(options.path, "/");
    assert.equal(options.sameSite, "strict");
    assert.equal("maxAge" in options, false);
  });
});

describe("startSessionCleanupScheduler", () => {
  afterEach(() => {
    sessionService.stopSessionCleanupScheduler();
    vi.useRealTimers();
  });

  function countSessions() {
    return (db.prepare("SELECT COUNT(*) AS n FROM sessions").get() as { n: number }).n;
  }

  function insertExpiredSession(tokenHash: string) {
    createSessionRow({ userId, tokenHash, expiresAt: new Date(Date.now() - 1000).toISOString() });
  }

  it("sweeps expired sessions immediately and again on each interval tick", () => {
    vi.useFakeTimers();
    db.prepare("DELETE FROM sessions").run();
    insertExpiredSession("sweep-now");
    const live = sessionService.createSession(userId);

    sessionService.startSessionCleanupScheduler();
    assert.equal(countSessions(), 1);
    assert.ok(sessionService.validateSession(live));

    insertExpiredSession("sweep-on-tick");
    assert.equal(countSessions(), 2);

    vi.advanceTimersByTime(60 * 60 * 1000);
    assert.equal(countSessions(), 1);
  });

  it("is a no-op when already started and stops cleanly", () => {
    vi.useFakeTimers();
    sessionService.startSessionCleanupScheduler();
    sessionService.startSessionCleanupScheduler();

    sessionService.stopSessionCleanupScheduler();
    db.prepare("DELETE FROM sessions").run();
    insertExpiredSession("after-stop");

    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    assert.equal(countSessions(), 1);
  });
});
