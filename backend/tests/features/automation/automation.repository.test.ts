import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let repo: typeof import("../../../src/features/automation/automation.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  repo = await import("../../../src/features/automation/automation.repository.js");
});

afterAll(() => {
  teardown();
});

describe("automation.repository — workflow CRUD", () => {
  it("creates a workflow with no blocks", () => {
    const workflow = repo.createAutomationWorkflow({ name: "Empty", enabled: true });
    assert.equal(workflow.name, "Empty");
    assert.equal(workflow.enabled, 1);
    assert.equal(workflow.archived, 0);
    assert.equal(repo.listAutomationBlocks(workflow.id).length, 0);
  });

  it("creates a workflow with top-level blocks in order and assigns sequential order_index", () => {
    const workflow = repo.createAutomationWorkflow({
      name: "Ordered",
      enabled: true,
      blocks: [
        { type: "manual_start", config: {} },
        { type: "set_variable", config: { variableName: "a" } },
        { type: "show_preview", config: { title: "t" } }
      ]
    });

    const blocks = repo.listAutomationBlocks(workflow.id);
    assert.equal(blocks.length, 3);
    assert.deepEqual(blocks.map((b) => b.order_index), [1, 2, 3]);
    assert.deepEqual(blocks.map((b) => b.type), ["manual_start", "set_variable", "show_preview"]);
  });

  it("resolves clientId-based parentBlockId references for attached blocks", () => {
    const workflow = repo.createAutomationWorkflow({
      name: "WithAttached",
      enabled: true,
      blocks: [
        { type: "manual_start", config: {}, clientId: "start" },
        { type: "fetch_data_source", config: {}, clientId: "fetch" },
        { type: "stamp_integritas", config: {}, parentBlockId: "fetch" }
      ]
    });

    const blocks = repo.listAutomationBlocks(workflow.id);
    const fetchBlock = blocks.find((b) => b.type === "fetch_data_source")!;
    const stampBlock = blocks.find((b) => b.type === "stamp_integritas")!;
    assert.equal(stampBlock.parent_block_id, fetchBlock.id);
  });

  it("getAutomationWorkflow returns undefined for a missing id", () => {
    assert.equal(repo.getAutomationWorkflow("missing"), undefined);
  });

  it("listAutomationWorkflows orders by created_at descending", () => {
    const first = repo.createAutomationWorkflow({ name: "ListOrderFirst", enabled: true });
    const second = repo.createAutomationWorkflow({ name: "ListOrderSecond", enabled: true });

    const workflows = repo.listAutomationWorkflows();
    const firstIndex = workflows.findIndex((w) => w.id === first.id);
    const secondIndex = workflows.findIndex((w) => w.id === second.id);
    assert.ok(secondIndex < firstIndex);
  });

  it("updateAutomationWorkflow updates only the provided fields and returns undefined for a missing id", () => {
    const workflow = repo.createAutomationWorkflow({ name: "Updatable", enabled: true, nextRunAt: "2026-01-01T00:00:00.000Z" });

    const updated = repo.updateAutomationWorkflow(workflow.id, { enabled: false });
    assert.equal(updated?.name, "Updatable");
    assert.equal(updated?.enabled, 0);
    assert.equal(updated?.next_run_at, "2026-01-01T00:00:00.000Z");

    assert.equal(repo.updateAutomationWorkflow("missing", { enabled: true }), undefined);
  });

  it("updateAutomationWorkflow serializes a structured lastError", () => {
    const workflow = repo.createAutomationWorkflow({ name: "ErrorWf", enabled: true });
    const updated = repo.updateAutomationWorkflow(workflow.id, { lastError: { message: "boom", code: "X" } as never });
    assert.equal(updated?.last_error, JSON.stringify({ message: "boom", code: "X" }));
  });

  it("deleteAutomationWorkflow removes the workflow and cascades to its blocks", () => {
    const workflow = repo.createAutomationWorkflow({
      name: "ToDelete",
      enabled: true,
      blocks: [{ type: "manual_start", config: {} }]
    });
    const [block] = repo.listAutomationBlocks(workflow.id);

    repo.deleteAutomationWorkflow(workflow.id);

    assert.equal(repo.getAutomationWorkflow(workflow.id), undefined);
    assert.equal(repo.getAutomationBlock(block.id), undefined);
  });
});

