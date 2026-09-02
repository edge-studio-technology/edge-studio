import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

type FakeClient = {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  emit: (event: string, ...args: unknown[]) => void;
};

function makeFakeClient(): FakeClient {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      const list = handlers.get(event) ?? [];
      list.push(cb);
      handlers.set(event, list);
    }),
    subscribe: vi.fn((_topic: string, cb: (error?: Error) => void) => cb()),
    end: vi.fn(),
    emit(event: string, ...args: unknown[]) {
      for (const cb of handlers.get(event) ?? []) cb(...args);
    }
  };
}

const mqttMock = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("mqtt", () => ({ default: mqttMock }));

const automationServiceMock = vi.hoisted(() => ({ recordPushAutomationPayload: vi.fn() }));
vi.mock("../../../src/features/automation/automation.service.js", () => automationServiceMock);

let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let dataSourcesRepo: typeof import("../../../src/features/data-sources/dataSources.repository.js");
let automationRepo: typeof import("../../../src/features/automation/automation.repository.js");
let dataReadsRepo: typeof import("../../../src/features/data-reads/dataReads.repository.js");
let mqttIngestion: typeof import("../../../src/features/data-sources/mqttIngestion.service.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  dataSourcesRepo = await import("../../../src/features/data-sources/dataSources.repository.js");
  automationRepo = await import("../../../src/features/automation/automation.repository.js");
  dataReadsRepo = await import("../../../src/features/data-reads/dataReads.repository.js");
  mqttIngestion = await import("../../../src/features/data-sources/mqttIngestion.service.js");
});

afterAll(() => {
  teardown();
});

let clients: FakeClient[];

function flush() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

function makeMqttSource(config: Record<string, unknown> = {}) {
  return dataSourcesRepo.createDataSource({
    name: "MQTT Sensor",
    type: "mqtt",
    config: { brokerUrl: "mqtt://broker:1883", topic: "sensors/temp", ...config }
  });
}

function makeMqttWorkflow(sourceId: string) {
  return automationRepo.createAutomationWorkflow({
    name: "MQTT Workflow",
    enabled: true,
    blocks: [{ type: "mqtt_event_start", config: { sourceId } }]
  });
}

beforeEach(() => {
  clients = [];
  mqttMock.connect.mockReset();
  mqttMock.connect.mockImplementation(() => {
    const client = makeFakeClient();
    clients.push(client);
    return client;
  });
  automationServiceMock.recordPushAutomationPayload.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  mqttIngestion.stopMqttIngestion();
  db.prepare("DELETE FROM automation_blocks").run();
  db.prepare("DELETE FROM automation_workflows").run();
  db.prepare("DELETE FROM data_source_reads").run();
  db.prepare("DELETE FROM data_sources").run();
  vi.restoreAllMocks();
});

describe("syncMqttDataSources", () => {
  it("connects and subscribes for each source with an enabled workflow", () => {
    const source = makeMqttSource();
    makeMqttWorkflow(source.id);

    mqttIngestion.startMqttIngestion();

    assert.equal(mqttMock.connect.mock.calls.length, 1);
    const [brokerUrl, opts] = mqttMock.connect.mock.calls[0] as [string, { clientId: string; reconnectPeriod: number }];
    assert.equal(brokerUrl, "mqtt://broker:1883");
    assert.equal(opts.clientId, `edge-studio-${source.id}`);
    assert.equal(opts.reconnectPeriod, 5000);

    clients[0].emit("connect");
    assert.equal(clients[0].subscribe.mock.calls[0][0], "sensors/temp");
  });

  it("does not reconnect when the source/workflow config is unchanged", () => {
    const source = makeMqttSource();
    makeMqttWorkflow(source.id);

    mqttIngestion.syncMqttDataSources();
    mqttIngestion.syncMqttDataSources();

    assert.equal(mqttMock.connect.mock.calls.length, 1);
  });

  it("ends the client when its workflow is disabled", () => {
    const source = makeMqttSource();
    const workflow = makeMqttWorkflow(source.id);
    mqttIngestion.syncMqttDataSources();
    const client = clients[0];

    automationRepo.updateAutomationWorkflow(workflow.id, { enabled: false });
    mqttIngestion.syncMqttDataSources();

    assert.equal(client.end.mock.calls[0][0], true);
    assert.equal(mqttMock.connect.mock.calls.length, 1);
  });

  it("records a configuration_invalid error and does not connect for an invalid config", () => {
    const source = dataSourcesRepo.createDataSource({ name: "Bad MQTT", type: "mqtt", config: {} });
    makeMqttWorkflow(source.id);

    mqttIngestion.syncMqttDataSources();

    assert.equal(mqttMock.connect.mock.calls.length, 0);
    const updated = dataSourcesRepo.getDataSource(source.id)!;
    const error = JSON.parse(updated.last_error!) as { type: string };
    assert.equal(error.type, "configuration_invalid");
  });

  it("records a connection_failed error when subscribe fails", () => {
    const source = makeMqttSource();
    makeMqttWorkflow(source.id);
    mqttMock.connect.mockImplementation(() => {
      const client = makeFakeClient();
      client.subscribe.mockImplementation((_topic: string, cb: (error?: Error) => void) => cb(new Error("not authorized")));
      clients.push(client);
      return client;
    });

    mqttIngestion.syncMqttDataSources();
    clients[0].emit("connect");

    const updated = dataSourcesRepo.getDataSource(source.id)!;
    const error = JSON.parse(updated.last_error!) as { type: string; nativeMessage: string };
    assert.equal(error.type, "connection_failed");
    assert.equal(error.nativeMessage, "not authorized");
  });

  it("records a connection_failed error on client error events", () => {
    const source = makeMqttSource();
    makeMqttWorkflow(source.id);
    mqttIngestion.syncMqttDataSources();
    clients[0].emit("error", new Error("refused"));

    const updated = dataSourcesRepo.getDataSource(source.id)!;
    const error = JSON.parse(updated.last_error!) as { type: string; nativeMessage: string };
    assert.equal(error.type, "connection_failed");
    assert.equal(error.nativeMessage, "refused");
  });
});

