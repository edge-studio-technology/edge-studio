import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let repo: typeof import("../../../src/features/automation/automationBudget.repository.js");
let workflows: typeof import("../../../src/features/automation/automation.repository.js");

const NOW = Date.parse("2026-09-17T12:00:00.000Z");
const WINDOW_MS = 60 * 60 * 1000;

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  repo = await import("../../../src/features/automation/automationBudget.repository.js");
  workflows = await import("../../../src/features/automation/automation.repository.js");
});

afterAll(() => {
  teardown();
});

let workflowId: string;

beforeEach(() => {
  workflowId = workflows.createAutomationWorkflow({ name: "Budgeted", enabled: true, blocks: [{ type: "manual_start", config: {} }] }).id;
});

// Run ids are globally unique in the ledger, so scope test ids to the workflow.
function reserve(runId: string, nowMs = NOW, id = workflowId) {
  return repo.reserveWorkflowRunBudget({ workflowId: id, runId: `${id}:${runId}`, nowMs, maxRuns: 3, windowMs: WINDOW_MS });
}

function eventCount(id = workflowId) {
  return (db.prepare("SELECT COUNT(*) AS n FROM automation_workflow_budget_events WHERE workflow_id = ?").get(id) as { n: number }).n;
}

describe("automationBudget.repository — reserveWorkflowRunBudget", () => {
  it("allows reservations below the limit and rejects at the limit with the next available time", () => {
    assert.deepEqual(reserve("run-1", NOW), { ok: true });
    assert.deepEqual(reserve("run-2", NOW + 1000), { ok: true });
    assert.deepEqual(reserve("run-3", NOW + 2000), { ok: true });

    assert.deepEqual(reserve("run-4", NOW + 3000), { ok: false, nextAvailableAt: new Date(NOW + WINDOW_MS).toISOString() });
    assert.equal(eventCount(), 3);
  });

  it("frees a slot exactly when the oldest reservation leaves the rolling window", () => {
    reserve("run-1", NOW);
    reserve("run-2", NOW + 1000);
    reserve("run-3", NOW + 2000);

    assert.equal(reserve("run-4", NOW + WINDOW_MS - 1).ok, false);
    assert.deepEqual(reserve("run-4", NOW + WINDOW_MS), { ok: true });
    assert.deepEqual(reserve("run-5", NOW + WINDOW_MS), { ok: false, nextAvailableAt: new Date(NOW + 1000 + WINDOW_MS).toISOString() });
    // Expired reservations are deleted during reservation rather than kept as history.
    assert.equal(eventCount(), 3);
  });

  it("charges a run only once", () => {
    assert.deepEqual(reserve("run-1"), { ok: true });
    assert.deepEqual(reserve("run-1"), { ok: true });
    assert.equal(eventCount(), 1);
  });

  it("keeps budgets independent per workflow", () => {
    const otherId = workflows.createAutomationWorkflow({ name: "Other", enabled: true, blocks: [{ type: "manual_start", config: {} }] }).id;
    for (const runId of ["a", "b", "c"]) reserve(runId);

    assert.equal(reserve("d").ok, false);
    assert.deepEqual(reserve("other-a", NOW, otherId), { ok: true });
  });

  it("never exceeds the limit across a burst of reservations", () => {
    const results = Array.from({ length: 20 }, (_, index) => reserve(`burst-${index}`));
    assert.equal(results.filter((result) => result.ok).length, 3);
    assert.equal(eventCount(), 3);
  });

  it("fails closed without reserving while another connection holds the write lock", () => {
    const other = new Database(db.name);
    db.pragma("busy_timeout = 25");
    try {
      other.exec("BEGIN IMMEDIATE");
      assert.throws(() => reserve("locked"), /database is locked/);
      other.exec("ROLLBACK");
      assert.equal(eventCount(), 0);
      assert.deepEqual(reserve("unlocked"), { ok: true });
    } finally {
      db.pragma("busy_timeout = 5000");
      other.close();
    }
  });
});

describe("automationBudget.repository — persistence", () => {
  it("keeps reservations across a closed and reopened database", async () => {
    for (const runId of ["a", "b", "c"]) reserve(runId);
    const databasePath = db.name;
    db.close();

    vi.resetModules();
    const reopened = await import("../../../src/db/database.js");
    try {
      assert.equal(reopened.db.name, databasePath);
      const reopenedRepo = await import("../../../src/features/automation/automationBudget.repository.js");
      assert.equal(reopenedRepo.reserveWorkflowRunBudget({ workflowId, runId: "after-restart", nowMs: NOW, maxRuns: 3, windowMs: WINDOW_MS }).ok, false);
    } finally {
      reopened.db.close();
    }
  });
});
