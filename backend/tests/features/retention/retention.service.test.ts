import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const repositoryMock = vi.hoisted(() => ({ failNextInboxPass: null as Error | null }));

vi.mock("../../../src/features/retention/retention.repository.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/features/retention/retention.repository.js")>();
  return {
    ...actual,
    pruneDeletedAutomationInboxItems: (batchSize: number) => {
      const error = repositoryMock.failNextInboxPass;
      repositoryMock.failNextInboxPass = null;
      if (error) throw error;
      return actual.pruneDeletedAutomationInboxItems(batchSize);
    }
  };
});

let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let policy: typeof import("../../../src/features/retention/retention.policy.js");
let service: typeof import("../../../src/features/retention/retention.service.js");

const NOW = Date.parse("2026-09-17T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  policy = await import("../../../src/features/retention/retention.policy.js");
  service = await import("../../../src/features/retention/retention.service.js");
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  db.exec("DELETE FROM automation_inbox_items; DELETE FROM automation_block_runs; DELETE FROM automation_runs; DELETE FROM data_source_reads; DELETE FROM integritas_proofs;");
  repositoryMock.failNextInboxPass = null;
});

afterEach(() => {
  service.stopRetentionScheduler();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function count(table: string) {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

/** Inserts rows for every retention category, with optional old rows and soft-deleted inbox items. */
function seed(total: number, old: number, deletedInboxItems = 0, now = NOW) {
  const run = db.prepare("INSERT INTO automation_runs (id, workflow_name, started_at, status, trigger_type) VALUES (?, 'WF', ?, 'success', 'manual')");
  const blockRun = db.prepare("INSERT INTO automation_block_runs (id, run_id, order_index, block_type, block_label, started_at, status) VALUES (?, ?, 1, 'wait', 'Wait', ?, 'success')");
  const inbox = db.prepare("INSERT INTO automation_inbox_items (id, workflow_name, title, format, content_json, created_at, deleted_at) VALUES (?, 'WF', 'T', 'text', 'null', ?, ?)");
  const read = db.prepare("INSERT INTO data_source_reads (id, created_at, source_name, source_url, trigger_type, status) VALUES (?, ?, 'S', 'data-source:x', 'manual', 'success')");
  db.transaction(() => {
    for (let index = 0; index < total; index += 1) {
      const id = String(index).padStart(6, "0");
      const at = new Date(index < old ? now - 40 * DAY_MS + index : now - total + index).toISOString();
      run.run(`run-${id}`, at);
      blockRun.run(`block-${id}`, `run-${id}`, at);
      inbox.run(`inbox-${id}`, at, index < deletedInboxItems ? at : null);
      read.run(`read-${id}`, at);
    }
  })();
}

describe("retention.service — policy", () => {
  it("declares the approved policy for every stored record category", () => {
    assert.deepEqual(policy.RETENTION_POLICIES, {
      automationRuns: { strategy: "preserve" },
      automationBlockRuns: { strategy: "preserve" },
      automationInboxItems: { strategy: "deleted-only", batchSize: 500 },
      dataSourceReads: { strategy: "preserve" },
      integritasProofs: { strategy: "explicit-deletion" }
    });
    assert.equal(service.RETENTION_INTERVAL_MS, 60 * 60 * 1000);
  });

  it("preserves workflow runs, block runs, visible inbox items, and data-source reads beyond 10,000 rows", () => {
    seed(10_700, 0);

    assert.deepEqual(service.runRetentionPass(), { automationRuns: 0, automationBlockRuns: 0, automationInboxItems: 0, dataSourceReads: 0 });
    assert.equal(count("automation_runs"), 10_700);
    assert.equal(count("automation_block_runs"), 10_700);
    assert.equal(count("automation_inbox_items"), 10_700);
    assert.equal(count("data_source_reads"), 10_700);
  });

  it("preserves workflow runs and block runs older than 30 days", () => {
    seed(20, 20);

    assert.deepEqual(service.runRetentionPass(), { automationRuns: 0, automationBlockRuns: 0, automationInboxItems: 0, dataSourceReads: 0 });
    assert.equal(count("automation_runs"), 20);
    assert.equal(count("automation_block_runs"), 20);
    assert.equal(count("automation_inbox_items"), 20);
    assert.equal(count("data_source_reads"), 20);
  });

  it("preserves Integritas proof history until explicit deletion", () => {
    const old = new Date(NOW - 40 * DAY_MS).toISOString();
    db.prepare("INSERT INTO integritas_proofs (id, created_at, updated_at, hash, proof_status) VALUES ('proof-old', ?, ?, 'hash', 'confirmed')").run(old, old);

    service.runRetentionPass();

    assert.equal(count("integritas_proofs"), 1);
  });

  it("physically purges user-deleted inbox items in bounded batches", () => {
    seed(700, 0, 700);

    assert.equal(service.runRetentionPass().automationInboxItems, 500);
    assert.equal(count("automation_inbox_items"), 200);
    assert.equal(service.runRetentionPass().automationInboxItems, 200);
    assert.equal(count("automation_inbox_items"), 0);
  });
});

describe("retention.service — scheduler", () => {
  it("yields between bounded batches and drains deleted inbox items before the next hourly tick", async () => {
    vi.useFakeTimers({ now: NOW });
    seed(10_000, 1700, 1700);

    service.startRetentionScheduler();
    assert.equal(count("automation_runs"), 10_000);
    assert.equal(count("automation_inbox_items"), 9_500);
    assert.equal(count("data_source_reads"), 10_000);

    await vi.advanceTimersByTimeAsync(10);
    assert.equal(count("automation_runs"), 10_000);
    assert.equal(count("automation_block_runs"), 10_000);
    assert.equal(count("automation_inbox_items"), 8_300);
    assert.equal(count("data_source_reads"), 10_000);

    db.exec("DELETE FROM automation_inbox_items; DELETE FROM automation_block_runs; DELETE FROM automation_runs; DELETE FROM data_source_reads; DELETE FROM integritas_proofs;");
    seed(10, 10, 10);
    await vi.advanceTimersByTimeAsync(service.RETENTION_INTERVAL_MS);
    assert.equal(count("automation_runs"), 10);
    assert.equal(count("automation_inbox_items"), 0);
    assert.equal(count("data_source_reads"), 10);
  });

  it("does not start overlapping sweeps and cancels a pending continuation on stop", async () => {
    vi.useFakeTimers({ now: NOW });
    seed(1700, 1700, 1700);
    service.startRetentionScheduler();
    service.startRetentionScheduler();
    assert.equal(count("automation_runs"), 1700);
    assert.equal(count("automation_inbox_items"), 1200);
    service.stopRetentionScheduler();
    await vi.advanceTimersByTimeAsync(10);
    assert.equal(count("automation_runs"), 1700);
    assert.equal(count("automation_inbox_items"), 1200);
    service.startRetentionScheduler();
    await vi.advanceTimersByTimeAsync(10);
    assert.equal(count("automation_runs"), 1700);
    assert.equal(count("automation_inbox_items"), 0);
    assert.equal(count("data_source_reads"), 1700);
  });

  it("is a no-op when already started and stops cleanly", () => {
    vi.useFakeTimers({ now: NOW });
    service.startRetentionScheduler();
    service.startRetentionScheduler();
    service.stopRetentionScheduler();
    seed(10, 10, 10);

    vi.advanceTimersByTime(2 * service.RETENTION_INTERVAL_MS);
    assert.equal(count("automation_runs"), 10);
    assert.equal(count("automation_inbox_items"), 10);
  });

  it("logs a static message with a redacted detail on failure and keeps running", () => {
    vi.useFakeTimers({ now: NOW });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const secret = ["broker", "password"].join("-");
    repositoryMock.failNextInboxPass = new Error(`database is locked mqtt://sensor:${secret}@broker.local`);
    seed(10, 10, 10);

    service.startRetentionScheduler();
    assert.equal(count("automation_runs"), 10);
    assert.equal(count("automation_inbox_items"), 10);
    assert.equal(errorSpy.mock.calls.length, 1);
    assert.equal(errorSpy.mock.calls[0][0], "Retention cleanup failed:");
    assert.equal(JSON.stringify(errorSpy.mock.calls).includes(secret), false);

    vi.advanceTimersByTime(service.RETENTION_INTERVAL_MS);
    assert.equal(count("automation_runs"), 10);
    assert.equal(count("automation_inbox_items"), 0);
    assert.equal(count("data_source_reads"), 10);
    assert.equal(errorSpy.mock.calls.length, 1);
  });
});
