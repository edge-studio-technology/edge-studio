import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const statfs = vi.hoisted(() => vi.fn());
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  statfsSync: statfs,
}));
let db: import("better-sqlite3").Database;
let teardown: () => void;
let settingsService: typeof import("../../../src/features/retention/retention-settings.service.js");
let repository: typeof import("../../../src/features/retention/retention.repository.js");
let service: typeof import("../../../src/features/retention/retention.service.js");
let runs: typeof import("../../../src/features/automation/automationRuns.repository.js");
const defaults = {
  automaticCleanupEnabled: false,
  runsPerWorkflow: 500,
  deletedWorkflowRunDays: 90,
  dataSourceReadDays: 90,
  diskWarningPercent: 80,
};
const policy = {
  ...defaults,
  automaticCleanupEnabled: true,
  runsPerWorkflow: 50,
  deletedWorkflowRunDays: 7,
  dataSourceReadDays: 7,
};
const now = Date.parse("2026-11-03T12:00:00.000Z");
const old = new Date(now - 8 * 86400000).toISOString();
const current = new Date(now).toISOString();

beforeAll(async () => {
  ({ db, teardown } = await setupTestDatabase());
  settingsService = await import("../../../src/features/retention/retention-settings.service.js");
  repository = await import("../../../src/features/retention/retention.repository.js");
  service = await import("../../../src/features/retention/retention.service.js");
  runs = await import("../../../src/features/automation/automationRuns.repository.js");
});
beforeEach(() => {
  for (const id of runs.getActiveAutomationRunIds())
    runs.finishAutomationRun(id, { status: "success" });
  db.exec(
    "DELETE FROM automation_inbox_items; DELETE FROM automation_block_runs; DELETE FROM automation_runs; DELETE FROM data_source_reads; DELETE FROM integritas_proofs; DELETE FROM automation_workflows; DELETE FROM settings; DELETE FROM audit_events;",
  );
  statfs.mockReset().mockReturnValue({ blocks: 100, bfree: 15 });
});
afterAll(() => teardown());
function count(table: string) {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}
function workflow(id: string) {
  db.prepare(
    "INSERT INTO automation_workflows(id,created_at,updated_at,name,enabled) VALUES (?, ?, ?, ?, 0)",
  ).run(id, current, current, id);
}
function run(id: string, workflowId: string | null, at = old) {
  db.prepare(
    "INSERT INTO automation_runs(id,workflow_id,workflow_name,started_at,status,trigger_type) VALUES (?,?,'WF',?,'success','manual')",
  ).run(id, workflowId, at);
  db.prepare(
    "INSERT INTO automation_block_runs(id,run_id,order_index,block_type,block_label,started_at,status) VALUES (?, ?, 1,'wait','Wait',?,'success')",
  ).run(`block-${id}`, id, at);
}
function read(id: string, at = old, proof: string | null = null) {
  db.prepare(
    "INSERT INTO data_source_reads(id,created_at,integritas_proof_id,source_name,source_url,trigger_type,status) VALUES (?, ?, ?, 'Source','data-source:x','manual','success')",
  ).run(id, at, proof);
}

