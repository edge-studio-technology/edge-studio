import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";
import type { DataSourceRecord } from "../../../src/features/data-sources/dataSources.repository.js";

const repoMock = vi.hoisted(() => ({ getDataSource: vi.fn() }));
vi.mock("../../../src/features/data-sources/dataSources.repository.js", () => repoMock);

type FakeClient = {
  on: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
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
    publish: vi.fn((_topic: string, _body: string, _opts: unknown, cb: (error?: Error) => void) => cb()),
    end: vi.fn((_force: boolean, cb?: () => void) => cb?.()),
    emit(event: string, ...args: unknown[]) {
      for (const cb of handlers.get(event) ?? []) cb(...args);
    }
  };
}

const mqttMock = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("mqtt", () => ({ default: mqttMock }));

const { publishMqttOutput } = await import("../../../src/features/data-sources/mqttOutput.service.js");

let lastClient: FakeClient;

function makeRecord(overrides: Partial<DataSourceRecord> = {}): DataSourceRecord {
  return {
    id: "src-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    name: "MQTT Target",
    type: "mqtt-output",
    status: "active",
    description: null,
    config: JSON.stringify({ brokerUrl: "mqtt://broker:1883", topic: "out/topic" }),
    last_read_at: null,
    last_error: null,
    last_preview: null,
    last_hash: null,
    ...overrides
  };
}

beforeEach(() => {
  repoMock.getDataSource.mockReset();
  mqttMock.connect.mockReset();
  mqttMock.connect.mockImplementation(() => {
    lastClient = makeFakeClient();
    void Promise.resolve().then(() => lastClient.emit("connect"));
    return lastClient;
  });
});

describe("publishMqttOutput", () => {
  it("throws when the target does not exist", async () => {
    repoMock.getDataSource.mockReturnValue(undefined);
    await assert.rejects(publishMqttOutput({ targetId: "missing", payload: {} }), /MQTT output target not found/);
  });

  it("throws when the target is not an mqtt-output source", async () => {
    repoMock.getDataSource.mockReturnValue(makeRecord({ type: "mqtt" }));
    await assert.rejects(publishMqttOutput({ targetId: "src-1", payload: {} }), /requires an MQTT output target/);
  });

  it("connects, publishes, and resolves with the publish summary", async () => {
    repoMock.getDataSource.mockReturnValue(makeRecord());
    const result = await publishMqttOutput({ targetId: "src-1", payload: { a: 1 } });

    assert.equal(result.targetId, "src-1");
    assert.equal(result.targetName, "MQTT Target");
    assert.equal(result.brokerUrl, "mqtt://broker:1883");
    assert.equal(result.topic, "out/topic");
    assert.deepEqual(result.payload, { a: 1 });
    assert.ok(result.publishedAt);

    assert.equal(lastClient.publish.mock.calls.length, 1);
    const [topic, body, opts] = lastClient.publish.mock.calls[0] as [string, string, { qos: number; retain: boolean }];
    assert.equal(topic, "out/topic");
    assert.equal(body, JSON.stringify({ a: 1 }));
    assert.equal(opts.qos, 0);
    assert.equal(opts.retain, false);
    assert.equal(lastClient.end.mock.calls.length, 1);
  });

  it("respects configured qos and retain flags", async () => {
    repoMock.getDataSource.mockReturnValue(makeRecord({ config: JSON.stringify({ brokerUrl: "mqtt://broker:1883", topic: "out/topic", qos: 1, retain: true }) }));
    await publishMqttOutput({ targetId: "src-1", payload: {} });
    const [, , opts] = lastClient.publish.mock.calls[0] as [string, string, { qos: number; retain: boolean }];
    assert.equal(opts.qos, 1);
    assert.equal(opts.retain, true);
  });

  it("rejects when the publish callback reports an error", async () => {
    repoMock.getDataSource.mockReturnValue(makeRecord());
    mqttMock.connect.mockImplementation(() => {
      lastClient = makeFakeClient();
      lastClient.publish.mockImplementation((_topic, _body, _opts, cb: (error?: Error) => void) => cb(new Error("publish failed")));
      void Promise.resolve().then(() => lastClient.emit("connect"));
      return lastClient;
    });
    await assert.rejects(publishMqttOutput({ targetId: "src-1", payload: {} }), /publish failed/);
  });

  it("rejects when the client reports a connection error", async () => {
    repoMock.getDataSource.mockReturnValue(makeRecord());
    mqttMock.connect.mockImplementation(() => {
      lastClient = makeFakeClient();
      void Promise.resolve().then(() => lastClient.emit("error", new Error("refused")));
      return lastClient;
    });
    await assert.rejects(publishMqttOutput({ targetId: "src-1", payload: {} }), /MQTT output publish failed: refused/);
  });
});
