import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { beforeEach, describe, it, vi } from "vitest";

const { findWebhookDataSourceMock, getEnabledAutomationWorkflowForDataSourceMock, recordPushAutomationPayloadMock, processWebhookPayloadMock } = vi.hoisted(() => ({
  findWebhookDataSourceMock: vi.fn(),
  getEnabledAutomationWorkflowForDataSourceMock: vi.fn(),
  recordPushAutomationPayloadMock: vi.fn(),
  processWebhookPayloadMock: vi.fn()
}));

vi.mock("../../../src/features/data-sources/dataSources.repository.js", () => ({
  createDataSource: vi.fn(),
  deleteDataSource: vi.fn(),
  findWebhookDataSource: findWebhookDataSourceMock,
  getDataSource: vi.fn(),
  listDataSources: vi.fn(() => []),
  updateDataSource: vi.fn(),
  updateDataSourceReadResult: vi.fn()
}));
vi.mock("../../../src/features/automation/automation.repository.js", () => ({
  getEnabledAutomationWorkflowForDataSource: getEnabledAutomationWorkflowForDataSourceMock,
  listAutomationWorkflowsUsingDataSource: vi.fn(() => [])
}));
vi.mock("../../../src/features/automation/automation.service.js", () => ({
  recordPushAutomationPayload: recordPushAutomationPayloadMock
}));
vi.mock("../../../src/features/data-reads/dataReads.repository.js", () => ({ createDataSourceRead: vi.fn() }));
vi.mock("../../../src/features/data-sources/mqttIngestion.service.js", () => ({ syncMqttDataSources: vi.fn() }));
vi.mock("../../../src/features/data-sources/gpioIngestion.service.js", () => ({ getGpioInputCapability: vi.fn(), syncGpioDataSources: vi.fn() }));
vi.mock("../../../src/features/data-sources/gpioOutput.service.js", () => ({ pulseGpioOutput: vi.fn() }));
vi.mock("../../../src/features/data-sources/mqttOutput.service.js", () => ({ publishMqttOutput: vi.fn() }));
vi.mock("../../../src/features/data-sources/cameraCapture.service.js", () => ({ getCameraCapability: vi.fn() }));
vi.mock("../../../src/features/data-sources/sensorHelper.service.js", () => ({ getSensorHelperCapability: vi.fn(), readBmeSensorSource: vi.fn() }));
vi.mock("../../../src/features/auth/auth.middleware.js", () => ({
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));
vi.mock("../../../src/features/data-sources/dataSources.service.js", () => ({
  parseBmeSensorConfig: vi.fn(),
  parseDataSourceConfig: vi.fn(),
  parseDeviceSystemDataConfig: vi.fn(),
  parseGpioInputConfig: vi.fn(),
  parseGpioOutputConfig: vi.fn(),
  parseHttpOutputConfig: vi.fn(),
  parseJsonApiConfig: vi.fn(),
  processWebhookPayload: processWebhookPayloadMock,
  readDeviceSystemDataSource: vi.fn(),
  readJsonApiSource: vi.fn(),
  sendHttpOutput: vi.fn(),
  serializeDataSource: vi.fn()
}));

const { dataSourcesWebhookRouter } = await import("../../../src/features/data-sources/dataSources.routes.js");

function testApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/data-source-webhooks", dataSourcesWebhookRouter);
  return app;
}

const record = { id: "src-1", name: "Webhook Source" };
const workflow = { id: "wf-1", name: "Webhook Workflow" };
const result = { bytesHash: "hash-1", preview: { temp: 21 } };

describe("webhook receiver route", () => {
  beforeEach(() => {
    findWebhookDataSourceMock.mockReset().mockReturnValue(record);
    getEnabledAutomationWorkflowForDataSourceMock.mockReset().mockReturnValue(workflow);
    processWebhookPayloadMock.mockReset().mockReturnValue(result);
    recordPushAutomationPayloadMock.mockReset().mockResolvedValue({ dataSource: record, workflow });
  });

  it("records the payload and returns the source, workflow and result", async () => {
    const response = await request(testApp()).post("/api/data-source-webhooks/token-1").send({ temp: 21 });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { item: record, workflow, result });
    const [input] = recordPushAutomationPayloadMock.mock.calls[0] as [{ sourceUrl: string; triggerType: string }];
    assert.equal(input.sourceUrl, "/api/data-source-webhooks/token-1");
    assert.equal(input.triggerType, "webhook");
  });

  it("returns 404 for an unknown token without recording anything", async () => {
    findWebhookDataSourceMock.mockReturnValue(undefined);

    const response = await request(testApp()).post("/api/data-source-webhooks/nope").send({ temp: 21 });

    assert.equal(response.status, 404);
    assert.equal(recordPushAutomationPayloadMock.mock.calls.length, 0);
  });

  it("returns 409 when no enabled workflow exists for the source", async () => {
    getEnabledAutomationWorkflowForDataSourceMock.mockReturnValue(undefined);

    const response = await request(testApp()).post("/api/data-source-webhooks/token-1").send({ temp: 21 });

    assert.equal(response.status, 409);
    assert.equal(response.body.errorDetails.context.sourceId, "src-1");
    assert.equal(recordPushAutomationPayloadMock.mock.calls.length, 0);
  });

  it("returns 202 skipped when the workflow trigger is ignored", async () => {
    recordPushAutomationPayloadMock.mockRejectedValue(Object.assign(new Error("Workflow trigger ignored because cooldown is active"), { code: "WORKFLOW_COOLDOWN_ACTIVE" }));

    const response = await request(testApp()).post("/api/data-source-webhooks/token-1").send({ temp: 21 });

    assert.equal(response.status, 202);
    assert.equal(response.body.skipped, true);
    assert.match(response.body.reason, /cooldown is active/);
  });

  it("returns 502 when recording the payload fails", async () => {
    recordPushAutomationPayloadMock.mockRejectedValue(new Error("workflow blew up"));

    const response = await request(testApp()).post("/api/data-source-webhooks/token-1").send({ temp: 21 });

    assert.equal(response.status, 502);
  });
});