describe("automation.repository — duplicateAutomationWorkflow", () => {
  it("returns undefined for a missing id", () => {
    assert.equal(repo.duplicateAutomationWorkflow("missing"), undefined);
  });

  it("copies blocks (including attached blocks), disables the copy, and appends ' copy' to the name", () => {
    const original = repo.createAutomationWorkflow({
      name: "Original",
      enabled: true,
      blocks: [
        { type: "manual_start", config: {}, clientId: "start" },
        { type: "fetch_data_source", config: { sourceId: "src1" }, clientId: "fetch" },
        { type: "stamp_integritas", config: {}, parentBlockId: "fetch" }
      ]
    });

    const copy = repo.duplicateAutomationWorkflow(original.id);

    assert.equal(copy?.name, "Original copy");
    assert.equal(copy?.enabled, 0);
    assert.notEqual(copy?.id, original.id);

    const copiedBlocks = repo.listAutomationBlocks(copy!.id);
    assert.equal(copiedBlocks.length, 3);
    const copiedFetch = copiedBlocks.find((b) => b.type === "fetch_data_source")!;
    const copiedStamp = copiedBlocks.find((b) => b.type === "stamp_integritas")!;
    assert.equal(copiedStamp.parent_block_id, copiedFetch.id);
    assert.equal(JSON.parse(copiedFetch.config_json).sourceId, "src1");

    const originalBlockIds = new Set(repo.listAutomationBlocks(original.id).map((b) => b.id));
    for (const block of copiedBlocks) assert.ok(!originalBlockIds.has(block.id));
  });
});

describe("automation.repository — run/block-run status updates", () => {
  it("updateAutomationRunSuccess sets last_run_at/next_run_at and preserves last_hash when not provided", () => {
    const workflow = repo.createAutomationWorkflow({ name: "RunSuccess", enabled: true });
    const first = repo.updateAutomationRunSuccess(workflow.id, { hash: "hash1", proofId: "proof1", nextRunAt: "2026-02-01T00:00:00.000Z" });
    assert.equal(first.last_hash, "hash1");
    assert.equal(first.last_proof_id, "proof1");
    assert.ok(first.last_run_at);
    assert.equal(first.next_run_at, "2026-02-01T00:00:00.000Z");

    const second = repo.updateAutomationRunSuccess(workflow.id, {});
    assert.equal(second.last_hash, "hash1");
    assert.equal(second.next_run_at, null);
  });

  it("updateAutomationRunError serializes the error and preserves hash/proofId when not provided", () => {
    const workflow = repo.createAutomationWorkflow({ name: "RunError", enabled: true });
    repo.updateAutomationRunSuccess(workflow.id, { hash: "keepme", proofId: "proofkeep" });

    const updated = repo.updateAutomationRunError(workflow.id, "boom");
    assert.equal(updated.last_error, "boom");
    assert.equal(updated.last_hash, "keepme");
    assert.equal(updated.last_proof_id, "proofkeep");
  });

  it("updateAutomationBlockRun serializes the error and stamps last_run_at", () => {
    const workflow = repo.createAutomationWorkflow({
      name: "BlockRun",
      enabled: true,
      blocks: [{ type: "manual_start", config: {} }]
    });
    const [block] = repo.listAutomationBlocks(workflow.id);

    const updated = repo.updateAutomationBlockRun(block.id, { error: "block failed" });
    assert.equal(updated.last_error, "block failed");
    assert.ok(updated.last_run_at);
  });
});

