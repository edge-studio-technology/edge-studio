import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
  hostAgentUrl: "http://host-agent/",
  hostAgentToken: "token-1",
  hostCapabilityDebug: false
}));

vi.mock("../../../src/config/env.js", () => ({ env: envMock }));

const service = await import("../../../src/features/host-capabilities/hostCapabilities.service.js");

const fetchMock = vi.fn();

function response(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

beforeEach(() => {
  envMock.hostAgentUrl = "http://host-agent/";
  envMock.hostAgentToken = "token-1";
  envMock.hostCapabilityDebug = false;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hostCapabilities.service", () => {
  it("returns fallback capabilities when the host agent is not configured", async () => {
    envMock.hostAgentUrl = "";
    const result = await service.listHostCapabilities();

    assert.deepEqual(result.items.map((item) => item.name), ["camera", "gpio", "sensors", "mqtt"]);
    assert.equal(result.items[0].available, false);
    assert.equal(result.items[0].reason, "Host agent is not configured");
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("returns fallback item responses for single capability reads when unconfigured", async () => {
    envMock.hostAgentToken = "";

    assert.equal((await service.getHostCameraCapability()).item.name, "camera");
    assert.equal((await service.getHostGpioCapability()).item.name, "gpio");
    assert.equal((await service.getHostSensorCapability()).item.name, "sensors");
    assert.equal((await service.getHostMqttCapability()).item.name, "mqtt");
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("GETs capability status with the backend-only bearer token", async () => {
    const payload = { items: [{ name: "gpio", enabled: true, installed: true, available: true, state: "enabled", reason: null }] };
    fetchMock.mockResolvedValue(response(200, payload));

    const result = await service.listHostCapabilities();

    assert.equal(result, payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    assert.equal(url, "http://host-agent/capabilities");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer token-1");
  });

  it("GETs individual capability status endpoints", async () => {
    fetchMock.mockResolvedValue(response(200, { item: { name: "camera", enabled: true, installed: true, available: true, state: "enabled", reason: null } }));

    await service.getHostCameraCapability();
    await service.getHostGpioCapability();
    await service.getHostSensorCapability();
    await service.getHostMqttCapability();

    assert.deepEqual(fetchMock.mock.calls.map((call) => call[0]), [
      "http://host-agent/capabilities/camera",
      "http://host-agent/capabilities/gpio",
      "http://host-agent/capabilities/sensors",
      "http://host-agent/capabilities/mqtt"
    ]);
  });

  it("POSTs apply and disable actions for every capability", async () => {
    const payload = { capability: { name: "camera", enabled: true, installed: true, available: true, state: "enabled", reason: null } };
    fetchMock.mockResolvedValue(response(200, payload));

    await service.enableHostCameraCapability();
    await service.disableHostCameraCapability();
    await service.enableHostGpioCapability();
    await service.disableHostGpioCapability();
    await service.enableHostSensorCapability();
    await service.disableHostSensorCapability();
    await service.enableHostMqttCapability();
    await service.disableHostMqttCapability();

    assert.deepEqual(fetchMock.mock.calls.map((call) => [call[0], (call[1] as RequestInit).method]), [
      ["http://host-agent/capabilities/camera/apply", "POST"],
      ["http://host-agent/capabilities/camera/disable", "POST"],
      ["http://host-agent/capabilities/gpio/apply", "POST"],
      ["http://host-agent/capabilities/gpio/disable", "POST"],
      ["http://host-agent/capabilities/sensors/apply", "POST"],
      ["http://host-agent/capabilities/sensors/disable", "POST"],
      ["http://host-agent/capabilities/mqtt/apply", "POST"],
      ["http://host-agent/capabilities/mqtt/disable", "POST"]
    ]);
  });

  it("uses host-agent error payloads for non-ok responses", async () => {
    fetchMock.mockResolvedValue(response(500, { error: "boom" }));

    await assert.rejects(service.enableHostCameraCapability(), /boom/);
  });

  it("falls back to HTTP status when the error response has no JSON payload", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error("not json"); } });

    await assert.rejects(service.getHostCameraCapability(), /Host agent returned HTTP 502/);
  });

  it("rejects action requests when the host agent is not configured", async () => {
    envMock.hostAgentToken = "";

    await assert.rejects(service.enableHostCameraCapability(), /Host agent is not configured/);
  });

  it("reports a timeout when the host agent does not respond", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      (init.signal as AbortSignal).addEventListener("abort", () => reject(new Error("aborted")));
    }));

    const request = service.getHostCameraCapability().then(
      () => assert.fail("expected request to time out"),
      (error: Error) => error
    );
    await vi.advanceTimersByTimeAsync(5000);

    assert.match((await request).message, /Host agent request timed out/);
    vi.useRealTimers();
  });

  it("logs secret-safe diagnostics when enabled", async () => {
    envMock.hostCapabilityDebug = true;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    fetchMock.mockResolvedValue(response(200, { item: { name: "gpio", enabled: true, installed: true, available: true, state: "enabled", reason: null } }));

    await service.getHostGpioCapability();

    assert.ok(log.mock.calls.some((call) => String(call[0]).includes("[host-capabilities] get /capabilities/gpio")));
    assert.ok(log.mock.calls.some((call) => String(call[0]).includes("[host-capabilities] response /capabilities/gpio")));
  });
});
