import { beforeEach, describe, expect, it, vi } from "vitest";

const getJson = vi.fn();
const postJson = vi.fn();
const patchJson = vi.fn();
const deleteJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
  patchJson: (...args: unknown[]) => patchJson(...args),
  deleteJson: (...args: unknown[]) => deleteJson(...args),
}));

import {
  addAutomationBlock,
  createAutomationWorkflow,
  deleteAutomationBlock,
  deleteAutomationInboxItem,
  deleteAutomationWorkflow,
  duplicateAutomationWorkflow,
  getAutomationWorkflowValidation,
  listAutomationInbox,
  listAutomationRuns,
  listAutomationWorkflowRuns,
  listAutomationWorkflows,
  reorderAutomationBlocks,
  runAutomationWorkflow,
  updateAutomationBlock,
  updateAutomationInboxItem,
  updateAutomationWorkflow,
  validateAutomationDraft,
} from "../../../src/features/automation/automationApi";

describe("automationApi", () => {
  beforeEach(() => {
    getJson.mockReset();
    postJson.mockReset();
    patchJson.mockReset();
    deleteJson.mockReset();
  });

  it("listAutomationWorkflows GETs the workflow list", async () => {
    const result = { items: [] };
    getJson.mockResolvedValue(result);

    expect(await listAutomationWorkflows()).toBe(result);
    expect(getJson).toHaveBeenCalledWith("/api/automation/workflows");
  });

  it("createAutomationWorkflow POSTs the given input", async () => {
    const item = { item: { id: "1" } };
    postJson.mockResolvedValue(item);
    const input = { name: "New workflow", enabled: true, blocks: [] };

    expect(await createAutomationWorkflow(input)).toBe(item);
    expect(postJson).toHaveBeenCalledWith("/api/automation/workflows", input);
  });

  it("validateAutomationDraft POSTs to the validate-draft endpoint", async () => {
    const result = { item: { ok: true, errors: [], warnings: [] } };
    postJson.mockResolvedValue(result);
    const input = { blocks: [] };

    expect(await validateAutomationDraft(input)).toBe(result);
    expect(postJson).toHaveBeenCalledWith("/api/automation/workflows/validate-draft", input);
  });

  it("updateAutomationWorkflow PATCHes the workflow by id", async () => {
    const result = { item: { id: "1" } };
    patchJson.mockResolvedValue(result);

    expect(await updateAutomationWorkflow("1", { enabled: false })).toBe(result);
    expect(patchJson).toHaveBeenCalledWith("/api/automation/workflows/1", { enabled: false });
  });

  it("duplicateAutomationWorkflow POSTs to the duplicate endpoint", async () => {
    const result = { item: { id: "2" } };
    postJson.mockResolvedValue(result);

    expect(await duplicateAutomationWorkflow("1")).toBe(result);
    expect(postJson).toHaveBeenCalledWith("/api/automation/workflows/1/duplicate");
  });

  it("addAutomationBlock POSTs the block to the workflow", async () => {
    const result = { item: { id: "b1" }, workflow: { id: "1" } };
    postJson.mockResolvedValue(result);
    const input = { type: "wait" as const, config: { durationMs: 500 } };

    expect(await addAutomationBlock("1", input)).toBe(result);
    expect(postJson).toHaveBeenCalledWith("/api/automation/workflows/1/blocks", input);
  });

  it("deleteAutomationBlock DELETEs the block by workflow and block id", async () => {
    const result = { deleted: true, workflow: { id: "1" } };
    deleteJson.mockResolvedValue(result);

    expect(await deleteAutomationBlock("1", "b1")).toBe(result);
    expect(deleteJson).toHaveBeenCalledWith("/api/automation/workflows/1/blocks/b1");
  });

  it("updateAutomationBlock PATCHes the block by workflow and block id", async () => {
    const result = { item: { id: "b1" }, workflow: { id: "1" } };
    patchJson.mockResolvedValue(result);
    const input = { enabled: false };

    expect(await updateAutomationBlock("1", "b1", input)).toBe(result);
    expect(patchJson).toHaveBeenCalledWith("/api/automation/workflows/1/blocks/b1", input);
  });

  it("reorderAutomationBlocks POSTs the ordered block ids", async () => {
    const result = { items: [], workflow: { id: "1" } };
    postJson.mockResolvedValue(result);

    expect(await reorderAutomationBlocks("1", ["b1", "b2"])).toBe(result);
    expect(postJson).toHaveBeenCalledWith("/api/automation/workflows/1/blocks/reorder", {
      blockIds: ["b1", "b2"],
    });
  });

  it("deleteAutomationWorkflow DELETEs the workflow by id", async () => {
    const result = { deleted: true };
    deleteJson.mockResolvedValue(result);

    expect(await deleteAutomationWorkflow("1")).toBe(result);
    expect(deleteJson).toHaveBeenCalledWith("/api/automation/workflows/1");
  });

  it("runAutomationWorkflow POSTs without a body when no trigger payload is given", async () => {
    const result = { workflow: { id: "1" }, proofId: null };
    postJson.mockResolvedValue(result);

    expect(await runAutomationWorkflow("1")).toBe(result);
    expect(postJson).toHaveBeenCalledWith("/api/automation/workflows/1/run", undefined);
  });

  it("runAutomationWorkflow POSTs a wrapped trigger payload when given", async () => {
    const result = { workflow: { id: "1" }, proofId: "p1" };
    postJson.mockResolvedValue(result);

    expect(await runAutomationWorkflow("1", { foo: "bar" })).toBe(result);
    expect(postJson).toHaveBeenCalledWith("/api/automation/workflows/1/run", {
      triggerPayload: { foo: "bar" },
    });
  });

  it("listAutomationRuns GETs runs with default paging when no params given", async () => {
    const result = { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 };
    getJson.mockResolvedValue(result);

    expect(await listAutomationRuns()).toBe(result);
    expect(getJson).toHaveBeenCalledWith("/api/automation/runs?pageSize=25");
  });

  it("listAutomationRuns builds a query string from paging params", async () => {
    const result = { items: [], page: 2, pageSize: 10, total: 0, totalPages: 0 };
    getJson.mockResolvedValue(result);

    expect(await listAutomationRuns({ page: 2, pageSize: 10, q: "hash" })).toBe(result);
    expect(getJson).toHaveBeenCalledWith("/api/automation/runs?page=2&pageSize=10&q=hash");
  });

  it("listAutomationWorkflowRuns GETs runs for a workflow with a default limit", async () => {
    const result = { items: [] };
    getJson.mockResolvedValue(result);

    expect(await listAutomationWorkflowRuns("1")).toBe(result);
    expect(getJson).toHaveBeenCalledWith("/api/automation/workflows/1/runs?limit=20");
  });

  it("listAutomationWorkflowRuns respects a custom limit", async () => {
    const result = { items: [] };
    getJson.mockResolvedValue(result);

    expect(await listAutomationWorkflowRuns("1", 5)).toBe(result);
    expect(getJson).toHaveBeenCalledWith("/api/automation/workflows/1/runs?limit=5");
  });

  it("getAutomationWorkflowValidation GETs the validation result for a workflow", async () => {
    const result = { item: { ok: true, errors: [], warnings: [] } };
    getJson.mockResolvedValue(result);

    expect(await getAutomationWorkflowValidation("1")).toBe(result);
    expect(getJson).toHaveBeenCalledWith("/api/automation/workflows/1/validation");
  });

  it("listAutomationInbox GETs the inbox with no query string by default", async () => {
    const result = { items: [], total: 0, limit: 0, offset: 0 };
    getJson.mockResolvedValue(result);

    expect(await listAutomationInbox()).toBe(result);
    expect(getJson).toHaveBeenCalledWith("/api/automation/inbox");
  });

  it("listAutomationInbox builds a query string from status/limit/offset", async () => {
    const result = { items: [], total: 0, limit: 10, offset: 20 };
    getJson.mockResolvedValue(result);

    expect(await listAutomationInbox({ status: "unread", limit: 10, offset: 20 })).toBe(result);
    expect(getJson).toHaveBeenCalledWith("/api/automation/inbox?status=unread&limit=10&offset=20");
  });

  it("updateAutomationInboxItem PATCHes the read state by id", async () => {
    const result = { item: { id: "i1" } };
    patchJson.mockResolvedValue(result);

    expect(await updateAutomationInboxItem("i1", { read: true })).toBe(result);
    expect(patchJson).toHaveBeenCalledWith("/api/automation/inbox/i1", { read: true });
  });

  it("deleteAutomationInboxItem DELETEs the inbox item by id", async () => {
    const result = { deleted: true };
    deleteJson.mockResolvedValue(result);

    expect(await deleteAutomationInboxItem("i1")).toBe(result);
    expect(deleteJson).toHaveBeenCalledWith("/api/automation/inbox/i1");
  });
});