describe("automation.repository — block CRUD/ordering", () => {
  it("updateAutomationBlock updates config/enabled, clears last_error, and returns undefined for a missing id", () => {
    const workflow = repo.createAutomationWorkflow({
      name: "BlockUpdate",
      enabled: true,
      blocks: [{ type: "manual_start", config: {} }]
    });
    const [block] = repo.listAutomationBlocks(workflow.id);
    repo.updateAutomationBlockRun(block.id, { error: "prior failure" });

    const updated = repo.updateAutomationBlock(workflow.id, block.id, { config: { foo: "bar" }, enabled: false });
    assert.equal(updated?.enabled, 0);
    assert.equal(JSON.parse(updated!.config_json).foo, "bar");
    assert.equal(updated?.last_error, null);

    assert.equal(repo.updateAutomationBlock(workflow.id, "missing", { enabled: true }), undefined);
  });

  it("deleteAutomationBlock removes a block, normalizes remaining order, and returns undefined for a missing id", () => {
    const workflow = repo.createAutomationWorkflow({
      name: "BlockDelete",
      enabled: true,
      blocks: [
        { type: "manual_start", config: {} },
        { type: "set_variable", config: {} },
        { type: "show_preview", config: { title: "t" } }
      ]
    });
    const [start, middle, last] = repo.listAutomationBlocks(workflow.id);

    const deleted = repo.deleteAutomationBlock(workflow.id, middle.id);
    assert.equal(deleted?.id, middle.id);

    const remaining = repo.listAutomationBlocks(workflow.id);
    assert.equal(remaining.length, 2);
    assert.deepEqual(remaining.map((b) => b.id), [start.id, last.id]);
    assert.deepEqual(remaining.map((b) => b.order_index), [1, 2]);

    assert.equal(repo.deleteAutomationBlock(workflow.id, "missing"), undefined);
  });

  it("reorderAutomationBlocks reorders top-level blocks and rejects an incomplete/invalid list", () => {
    const workflow = repo.createAutomationWorkflow({
      name: "Reorder",
      enabled: true,
      blocks: [
        { type: "manual_start", config: {} },
        { type: "set_variable", config: {} },
        { type: "show_preview", config: { title: "t" } }
      ]
    });
    const [start, second, third] = repo.listAutomationBlocks(workflow.id);

    const reordered = repo.reorderAutomationBlocks(workflow.id, [start.id, third.id, second.id]);
    assert.deepEqual(reordered.map((b) => b.id), [start.id, third.id, second.id]);
    assert.deepEqual(reordered.map((b) => b.order_index), [1, 2, 3]);

    assert.throws(() => repo.reorderAutomationBlocks(workflow.id, [start.id, second.id]), /must include every workflow block exactly once/);
    assert.throws(() => repo.reorderAutomationBlocks(workflow.id, [second.id, start.id, third.id]), /first workflow block must be a start block/);
    assert.throws(() => repo.reorderAutomationBlocks(workflow.id, [second.id, start.id, third.id]), Error);
  });

  it("reorderAutomationBlocks rejects moving a second start block after action blocks", () => {
    const workflow = repo.createAutomationWorkflow({
      name: "ReorderStart",
      enabled: true,
      blocks: [
        { type: "manual_start", config: {} },
        { type: "set_variable", config: {} }
      ]
    });
    const [start, second] = repo.listAutomationBlocks(workflow.id);
    repo.createAutomationBlock(workflow.id, { type: "schedule_start", config: {}, orderIndex: 3 });
    const [, , thirdStart] = repo.listAutomationBlocks(workflow.id);

    assert.throws(
      () => repo.reorderAutomationBlocks(workflow.id, [start.id, second.id, thirdStart.id]),
      /Start blocks cannot be moved after action blocks/
    );
  });

  it("replaceAutomationBlocks deletes existing blocks and inserts the new set in order", () => {
    const workflow = repo.createAutomationWorkflow({
      name: "Replace",
      enabled: true,
      blocks: [{ type: "manual_start", config: {} }]
    });

    repo.replaceAutomationBlocks(workflow.id, [
      { type: "schedule_start", config: {} },
      { type: "set_variable", config: { variableName: "x" } }
    ]);

    const blocks = repo.listAutomationBlocks(workflow.id);
    assert.equal(blocks.length, 2);
    assert.deepEqual(blocks.map((b) => b.type), ["schedule_start", "set_variable"]);
    assert.deepEqual(blocks.map((b) => b.order_index), [1, 2]);
  });

  it("createAutomationBlock assigns the parent's order_index for attached blocks", () => {
    const workflow = repo.createAutomationWorkflow({
      name: "AttachedOrder",
      enabled: true,
      blocks: [
        { type: "manual_start", config: {} },
        { type: "fetch_data_source", config: {} }
      ]
    });
    const [, fetchBlock] = repo.listAutomationBlocks(workflow.id);

    const attached = repo.createAutomationBlock(workflow.id, { type: "stamp_integritas", config: {}, parentBlockId: fetchBlock.id });
    assert.equal(attached.order_index, fetchBlock.order_index);
  });
});

