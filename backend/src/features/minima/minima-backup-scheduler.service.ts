import { createBackup, getAutoBackupEnabled, hasBackupPassword } from "./minima-backup.service.js";

// Our own scheduler, not Minima's built-in `backup auto:true` (see minima-backup.service.ts
// header comment for why). Runs at a fixed nightly clock time rather than a rolling 24h
// interval from whenever the container happened to start, so backups land overnight instead
// of at a random hour. Uses the container's own system clock (`TZ` in docker-compose.yml,
// default UTC) — set TZ to the Pi's real local timezone for this to land at actual local
// night, otherwise 00:30 is UTC midnight-thirty.
const AUTO_BACKUP_HOUR = 0;
const AUTO_BACKUP_MINUTE = 30;

let timer: NodeJS.Timeout | null = null;
let running = false;
let stopped = true;

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(AUTO_BACKUP_HOUR, AUTO_BACKUP_MINUTE, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function scheduleNext() {
  if (stopped) return;
  timer = setTimeout(() => void runAutoBackupIfEnabled(), msUntilNextRun());
}

async function runAutoBackupIfEnabled() {
  if (running) return;
  running = true;
  try {
    if (getAutoBackupEnabled() && hasBackupPassword()) {
      const result = await createBackup({ auto: true });
      console.log(`Minima auto-backup: ${result.ok ? "completed" : "failed"} (${result.fileName})`);
    }
  } catch (error) {
    console.error("Minima auto-backup failed:", error instanceof Error ? error.message : error);
  } finally {
    running = false;
    scheduleNext();
  }
}

export function startMinimaAutoBackupScheduler() {
  if (timer) return;
  stopped = false;
  scheduleNext();
}

export function stopMinimaAutoBackupScheduler() {
  stopped = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