describe("MQTT message handling", () => {
  it("processes a JSON message and forwards it to the workflow", async () => {
    const source = makeMqttSource();
    const workflow = makeMqttWorkflow(source.id);
    mqttIngestion.syncMqttDataSources();
    const client = clients[0];

    client.emit("message", "sensors/temp", Buffer.from(JSON.stringify({ temp: 21.5 })));
    await flush();

    assert.equal(automationServiceMock.recordPushAutomationPayload.mock.calls.length, 1);
    const call = automationServiceMock.recordPushAutomationPayload.mock.calls[0][0] as { workflow: { id: string }; dataSource: { id: string }; triggerType: string; result: { preview: Record<string, unknown> } };
    assert.equal(call.workflow.id, workflow.id);
    assert.equal(call.dataSource.id, source.id);
    assert.equal(call.triggerType, "mqtt");
    assert.deepEqual(call.result.preview, { temp: 21.5 });
  });

  it("records an invalid_payload error and a failed data-source read for non-JSON messages", async () => {
    const source = makeMqttSource();
    makeMqttWorkflow(source.id);
    mqttIngestion.syncMqttDataSources();
    const client = clients[0];

    client.emit("message", "sensors/temp", Buffer.from("not json"));
    await flush();

    assert.equal(automationServiceMock.recordPushAutomationPayload.mock.calls.length, 0);
    const updated = dataSourcesRepo.getDataSource(source.id)!;
    const error = JSON.parse(updated.last_error!) as { type: string };
    assert.equal(error.type, "invalid_payload");

    const reads = dataReadsRepo.listDataSourceReads({ page: 1, pageSize: 10 });
    assert.equal(reads.length, 1);
    assert.equal(reads[0].status, "failed");
  });

  it("swallows workflow-busy errors without logging", async () => {
    const source = makeMqttSource();
    makeMqttWorkflow(source.id);
    automationServiceMock.recordPushAutomationPayload.mockReset().mockImplementation(() => {
      const error = new Error("running") as Error & { code: string };
      error.code = "WORKFLOW_ALREADY_RUNNING";
      return Promise.reject(error);
    });
    mqttIngestion.syncMqttDataSources();
    const client = clients[0];

    client.emit("message", "sensors/temp", Buffer.from(JSON.stringify({ a: 1 })));
    await flush();

    assert.equal((console.error as ReturnType<typeof vi.fn>).mock.calls.length, 0);
  });

  it("logs unexpected workflow errors", async () => {
    const source = makeMqttSource();
    const workflow = makeMqttWorkflow(source.id);
    automationServiceMock.recordPushAutomationPayload.mockReset().mockRejectedValue(new Error("boom"));
    mqttIngestion.syncMqttDataSources();
    const client = clients[0];

    client.emit("message", "sensors/temp", Buffer.from(JSON.stringify({ a: 1 })));
    await flush();

    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls;
    assert.equal(calls.length, 1);
    assert.match(calls[0][0] as string, new RegExp(`MQTT workflow ${workflow.id} failed for source ${source.id}: boom`));
  });
});

describe("stopMqttIngestion", () => {
  it("ends all active clients and clears them", () => {
    const source = makeMqttSource();
    makeMqttWorkflow(source.id);
    mqttIngestion.syncMqttDataSources();
    const client = clients[0];

    mqttIngestion.stopMqttIngestion();

    assert.equal(client.end.mock.calls[0][0], true);
    mqttIngestion.syncMqttDataSources();
    assert.equal(mqttMock.connect.mock.calls.length, 2);
  });
});
