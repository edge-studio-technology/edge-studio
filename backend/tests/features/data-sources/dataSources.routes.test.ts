import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";
import { WORKFLOW_RUN_BUDGET_MAX_RUNS } from "../../../src/features/automation/automation.policy.js";

vi.mock("../../../src/features/data-sources/dataSources.service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/features/data-sources/dataSources.service.js")>()),
  sendHttpOutput: vi.fn().mockResolvedValue({ status: 200 })
}));

let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let app: express.Express;
let workflows: typeof import("../../../src/features/automation/automation.repository.js");
let dataSources: typeof import("../../../src/features/data-sources/dataSources.repository.js");
let sensorEnv: typeof import("../../../src/config/env.js")["env"];

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  const { dataSourcesRouter, dataSourcesWebhookRouter } = await import("../../../src/features/data-sources/dataSources.routes.js");
  sensorEnv = (await import("../../../src/config/env.js")).env;
  workflows = await import("../../../src/features/automation/automation.repository.js");
  dataSources = await import("../../../src/features/data-sources/dataSources.repository.js");

  app = express();
  app.use(express.json());
  app.use("/api/data-source-webhooks", dataSourcesWebhookRouter);
  app.use("/api/data-sources", (req, _res, next) => {
    req.user = { id: "admin", displayName: "Admin", role: "admin", lastLogin: null, credentialType: "password" };
    next();
  }, dataSourcesRouter);
});

afterEach(() => { vi.unstubAllGlobals(); });

afterAll(() => {
  teardown();
});

describe("PIM576 output device", () => {
  it("round trips config, prevents shared GPIO ownership, rejects reads and deliberately tests output", async () => {
    const input = { name: "Screen", type: "spi-display", config: { model: "pim576", rotation: 90 } };
    const gpio = dataSources.createDataSource({ name: "Busy GPIO", type: "gpio-output", config: { chip: "gpiochip0", pin: 25 } });
    const busy = await request(app).post("/api/data-sources").send(input);
    assert.equal(busy.status, 400);
    assert.match(busy.body.error, /already used/);
    dataSources.deleteDataSource(gpio.id);
    const created = await request(app).post("/api/data-sources").send(input);
    assert.equal(created.status, 200);
    const id = created.body.item.id;
    try {
      assert.equal((await request(app).post("/api/data-sources").send(input)).status, 400);
      assert.equal((await request(app).post("/api/data-sources").send({ name: "Conflicting pin", type: "gpio-output", config: { chip: "/dev/gpiochip0", pin: 24 } })).status, 400);
      assert.equal((await request(app).post(`/api/data-sources/${id}/read`).send({})).status, 400);
      const edited = await request(app).patch(`/api/data-sources/${id}`).send({ ...input, config: { model: "pim576", rotation: 180 } });
      assert.equal(edited.status, 200);
      assert.equal(edited.body.item.id, id);
      assert.deepEqual(edited.body.item.config, { model: "pim576", rotation: 180 });
      const saved = { enabled: sensorEnv.displaysEnabled, token: sensorEnv.displayHelperToken };
      sensorEnv.displaysEnabled = true;
      sensorEnv.displayHelperToken = "display-test-token";
      const fetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal("fetch", fetch);
      try {
        const tested = await request(app).post(`/api/data-sources/${id}/test-output`).send({});
        assert.equal(tested.status, 200);
        assert.equal(tested.body.result.action, "display_text");
        assert.deepEqual(JSON.parse(fetch.mock.calls[0][1].body).content, { title: "Edge Studio", text: "Display connected" });
      } finally {
        sensorEnv.displaysEnabled = saved.enabled;
        sensorEnv.displayHelperToken = saved.token;
      }
    } finally {
      dataSources.deleteDataSource(id);
    }
  });
});

