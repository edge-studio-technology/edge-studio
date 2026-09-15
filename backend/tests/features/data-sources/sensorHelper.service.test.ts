import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
  sensorsEnabled: true,
  sensorHelperUrl: "http://sensor-helper",
  sensorHelperToken: "sensor-token",
  sensorReadTimeoutMs: 5000
}));

vi.mock("../../../src/config/env.js", () => ({ env: envMock }));

const { getSensorHelperCapability, readBmeSensorSource } = await import("../../../src/features/data-sources/sensorHelper.service.js");

const fetchMock = vi.fn();

beforeEach(() => {
  envMock.sensorsEnabled = true;
  envMock.sensorHelperUrl = "http://sensor-helper";
  envMock.sensorHelperToken = "sensor-token";
  envMock.sensorReadTimeoutMs = 5000;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockResponse(status: number, bodyText: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText
  };
}

describe("getSensorHelperCapability", () => {
  it("reports disabled without calling the helper when sensors are off", async () => {
    envMock.sensorsEnabled = false;
    const result = await getSensorHelperCapability();
    assert.deepEqual(result, { enabled: false, available: false, reason: "I2C sensor support is disabled. Enable it from Devices -> Hardware support." });
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("reports available with supported sensors when health and capabilities succeed", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, JSON.stringify({ ok: true })))
      .mockResolvedValueOnce(mockResponse(200, JSON.stringify({ available: true, reason: null, supportedSensors: ["bme280", "bme680"] })));

    const result = await getSensorHelperCapability();
    assert.deepEqual(result, { enabled: true, available: true, reason: null, supportedSensors: ["bme280", "bme680"] });

    const [healthUrl, healthInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    assert.equal(healthUrl, "http://sensor-helper/health");
    assert.equal((healthInit.headers as Record<string, string>).Authorization, undefined);

    const [capsUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    assert.equal(capsUrl, "http://sensor-helper/capabilities");
  });

  it("reports unavailable with a reason when the helper request fails", async () => {
    fetchMock.mockRejectedValue(new Error("connection refused"));
    const result = await getSensorHelperCapability();
    assert.equal(result.enabled, true);
    assert.equal(result.available, false);
    assert.match(result.reason!, /Sensor helper is unavailable at http:\/\/sensor-helper: connection refused/);
  });
});

describe("readBmeSensorSource", () => {
  it("throws when sensors are disabled", async () => {
    envMock.sensorsEnabled = false;
    await assert.rejects(
      readBmeSensorSource({ sensor: "bme280", bus: 1, address: "0x76" }),
      /I2C sensor support is disabled/
    );
  });

  it("reads a sensor and returns hashed canonical bytes", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ temperature: 21.5 })));
    const result = await readBmeSensorSource({ sensor: "bme280", bus: 1, address: "0x76" });

    assert.equal(result.contentType, "application/json");
    assert.deepEqual(result.preview, { temperature: 21.5 });
    assert.ok(result.bytesHash);
    assert.ok(result.fetchedAt);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    assert.equal(url, "http://sensor-helper/read");
    assert.equal(init.method, "POST");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer sensor-token");
    assert.equal(init.body, JSON.stringify({ sensor: "bme280", bus: 1, address: "0x76" }));
  });

  it("throws when the response body is not valid JSON", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, "not json"));
    await assert.rejects(readBmeSensorSource({ sensor: "bme280", bus: 1, address: "0x76" }), /Sensor helper returned invalid JSON/);
  });

  it("throws the helper's error message when the response is not ok", async () => {
    fetchMock.mockResolvedValue(mockResponse(500, JSON.stringify({ error: "sensor read failed" })));
    await assert.rejects(readBmeSensorSource({ sensor: "bme280", bus: 1, address: "0x76" }), /sensor read failed/);
  });

  it("falls back to a generic HTTP status message when no error field is present", async () => {
    fetchMock.mockResolvedValue(mockResponse(503, ""));
    await assert.rejects(readBmeSensorSource({ sensor: "bme280", bus: 1, address: "0x76" }), /Sensor helper returned HTTP 503/);
  });
});
