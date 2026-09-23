import { env } from "./config/env.js";
import { db, runMigrations } from "./db/database.js";
import { createApp } from "./app.js";
import {
  startAutomationScheduler,
  stopAutomationScheduler,
} from "./features/automation/automation.service.js";
import {
  startIntegritasProofPoller,
  stopIntegritasProofPoller,
} from "./features/integritas/integritas-poll.service.js";
import {
  startMinimaHealthPoller,
  stopMinimaHealthPoller,
} from "./features/minima/minima-poll.service.js";
import {
  startMinimaAutoBackupScheduler,
  stopMinimaAutoBackupScheduler,
} from "./features/minima/minima-backup-scheduler.service.js";
import {
  startMqttIngestion,
  stopMqttIngestion,
} from "./features/data-sources/mqttIngestion.service.js";
import {
  startGpioIngestion,
  stopGpioIngestion,
} from "./features/data-sources/gpioIngestion.service.js";
import { stopGpioOutputHolders } from "./features/data-sources/gpioOutput.service.js";
import {
  startSessionCleanupScheduler,
  stopSessionCleanupScheduler,
} from "./features/auth/session.service.js";
import {
  startRetentionScheduler,
  stopRetentionScheduler,
} from "./features/retention/retention.service.js";
import { ensureDeviceId } from "./features/status/device.service.js";

runMigrations();
await ensureDeviceId();
startAutomationScheduler();
startIntegritasProofPoller();
startMinimaHealthPoller();
startMinimaAutoBackupScheduler();
startMqttIngestion();
startGpioIngestion();
startSessionCleanupScheduler();
startRetentionScheduler();

const app = createApp();

app.listen(env.port, "0.0.0.0", () => {
  console.log(`edge-studio backend listening on port ${env.port}`);
  console.log(`File access root: ${env.hostFilesRoot}`);
  console.log(`Minima status URL: ${env.minimaStatusUrl}`);
  console.log(`Integritas connect base URL: ${env.integritasConnectBaseUrl}`);
  console.log(`Integritas base URL: ${env.integritasBaseUrl}`);
  console.log(`SQLite database path: ${env.databasePath}`);
});

function shutdown() {
  stopAutomationScheduler();
  stopIntegritasProofPoller();
  stopMinimaHealthPoller();
  stopMinimaAutoBackupScheduler();
  stopMqttIngestion();
  stopGpioIngestion();
  stopGpioOutputHolders();
  stopSessionCleanupScheduler();
  stopRetentionScheduler();
  db.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
