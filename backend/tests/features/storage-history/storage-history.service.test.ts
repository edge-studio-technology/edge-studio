import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let db: import("better-sqlite3").Database;
let service: typeof import("../../../src/features/storage-history/storage-history.service.js");
let dataDir: string;

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  service = await import("../../../src/features/storage-history/storage-history.service.js");
  dataDir = path.dirname(process.env.DATABASE_PATH!);
});

afterAll(() => {
  fs.rmSync(path.join(dataDir, "captures"), { recursive: true, force: true });
  fs.rmSync(path.join(dataDir, "integritas-verification-reports"), { recursive: true, force: true });
  fs.rmSync(path.join(dataDir, "exports"), { recursive: true, force: true });
  teardown();
});

describe("getStorageHistoryInventory", () => {
  it("reports category counts, managed files, and physical database storage without paths", () => {
    db.prepare("INSERT INTO wallet_transactions (txpow_id, token_id, direction, amount, token_name, time_millis, wallet_fingerprint, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run("tx-1", "0x00", "in", "1", "Minima", 1, "wallet-1", "2026-10-14T00:00:00.000Z");
    db.prepare("INSERT INTO wallet_send_history (id, created_at, to_address, token_id, token_name, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("send-1", "2026-10-14T00:00:00.000Z", "Mxrecipient", "0x00", "Minima", "1", "submitted");
    db.prepare("INSERT INTO automation_inbox_items (id, workflow_name, title, format, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("inbox-1", "Workflow", "Preview", "text", "{}", "2026-10-14T00:00:00.000Z");
    db.prepare("INSERT INTO automation_runs (id, workflow_name, started_at, status, trigger_type) VALUES (?, ?, ?, ?, ?)")
      .run("run-1", "Workflow", "2026-10-14T00:00:00.000Z", "succeeded", "manual");
    db.prepare("INSERT INTO automation_block_runs (id, run_id, order_index, block_type, block_label, started_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("block-1", "run-1", 0, "start", "Start", "2026-10-14T00:00:00.000Z", "succeeded");
    db.prepare("INSERT INTO data_source_reads (id, created_at, source_name, source_url, trigger_type, status) VALUES (?, ?, ?, ?, ?, ?)")
      .run("read-1", "2026-10-14T00:00:00.000Z", "Device", "data-source:device", "manual", "success");
    db.prepare("INSERT INTO integritas_proofs (id, created_at, updated_at, hash, proof_status) VALUES (?, ?, ?, ?, ?)")
      .run("proof-1", "2026-10-14T00:00:00.000Z", "2026-10-14T00:00:00.000Z", "hash", "ready");
    db.prepare("INSERT INTO audit_events (id, created_at, action) VALUES (?, ?, ?)")
      .run("audit-1", "2026-10-14T00:00:00.000Z", "test");

    writeFile("captures/capture.jpg", 10);
    writeFile("integritas-verification-reports/proof.pdf", 20);
    writeFile("exports/proof.json", 30);

    const inventory = service.getStorageHistoryInventory();

    assert.ok(inventory.totalBytes >= 60);
    assert.ok(inventory.database.databaseBytes > 0);
    assert.equal(category(inventory, "minima-history").recordCount, 2);
    assert.equal(category(inventory, "workflow-inbox").recordCount, 1);
    assert.equal(category(inventory, "workflow-diagnostics").recordCount, 2);
    assert.equal(category(inventory, "device-diagnostics").recordCount, 1);
    assert.equal(category(inventory, "integritas-evidence").recordCount, 1);
    assert.equal(category(inventory, "integritas-evidence").fileBytes, 20);
    assert.equal(category(inventory, "camera-captures").fileBytes, 10);
    assert.equal(category(inventory, "generated-exports").fileBytes, 30);
    assert.equal(category(inventory, "audit-events").recordCount, 1);
    assert.deepEqual(Object.keys(category(inventory, "camera-captures")).sort(), [
      "databaseBytes",
      "description",
      "fileBytes",
      "fileCount",
      "id",
      "label",
      "lifecycle",
      "recordCount",
    ]);
  });
});

function category(inventory: ReturnType<typeof service.getStorageHistoryInventory>, id: string) {
  const result = inventory.categories.find((entry) => entry.id === id);
  assert.ok(result, `Expected ${id} category`);
  return result;
}

function writeFile(relativePath: string, size: number) {
  const filePath = path.join(dataDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.alloc(size));
}
