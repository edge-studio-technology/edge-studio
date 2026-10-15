import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let db: import("better-sqlite3").Database;
let service: typeof import("../../../src/features/storage-history/history-archive.service.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  service = await import("../../../src/features/storage-history/history-archive.service.js");
});

afterAll(() => teardown());

describe("buildHistoryArchive", () => {
  it("keeps historical relationships and payloads while removing configuration and secrets", () => {
    db.prepare("INSERT INTO wallet_transactions (txpow_id, token_id, direction, amount, token_name, counterparty, time_millis, wallet_fingerprint, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("tx-1", "0x00", "in", "1", "Minima", "Mxrecipient", 1, "wallet-fingerprint", "2026-10-15T00:00:00.000Z");
    db.prepare("INSERT INTO automation_workflows (id, created_at, updated_at, name, enabled) VALUES (?, ?, ?, ?, ?)")
      .run("workflow-1", "2026-10-15T00:00:00.000Z", "2026-10-15T00:00:00.000Z", "Workflow", 1);
    db.prepare("INSERT INTO automation_runs (id, workflow_id, workflow_name, started_at, status, trigger_type, trigger_payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("run-1", "workflow-1", "Workflow", "2026-10-15T00:00:00.000Z", "success", "webhook", JSON.stringify({ reading: 12, apiKey: "secret-key" }));
    db.prepare("INSERT INTO automation_block_runs (id, run_id, order_index, block_type, block_label, started_at, status, output_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run("block-1", "run-1", 0, "fetch", "Fetch", "2026-10-15T00:00:00.000Z", "success", JSON.stringify({ temperature: 21, password: "secret-password" }));
    db.prepare("INSERT INTO automation_inbox_items (id, workflow_name, run_id, title, format, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("inbox-1", "Workflow", "run-1", "Preview", "json", JSON.stringify({ value: "visible", webhookToken: "secret-token" }), "2026-10-15T00:00:00.000Z");
    db.prepare("INSERT INTO integritas_proofs (id, created_at, updated_at, hash, proof_status, proof_payload, verification_report_file) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("proof-1", "2026-10-15T00:00:00.000Z", "2026-10-15T00:00:00.000Z", "hash", "ready", JSON.stringify({ uid: "proof-uid", token: "token-id", apiKey: "secret-key" }), "local-report.pdf");
    db.prepare("INSERT INTO data_source_reads (id, created_at, data_source_id, workflow_id, integritas_proof_id, source_name, source_url, trigger_type, status, preview_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("read-1", "2026-10-15T00:00:00.000Z", null, "workflow-1", "proof-1", "Device", "https://user:password@example.test/data", "automation", "success", JSON.stringify({ humidity: 50, authorization: "Bearer secret" }));

    const archive = service.buildHistoryArchive();
    const serialized = JSON.stringify(archive);

    assert.equal(archive.format, "edge-studio-history");
    assert.equal(archive.schemaVersion, 1);
    assert.equal(archive.records.workflowRuns[0]?.id, "run-1");
    assert.equal(archive.records.workflowBlockRuns[0]?.run_id, "run-1");
    assert.equal(archive.records.workflowInboxItems[0]?.run_id, "run-1");
    assert.equal(archive.records.dataSourceReads[0]?.integritas_proof_id, "proof-1");
    assert.equal(archive.records.dataSourceReads[0]?.source_reference, null);
    assert.equal(archive.records.workflowRuns[0]?.trigger_payload.apiKey, "[redacted]");
    assert.equal(archive.records.workflowBlockRuns[0]?.output.password, "[redacted]");
    assert.equal(archive.records.workflowInboxItems[0]?.content.webhookToken, "[redacted]");
    assert.equal(archive.records.dataSourceReads[0]?.preview.authorization, "[redacted]");
    assert.equal(archive.records.integritasProofs[0]?.proof_payload.apiKey, "[redacted]");
    assert.equal(archive.records.integritasProofs[0]?.proof_payload.token, "token-id");
    assert.doesNotMatch(serialized, /wallet-fingerprint|secret-key|secret-password|secret-token|local-report\.pdf|https:\/\/user:password/i);
  });
});
