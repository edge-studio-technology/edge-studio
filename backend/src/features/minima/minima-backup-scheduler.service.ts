import { createBackup, getAutoBackupEnabled, hasBackupPassword } from "./minima-backup.service.js";

// Our own scheduler, not Minima's built-in `backup auto:true` (see minima-backup.service.ts
// header comment for why). Mirrors the shape of minima-poll.service.ts's health poller, but
// with a short initial delay instead of an immediate first run, so enabling this doesn't
// force a backup on every container restart during normal operation/deploys.
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const AUTO_BACKUP_INITIAL_DELAY_MS = 5 * 60 * 1000;

let initialTimer: NodeJS.Timeout | null = null;
let interval: NodeJS.Timeout | null = null;
let running = false;

async function runAutoBackupIfEnabled() {
  if (running) return;
  running = true;
  try {
    if (!getAutoBackupEnabled() || !hasBackupPassword()) return;
    const result = await createBackup({ auto: true });
    console.log(`Minima auto-backup: ${result.ok ? "completed" : "failed"} (${result.fileName})`);
  } catch (error) {
    console.error("Minima auto-backup failed:", error instanceof Error ? error.message : error);
  } finally {
    running = false;
  }
}

export function startMinimaAutoBackupScheduler() {
  if (initialTimer || interval) return;
  initialTimer = setTimeout(() => {
    initialTimer = null;
    void runAutoBackupIfEnabled();
    interval = setInterval(() => void runAutoBackupIfEnabled(), AUTO_BACKUP_INTERVAL_MS);
  }, AUTO_BACKUP_INITIAL_DELAY_MS);
}

export function stopMinimaAutoBackupScheduler() {
  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
