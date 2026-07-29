import fs from "node:fs/promises";
import path from "node:path";
import { findUserById } from "../auth/auth.repository.js";
import { verifyPassword } from "../auth/password.service.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";
import { beginMinimaOperation, endMinimaOperation } from "./minima-monitoring.js";
import { runMinimaPathCommand } from "./minima.rpc.js";
import { getMinimaConfig } from "./minima.service.js";

export class MinimaBackupError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Same re-auth pattern as updateConsoleWhitelist (minima-console.service.ts) — backup
// files can contain unencrypted private keys, so download/restore require re-entering
// the current admin credential, not just an active session.
export async function verifyCurrentPassword(userId: string | undefined, currentPassword: string) {
  if (!userId) throw new MinimaBackupError("Unauthorized", 401);
  const user = findUserById(userId);
  if (!user) throw new MinimaBackupError("User not found", 404);
  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) throw new MinimaBackupError("Invalid current credential", 401);
}

// Fixed container path for the shared backend<->minima volume — see docker-compose.yml
// (`${MINIMA_DATA_DIR:-./minima}/backups:/minima-backups`), mirroring the hardcoded
// /home/minima/data constant in minima.docker.ts. Relative to the minima container's own
// data dir this is `backups/`, which is the path used in RPC commands below.
const backupsRoot = "/minima-backups";
const autoBackupSetting = "minima_auto_backup_enabled";

export type MinimaBackupEntry = {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
};

async function ensureBackupsRoot() {
  await fs.mkdir(backupsRoot, { recursive: true });
}

// Same resolve-then-realpath containment check as files.service.ts, applied here as
// defense in depth even though backupsRoot is a fixed, non-configurable path.
async function resolveBackupPath(fileName: string) {
  if (!fileName || fileName !== path.basename(fileName)) {
    const error = new Error("Invalid backup file name") as NodeJS.ErrnoException;
    error.code = "OUTSIDE_ROOT";
    throw error;
  }

  const absolutePath = path.resolve(backupsRoot, fileName);
  if (absolutePath !== backupsRoot && !absolutePath.startsWith(`${backupsRoot}${path.sep}`)) {
    const error = new Error("Path is outside the allowed directory") as NodeJS.ErrnoException;
    error.code = "OUTSIDE_ROOT";
    throw error;
  }

  await ensureBackupsRoot();
  const rootRealPath = await fs.realpath(backupsRoot);
  const targetRealPath = await fs.realpath(absolutePath).catch(() => absolutePath);
  if (targetRealPath !== rootRealPath && !targetRealPath.startsWith(`${rootRealPath}${path.sep}`)) {
    const error = new Error("Path is outside the allowed directory") as NodeJS.ErrnoException;
    error.code = "OUTSIDE_ROOT";
    throw error;
  }

  return absolutePath;
}

function backupFileName() {
  return `minima-${new Date().toISOString().replace(/[:.]/g, "-")}.bak`;
}

function quotedPasswordArg(password: string | undefined) {
  const trimmed = password?.trim();
  return trimmed ? ` password:"${trimmed}"` : "";
}

export async function listBackups(): Promise<MinimaBackupEntry[]> {
  await ensureBackupsRoot();
  const entries = await fs.readdir(backupsRoot, { withFileTypes: true });
  const backups = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".bak"))
      .map(async (entry) => {
        const stat = await fs.stat(path.join(backupsRoot, entry.name));
        return { fileName: entry.name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
      })
  );
  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getBackupFilePath(fileName: string) {
  const absolutePath = await resolveBackupPath(fileName);
  await fs.access(absolutePath);
  return absolutePath;
}

export async function createBackup({ password }: { password?: string } = {}) {
  await ensureBackupsRoot();
  const fileName = backupFileName();
  const command = `backup file:backups/${fileName}${quotedPasswordArg(password)}`;
  beginMinimaOperation("backup");
  try {
    const result = await runMinimaPathCommand(command, 60000);
    return { ...result, fileName };
  } catch (error) {
    endMinimaOperation();
    throw error;
  }
}

export async function restoreBackup({ fileName, password }: { fileName: string; password?: string }) {
  const absolutePath = await resolveBackupPath(fileName);
  await fs.access(absolutePath);
  const { megammrHost } = getMinimaConfig();
  const command = `restoresync file:backups/${fileName} host:${megammrHost}${quotedPasswordArg(password)}`;
  beginMinimaOperation("restore");
  try {
    return await runMinimaPathCommand(command, 60000);
  } catch (error) {
    endMinimaOperation();
    throw error;
  }
}

export async function deleteBackup(fileName: string) {
  const absolutePath = await resolveBackupPath(fileName);
  await fs.unlink(absolutePath);
}

// Moves an uploaded restore file (multer tmpdir) into the shared backups dir. Uses
// copyFile+rm instead of rename since the tmp upload dir and /minima-backups are on
// different mounts (rename across filesystems fails with EXDEV).
export async function saveUploadedBackup(tmpFilePath: string, originalName: string) {
  await ensureBackupsRoot();
  const baseName = path.basename(originalName) || "uploaded.bak";
  const safeName = baseName.endsWith(".bak") ? baseName : `${baseName}.bak`;
  const fileName = `${Date.now()}-${safeName.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  const destPath = await resolveBackupPath(fileName);
  await fs.copyFile(tmpFilePath, destPath);
  await fs.rm(tmpFilePath, { force: true });
  return fileName;
}

export function getAutoBackupEnabled() {
  return getSetting(autoBackupSetting) === "true";
}

// Verified live: `backup auto:true` alone writes its rolling backup to
// /home/minima/data/minima-backup-<ts>.bak — outside the shared backups/ folder and
// invisible to listBackups(). Passing file: alongside auto:true redirects it into the
// shared folder instead, onto one fixed, overwritten-in-place file.
const autoBackupFileName = "auto-backup.bak";

export async function setAutoBackupEnabled(enabled: boolean) {
  const command = enabled ? `backup auto:true file:backups/${autoBackupFileName}` : "backup auto:false";
  const result = await runMinimaPathCommand(command, 30000);
  saveSetting(autoBackupSetting, enabled ? "true" : "false");
  return { ...result, autoBackupEnabled: enabled };
}