describe("automation.repository — schedule/event queries", () => {
  it("listDueScheduleWorkflows returns only enabled, non-archived workflows with a due schedule_start", () => {
    const due = repo.createAutomationWorkflow({
      name: "Due",
      enabled: true,
      nextRunAt: "2026-01-01T00:00:00.000Z",
      blocks: [{ type: "schedule_start", config: {} }]
    });
    repo.createAutomationWorkflow({
      name: "NotDue",
      enabled: true,
      nextRunAt: "2099-01-01T00:00:00.000Z",
      blocks: [{ type: "schedule_start", config: {} }]
    });
    const disabled = repo.createAutomationWorkflow({
      name: "Disabled",
      enabled: false,
      nextRunAt: "2026-01-01T00:00:00.000Z",
      blocks: [{ type: "schedule_start", config: {} }]
    });
    repo.updateAutomationWorkflow(disabled.id, { archived: false });

    const results = repo.listDueScheduleWorkflows("2026-06-01T00:00:00.000Z");
    const ids = results.map((w) => w.id);
    assert.ok(ids.includes(due.id));
    assert.ok(!ids.includes(disabled.id));
    assert.ok(!results.some((w) => w.name === "NotDue"));
  });

  it("listDueScheduleWorkflows excludes archived workflows", () => {
    const workflow = repo.createAutomationWorkflow({
      name: "ArchivedDue",
      enabled: true,
      nextRunAt: "2026-01-01T00:00:00.000Z",
      blocks: [{ type: "schedule_start", config: {} }]
    });
    repo.updateAutomationWorkflow(workflow.id, { archived: true });

    const results = repo.listDueScheduleWorkflows("2026-06-01T00:00:00.000Z");
    assert.ok(!results.some((w) => w.id === workflow.id));
  });

  it("listEnabledEventWorkflows matches on block type and config sourceId", () => {
    const matching = repo.createAutomationWorkflow({
      name: "WebhookMatch",
      enabled: true,
      blocks: [{ type: "webhook_event_start", config: { sourceId: "src-a" } }]
    });
    repo.createAutomationWorkflow({
      name: "WebhookOther",
      enabled: true,
      blocks: [{ type: "webhook_event_start", config: { sourceId: "src-b" } }]
    });

    const results = repo.listEnabledEventWorkflows("webhook_event_start", "src-a");
    assert.equal(results.length, 1);
    assert.equal(results[0].id, matching.id);
  });

  it("getEnabledAutomationWorkflowForDataSource checks webhook, then mqtt, then gpio", () => {
    const gpioMatch = repo.createAutomationWorkflow({
      name: "GpioOnly",
      enabled: true,
      blocks: [{ type: "gpio_event_start", config: { sourceId: "src-gpio" } }]
    });

    const result = repo.getEnabledAutomationWorkflowForDataSource("src-gpio");
    assert.equal(result?.id, gpioMatch.id);

    assert.equal(repo.getEnabledAutomationWorkflowForDataSource("no-such-source"), undefined);
  });

  it("listAutomationWorkflowsUsingDataSource matches sourceId or targetId in any block", () => {
    const bySource = repo.createAutomationWorkflow({
      name: "BySource",
      enabled: true,
      blocks: [{ type: "fetch_data_source", config: { sourceId: "shared-src" } }]
    });
    const byTarget = repo.createAutomationWorkflow({
      name: "ByTarget",
      enabled: true,
      blocks: [
        { type: "manual_start", config: {} },
        { type: "control_output", config: { targetId: "shared-src" } }
      ]
    });

    const results = repo.listAutomationWorkflowsUsingDataSource("shared-src");
    const ids = results.map((w) => w.id);
    assert.ok(ids.includes(bySource.id));
    assert.ok(ids.includes(byTarget.id));
  });
});
