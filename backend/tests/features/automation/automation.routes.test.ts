import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

// The router is mounted without the global auth gate, so requireRole must not 401 the request.
vi.mock("../../../src/features/auth/auth.middleware.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

vi.mock("../../../src/features/data-sources/mqttIngestion.service.js", () => ({ syncMqttDataSources: vi.fn() }));
vi.mock("../../../src/features/data-sources/gpioIngestion.service.js", () => ({
  syncGpioDataSources: vi.fn(),
  getGpioInputCapability: () => ({ enabled: false, available: false, reason: null })
}));

let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let app: express.Express;
let workflows: typeof import("../../../src/features/automation/automation.repository.js");
let dataSources: typeof import("../../../src/features/data-sources/dataSources.repository.js");
let limiters: typeof import("../../../src/features/auth/rate-limit.middleware.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  const { automationRouter } = await import("../../../src/features/automation/automation.routes.js");
  workflows = await import("../../../src/features/automation/automation.repository.js");
  dataSources = await import("../../../src/features/data-sources/dataSources.repository.js");
  limiters = await import("../../../src/features/auth/rate-limit.middleware.js");

  app = express();
  app.use(express.json());
  app.use("/api/automation", automationRouter);
});

afterAll(() => {
  teardown();
});

beforeEach(async () => {
  await limiters.automationWriteRateLimiter.resetKey("::ffff:127.0.0.1");
});

describe("automation write rate limit", () => {
  it("allows 30 mutation or manual-run requests per minute, then returns 429 with rate-limit headers", async () => {
    const writes = [
      () => request(app).post("/api/automation/workflows").send({}),
      () => request(app).patch("/api/automation/workflows/missing").send({ name: "x" }),
      () => request(app).delete("/api/automation/inbox/missing"),
      () => request(app).post("/api/automation/workflows/missing/run").send({})
    ];
    for (let index = 0; index < 30; index += 1) {
      const response = await writes[index % writes.length]();
      assert.notEqual(response.status, 429, `request ${index + 1} was throttled`);
      assert.equal(response.headers["ratelimit-limit"], "30");
    }

    const limited = await request(app).post("/api/automation/workflows/missing/run").send({});
    assert.equal(limited.status, 429);
    assert.equal(limited.headers["ratelimit-remaining"], "0");
    assert.ok(limited.headers["ratelimit-reset"]);
    assert.equal(limited.body.errorDetails.type, "rate_limited");
  });

  it("does not throttle reads or per-edit draft validation", async () => {
    for (let index = 0; index < 30; index += 1) await request(app).delete("/api/automation/inbox/missing");
    assert.equal((await request(app).delete("/api/automation/inbox/missing")).status, 429);

    for (const response of [
      await request(app).get("/api/automation/workflows"),
      await request(app).get("/api/automation/runs"),
      await request(app).get("/api/automation/inbox"),
      await request(app).post("/api/automation/workflows/validate-draft").send({ blocks: [] })
    ]) {
      assert.equal(response.status, 200);
      assert.equal(response.headers["ratelimit-limit"], undefined);
    }
  });
});

describe("POST /api/automation/workflows/:id/run — run budget", () => {
  it("returns 429 with the next available time when the workflow budget is exhausted", async () => {
    const target = dataSources.createDataSource({ name: "HTTP target", type: "http-output", config: { url: "https://example.com/hook", method: "POST" } });
    const workflow = workflows.createAutomationWorkflow({
      name: "Budgeted run",
      enabled: true,
      blocks: [
        { type: "manual_start", config: {} },
        { type: "control_output", config: { targetId: target.id, action: "send_request", bodyMode: "none" } }
      ]
    });
    const consumedAt = new Date().toISOString();
    for (let index = 0; index < 10; index += 1) {
      db.prepare("INSERT INTO automation_workflow_budget_events (run_id, workflow_id, consumed_at) VALUES (?, ?, ?)").run(`prefilled-${index}`, workflow.id, consumedAt);
    }

    const response = await request(app).post(`/api/automation/workflows/${workflow.id}/run`).send({});

    assert.equal(response.status, 429);
    assert.match(response.body.error as string, /budget exhausted/);
    assert.equal(response.body.errorDetails.type, "rate_limited");
    assert.equal(response.body.errorDetails.context.workflowId, workflow.id);
    assert.equal(response.body.errorDetails.context.nextAvailableAt, new Date(Date.parse(consumedAt) + 60 * 60 * 1000).toISOString());
    assert.equal(response.body.workflow.id, workflow.id);
  });
});

describe("automation workflow validation routes", () => {
  it("creates an invalid requested-enabled workflow as paused", async () => {
    const response = await request(app).post("/api/automation/workflows").send({
      name: "Invalid draft workflow",
      enabled: true,
      blocks: [
        { type: "manual_start", config: {}, clientId: "start" },
        { type: "set_variable", config: { variableName: "1bad", variableSource: "custom_json", valueJsonText: "1" }, clientId: "var" }
      ]
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.item.enabled, false);
    assert.equal(response.body.item.blocks.length, 2);
  });

  it("rejects enabling a workflow while validation has errors", async () => {
    const created = await request(app).post("/api/automation/workflows").send({
      name: "Invalid workflow",
      enabled: false,
      blocks: [
        { type: "manual_start", config: {}, clientId: "start" },
        { type: "set_variable", config: { variableName: "1bad", variableSource: "custom_json", valueJsonText: "1" }, clientId: "var" }
      ]
    });
    const workflow = created.body.item;

    const response = await request(app).patch("/api/automation/workflows/" + workflow.id).send({ enabled: true });

    assert.equal(response.status, 400);
    assert.equal(workflows.getAutomationWorkflow(workflow.id)?.enabled, 0);
  });
});
