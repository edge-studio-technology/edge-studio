import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let repo: typeof import("../../../src/features/data-sources/dataSources.repository.js");
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  repo = await import("../../../src/features/data-sources/dataSources.repository.js");
});

afterAll(() => {
  teardown();
});

describe("dataSources.repository — create/get", () => {
  it("creates a data source with active status and no read history", () => {
    const source = repo.createDataSource({ name: "Source A", type: "json-api", config: { url: "https://example.com" } });
    assert.equal(source.name, "Source A");
    assert.equal(source.type, "json-api");
    assert.equal(source.status, "active");
    assert.equal(source.description, null);
    assert.equal(source.config, JSON.stringify({ url: "https://example.com" }));
    assert.equal(source.last_read_at, null);
    assert.equal(source.last_error, null);
    assert.equal(source.last_preview, null);
    assert.equal(source.last_hash, null);
    assert.ok(source.id);
    assert.ok(source.created_at);
  });

  it("stores an optional description", () => {
    const source = repo.createDataSource({ name: "Source B", type: "mqtt", description: "desc", config: {} });
    assert.equal(source.description, "desc");
  });

  it("getDataSource returns undefined for a missing id", () => {
    assert.equal(repo.getDataSource("missing"), undefined);
  });

  it("getDataSource returns the source after creation", () => {
    const source = repo.createDataSource({ name: "Source C", type: "json-api", config: { url: "https://example.com" } });
    assert.equal(repo.getDataSource(source.id)?.id, source.id);
  });
});

describe("dataSources.repository — list", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists data sources ordered by created_at DESC", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const first = repo.createDataSource({ name: "First", type: "json-api", config: { url: "https://example.com/1" } });
    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    const second = repo.createDataSource({ name: "Second", type: "json-api", config: { url: "https://example.com/2" } });

    const list = repo.listDataSources();
    const firstIndex = list.findIndex((record) => record.id === first.id);
    const secondIndex = list.findIndex((record) => record.id === second.id);
    assert.ok(secondIndex < firstIndex);
  });
});

describe("dataSources.repository — findWebhookDataSource", () => {
  it("finds a webhook source by its config token", () => {
    const source = repo.createDataSource({ name: "Webhook Source", type: "webhook", config: { webhookToken: "abc123" } });
    const found = repo.findWebhookDataSource("abc123");
    assert.equal(found?.id, source.id);
  });

  it("returns undefined for an unknown token", () => {
    assert.equal(repo.findWebhookDataSource("unknown-token"), undefined);
  });

  it("ignores non-webhook sources even if config happens to have a matching token", () => {
    repo.createDataSource({ name: "Not Webhook", type: "json-api", config: { webhookToken: "sneaky" } });
    assert.equal(repo.findWebhookDataSource("sneaky"), undefined);
  });

  it("does not throw for a webhook source with malformed config JSON", () => {
    const source = repo.createDataSource({ name: "Broken Webhook", type: "webhook", config: { webhookToken: "ok-token" } });
    db.prepare("UPDATE data_sources SET config = ? WHERE id = ?").run("not-json", source.id);
    assert.doesNotThrow(() => repo.findWebhookDataSource("anything"));
    assert.equal(repo.findWebhookDataSource("anything"), undefined);
  });
});

describe("dataSources.repository — update/delete", () => {
  it("updates name, type, description, and config", () => {
    const source = repo.createDataSource({ name: "Old Name", type: "json-api", config: { url: "https://example.com/old" } });
    const updated = repo.updateDataSource(source.id, { name: "New Name", type: "mqtt", description: "new desc", config: { brokerUrl: "mqtt://x", topic: "t" } });
    assert.equal(updated?.name, "New Name");
    assert.equal(updated?.type, "mqtt");
    assert.equal(updated?.description, "new desc");
    assert.equal(updated?.config, JSON.stringify({ brokerUrl: "mqtt://x", topic: "t" }));
  });

  it("updateDataSource returns undefined for a missing id", () => {
    assert.equal(repo.updateDataSource("missing", { name: "x", type: "json-api", config: {} }), undefined);
  });

  it("deletes a data source", () => {
    const source = repo.createDataSource({ name: "To Delete", type: "json-api", config: { url: "https://example.com" } });
    repo.deleteDataSource(source.id);
    assert.equal(repo.getDataSource(source.id), undefined);
  });
});

describe("dataSources.repository — updateDataSourceReadResult", () => {
  it("stores hash, preview, and clears error on success", () => {
    const source = repo.createDataSource({ name: "Read Source", type: "json-api", config: { url: "https://example.com" } });
    const updated = repo.updateDataSourceReadResult(source.id, { hash: "abc", preview: { a: 1 } });
    assert.equal(updated.last_hash, "abc");
    assert.equal(updated.last_preview, JSON.stringify({ a: 1 }));
    assert.equal(updated.last_error, null);
    assert.ok(updated.last_read_at);
  });

  it("stores a structured error", () => {
    const source = repo.createDataSource({ name: "Read Source Err", type: "json-api", config: { url: "https://example.com" } });
    const updated = repo.updateDataSourceReadResult(source.id, { error: { domain: "data_source", type: "fetch_failed", message: "boom", occurredAt: new Date().toISOString() } });
    assert.ok(updated.last_error);
    const parsed = JSON.parse(updated.last_error!) as { message: string };
    assert.equal(parsed.message, "boom");
  });

  it("stores a plain string error", () => {
    const source = repo.createDataSource({ name: "Read Source Plain Err", type: "json-api", config: { url: "https://example.com" } });
    const updated = repo.updateDataSourceReadResult(source.id, { error: "plain failure" });
    assert.equal(updated.last_error, "plain failure");
  });

  it("leaves preview null when omitted", () => {
    const source = repo.createDataSource({ name: "Read Source No Preview", type: "json-api", config: { url: "https://example.com" } });
    const updated = repo.updateDataSourceReadResult(source.id, { hash: "abc" });
    assert.equal(updated.last_preview, null);
  });
});
