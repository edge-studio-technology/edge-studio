import fs from "node:fs/promises";
import path from "node:path";
import { findUserById } from "../auth/auth.repository.js";
import { verifyPassword } from "../auth/password.service.js";
import { decryptSecret, encryptSecret, type EncryptedSecret } from "../../shared/crypto.js";
import { deleteSetting, getBoolSetting, getSetting, saveSetting, setBoolSetting } from "../settings/settings.repository.js";
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
// files can contain key material, so download/restore/password changes require
// re-entering the current admin credential, not just an active session.
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
const backupPasswordSetting = "minima_backup_password_enc";

// Minima's own built-in `backup auto:true` scheduler is not used (see docs/plans —
// its recurring runs always use Minima's hardcoded default password and always land
// outside any folder we can see, with no configurable path or password). Instead we run
// our own scheduler (minima-backup-scheduler.service.ts) against one admin-chosen
// password, set once and reused for every backup — manual or auto.
export function hasBackupPassword() {
  return Boolean(getSetting(backupPasswordSetting));
}

// Rejected outright rather than escaped: the password is embedded in a quoted
// Minima RPC command argument (see createBackup/restoreBackup below), and Minima's
// own command parser has no documented escape sequence for an embedded `"`.
export function setBackupPassword(password: string) {
  const trimmed = password.trim();
  if (!trimmed) throw new MinimaBackupError("Backup password is required", 400);
  if (trimmed.includes('"')) {
    throw new MinimaBackupError('Backup password cannot contain a " character', 400);
  }
  saveSetting(backupPasswordSetting, JSON.stringify(encryptSecret(trimmed)));
}

export function clearBackupPassword() {
  deleteSetting(backupPasswordSetting);
  setBoolSetting(autoBackupSetting, false);
}

function getBackupPassword(): string {
  const stored = getSetting(backupPasswordSetting);
  if (!stored) return "";
  try {
    return decryptSecret(JSON.parse(stored) as EncryptedSecret);
  } catch {
    return "";
  }
}

// One rolling list regardless of trigger source — every backup uses the same admin-chosen
// password, so all of them are equally downloadable/restorable. Oldest is pruned once the
// cap is exceeded, same as the old auto-only list did.
const MAX_BACKUPS = 20;

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

function backupFileName(auto: boolean) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return auto ? `minima-auto-${stamp}.bak` : `minima-manual-${stamp}.bak`;
}

export async function listBackups(): Promise<MinimaBackupEntry[]> {
  await ensureBackupsRoot();
  const entries = await fs.readdir(backupsRoot, { withFileTypes: true });
  const all = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".bak"))
      .map(async (entry) => {
        const stat = await fs.stat(path.join(backupsRoot, entry.name));
        return { fileName: entry.name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
      })
  );
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getBackupFilePath(fileName: string) {
  const absolutePath = await resolveBackupPath(fileName);
  await fs.access(absolutePath);
  return absolutePath;
}

export async function createBackup({ auto = false }: { auto?: boolean } = {}) {
  const password = getBackupPassword();
  if (!password) {
    throw new MinimaBackupError("Set a backup password before creating a backup.", 400);
  }

  const fileName = backupFileName(auto);
  const command = `backup file:backups/${fileName} password:"${password}"`;
  beginMinimaOperation("backup");
  try {
    const result = await runMinimaPathCommand(command, 60000);

    const existing = await listBackups();
    if (existing.length > MAX_BACKUPS) {
      const oldest = existing[existing.length - 1];
      if (oldest) await deleteBackup(oldest.fileName).catch(() => undefined);
    }

    return { ...result, fileName, auto };
  } catch (error) {
    endMinimaOperation();
    throw error;
  }
}

export async function restoreBackup({ fileName, password }: { fileName: string; password?: string }) {
  const absolutePath = await resolveBackupPath(fileName);
  await fs.access(absolutePath);
  const { megammrHost } = getMinimaConfig();
  // Explicit password wins (needed for an uploaded/foreign .bak with an unknown history);
  // otherwise fall back to our own stored password, since that's what protects every
  // backup this service itself created.
  const trimmed = password?.trim() || getBackupPassword();
  if (trimmed.includes('"')) {
    throw new MinimaBackupError('Restore password cannot contain a " character', 400);
  }
  const passwordArg = trimmed ? ` password:"${trimmed}"` : "";
  const command = `restoresync file:backups/${fileName} host:${megammrHost}${passwordArg}`;
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
  return getBoolSetting(autoBackupSetting);
}

export function setAutoBackupEnabled(enabled: boolean) {
  if (enabled && !hasBackupPassword()) {
    throw new MinimaBackupError("Set a backup password before enabling automatic backups.", 400);
  }
  setBoolSetting(autoBackupSetting, enabled);
  return { autoBackupEnabled: enabled };
}
