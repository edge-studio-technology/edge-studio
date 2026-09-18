import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let repo: typeof import("../../../src/features/retention/retention.repository.js");

const NOW = Date.parse("2026-09-17T12:00:00.000Z");
const CUTOFF_ISO = new Date(NOW - 30 * 24 * 60 * 60 * 1000).toISOString();

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  repo = await import("../../../src/features/retention/retention.repository.js");
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  db.exec("DELETE FROM automation_inbox_items; DELETE FROM automation_block_runs; DELETE FROM automation_runs; DELETE FROM data_source_reads;");
});

function iso(msBeforeNow: number) {
  return new Date(NOW - msBeforeNow).toISOString();
}

function insertRun(id: string, startedAt: string) {
  db.prepare("INSERT INTO automation_runs (id, workflow_name, started_at, status, trigger_type) VALUES (?, 'WF', ?, 'success', 'manual')").run(id, startedAt);
}

function insertBlockRun(id: string, runId: string, startedAt: string) {
  db.prepare("INSERT INTO automation_block_runs (id, run_id, order_index, block_type, block_label, started_at, status) VALUES (?, ?, 1, 'wait', 'Wait', ?, 'success')").run(id, runId, startedAt);
}

function insertInboxItem(id: string, createdAt: string, deletedAt: string | null = null) {
  db.prepare("INSERT INTO automation_inbox_items (id, workflow_name, title, format, content_json, created_at, deleted_at) VALUES (?, 'WF', 'Title', 'text', '\"x\"', ?, ?)").run(id, createdAt, deletedAt);
}

function insertRead(id: string, createdAt: string) {
  db.prepare("INSERT INTO data_source_reads (id, created_at, source_name, source_url, trigger_type, status) VALUES (?, ?, 'Source', 'data-source:x', 'manual', 'success')").run(id, createdAt);
}

function ids(table: string) {
  return (db.prepare(`SELECT id FROM ${table} ORDER BY id`).all() as { id: string }[]).map((row) => row.id);
}

const generous = { cutoffIso: CUTOFF_ISO, maxRows: 1000, batchSize: 1000 };

describe("retention.repository — pruneRetainedRows", () => {
  it("deletes rows strictly older than the cutoff and keeps a row exactly at the cutoff", () => {
    insertRead("older", iso(30 * 24 * 60 * 60 * 1000 + 1));
    insertRead("at-cutoff", CUTOFF_ISO);
    insertRead("recent", iso(1000));

    assert.equal(repo.pruneRetainedRows("data_source_reads", generous), 1);
    assert.deepEqual(ids("data_source_reads"), ["at-cutoff", "recent"]);
  });

  it("keeps only the newest rows over the cap, breaking timestamp ties by id", () => {
    const sameTime = iso(1000);
    for (const id of ["c", "a", "d", "b"]) insertRead(id, sameTime);
    insertRead("newest", iso(10));

    assert.equal(repo.pruneRetainedRows("data_source_reads", { ...generous, maxRows: 3 }), 2);
    assert.deepEqual(ids("data_source_reads"), ["c", "d", "newest"]);
  });

  it("deletes the union of age- and cap-eligible rows without double counting", () => {
    insertRead("old-1", iso(40 * 24 * 60 * 60 * 1000));
    insertRead("old-2", iso(35 * 24 * 60 * 60 * 1000));
    insertRead("new-1", iso(3000));
    insertRead("new-2", iso(2000));
    insertRead("new-3", iso(1000));

    // Two rows are too old; three rows exceed a cap of two. The union is the oldest three.
    assert.equal(repo.pruneRetainedRows("data_source_reads", { ...generous, maxRows: 2 }), 3);
    assert.deepEqual(ids("data_source_reads"), ["new-2", "new-3"]);
  });

  it("deletes at most one batch per call, oldest first, and is idempotent once drained", () => {
    for (let index = 0; index < 5; index += 1) insertRead(`old-${index}`, iso((40 + index) * 24 * 60 * 60 * 1000));
    insertRead("recent", iso(1000));
    const limits = { ...generous, batchSize: 2 };

    assert.equal(repo.pruneRetainedRows("data_source_reads", limits), 2);
    assert.deepEqual(ids("data_source_reads"), ["old-0", "old-1", "old-2", "recent"]);
    assert.equal(repo.pruneRetainedRows("data_source_reads", limits), 2);
    assert.equal(repo.pruneRetainedRows("data_source_reads", limits), 1);
    assert.equal(repo.pruneRetainedRows("data_source_reads", limits), 0);
    assert.deepEqual(ids("data_source_reads"), ["recent"]);
  });

  it("physically deletes eligible inbox items, including soft-deleted ones", () => {
    insertInboxItem("old-visible", iso(40 * 24 * 60 * 60 * 1000));
    insertInboxItem("old-soft-deleted", iso(39 * 24 * 60 * 60 * 1000), iso(38 * 24 * 60 * 60 * 1000));
    insertInboxItem("recent-soft-deleted", iso(1000), iso(500));

    assert.equal(repo.pruneRetainedRows("automation_inbox_items", generous), 2);
    assert.deepEqual(ids("automation_inbox_items"), ["recent-soft-deleted"]);
  });

  it("caps block runs independently of their parent runs", () => {
    insertRun("run", iso(1000));
    for (let index = 0; index < 4; index += 1) insertBlockRun(`block-${index}`, "run", iso(1000 - index));

    assert.equal(repo.pruneRetainedRows("automation_block_runs", { ...generous, maxRows: 1 }), 3);
    assert.deepEqual(ids("automation_block_runs"), ["block-3"]);
    assert.deepEqual(ids("automation_runs"), ["run"]);
  });
});

describe("retention.repository — pruneAutomationRuns", () => {
  it("deletes eligible runs together with their block runs and leaves newer runs intact", () => {
    insertRun("old-run", iso(40 * 24 * 60 * 60 * 1000));
    insertBlockRun("old-block-1", "old-run", iso(40 * 24 * 60 * 60 * 1000));
    // A block run's own timestamp does not keep it alive once its parent run is removed.
    insertBlockRun("old-block-2", "old-run", iso(1000));
    insertRun("new-run", iso(1000));
    insertBlockRun("new-block", "new-run", iso(1000));
    insertInboxItem("inbox-for-old-run", iso(1000));
    db.prepare("UPDATE automation_inbox_items SET run_id = 'old-run'").run();

    assert.deepEqual(repo.pruneAutomationRuns(generous), { runs: 1, dependentBlockRuns: 2 });
    assert.deepEqual(ids("automation_runs"), ["new-run"]);
    assert.deepEqual(ids("automation_block_runs"), ["new-block"]);
    assert.deepEqual(ids("automation_inbox_items"), ["inbox-for-old-run"]);
    assert.deepEqual(repo.pruneAutomationRuns(generous), { runs: 0, dependentBlockRuns: 0 });
  });

  it("applies the batch size to runs, not to their dependent block runs", () => {
    for (let index = 0; index < 3; index += 1) {
      insertRun(`run-${index}`, iso((40 + index) * 24 * 60 * 60 * 1000));
      insertBlockRun(`run-${index}-a`, `run-${index}`, iso(1000));
      insertBlockRun(`run-${index}-b`, `run-${index}`, iso(1000));
    }

    assert.deepEqual(repo.pruneAutomationRuns({ ...generous, batchSize: 2 }), { runs: 2, dependentBlockRuns: 4 });
    assert.deepEqual(ids("automation_runs"), ["run-0"]);
    assert.deepEqual(ids("automation_block_runs"), ["run-0-a", "run-0-b"]);
  });
});