describe("retention settings and previews", () => {
  it("returns defaults without activating deletion or changing records", () => {
    run("gone", null);
    read("old");
    assert.deepEqual(settingsService.getRetentionSettings(), defaults);
    assert.equal(count("settings"), 0);
    assert.equal(service.runRetentionPass().automationRuns, 0);
    assert.equal(count("automation_runs"), 1);
    assert.equal(count("data_source_reads"), 1);
  });

  it("rejects missing, string, fractional and out-of-range settings without a write", () => {
    for (const value of [
      null,
      {},
      { ...policy, automaticCleanupEnabled: "true" },
      ...Object.entries(settingsService.RETENTION_LIMITS).flatMap(([key, range]) =>
        [range.min - 1, range.max + 1, 7.5, Number.NaN, String(range.min)].map((number) => ({
          ...policy,
          [key]: number,
        })),
      ),
    ]) {
      assert.throws(
        () => settingsService.previewRetentionSettings(value),
        settingsService.RetentionValidationError,
      );
    }
    assert.equal(count("settings"), 0);
  });

  it("requires confirmation and rejects a preview for another policy or stale counts", () => {
    const proposal = settingsService.previewRetentionSettings(policy);
    assert.throws(
      () => settingsService.saveRetentionSettings(policy, proposal.previewToken, false),
      settingsService.RetentionValidationError,
    );
    assert.throws(
      () =>
        settingsService.saveRetentionSettings(
          { ...policy, runsPerWorkflow: 51 },
          proposal.previewToken,
          true,
        ),
      settingsService.RetentionPreviewConflict,
    );
    const ancient = new Date(Date.now() - 10 * 86400000).toISOString();
    read("newly-eligible", ancient);
    assert.throws(
      () => settingsService.saveRetentionSettings(policy, proposal.previewToken, true),
      settingsService.RetentionPreviewConflict,
    );
    assert.equal(count("settings"), 0);
  });

  it("saves the reviewed policy and audit atomically without deleting records", () => {
    read("old", new Date(Date.now() - 10 * 86400000).toISOString());
    const proposal = settingsService.previewRetentionSettings(policy);
    settingsService.saveRetentionSettings(policy, proposal.previewToken, true, "admin");
    assert.deepEqual(settingsService.getRetentionSettings(), policy);
    assert.equal(count("data_source_reads"), 1);
    const audit = db
      .prepare("SELECT user_id, detail FROM audit_events WHERE action='retention.settings_changed'")
      .get() as { user_id: string; detail: string };
    assert.equal(audit.user_id, "admin");
    assert.deepEqual(JSON.parse(audit.detail).previous, defaults);
    assert.equal(JSON.parse(audit.detail).scheduled.dataSourceReads, 1);
    service.runRetentionPass();
    assert.equal(count("data_source_reads"), 0);
  });

  it("rolls back a policy if the audit write fails", () => {
    const proposal = settingsService.previewRetentionSettings(policy);
    db.exec(
      "CREATE TEMP TRIGGER reject_retention_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END",
    );
    try {
      assert.throws(
        () => settingsService.saveRetentionSettings(policy, proposal.previewToken, true),
        /audit unavailable/,
      );
    } finally {
      db.exec("DROP TRIGGER reject_retention_audit");
    }
    assert.deepEqual(settingsService.getRetentionSettings(), defaults);
  });

  it("detects concurrent policy changes and allows a confirmed disable", () => {
    const original = settingsService.previewRetentionSettings(policy);
    settingsService.saveRetentionSettings(policy, original.previewToken, true);
    assert.throws(
      () => settingsService.saveRetentionSettings(policy, original.previewToken, true),
      settingsService.RetentionPreviewConflict,
    );
    const off = settingsService.previewRetentionSettings(defaults);
    assert.deepEqual(off.scheduled, {
      automationRuns: 0,
      automationBlockRuns: 0,
      dataSourceReads: 0,
    });
    settingsService.saveRetentionSettings(defaults, off.previewToken, true);
    assert.equal(settingsService.getRetentionSettings().automaticCleanupEnabled, false);
  });

  it("reports disk warnings at the selected threshold and handles unavailable storage", () => {
    assert.deepEqual(settingsService.getRetentionDiskUsage(80), { usedPercent: 85, warning: true });
    assert.equal(settingsService.getRetentionDiskUsage(90)?.warning, false);
    statfs.mockReturnValueOnce({ blocks: 0, bfree: 0 });
    assert.equal(settingsService.getRetentionDiskUsage(80), null);
    statfs.mockImplementationOnce(() => {
      throw new Error("unavailable");
    });
    assert.equal(settingsService.getRetentionDiskUsage(80), null);
  });
});

