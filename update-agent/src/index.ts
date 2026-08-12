import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { startStatusPoller } from "./status/status-poller.js";

const app = createApp();

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`integritas-pi update-agent listening on port ${env.port}`);
  if (env.dryRun) {
    console.warn("[update-agent] UPDATE_DRY_RUN=true — applies will be simulated, not applied. Dev only, never set this in production.");
  }
});

await startStatusPoller();
