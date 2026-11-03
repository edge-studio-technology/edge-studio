import { getJson, postJson } from "../../lib/api";
import type { AuthUser, SetupStatus } from "./types";

export async function getSetupStatus(): Promise<SetupStatus> {
  const status = await getJson<SetupStatus>("/api/setup/status");
  return {
    ...status,
    credentialType: status.credentialType === "pin" || status.credentialType === "password"
      ? status.credentialType
      : null,
  };
}

export async function getMe() {
  return getJson<AuthUser>("/api/auth/me");
}

export async function login(input: { password: string }) {
  return postJson<{ success: boolean; user: AuthUser }>("/api/auth/login", input);
}

export async function logout() {
  return postJson<{ success: boolean }>("/api/auth/logout");
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  return postJson<{ success: boolean }>("/api/auth/settings/password", input);
}

type SessionSettings = { maxAgeDays: number; idleHours: number };
export type SessionSettingsResponse = {
  settings: SessionSettings;
  limits: Record<keyof SessionSettings, { min: number; max: number }>;
};
export function getSessionSettings() {
  return getJson<SessionSettingsResponse>("/api/auth/settings/session");
}
export function saveSessionSettings(settings: SessionSettings, currentPassword: string) {
  return postJson<{ settings: SessionSettings; revokedSessions: number; currentSessionExpired: boolean }>("/api/auth/settings/session", { settings, currentPassword });
}
