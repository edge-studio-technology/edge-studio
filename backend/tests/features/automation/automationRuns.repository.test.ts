import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let repo: typeof import("../../../src/features/automation/automationRuns.repository.js");
let workflowRepo: typeof import("../../../src/features/automation/automation.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  repo = await import("../../../src/features/automation/automationRuns.repository.js");
  workflowRepo = await import("../../../src/features/automation/automation.repository.js");
});

afterAll(() => {
  teardown();
});

function baseQuery(overrides: Partial<{ page: number; pageSize: number; status?: string; q?: string }> = {}) {
  return { page: 1, pageSize: 50, ...overrides };
}

function makeWorkflow(name: string) {
  return workflowRepo.createAutomationWorkflow({ name, enabled: true, blocks: [{ type: "manual_start", config: {} }] });
}

describe("automationRuns.repository — runs", () => {
  it("creates a run in the running state with no finished_at/error", () => {
    const workflow = makeWorkflow("Test Workflow");
    const run = repo.createAutomationRun({
      workflowId: workflow.id,
      workflowName: "Test Workflow",
      triggerType: "manual",
      blockCount: 3
    });

    assert.equal(run.workflow_id, workflow.id);
    assert.equal(run.workflow_name, "Test Workflow");
    assert.equal(run.status, "running");
    assert.equal(run.finished_at, null);
    assert.equal(run.error, null);
    assert.equal(run.block_count, 3);
    assert.ok(run.id);
    assert.ok(run.started_at);
  });

  it("serializes the trigger payload as JSON, storing null when omitted", () => {
    const workflow = makeWorkflow("Test Workflow");
    const withPayload = repo.createAutomationRun({
      workflowId: workflow.id,
      workflowName: "Test Workflow",
      triggerType: "webhook",
      triggerPayload: { foo: "bar" },
      blockCount: 1
    });
    assert.equal(withPayload.trigger_payload_json, JSON.stringify({ foo: "bar" }));

    const withoutPayload = repo.createAutomationRun({
      workflowId: workflow.id,
      workflowName: "Test Workflow",
      triggerType: "manual",
      blockCount: 1
    });
    assert.equal(withoutPayload.trigger_payload_json, null);
  });

  it("finishAutomationRun sets status, finished_at, duration_ms, and error", () => {
    const workflow = makeWorkflow("Test Workflow");
    const run = repo.createAutomationRun({
      workflowId: workflow.id,
      workflowName: "Test Workflow",
      triggerType: "manual",
      blockCount: 1
    });

    const finished = repo.finishAutomationRun(run.id, { status: "failed", error: "boom" });

    assert.ok(finished);
    assert.equal(finished?.status, "failed");
    assert.ok(finished?.finished_at);
    assert.equal(typeof finished?.duration_ms, "number");
    assert.ok((finished?.duration_ms ?? -1) >= 0);
    assert.equal(finished?.error, "boom");
  });

  it("finishAutomationRun returns undefined for a missing run id", () => {
    const result = repo.finishAutomationRun("does-not-exist", { status: "success" });
    assert.equal(result, undefined);
  });

  it("getAutomationRun returns undefined for a missing id", () => {
    assert.equal(repo.getAutomationRun("missing"), undefined);
  });

  it("listAutomationRunsForWorkflow filters by workflow and honors the limit", () => {
    const workflowA = makeWorkflow("A");
    const workflowB = makeWorkflow("B");
    repo.createAutomationRun({ workflowId: workflowA.id, workflowName: "A", triggerType: "manual", blockCount: 1 });
    repo.createAutomationRun({ workflowId: workflowA.id, workflowName: "A", triggerType: "manual", blockCount: 1 });
    repo.createAutomationRun({ workflowId: workflowB.id, workflowName: "B", triggerType: "manual", blockCount: 1 });

    const runsForA = repo.listAutomationRunsForWorkflow(workflowA.id);
    assert.ok(runsForA.every((r) => r.workflow_id === workflowA.id));
    assert.equal(runsForA.length, 2);

    const limited = repo.listAutomationRunsForWorkflow(workflowA.id, 1);
    assert.equal(limited.length, 1);
  });
});

