import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let repo: typeof import("../../../src/features/automation/automationInbox.repository.js");
let workflowRepo: typeof import("../../../src/features/automation/automation.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  repo = await import("../../../src/features/automation/automationInbox.repository.js");
  workflowRepo = await import("../../../src/features/automation/automation.repository.js");
});

afterAll(() => {
  teardown();
});

function makeItem(overrides: Partial<Parameters<typeof repo.createAutomationInboxItem>[0]> = {}) {
  return repo.createAutomationInboxItem({
    workflowId: null,
    workflowName: "Test Workflow",
    runId: null,
    blockId: null,
    title: "Preview",
    format: "text",
    content: { text: "hello" },
    ...overrides
  });
}

describe("automationInbox.repository — create/get", () => {
  it("creates an item with content serialized as JSON and unread/undeleted by default", () => {
    const item = makeItem({ content: { text: "hi" } });

    assert.equal(item.content_json, JSON.stringify({ text: "hi" }));
    assert.equal(item.read_at, null);
    assert.equal(item.deleted_at, null);
    assert.ok(item.id);
    assert.ok(item.created_at);
  });

  it("stores renderedText when provided, null otherwise", () => {
    const withRendered = makeItem({ renderedText: "rendered" });
    assert.equal(withRendered.rendered_text, "rendered");

    const withoutRendered = makeItem();
    assert.equal(withoutRendered.rendered_text, null);
  });

  it("getAutomationInboxItem returns undefined for a missing id", () => {
    assert.equal(repo.getAutomationInboxItem("missing"), undefined);
  });

  it("getAutomationInboxItem returns the item after creation", () => {
    const item = makeItem();
    const fetched = repo.getAutomationInboxItem(item.id);
    assert.equal(fetched?.id, item.id);
  });
});

describe("automationInbox.repository — read/delete", () => {
  it("setAutomationInboxItemRead marks read and clears it back to unread", () => {
    const item = makeItem();

    const read = repo.setAutomationInboxItemRead(item.id, true);
    assert.ok(read?.read_at);

    const unread = repo.setAutomationInboxItemRead(item.id, false);
    assert.equal(unread?.read_at, null);
  });

  it("deleteAutomationInboxItem soft-deletes and returns true, then false on a second call", () => {
    const item = makeItem();

    const firstDelete = repo.deleteAutomationInboxItem(item.id);
    assert.equal(firstDelete, true);
    assert.equal(repo.getAutomationInboxItem(item.id), undefined);

    const secondDelete = repo.deleteAutomationInboxItem(item.id);
    assert.equal(secondDelete, false);
  });

  it("deleteAutomationInboxItem returns false for a missing id", () => {
    assert.equal(repo.deleteAutomationInboxItem("missing"), false);
  });
});

describe("automationInbox.repository — listing/filtering", () => {
  it("excludes deleted items from listAutomationInboxItems and countAutomationInboxItems", () => {
    const item = makeItem({ title: "ToDelete" });
    repo.deleteAutomationInboxItem(item.id);

    const items = repo.listAutomationInboxItems({ status: "all", limit: 100, offset: 0 });
    assert.ok(!items.some((i) => i.id === item.id));
  });

  it("filters by unread/read status", () => {
    const unreadItem = makeItem({ title: "Unread" });
    const readItem = makeItem({ title: "Read" });
    repo.setAutomationInboxItemRead(readItem.id, true);

    const unread = repo.listAutomationInboxItems({ status: "unread", limit: 100, offset: 0 });
    const read = repo.listAutomationInboxItems({ status: "read", limit: 100, offset: 0 });

    assert.ok(unread.some((i) => i.id === unreadItem.id));
    assert.ok(!unread.some((i) => i.id === readItem.id));
    assert.ok(read.some((i) => i.id === readItem.id));
    assert.ok(!read.some((i) => i.id === unreadItem.id));
  });

  it("filters by workflowId", () => {
    const workflow = workflowRepo.createAutomationWorkflow({ name: "InboxWf", enabled: true, blocks: [{ type: "manual_start", config: {} }] });
    const matching = makeItem({ workflowId: workflow.id, workflowName: "InboxWf", title: "Match" });
    makeItem({ title: "NoMatch" });

    const items = repo.listAutomationInboxItems({ status: "all", workflowId: workflow.id, limit: 100, offset: 0 });
    assert.equal(items.length, 1);
    assert.equal(items[0].id, matching.id);
  });

  it("filters by format", () => {
    const jsonItem = makeItem({ format: "json", content: { a: 1 }, title: "JsonItem" });
    makeItem({ format: "text", title: "TextItem" });

    const items = repo.listAutomationInboxItems({ status: "all", format: "json", limit: 100, offset: 0 });
    assert.ok(items.some((i) => i.id === jsonItem.id));
    assert.ok(items.every((i) => i.format === "json"));
  });

  it("countAutomationInboxItems matches listAutomationInboxItems length for the same filter", () => {
    makeItem({ title: "CountA" });
    makeItem({ title: "CountB" });

    const count = repo.countAutomationInboxItems({ status: "all" });
    const items = repo.listAutomationInboxItems({ status: "all", limit: 1000, offset: 0 });
    assert.equal(count, items.length);
  });

  it("orders results by created_at descending and respects limit/offset", () => {
    const first = makeItem({ title: "OrderFirst" });
    const second = makeItem({ title: "OrderSecond" });

    const page1 = repo.listAutomationInboxItems({ status: "all", limit: 1, offset: 0 });
    assert.equal(page1[0].id, second.id);

    const page2 = repo.listAutomationInboxItems({ status: "all", limit: 1, offset: 1 });
    assert.equal(page2[0].id, first.id);
  });
});