describe("configured retention eligibility and deletion", () => {
  it("stops future batches when the policy is disabled during a sweep", async () => {
    vi.useFakeTimers({ now });
    try {
      db.transaction(() => {
        for (let i = 0; i < 1200; i++) read(`batch-${i}`);
      })();
      const proposal = settingsService.previewRetentionSettings(policy);
      settingsService.saveRetentionSettings(policy, proposal.previewToken, true);
      service.startRetentionScheduler();
      assert.equal(count("data_source_reads"), 700);
      const disabled = settingsService.previewRetentionSettings(defaults);
      settingsService.saveRetentionSettings(defaults, disabled.previewToken, true);
      await vi.advanceTimersByTimeAsync(10);
      assert.equal(count("data_source_reads"), 700);
      await vi.advanceTimersByTimeAsync(service.RETENTION_INTERVAL_MS);
      assert.equal(count("data_source_reads"), 700);
    } finally {
      service.stopRetentionScheduler();
      vi.useRealTimers();
    }
  });

  it("rolls back dependent block deletion if parent deletion fails", () => {
    run("deleted-old", null);
    db.exec(
      "CREATE TEMP TRIGGER reject_run_delete BEFORE DELETE ON automation_runs BEGIN SELECT RAISE(ABORT,'run delete unavailable'); END",
    );
    try {
      assert.throws(
        () => repository.pruneConfiguredRetention(policy, 500, now),
        /run delete unavailable/,
      );
      assert.equal(count("automation_runs"), 1);
      assert.equal(count("automation_block_runs"), 1);
    } finally {
      db.exec("DROP TRIGGER reject_run_delete");
    }
  });
  it("caps each workflow separately, removes block runs together and keeps the security budget ledger", () => {
    workflow("busy");
    workflow("quiet");
    for (let i = 0; i < 60; i++)
      run(`busy-${String(i).padStart(3, "0")}`, "busy", new Date(now - 100000 + i).toISOString());
    run("quiet-1", "quiet");
    run("quiet-2", "quiet");
    db.prepare(
      "INSERT INTO automation_workflow_budget_events(run_id,workflow_id,consumed_at) VALUES ('busy-000','busy',?)",
    ).run(current);
    assert.deepEqual(repository.previewConfiguredRetention(policy, now), {
      automationRuns: 10,
      automationBlockRuns: 10,
      dataSourceReads: 0,
    });
    assert.deepEqual(repository.pruneConfiguredRetention(policy, 3, now), {
      automationRuns: 3,
      automationBlockRuns: 3,
      dataSourceReads: 0,
    });
    assert.equal(count("automation_runs"), 59);
    assert.equal(count("automation_block_runs"), 59);
    assert.equal(count("automation_workflow_budget_events"), 1);
    assert.ok(db.prepare("SELECT id FROM automation_runs WHERE id='quiet-1'").get());
    while (repository.pruneConfiguredRetention(policy, 3, now).automationRuns) {
      /* drain bounded batches */
    }
    assert.equal(count("automation_runs"), 52);
    assert.ok(db.prepare("SELECT id FROM automation_runs WHERE id='busy-059'").get());
  });

  it("uses age only for deleted-workflow runs and never prunes active runs", () => {
    workflow("active");
    const active = runs.createAutomationRun({
      workflowId: "active",
      workflowName: "Active",
      triggerType: "manual",
      blockCount: 0,
    });
    db.prepare("UPDATE automation_runs SET started_at=? WHERE id=?").run(old, active.id);
    for (let i = 0; i < 51; i++) run(`recent-${i}`, "active", current);
    run("deleted-old", null);
    run("deleted-new", null, current);
    run("boundary", null, new Date(now - 7 * 86400000).toISOString());
    const preview = repository.previewConfiguredRetention(policy, now);
    assert.equal(preview.automationRuns, 2);
    repository.pruneConfiguredRetention(policy, 500, now);
    assert.ok(db.prepare("SELECT id FROM automation_runs WHERE id=?").get(active.id));
    assert.ok(db.prepare("SELECT id FROM automation_runs WHERE id='deleted-new'").get());
    assert.ok(db.prepare("SELECT id FROM automation_runs WHERE id='boundary'").get());
    runs.finishAutomationRun(active.id, { status: "success" });
  });

  it("preserves proof-linked reads, visible inbox content, proof history and imported archives", () => {
    db.prepare(
      "INSERT INTO integritas_proofs(id,created_at,updated_at,hash,proof_status) VALUES ('proof', ?, ?, 'hash','confirmed')",
    ).run(old, old);
    read("protected", old, "proof");
    read("eligible");
    read("recent", current);
    run("deleted-run", null);
    db.prepare(
      "INSERT INTO automation_inbox_items(id,run_id,workflow_name,title,format,content_json,created_at) VALUES ('inbox','deleted-run','WF','Keep','text','{}',?)",
    ).run(old);
    db.prepare(
      "INSERT INTO history_archives(id,imported_at,exported_at,schema_version,category_counts_json,archive_json) VALUES ('archive',?,?,1,'{}','{}')",
    ).run(old, old);
    assert.deepEqual(repository.previewConfiguredRetention(policy, now), {
      automationRuns: 1,
      automationBlockRuns: 1,
      dataSourceReads: 1,
    });
    repository.pruneConfiguredRetention(policy, 500, now);
    assert.ok(db.prepare("SELECT id FROM data_source_reads WHERE id='protected'").get());
    assert.equal(count("automation_inbox_items"), 1);
    assert.equal(count("integritas_proofs"), 1);
    assert.equal(count("history_archives"), 1);
  });
});
