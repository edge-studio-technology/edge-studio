import "./config/loadEnv.js";
import { startWithAppSecret } from "./config/app-secret.js";
import { env } from "./config/env.js";

let startup: Promise<unknown>;
try {
  startup = startWithAppSecret(env.appSecret, () => import("./startup.js"));
} catch (error) {
  console.error(error instanceof Error ? error.message : "ERROR: APP_SECRET is required.");
  process.exit(1);
}

await startup;
