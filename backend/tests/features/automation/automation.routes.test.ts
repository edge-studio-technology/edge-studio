import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

vi.mock("../../../src/features/auth/auth.middleware.js", () => ({
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

vi.mock("../../../src/features/data-sources/gpioIngestion.service.js", () => ({
  getGpioInputCapability: vi.fn(),
  syncGpioDataSources: vi.fn()
}));

vi.mock("../../../src/features/data-sources/mqttIngestion.service.js", () => ({
  syncMqttDataSources: vi.fn()
}));

let teardown: () => void;
let automationRouter: typeof import("../../../src/features/automation/automation.routes.js").automationRouter;
let repository: typeof import("../../../src/features/automation/automation.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  automationRouter = (await import("../../../src/features/automation/automation.routes.js")).automationRouter;
  repository = await import("../../../src/features/automation/automation.repository.js");
});

afterAll(() => {
  teardown?.();
});

function testApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/automation", automationRouter);
  return app;
}

describe("automation workflow routes", () => {
  it("creates an invalid requested-enabled workflow as paused", async () => {
    const response = await request(testApp())
      .post("/api/automation/workflows")
      .send({
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
    const workflow = repository.createAutomationWorkflow({
      name: "Invalid workflow",
      enabled: false,
      blocks: [
        { type: "manual_start", config: {}, clientId: "start" },
        { type: "set_variable", config: { variableName: "1bad", variableSource: "custom_json", valueJsonText: "1" }, clientId: "var" }
      ]
    });

    const response = await request(testApp())
      .patch(`/api/automation/workflows/${workflow.id}`)
      .send({ enabled: true });

    assert.equal(response.status, 400);
    assert.equal(repository.getAutomationWorkflow(workflow.id)?.enabled, 0);
  });
});