describe("automationRuns.repository — run listing/filtering", () => {
  it("countAutomationRuns and listAutomationRuns filter by status", () => {
    const workflow = makeWorkflow("FilterWf");
    const success = repo.createAutomationRun({ workflowId: workflow.id, workflowName: "FilterWf", triggerType: "manual", blockCount: 1 });
    repo.finishAutomationRun(success.id, { status: "success" });
    const failed = repo.createAutomationRun({ workflowId: workflow.id, workflowName: "FilterWf", triggerType: "manual", blockCount: 1 });
    repo.finishAutomationRun(failed.id, { status: "failed", error: "err" });

    const successCount = repo.countAutomationRuns({ status: "success" });
    const successRuns = repo.listAutomationRuns(baseQuery({ status: "success" }));
    assert.equal(successRuns.length, successCount);
    assert.ok(successRuns.every((r) => r.status === "success"));
  });

  it("filters by q across workflow_name/trigger_type/trigger_source_id/error", () => {
    const workflow = makeWorkflow("UniqueSearchTarget");
    repo.createAutomationRun({
      workflowId: workflow.id,
      workflowName: "UniqueSearchTarget",
      triggerType: "manual",
      blockCount: 1
    });

    const results = repo.listAutomationRuns(baseQuery({ q: "UniqueSearchTarget" }));
    assert.ok(results.length >= 1);
    assert.ok(results.every((r) => r.workflow_name.includes("UniqueSearchTarget")));
  });

  it("paginates using page/pageSize", () => {
    const workflow = makeWorkflow("PageWf");
    for (let i = 0; i < 5; i += 1) {
      repo.createAutomationRun({ workflowId: workflow.id, workflowName: "PageWf", triggerType: "manual", blockCount: 1 });
    }

    const total = repo.countAutomationRuns({ q: "PageWf" });
    const page1 = repo.listAutomationRuns(baseQuery({ pageSize: 2, q: "PageWf" }));
    const page2 = repo.listAutomationRuns(baseQuery({ page: 2, pageSize: 2, q: "PageWf" }));

    assert.equal(total, 5);
    assert.equal(page1.length, 2);
    assert.equal(page2.length, 2);
    assert.notDeepEqual(page1.map((r) => r.id), page2.map((r) => r.id));
  });

  it("orders results by started_at descending", () => {
    const workflow = makeWorkflow("OrderWf");
    const first = repo.createAutomationRun({ workflowId: workflow.id, workflowName: "OrderWf", triggerType: "manual", blockCount: 1 });
    const second = repo.createAutomationRun({ workflowId: workflow.id, workflowName: "OrderWf", triggerType: "manual", blockCount: 1 });

    const results = repo.listAutomationRuns(baseQuery({ q: "OrderWf" }));
    const firstIndex = results.findIndex((r) => r.id === first.id);
    const secondIndex = results.findIndex((r) => r.id === second.id);
    assert.ok(secondIndex < firstIndex);
  });
});

describe("automationRuns.repository — block runs", () => {
  it("creates a block run in the running state and serializes input", () => {
    const workflow = makeWorkflow("W");
    const block = workflowRepo.createAutomationBlock(workflow.id, { type: "fetch_data_source", config: {} });
    const run = repo.createAutomationRun({ workflowId: workflow.id, workflowName: "W", triggerType: "manual", blockCount: 1 });
    const blockRun = repo.createAutomationBlockRun({
      runId: run.id,
      workflowId: workflow.id,
      blockId: block.id,
      orderIndex: 0,
      blockType: "fetch_data_source",
      blockLabel: "Fetch",
      input: { sourceId: "src1" }
    });

    assert.equal(blockRun.run_id, run.id);
    assert.equal(blockRun.status, "running");
    assert.equal(blockRun.finished_at, null);
    assert.equal(blockRun.input_json, JSON.stringify({ sourceId: "src1" }));
  });

  it("finishAutomationBlockRun sets status, output, error, and duration", () => {
    const workflow = makeWorkflow("W");
    const block = workflowRepo.createAutomationBlock(workflow.id, { type: "fetch_data_source", config: {} });
    const run = repo.createAutomationRun({ workflowId: workflow.id, workflowName: "W", triggerType: "manual", blockCount: 1 });
    const blockRun = repo.createAutomationBlockRun({
      runId: run.id,
      workflowId: workflow.id,
      blockId: block.id,
      orderIndex: 0,
      blockType: "fetch_data_source",
      blockLabel: "Fetch"
    });

    const finished = repo.finishAutomationBlockRun(blockRun.id, { status: "success", output: { ok: true } });

    assert.equal(finished?.status, "success");
    assert.equal(finished?.output_json, JSON.stringify({ ok: true }));
    assert.equal(finished?.error, null);
    assert.ok(finished?.finished_at);
  });

  it("finishAutomationBlockRun returns undefined for a missing id", () => {
    const result = repo.finishAutomationBlockRun("missing", { status: "skipped" });
    assert.equal(result, undefined);
  });

  it("listAutomationBlockRuns orders by order_index then started_at", () => {
    const workflow = makeWorkflow("W");
    const blockA = workflowRepo.createAutomationBlock(workflow.id, { type: "fetch_data_source", config: {} });
    const blockB = workflowRepo.createAutomationBlock(workflow.id, { type: "show_preview", config: {} });
    const run = repo.createAutomationRun({ workflowId: workflow.id, workflowName: "W", triggerType: "manual", blockCount: 2 });
    repo.createAutomationBlockRun({ runId: run.id, workflowId: workflow.id, blockId: blockB.id, orderIndex: 1, blockType: "show_preview", blockLabel: "Second" });
    repo.createAutomationBlockRun({ runId: run.id, workflowId: workflow.id, blockId: blockA.id, orderIndex: 0, blockType: "fetch_data_source", blockLabel: "First" });

    const blockRuns = repo.listAutomationBlockRuns(run.id);
    assert.equal(blockRuns.length, 2);
    assert.equal(blockRuns[0].block_id, blockA.id);
    assert.equal(blockRuns[1].block_id, blockB.id);
  });
});
