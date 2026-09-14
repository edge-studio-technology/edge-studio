import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { serializeDataSourceRead } from "../../../src/features/data-reads/dataReads.service.js";
import type { DataSourceReadRecord } from "../../../src/features/data-reads/dataReads.repository.js";

function record(overrides: Partial<DataSourceReadRecord> = {}): DataSourceReadRecord {
  return {
    id: "read-1",
    created_at: "2026-01-01T00:00:00.000Z",
    data_source_id: "src-1",
    workflow_id: null,
    integritas_proof_id: null,
    source_name: "Source",
    source_url: "https://example.com",
    trigger_type: "manual",
    status: "success",
    hash: null,
    preview_json: null,
    error: null,
    trigger_source_id: null,
    trigger_payload_json: null,
    block_id: null,
    ...overrides
  };
}

describe("serializeDataSourceRead", () => {
  it("maps snake_case fields to camelCase", () => {
    const serialized = serializeDataSourceRead(record({ data_source_id: "src-1", workflow_id: "wf-1", block_id: "blk-1" }));
    assert.equal(serialized.dataSourceId, "src-1");
    assert.equal(serialized.workflowId, "wf-1");
    assert.equal(serialized.blockId, "blk-1");
  });

  it("returns null preview/triggerPayload when the JSON columns are null", () => {
    const serialized = serializeDataSourceRead(record());
    assert.equal(serialized.preview, null);
    assert.equal(serialized.triggerPayload, null);
  });

  it("parses preview and triggerPayload JSON when present", () => {
    const serialized = serializeDataSourceRead(record({ preview_json: JSON.stringify({ a: 1 }), trigger_payload_json: JSON.stringify({ b: 2 }) }));
    assert.deepEqual(serialized.preview, { a: 1 });
    assert.deepEqual(serialized.triggerPayload, { b: 2 });
  });

  it("returns null error/errorDetails when there is no error", () => {
    const serialized = serializeDataSourceRead(record());
    assert.equal(serialized.error, null);
    assert.equal(serialized.errorDetails, null);
  });

  it("exposes both a friendly error message and structured errorDetails for a structured error", () => {
    const structured = { domain: "data_source", type: "fetch_failed", message: "boom", occurredAt: "2026-01-01T00:00:00.000Z" };
    const serialized = serializeDataSourceRead(record({ status: "failed", error: JSON.stringify(structured) }));
    assert.equal(serialized.error, "boom");
    assert.ok(serialized.errorDetails);
  });

  it("falls back to the raw string for a legacy plain-text error", () => {
    const serialized = serializeDataSourceRead(record({ status: "failed", error: "legacy failure" }));
    assert.equal(serialized.error, "legacy failure");
    assert.equal(serialized.errorDetails?.domain, "unknown");
  });
});
