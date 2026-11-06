import { env } from "../../config/env.js";
import { db } from "../../db/database.js";
import { sha256Hex } from "../../shared/crypto.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";
import { recordAuditEvent } from "./audit.service.js";
import { deleteExpiredSessions, findSessionByTokenHash, findUserById, shortenSessionExpiries } from "./auth.repository.js";
import { verifyPassword } from "./password.service.js";

export type SessionSettings = { maxAgeDays: number; idleHours: number };
export const SESSION_LIMITS = { maxAgeDays: { min: 1, max: 30 }, idleHours: { min: 1, max: 168 } } as const;
const defaults: SessionSettings = { maxAgeDays: 7, idleHours: 24 };
const key = "session_settings";

export class SessionSettingsError extends Error {
  constructor(message: string, public readonly status: number, public readonly fieldErrors?: Record<string, string>) { super(message); }
}

function validate(input: unknown): SessionSettings {
  const value = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  for (const [field, range] of Object.entries(SESSION_LIMITS)) {
    const number = value[field];
    if (typeof number !== "number" || !Number.isInteger(number) || number < range.min || number > range.max)
      errors[field] = `Enter a whole number from ${range.min} to ${range.max}.`;
  }
  if (Object.keys(errors).length) throw new SessionSettingsError("Check the session settings.", 400, errors);
  return { maxAgeDays: value.maxAgeDays as number, idleHours: value.idleHours as number };
}

export function getSessionSettings(): SessionSettings {
  const stored = getSetting(key);
  if (stored) return validate(JSON.parse(stored));
  const settings = { maxAgeDays: env.sessionMaxAgeDays, idleHours: env.sessionIdleHours };
  for (const field of Object.keys(SESSION_LIMITS) as (keyof SessionSettings)[]) {
    const range = SESSION_LIMITS[field];
    if (!Number.isInteger(settings[field]) || settings[field] < range.min || settings[field] > range.max) {
      console.warn(`Invalid legacy session setting ${field}; using its safe default.`);
      settings[field] = defaults[field];
    }
  }
  saveSetting(key, JSON.stringify(settings));
  return settings;
}

export function isSessionExpired(session: { created_at: string; expires_at: string; last_seen_at: string }, settings: SessionSettings, now = Date.now()) {
  const deadline = Math.min(Date.parse(session.expires_at), Date.parse(session.created_at) + settings.maxAgeDays * 86400000, Date.parse(session.last_seen_at) + settings.idleHours * 3600000);
  return !Number.isFinite(deadline) || now >= deadline;
}

export async function saveSessionSettings(userId: string, input: unknown, currentPassword: string, rawToken: string) {
  const settings = validate(input);
  const user = findUserById(userId);
  if (!user || !await verifyPassword(currentPassword, user.password))
    throw new SessionSettingsError("Invalid current PIN or password.", 403);

  return db.transaction(() => {
    const current = findUserById(userId);
    const session = findSessionByTokenHash(sha256Hex(rawToken));
    const previous = getSessionSettings();
    if (!current || current.role !== "admin" || current.password !== user.password || !session || session.user_id !== userId || isSessionExpired(session, previous))
      throw new SessionSettingsError("Your session changed or expired. Log in again before changing session settings.", 401);

    const previouslyExpired = deleteExpiredSessions(previous.maxAgeDays, previous.idleHours);
    saveSetting(key, JSON.stringify(settings));
    shortenSessionExpiries(settings.maxAgeDays);
    const revokedSessions = previouslyExpired + deleteExpiredSessions(settings.maxAgeDays, settings.idleHours);
    const currentSessionExpired = !findSessionByTokenHash(sha256Hex(rawToken));
    recordAuditEvent("auth.session_settings_changed", { userId, detail: JSON.stringify({ previous, settings, revokedSessions }) });
    return { settings, revokedSessions, currentSessionExpired };
  }).immediate();
}
