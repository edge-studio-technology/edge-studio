import { getSetting, saveSetting } from "../settings/settings.repository.js";
import { createBackup, getAutoBackupEnabled, hasBackupPassword } from "./minima-backup.service.js";
import { getAutoRestartEnabled, restartMinimaContainer } from "./minima.service.js";

// Our own scheduler, not Minima's built-in `backup auto:true` (see minima-backup.service.ts
// header comment for why). Runs at a fixed nightly clock time rather than a rolling 24h
// interval from whenever the container happened to start, so backups land overnight instead
// of at a random hour. Uses the container's own system clock (`TZ` in docker-compose.yml,
// default UTC) — set TZ to the Pi's real local timezone for this to land at actual local
// night, otherwise 00:30 is UTC midnight-thirty.
const AUTO_BACKUP_HOUR = 0;
const AUTO_BACKUP_MINUTE = 30;

// The nightly auto-restart (opt-in, for node health per a coworker's recommendation) reuses
// this same nightly tick rather than its own timer, gated to every other night by comparing
// against a persisted last-run timestamp (survives backend restarts, unlike an in-memory
// counter). Runs after the backup attempt so a restart never interrupts one.
const AUTO_RESTART_INTERVAL_MS = 48 * 60 * 60 * 1000;
const lastAutoRestartSetting = "minima_last_auto_restart_at";

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
  timer = setTimeout(() => void runNightlyTick(), msUntilNextRun());
}

async function runAutoBackupIfEnabled() {
  if (getAutoBackupEnabled() && hasBackupPassword()) {
    const result = await createBackup({ auto: true });
    console.log(`Minima auto-backup: ${result.ok ? "completed" : "failed"} (${result.fileName})`);
  }
}

async function runAutoRestartIfDue() {
  if (!getAutoRestartEnabled()) return;
  const lastRunAt = getSetting(lastAutoRestartSetting);
  if (lastRunAt && Date.now() - new Date(lastRunAt).getTime() < AUTO_RESTART_INTERVAL_MS) return;

  await restartMinimaContainer();
  saveSetting(lastAutoRestartSetting, new Date().toISOString());
  console.log("Minima auto-restart: triggered");
}

async function runNightlyTick() {
  if (running) return;
  running = true;
  try {
    await runAutoBackupIfEnabled();
  } catch (error) {
    console.error("Minima auto-backup failed:", error instanceof Error ? error.message : error);
  }
  try {
    await runAutoRestartIfDue();
  } catch (error) {
    console.error("Minima auto-restart failed:", error instanceof Error ? error.message : error);
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
