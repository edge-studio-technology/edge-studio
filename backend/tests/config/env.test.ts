import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

/** env is read once at module load, so each case needs a fresh module registry. */
async function loadEnv(overrides: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
  return (await import("../../src/config/env.js")).env;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("resource limit configuration", () => {
  it("uses the documented defaults when nothing is set", async () => {
    const env = await loadEnv({});

    assert.equal(env.egressMaxResponseBytes, 5 * 1024 * 1024);
    assert.equal(env.egressTimeoutMs, 5000);
    assert.equal(env.egressMaxConcurrent, 4);
    assert.equal(env.egressQueueLimit, 32);
    assert.equal(env.uploadMaxFileBytes, 100 * 1024 * 1024);
    assert.equal(env.uploadMaxFiles, 1);
    assert.equal(env.uploadMaxFields, 8);
    assert.equal(env.mqttMaxPayloadBytes, 256 * 1024);
  });

  it("honours an operator value inside the supported range", async () => {
    const env = await loadEnv({ EGRESS_MAX_RESPONSE_BYTES: String(20 * 1024 * 1024), EGRESS_MAX_CONCURRENT: "8" });

    assert.equal(env.egressMaxResponseBytes, 20 * 1024 * 1024);
    assert.equal(env.egressMaxConcurrent, 8);
  });

  it("clamps a value above the hard maximum rather than honouring it", async () => {
    const env = await loadEnv({
      EGRESS_MAX_RESPONSE_BYTES: String(500 * 1024 * 1024),
      EGRESS_TIMEOUT_MS: "600000",
      EGRESS_MAX_CONCURRENT: "512",
      EGRESS_QUEUE_LIMIT: "100000",
      MQTT_MAX_PAYLOAD_BYTES: String(64 * 1024 * 1024)
    });

    assert.equal(env.egressMaxResponseBytes, 50 * 1024 * 1024);
    assert.equal(env.egressTimeoutMs, 60000);
    assert.equal(env.egressMaxConcurrent, 16);
    assert.equal(env.egressQueueLimit, 256);
    assert.equal(env.mqttMaxPayloadBytes, 4 * 1024 * 1024);
  });

  it("clamps a value below the floor, so a limit cannot be set to zero or negative", async () => {
    const env = await loadEnv({ EGRESS_MAX_CONCURRENT: "0", EGRESS_QUEUE_LIMIT: "-5", EGRESS_TIMEOUT_MS: "1" });

    assert.equal(env.egressMaxConcurrent, 1);
    assert.equal(env.egressQueueLimit, 1);
    assert.equal(env.egressTimeoutMs, 100);
  });

  it("falls back to the default when the value is not a number", async () => {
    const env = await loadEnv({ EGRESS_MAX_CONCURRENT: "unlimited" });
    assert.equal(env.egressMaxConcurrent, 4);
  });

  it("lets the upload size cap be raised without a ceiling, since stamping large files is the product", async () => {
    const env = await loadEnv({ UPLOAD_MAX_FILE_BYTES: String(4 * 1024 * 1024 * 1024) });
    assert.equal(env.uploadMaxFileBytes, 4 * 1024 * 1024 * 1024);
  });
});
