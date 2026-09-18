import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const repositoryMock = vi.hoisted(() => ({ failNextRunsPass: null as Error | null }));

vi.mock("../../../src/features/retention/retention.repository.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/features/retention/retention.repository.js")>();
  return {
    ...actual,
    pruneAutomationRuns: (limits: Parameters<typeof actual.pruneAutomationRuns>[0]) => {
      const error = repositoryMock.failNextRunsPass;
      repositoryMock.failNextRunsPass = null;
      if (error) throw error;
      return actual.pruneAutomationRuns(limits);
    }
  };
});

let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let service: typeof import("../../../src/features/retention/retention.service.js");

const NOW = Date.parse("2026-09-17T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  service = await import("../../../src/features/retention/retention.service.js");
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  db.exec("DELETE FROM automation_inbox_items; DELETE FROM automation_block_runs; DELETE FROM automation_runs; DELETE FROM data_source_reads;");
  repositoryMock.failNextRunsPass = null;
});

afterEach(() => {
  service.stopRetentionScheduler();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function count(table: string) {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

/** Inserts `total` rows per retained table, `old` of them older than 30 days, all others recent. */
function seed(total: number, old: number, now = NOW) {
  const run = db.prepare("INSERT INTO automation_runs (id, workflow_name, started_at, status, trigger_type) VALUES (?, 'WF', ?, 'success', 'manual')");
  const blockRun = db.prepare("INSERT INTO automation_block_runs (id, run_id, order_index, block_type, block_label, started_at, status) VALUES (?, ?, 1, 'wait', 'Wait', ?, 'success')");
  const inbox = db.prepare("INSERT INTO automation_inbox_items (id, workflow_name, title, format, content_json, created_at) VALUES (?, 'WF', 'T', 'text', '\"x\"', ?)");
  const read = db.prepare("INSERT INTO data_source_reads (id, created_at, source_name, source_url, trigger_type, status) VALUES (?, ?, 'S', 'data-source:x', 'manual', 'success')");
  db.transaction(() => {
    for (let index = 0; index < total; index += 1) {
      const id = String(index).padStart(6, "0");
      const at = new Date(index < old ? now - 40 * DAY_MS + index : now - total + index).toISOString();
      run.run(`run-${id}`, at);
      blockRun.run(`block-${id}`, `run-${id}`, at);
      inbox.run(`inbox-${id}`, at);
      read.run(`read-${id}`, at);
    }
  })();
}

describe("retention.service — policy", () => {
  it("uses the approved fixed limits", () => {
    assert.equal(service.RETENTION_MAX_AGE_DAYS, 30);
    assert.equal(service.RETENTION_MAX_ROWS, 10_000);
    assert.equal(service.RETENTION_BATCH_SIZE, 500);
    assert.equal(service.RETENTION_INTERVAL_MS, 60 * 60 * 1000);
  });

  it("removes at most 500 direct rows per table per pass when over the 10,000-row cap", () => {
    seed(10_700, 0);

    assert.deepEqual(service.runRetentionPass(NOW), {
      automationRuns: 500,
      // 500 block runs go with their runs; the block-run cap then removes the 200 still over 10,000.
      automationBlockRuns: 700,
      automationInboxItems: 500,
      dataSourceReads: 500
    });
    assert.equal(count("automation_runs"), 10_200);
    assert.equal(count("data_source_reads"), 10_200);

    // The block-run cap already removed the block runs of the 200 runs pruned here.
    assert.deepEqual(service.runRetentionPass(NOW), { automationRuns: 200, automationBlockRuns: 0, automationInboxItems: 200, dataSourceReads: 200 });
    assert.deepEqual(service.runRetentionPass(NOW), { automationRuns: 0, automationBlockRuns: 0, automationInboxItems: 0, dataSourceReads: 0 });
    assert.equal(count("automation_runs"), 10_000);
    assert.equal(count("automation_block_runs"), 10_000);
  });

  it("removes rows older than 30 days even when under the row cap", () => {
    seed(20, 5);

    assert.deepEqual(service.runRetentionPass(NOW), { automationRuns: 5, automationBlockRuns: 5, automationInboxItems: 5, dataSourceReads: 5 });
    assert.equal(count("automation_inbox_items"), 15);
  });
});

describe("retention.service — scheduler", () => {
  it("runs one bounded pass immediately and drains the backlog on hourly ticks", () => {
    vi.useFakeTimers({ now: NOW });
    seed(10_000, 700);

    service.startRetentionScheduler();
    assert.equal(count("data_source_reads"), 9_500);

    vi.advanceTimersByTime(service.RETENTION_INTERVAL_MS - 1);
    assert.equal(count("data_source_reads"), 9_500);
    vi.advanceTimersByTime(1);
    assert.equal(count("data_source_reads"), 9_300);
  });

  it("is a no-op when already started and stops cleanly", () => {
    vi.useFakeTimers({ now: NOW });
    service.startRetentionScheduler();
    service.startRetentionScheduler();
    service.stopRetentionScheduler();
    seed(10, 10);

    vi.advanceTimersByTime(2 * service.RETENTION_INTERVAL_MS);
    assert.equal(count("data_source_reads"), 10);
  });

  it("logs a static message with a redacted detail on failure and keeps running", () => {
    vi.useFakeTimers({ now: NOW });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const secret = ["broker", "password"].join("-");
    repositoryMock.failNextRunsPass = new Error(`database is locked mqtt://sensor:${secret}@broker.local`);
    seed(10, 10);

    service.startRetentionScheduler();
    assert.equal(count("data_source_reads"), 10);
    assert.equal(errorSpy.mock.calls.length, 1);
    assert.equal(errorSpy.mock.calls[0][0], "Retention cleanup failed:");
    assert.equal(JSON.stringify(errorSpy.mock.calls).includes(secret), false);

    vi.advanceTimersByTime(service.RETENTION_INTERVAL_MS);
    assert.equal(count("data_source_reads"), 0);
    assert.equal(errorSpy.mock.calls.length, 1);
  });
});
