import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

vi.mock("../../../src/features/data-sources/dataSources.service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/features/data-sources/dataSources.service.js")>()),
  sendHttpOutput: vi.fn().mockResolvedValue({ status: 200 })
}));

let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let app: express.Express;
let workflows: typeof import("../../../src/features/automation/automation.repository.js");
let dataSources: typeof import("../../../src/features/data-sources/dataSources.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  const { dataSourcesWebhookRouter } = await import("../../../src/features/data-sources/dataSources.routes.js");
  workflows = await import("../../../src/features/automation/automation.repository.js");
  dataSources = await import("../../../src/features/data-sources/dataSources.repository.js");

  app = express();
  app.use(express.json());
  app.use("/api/data-source-webhooks", dataSourcesWebhookRouter);
});

afterAll(() => {
  teardown();
});

let tokenCounter = 0;

function makeWebhookWorkflow(extraBlocks: { type: "control_output"; config: unknown }[] = []) {
  tokenCounter += 1;
  const webhookToken = `webhook-route-token-${tokenCounter}`;
  const source = dataSources.createDataSource({ name: "Webhook", type: "webhook", config: { webhookToken } });
  const workflow = workflows.createAutomationWorkflow({
    name: "Webhook workflow",
    enabled: true,
    blocks: [{ type: "webhook_event_start", config: { sourceId: source.id } }, ...extraBlocks]
  });
  return { webhookToken, source, workflow };
}

describe("POST /api/data-source-webhooks/:token — rate limit", () => {
  it("allows 60 requests per minute per client and source, then returns 429 with rate-limit headers", async () => {
    const { webhookToken } = makeWebhookWorkflow();
    for (let index = 0; index < 60; index += 1) {
      const response = await request(app).post(`/api/data-source-webhooks/${webhookToken}`).send({ index });
      assert.equal(response.status, 200, `request ${index + 1} failed`);
      assert.equal(response.headers["ratelimit-limit"], "60");
    }

    const limited = await request(app).post(`/api/data-source-webhooks/${webhookToken}`).send({ index: 61 });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers["ratelimit-remaining"], "0");
    assert.ok(limited.headers["ratelimit-reset"]);
    assert.equal(limited.body.errorDetails.type, "rate_limited");
    assert.equal(JSON.stringify(limited.body).includes(webhookToken), false);

    const other = makeWebhookWorkflow();
    assert.equal((await request(app).post(`/api/data-source-webhooks/${other.webhookToken}`).send({})).status, 200);
  });

  it("returns 429 without the token when the workflow run budget is exhausted", async () => {
    const target = dataSources.createDataSource({ name: "HTTP target", type: "http-output", config: { url: "https://example.com/hook", method: "POST" } });
    const { webhookToken, source, workflow } = makeWebhookWorkflow([
      { type: "control_output", config: { targetId: target.id, action: "send_request", bodyMode: "none" } }
    ]);
    for (let index = 0; index < 10; index += 1) {
      db.prepare("INSERT INTO automation_workflow_budget_events (run_id, workflow_id, consumed_at) VALUES (?, ?, ?)").run(`${workflow.id}-${index}`, workflow.id, new Date().toISOString());
    }

    const response = await request(app).post(`/api/data-source-webhooks/${webhookToken}`).send({ ok: true });

    assert.equal(response.status, 429);
    assert.match(response.body.error as string, /budget exhausted/);
    assert.equal(response.body.errorDetails.context.sourceId, source.id);
    assert.match(response.body.errorDetails.context.nextAvailableAt as string, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(JSON.stringify(response.body).includes(webhookToken), false);
  });

  it("records the pushed payload with a source reference, not the tokenised URL", async () => {
    const { webhookToken, source } = makeWebhookWorkflow();
    const recordWorkflow = workflows.listEnabledEventWorkflows("webhook_event_start", source.id)[0];
    workflows.createAutomationBlock(recordWorkflow.id, { type: "record_trigger_event", config: {} });

    assert.equal((await request(app).post(`/api/data-source-webhooks/${webhookToken}`).send({ temp: 21 })).status, 200);

    const reads = db.prepare("SELECT source_url FROM data_source_reads WHERE data_source_id = ?").all(source.id) as { source_url: string }[];
    assert.deepEqual(reads, [{ source_url: `data-source:${source.id}` }]);
  });
});
