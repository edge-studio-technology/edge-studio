import type { MinimaAutoBackupResponse, MinimaBackupCreateResult, MinimaBackupListResponse, MinimaCommandResult } from "../../app/types";
import { deleteJson, getJson, postForm, postJson } from "../../lib/api";

export function listMinimaBackups() {
  return getJson<MinimaBackupListResponse>("/api/minima/backups");
}

export function createMinimaBackup(password: string) {
  return postJson<MinimaBackupCreateResult>("/api/minima/backups", password ? { password } : undefined);
}

export async function downloadMinimaBackup(fileName: string, currentPassword: string) {
  const response = await fetch(`/api/minima/backups/${encodeURIComponent(fileName)}/download`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword })
  });
  if (!response.ok) {
    const parsed = await response.json().catch(() => ({}));
    const error = new Error(parsed?.error || `HTTP ${response.status}`) as Error & { errorCode?: string };
    if (typeof parsed?.errorCode === "string") error.errorCode = parsed.errorCode;
    throw error;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function restoreMinimaBackup(input: { fileName: string; password: string; currentPassword: string }) {
  return postJson<MinimaCommandResult>("/api/minima/backups/restore", input);
}

export function restoreMinimaBackupFromUpload(input: { file: File; password: string; currentPassword: string }) {
  const form = new FormData();
  form.append("file", input.file);
  form.append("currentPassword", input.currentPassword);
  if (input.password) form.append("password", input.password);
  return postForm<MinimaCommandResult>("/api/minima/backups/restore", form);
}

export function deleteMinimaBackup(fileName: string) {
  return deleteJson<{ ok: boolean }>(`/api/minima/backups/${encodeURIComponent(fileName)}`);
}

export function getAutoBackupEnabled() {
  return getJson<MinimaAutoBackupResponse>("/api/minima/backups/auto");
}

export function setAutoBackupEnabled(enabled: boolean) {
  return postJson<MinimaAutoBackupResponse>("/api/minima/backups/auto", { enabled });
}
