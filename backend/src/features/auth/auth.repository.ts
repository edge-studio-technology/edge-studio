import crypto from "node:crypto";
import { db } from "../../db/database.js";
import type { UserRecord } from "./auth.types.js";
import type { AdminCredentialType } from "./password.service.js";

export function countUsers() {
  const row = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  return row.count;
}

export function findTheUser(): UserRecord | undefined {
  return db.prepare("SELECT * FROM users LIMIT 1").get() as UserRecord | undefined;
}

export function getLocalAdminCredentialType(): AdminCredentialType | null {
  const row = db.prepare("SELECT credential_type FROM users LIMIT 1").get() as
    | { credential_type: AdminCredentialType }
    | undefined;
  return row?.credential_type ?? null;
}

export function findUserById(id: string): UserRecord | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRecord | undefined;
}

export function createUser(input: {
  username: string;
  passwordHash: string;
  credentialType: AdminCredentialType;
  role?: string;
}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, username, password, role, created_at, credential_type)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.username,
    input.passwordHash,
    input.role ?? "admin",
    now,
    input.credentialType
  );
  return id;
}

export function updateUserLastLogin(userId: string) {
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(now, userId);
}

export function createSessionRow(input: {
  userId: string;
  tokenHash: string;
  expiresAt: string;
}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.userId, input.tokenHash, now, input.expiresAt, now);
}

export function findSessionByTokenHash(tokenHash: string) {
  return db.prepare("SELECT * FROM sessions WHERE token_hash = ?").get(tokenHash) as
    | {
        id: string;
        user_id: string;
        token_hash: string;
        created_at: string;
        expires_at: string;
        last_seen_at: string;
      }
    | undefined;
}

export function updateSessionLastSeen(sessionId: string) {
  const now = new Date().toISOString();
  db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(now, sessionId);
}

export function deleteSessionByTokenHash(tokenHash: string) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function deleteAllUserSessions(userId: string) {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function deleteExpiredSessions() {
  const now = new Date().toISOString();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
}

export function updateUserPassword(userId: string, passwordHash: string, credentialType: AdminCredentialType) {
  db.prepare("UPDATE users SET password = ?, credential_type = ? WHERE id = ?").run(
    passwordHash,
    credentialType,
    userId
  );
}

export function updateUserCredentialType(userId: string, verifiedPasswordHash: string, credentialType: AdminCredentialType) {
  return db.prepare("UPDATE users SET credential_type = ? WHERE id = ? AND password = ?").run(
    credentialType,
    userId,
    verifiedPasswordHash
  ).changes > 0;
}

export function replaceUserPasswordHash(userId: string, verifiedPasswordHash: string, passwordHash: string) {
  return db.prepare("UPDATE users SET password = ? WHERE id = ? AND password = ?").run(
    passwordHash,
    userId,
    verifiedPasswordHash
  ).changes > 0;
}

export function insertAuditEvent(input: { userId?: string | null; action: string; detail?: string }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO audit_events (id, created_at, user_id, action, detail) VALUES (?, ?, ?, ?, ?)").run(
    id,
    now,
    input.userId ?? null,
    input.action,
    input.detail ?? null
  );
}