describe("BH1750 device create/edit/manual read", () => {
  it("validates config, preserves the saved identity on edit and stores a zero-lux read and hash", async () => {
    const invalid = await request(app).post("/api/data-sources").send({ name: "Light", type: "bh1750-sensor", config: { address: "0x76" } });
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error, /config.address/);
    const created = await request(app).post("/api/data-sources").send({ name: "Light", type: "bh1750-sensor", config: {} });
    assert.equal(created.status, 200);
    const id = created.body.item.id;
    assert.deepEqual(created.body.item.config, { sensor: "bh1750", bus: 1, address: "0x23" });
    const edited = await request(app).patch(`/api/data-sources/${id}`).send({ name: "Room light", type: "bh1750-sensor", config: { bus: 1, address: "0x5c" } });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.item.id, id);
    const enabled = sensorEnv.sensorsEnabled;
    sensorEnv.sensorsEnabled = true;
    const preview = { sensor: "bh1750", bus: 1, address: "0x5c", lux: 0, readAt: "2026-11-19T00:00:00Z" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(preview))));
    try {
      const read = await request(app).post(`/api/data-sources/${id}/read`).send({});
      assert.equal(read.status, 200);
      assert.deepEqual(read.body.item.lastPreview, preview);
      assert.equal(read.body.item.lastHash, read.body.result.bytesHash);
      const stored = db.prepare("SELECT source_url, status, hash FROM data_source_reads WHERE data_source_id = ?").get(id) as { source_url: string; status: string; hash: string };
      assert.deepEqual(stored, { source_url: "bh1750:i2c-1:0x5c", status: "success", hash: read.body.result.bytesHash });

      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sensor disconnected")));
      const failed = await request(app).post(`/api/data-sources/${id}/read`).send({});
      assert.equal(failed.status, 502);
      assert.match(failed.body.item.lastError, /sensor disconnected/);
      assert.equal((db.prepare("SELECT COUNT(*) AS count FROM data_source_reads WHERE data_source_id = ? AND status = 'failed'").get(id) as { count: number }).count, 1);
    } finally {
      sensorEnv.sensorsEnabled = enabled;
    }
  });
});

let tokenCounter = 0;

function makeWebhookWorkflow(extraBlocks: { type: "control_output"; config: unknown }[] = [], startConfig: Record<string, unknown> = {}) {
  tokenCounter += 1;
  const webhookToken = `webhook-route-token-${tokenCounter}`;
  const source = dataSources.createDataSource({ name: "Webhook", type: "webhook", config: { webhookToken } });
  const workflow = workflows.createAutomationWorkflow({
    name: "Webhook workflow",
    enabled: true,
    blocks: [{ type: "webhook_event_start", config: { sourceId: source.id, ...startConfig } }, ...extraBlocks]
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
  }, 10_000);

  it("returns 429 without the token when the workflow run budget is exhausted", async () => {
    const target = dataSources.createDataSource({ name: "HTTP target", type: "http-output", config: { url: "https://example.com/hook", method: "POST" } });
    const { webhookToken, source, workflow } = makeWebhookWorkflow([
      { type: "control_output", config: { targetId: target.id, action: "send_request", bodyMode: "none" } }
    ]);
    const insert = db.prepare("INSERT INTO automation_workflow_budget_events (run_id, workflow_id, consumed_at) VALUES (?, ?, ?)");
    db.transaction(() => {
      for (let index = 0; index < WORKFLOW_RUN_BUDGET_MAX_RUNS; index += 1) insert.run(`${workflow.id}-${index}`, workflow.id, new Date().toISOString());
    })();

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

  it("returns 404 for an unknown token", async () => {
    const response = await request(app).post("/api/data-source-webhooks/unknown-token").send({ temp: 21 });
    assert.equal(response.status, 404);
  });

  it("returns 409 when the source has no enabled workflow", async () => {
    const { webhookToken, source, workflow } = makeWebhookWorkflow();
    workflows.updateAutomationWorkflow(workflow.id, { enabled: false });

    const response = await request(app).post("/api/data-source-webhooks/" + webhookToken).send({ temp: 21 });

    assert.equal(response.status, 409);
    assert.equal(response.body.errorDetails.context.sourceId, source.id);
  });

  it("returns 202 when a workflow trigger is skipped by its cooldown", async () => {
    const { webhookToken } = makeWebhookWorkflow([], { cooldownSeconds: 60 });

    assert.equal((await request(app).post("/api/data-source-webhooks/" + webhookToken).send({ temp: 21 })).status, 200);
    const skipped = await request(app).post("/api/data-source-webhooks/" + webhookToken).send({ temp: 22 });

    assert.equal(skipped.status, 202);
    assert.equal(skipped.body.skipped, true);
    assert.match(skipped.body.reason, /cooldown is active/);
  });
});
