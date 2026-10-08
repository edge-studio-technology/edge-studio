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

describe("runMigrations — legacy credential metadata", () => {
  it("defaults pre-flag accounts to password, preserves their fields, and retains corrected types on rerun", () => {
    db.exec(`
      CREATE TABLE legacy_users (
        id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
        totp_secret TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin',
        created_at TEXT NOT NULL, last_login TEXT
      );
      DROP TABLE users;
      ALTER TABLE legacy_users RENAME TO users;
      INSERT INTO users VALUES ('legacy-pin', 'admin-pin', 'pin-hash', 'pin-totp', 'admin', '2026-01-01', NULL);
      INSERT INTO users VALUES ('legacy-password', 'admin-password', 'password-hash', 'password-totp', 'admin', '2026-01-02', '2026-01-03');
    `);
    const original = db.prepare("SELECT * FROM users ORDER BY id").all() as object[];
    runMigrations();
    assert.deepEqual(db.prepare("SELECT * FROM users ORDER BY id").all(), original.map((row) => ({ ...row, credential_type: "password" })));
    const column = (db.prepare("PRAGMA table_info(users)").all() as { name: string; notnull: number; dflt_value: string }[])
      .find((item) => item.name === "credential_type");
    assert.equal(column?.notnull, 1);
    assert.equal(column?.dflt_value, "'password'");

    db.prepare("UPDATE users SET credential_type = 'pin' WHERE id = 'legacy-pin'").run();
    const corrected = db.prepare("SELECT * FROM users ORDER BY id").all();
    runMigrations();
    runMigrations();
    assert.deepEqual(db.prepare("SELECT * FROM users ORDER BY id").all(), corrected);
  });
});

describe("runMigrations — local address-book identity", () => {
  it("upgrades an existing address book without changing saved fields and is repeatable", () => {
    db.exec(`
      DROP TABLE address_book;
      CREATE TABLE address_book (
        id TEXT PRIMARY KEY, label TEXT NOT NULL, address TEXT NOT NULL UNIQUE,
        notes TEXT, created_at TEXT NOT NULL
      );
      INSERT INTO address_book VALUES ('saved', 'Saved label', '0x01', 'Saved notes', '2026-01-01');
    `);
    runMigrations();
    const rows = db.prepare("SELECT * FROM address_book").all();
    assert.deepEqual(rows, [{ id: "saved", label: "Saved label", address: "0x01", notes: "Saved notes", created_at: "2026-01-01", is_local_device: 0 }]);
    db.prepare("UPDATE address_book SET is_local_device = 1 WHERE id = 'saved'").run();
    runMigrations();
    runMigrations();
    assert.deepEqual(db.prepare("SELECT * FROM address_book").all(), [{ ...rows[0] as object, is_local_device: 1 }]);

    const column = (db.prepare("PRAGMA table_info(address_book)").all() as { name: string; notnull: number; dflt_value: string }[])
      .find((item) => item.name === "is_local_device");
    assert.equal(column?.notnull, 1);
    assert.equal(column?.dflt_value, "0");
    db.exec("INSERT INTO address_book (id, label, address, created_at) VALUES ('ordinary', 'Ordinary', '0x02', '2026-01-02');");
    assert.throws(() => db.exec("UPDATE address_book SET is_local_device = 1 WHERE id = 'ordinary'"), /UNIQUE/);
  });

  it("removes legacy global uniqueness while preserving manual contacts and their references", () => {
    db.exec(`
      DROP TABLE address_book;
      CREATE TABLE address_book (
        id TEXT PRIMARY KEY, label TEXT NOT NULL, address TEXT NOT NULL UNIQUE,
        notes TEXT, created_at TEXT NOT NULL
      );
      INSERT INTO address_book VALUES ('manual', 'My node', '0x01', 'My notes', '2026-01-01');
      INSERT INTO address_book VALUES ('alias', 'My alias', '0X01', NULL, '2026-01-02');
      INSERT INTO automation_workflows (id, created_at, updated_at, name, enabled)
        VALUES ('address-book-migration', '2026-01-01', '2026-01-01', 'Saved workflow', 0);
      INSERT INTO automation_blocks (id, workflow_id, created_at, updated_at, type, enabled, order_index, config_json)
        VALUES ('address-book-reference', 'address-book-migration', '2026-01-01', '2026-01-01', 'send_transaction', 1, 0,
          '{"recipientAddressBookId":"manual"}');
    `);
    const original = db.prepare("SELECT * FROM address_book ORDER BY id").all() as object[];
    runMigrations();
    assert.deepEqual(db.prepare("SELECT * FROM address_book ORDER BY id").all(), original.map((row) => ({ ...row, is_local_device: 0 })));
    assert.deepEqual(db.prepare("SELECT config_json FROM automation_blocks WHERE id = 'address-book-reference'").get(), {
      config_json: '{"recipientAddressBookId":"manual"}'
    });

    db.exec(`INSERT INTO address_book (id, label, address, created_at, is_local_device)
      VALUES ('local', 'This device', '0x01', '2026-01-03', 1);`);
    const migrated = db.prepare("SELECT * FROM address_book ORDER BY id").all();
    runMigrations();
    runMigrations();
    assert.deepEqual(db.prepare("SELECT * FROM address_book ORDER BY id").all(), migrated);
    assert.throws(() => db.exec(`INSERT INTO address_book (id, label, address, created_at)
      VALUES ('duplicate', 'Duplicate manual', '0x01', '2026-01-04');`), /UNIQUE/);
  });

  it("preserves a local marker from the earlier step 1 schema and supports a later manual copy", () => {
    db.exec(`
      DROP TABLE address_book;
      CREATE TABLE address_book (
        id TEXT PRIMARY KEY, label TEXT NOT NULL, address TEXT NOT NULL UNIQUE,
        notes TEXT, created_at TEXT NOT NULL, is_local_device INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO address_book VALUES ('local', 'This device', '0x01', 'Local notes', '2026-01-01', 1);
      INSERT INTO address_book VALUES ('manual', 'Alice', '0x02', 'Manual notes', '2026-01-02', 0);
      CREATE UNIQUE INDEX idx_address_book_local_device ON address_book(is_local_device) WHERE is_local_device = 1;
    `);
    const original = db.prepare("SELECT * FROM address_book ORDER BY id").all();
    runMigrations();
    assert.deepEqual(db.prepare("SELECT * FROM address_book ORDER BY id").all(), original);
    db.exec("INSERT INTO address_book (id, label, address, created_at) VALUES ('copy', 'My copy', '0x01', '2026-01-03');");
    const once = db.prepare("SELECT * FROM address_book ORDER BY id").all();
    runMigrations();
    assert.deepEqual(db.prepare("SELECT * FROM address_book ORDER BY id").all(), once);
    assert.equal((db.prepare("SELECT COUNT(*) AS total FROM address_book WHERE is_local_device = 1").get() as { total: number }).total, 1);
  });
});
