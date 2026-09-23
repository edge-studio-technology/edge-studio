import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../helpers/testDatabase.js";

// Built at runtime so failure output never echoes a literal credential.
const WEBHOOK_TOKEN = ["hook", "token", "live"].join("-");
const ORPHAN_WEBHOOK_TOKEN = ["hook", "token", "orphan"].join("-");
const BROKER_PASSWORD = ["broker", "password"].join("-");
const BROKER_USER_TOKEN = ["broker", "user", "token"].join("-");

let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let runMigrations: typeof import("../../src/db/database.js")["runMigrations"];

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  ({ runMigrations } = await import("../../src/db/database.js"));
});

afterAll(() => {
  teardown();
});

function insertSource(id: string, type: string) {
  const now = new Date().toISOString();
  db.prepare("INSERT INTO data_sources (id, created_at, updated_at, name, type, status, config) VALUES (?, ?, ?, ?, ?, 'active', '{}')")
    .run(id, now, now, id, type);
}

function insertRead(id: string, dataSourceId: string | null, sourceUrl: string) {
  db.prepare("INSERT INTO data_source_reads (id, created_at, data_source_id, source_name, source_url, trigger_type, status) VALUES (?, ?, ?, 'Source', ?, 'webhook', 'success')")
    .run(id, new Date().toISOString(), dataSourceId, sourceUrl);
}

function sourceUrls() {
  const rows = db.prepare("SELECT id, source_url FROM data_source_reads").all() as { id: string; source_url: string }[];
  return Object.fromEntries(rows.map((row) => [row.id, row.source_url]));
}

describe("runMigrations — data_source_reads.source_url scrub", () => {
  it("replaces push-source URLs with source references, sanitizes orphans, and leaves safe rows alone", () => {
    insertSource("webhook-1", "webhook");
    insertSource("mqtt-1", "mqtt");
    insertSource("gpio-1", "gpio-input");
    insertSource("api-1", "json-api");

    insertRead("live-webhook", "webhook-1", `/api/data-source-webhooks/${WEBHOOK_TOKEN}`);
    insertRead("live-mqtt", "mqtt-1", `mqtt://sensor:${BROKER_PASSWORD}@broker.local:1883 devices/temp`);
    insertRead("live-gpio", "gpio-1", "PIR motion gpiochip0 GPIO17");
    insertRead("already-safe-ref", "webhook-1", "data-source:webhook-1");
    insertSource("deleted-webhook", "webhook");
    insertSource("deleted-mqtt", "mqtt");
    insertRead("orphan-webhook", "deleted-webhook", `/api/data-source-webhooks/${ORPHAN_WEBHOOK_TOKEN}`);
    insertRead("orphan-mqtt-user", "deleted-mqtt", `mqtt://${BROKER_USER_TOKEN}@broker.local:1883 devices/temp`);
    insertRead("orphan-mqtt-password", "deleted-mqtt", `mqtt://sensor:${BROKER_PASSWORD}@broker.local:1883 devices/temp`);
    // Deleting a source nulls data_source_id on its reads, leaving the stored URL behind.
    db.prepare("DELETE FROM data_sources WHERE id IN ('deleted-webhook', 'deleted-mqtt')").run();
    insertRead("safe-api", "api-1", "https://api.example.com/data");
    insertRead("safe-at-in-query", "api-1", "https://api.example.com/users?email=a@b.example");
    insertRead("safe-sensor", null, "bme280:i2c-1:0x76");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      runMigrations();
      const once = sourceUrls();
      runMigrations();
      assert.deepEqual(sourceUrls(), once, "second migration run changed rows");

      assert.equal(once["live-webhook"], "data-source:webhook-1");
      assert.equal(once["live-mqtt"], "data-source:mqtt-1");
      assert.equal(once["live-gpio"], "data-source:gpio-1");
      assert.equal(once["already-safe-ref"], "data-source:webhook-1");
      assert.equal(once["orphan-webhook"], "/api/data-source-webhooks/[redacted]");
      assert.equal(once["orphan-mqtt-user"], "mqtt://[redacted]@broker.local:1883 devices/temp");
      assert.equal(once["orphan-mqtt-password"], "mqtt://sensor:[redacted]@broker.local:1883 devices/temp");
      assert.equal(once["safe-api"], "https://api.example.com/data");
      assert.equal(once["safe-at-in-query"], "https://api.example.com/users?email=a@b.example");
      assert.equal(once["safe-sensor"], "bme280:i2c-1:0x76");

      const stored = JSON.stringify(db.prepare("SELECT * FROM data_source_reads").all());
      for (const secret of [WEBHOOK_TOKEN, ORPHAN_WEBHOOK_TOKEN, BROKER_PASSWORD, BROKER_USER_TOKEN]) {
        assert.equal(stored.includes(secret), false, "a credential survived the scrub");
      }

      const logged = JSON.stringify([...logSpy.mock.calls, ...errorSpy.mock.calls]);
      for (const secret of [WEBHOOK_TOKEN, ORPHAN_WEBHOOK_TOKEN, BROKER_PASSWORD, BROKER_USER_TOKEN]) {
        assert.equal(logged.includes(secret), false, "the migration logged a credential");
      }
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

describe("runMigrations — retention and budget schema", () => {
  it("creates the workflow budget ledger with a unique run id and the retention/budget indexes", () => {
    const columns = db.prepare("PRAGMA table_info(automation_workflow_budget_events)").all() as { name: string; pk: number }[];
    assert.deepEqual(columns.map((column) => column.name).sort(), ["consumed_at", "run_id", "workflow_id"]);
    assert.equal(columns.find((column) => column.name === "run_id")?.pk, 1);

    const indexes = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as { name: string }[]).map((row) => row.name);
    assert.ok(indexes.includes("idx_automation_block_runs_started"));
    assert.ok(indexes.includes("idx_automation_inbox_items_deleted"));
    assert.ok(indexes.includes("idx_automation_workflow_budget_events_workflow_consumed"));
  });
});
