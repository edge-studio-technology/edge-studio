import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import {
  checkDataSourceHealth,
  parseBmeSensorConfig,
  parseDataSourceConfig,
  parseDeviceSystemDataConfig,
  parseGpioInputConfig,
  parseGpioOutputConfig,
  parseHttpOutputConfig,
  parseJsonApiConfig,
  parseMqttConfig,
  parseMqttOutputConfig,
  parsePiCameraConfig,
  parseWebhookConfig,
  processGpioPayload,
  processMqttPayload,
  processWebhookPayload,
  readDeviceSystemDataSource,
  readJsonApiSource,
  sendHttpOutput,
  sendMultipartMediaOutput,
  serializeDataSource
} from "../../../src/features/data-sources/dataSources.service.js";
import type {
  BmeSensorConfig,
  DeviceSystemDataConfig,
  GpioInputConfig,
  GpioOutputConfig,
  HttpOutputConfig,
  MqttOutputConfig,
  PiCameraConfig,
  WebhookConfig
} from "../../../src/features/data-sources/dataSources.service.js";
import type { DataSourceRecord } from "../../../src/features/data-sources/dataSources.repository.js";

function makeRecord(overrides: Partial<DataSourceRecord> = {}): DataSourceRecord {
  return {
    id: "src-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    name: "Source",
    type: "json-api",
    status: "active",
    description: null,
    config: JSON.stringify({ url: "https://example.com" }),
    last_read_at: null,
    last_error: null,
    last_preview: null,
    last_hash: null,
    ...overrides
  };
}

describe("serializeDataSource", () => {
  it("maps a record with no read history to defaults", () => {
    const result = serializeDataSource(makeRecord());
    assert.equal(result.id, "src-1");
    assert.deepEqual(result.config, { url: "https://example.com" });
    assert.equal(result.lastError, null);
    assert.equal(result.lastErrorDetails, null);
    assert.equal(result.lastPreview, null);
  });

  it("parses last_preview JSON", () => {
    const result = serializeDataSource(makeRecord({ last_preview: JSON.stringify({ a: 1 }) }));
    assert.deepEqual(result.lastPreview, { a: 1 });
  });

  it("maps a structured last_error to friendly message and details", () => {
    const structured = JSON.stringify({ domain: "data_source", type: "fetch_failed", message: "boom", occurredAt: "2026-01-01T00:00:00.000Z" });
    const result = serializeDataSource(makeRecord({ last_error: structured }));
    assert.equal(result.lastError, "boom");
    assert.equal(result.lastErrorDetails?.message, "boom");
    assert.equal(result.lastErrorDetails?.domain, "data_source");
  });

  it("maps a legacy plain-string last_error", () => {
    const result = serializeDataSource(makeRecord({ last_error: "plain failure" }));
    assert.equal(result.lastError, "plain failure");
    assert.equal(result.lastErrorDetails?.domain, "unknown");
  });
});

describe("parseJsonApiConfig", () => {
  it("requires config.url", () => {
    assert.throws(() => parseJsonApiConfig({}), /config.url is required/);
  });

  it("trims url and defaults method to GET", () => {
    const config = parseJsonApiConfig({ url: "  https://example.com  " });
    assert.equal(config.url, "https://example.com");
    assert.equal(config.method, "GET");
    assert.deepEqual(config.headers, {});
    assert.equal(config.healthStatusUrl, undefined);
  });

  it("accepts POST method, headers, healthStatusUrl, and body", () => {
    const config = parseJsonApiConfig({ url: "https://example.com", method: "POST", headers: { "X-Test": "1" }, healthStatusUrl: "https://example.com/health", body: { a: 1 } });
    assert.equal(config.method, "POST");
    assert.deepEqual(config.headers, { "X-Test": "1" });
    assert.equal(config.healthStatusUrl, "https://example.com/health");
    assert.deepEqual(config.body, { a: 1 });
  });

  it("ignores non-object headers", () => {
    const config = parseJsonApiConfig({ url: "https://example.com", headers: ["not", "an", "object"] });
    assert.deepEqual(config.headers, {});
  });
});

describe("parseWebhookConfig", () => {
  it("generates a token when none is provided", () => {
    const config = parseWebhookConfig({});
    assert.ok(config.webhookToken);
  });

  it("keeps a provided token", () => {
    const config = parseWebhookConfig({ webhookToken: "provided" });
    assert.equal(config.webhookToken, "provided");
  });

  it("falls back to the existing token when the new value is empty", () => {
    const config = parseWebhookConfig({}, { webhookToken: "existing" });
    assert.equal(config.webhookToken, "existing");
  });
});

describe("parseMqttConfig", () => {
  it("requires brokerUrl and topic", () => {
    assert.throws(() => parseMqttConfig({ topic: "t" }), /config.brokerUrl is required/);
    assert.throws(() => parseMqttConfig({ brokerUrl: "mqtt://x" }), /config.topic is required/);
  });

  it("trims values and keeps a recognized profile", () => {
    const config = parseMqttConfig({ brokerUrl: " mqtt://x ", topic: " t/1 ", profile: "esp32-mqtt-board" });
    assert.equal(config.brokerUrl, "mqtt://x");
    assert.equal(config.topic, "t/1");
    assert.equal(config.profile, "esp32-mqtt-board");
  });

  it("drops an unrecognized profile", () => {
    const config = parseMqttConfig({ brokerUrl: "mqtt://x", topic: "t", profile: "bogus" });
    assert.equal(config.profile, undefined);
  });
});

describe("parseHttpOutputConfig", () => {
  it("requires url and defaults method to POST", () => {
    assert.throws(() => parseHttpOutputConfig({}), /config.url is required/);
    const config = parseHttpOutputConfig({ url: "https://example.com" });
    assert.equal(config.method, "POST");
    assert.equal(config.timeoutMs, 5000);
  });

  it("accepts PUT/PATCH methods", () => {
    assert.equal(parseHttpOutputConfig({ url: "https://example.com", method: "PUT" }).method, "PUT");
    assert.equal(parseHttpOutputConfig({ url: "https://example.com", method: "PATCH" }).method, "PATCH");
  });

  it("rejects an out-of-range timeoutMs", () => {
    assert.throws(() => parseHttpOutputConfig({ url: "https://example.com", timeoutMs: 50 }), /config.timeoutMs must be between 100 and 60000/);
    assert.throws(() => parseHttpOutputConfig({ url: "https://example.com", timeoutMs: 70000 }), /config.timeoutMs must be between 100 and 60000/);
  });
});

describe("parseMqttOutputConfig", () => {
  it("requires brokerUrl and topic", () => {
    assert.throws(() => parseMqttOutputConfig({ topic: "t" }), /config.brokerUrl is required/);
    assert.throws(() => parseMqttOutputConfig({ brokerUrl: "mqtt://x" }), /config.topic is required/);
  });

  it("defaults qos to 0 and retain to false", () => {
    const config = parseMqttOutputConfig({ brokerUrl: "mqtt://x", topic: "t" });
    assert.equal(config.qos, 0);
    assert.equal(config.retain, false);
  });

  it("accepts qos 1 and retain true", () => {
    const config = parseMqttOutputConfig({ brokerUrl: "mqtt://x", topic: "t", qos: 1, retain: true });
    assert.equal(config.qos, 1);
    assert.equal(config.retain, true);
  });
});

describe("parseGpioInputConfig", () => {
  it("applies defaults", () => {
    const config = parseGpioInputConfig({ pin: 4 });
    assert.equal(config.chip, "gpiochip0");
    assert.equal(config.pin, 4);
    assert.equal(config.profile, "generic");
    assert.equal(config.pull, "off");
    assert.equal(config.edge, "both");
    assert.equal(config.debounceMs, 100);
    assert.equal(config.activeState, "high");
  });

  it("accepts a /dev/gpiochipN chip path", () => {
    const config = parseGpioInputConfig({ chip: "/dev/gpiochip1", pin: 4 });
    assert.equal(config.chip, "/dev/gpiochip1");
  });

  it("rejects a malformed chip", () => {
    assert.throws(() => parseGpioInputConfig({ chip: "bogus", pin: 4 }), /config.chip must be gpiochipN or \/dev\/gpiochipN/);
  });

  it("rejects an out-of-range pin", () => {
    assert.throws(() => parseGpioInputConfig({ pin: -1 }), /config.pin must be a BCM GPIO number from 0 to 27/);
    assert.throws(() => parseGpioInputConfig({ pin: 28 }), /config.pin must be a BCM GPIO number from 0 to 27/);
    assert.throws(() => parseGpioInputConfig({ pin: 1.5 }), /config.pin must be a BCM GPIO number from 0 to 27/);
  });

  it("rejects an out-of-range debounceMs", () => {
    assert.throws(() => parseGpioInputConfig({ pin: 4, debounceMs: -1 }), /config.debounceMs must be between 0 and 60000/);
    assert.throws(() => parseGpioInputConfig({ pin: 4, debounceMs: 70000 }), /config.debounceMs must be between 0 and 60000/);
  });
});

describe("parseGpioOutputConfig", () => {
  it("applies defaults", () => {
    const config = parseGpioOutputConfig({ pin: 17 });
    assert.equal(config.chip, "gpiochip0");
    assert.equal(config.profile, "led");
    assert.equal(config.activeState, "high");
    assert.equal(config.initialState, "inactive");
  });

  it("rejects a malformed chip or out-of-range pin", () => {
    assert.throws(() => parseGpioOutputConfig({ chip: "bogus", pin: 17 }), /config.chip must be gpiochipN or \/dev\/gpiochipN/);
    assert.throws(() => parseGpioOutputConfig({ pin: 99 }), /config.pin must be a BCM GPIO number from 0 to 27/);
  });
});

describe("parsePiCameraConfig", () => {
  it("defaults to photo mode with jpg output", () => {
    const config = parsePiCameraConfig({});
    assert.equal(config.mode, "photo");
    assert.equal(config.outputFormat, "jpg");
    assert.equal(config.durationMs, 1000);
  });

  it("defaults to video mode with h264 output and a longer duration", () => {
    const config = parsePiCameraConfig({ mode: "video" });
    assert.equal(config.mode, "video");
    assert.equal(config.outputFormat, "h264");
    assert.equal(config.durationMs, 5000);
  });

  it("rejects out-of-range dimensions, duration, and fps", () => {
    assert.throws(() => parsePiCameraConfig({ width: 10 }), /config.width must be between 160 and 7680/);
    assert.throws(() => parsePiCameraConfig({ height: 10 }), /config.height must be between 120 and 4320/);
    assert.throws(() => parsePiCameraConfig({ durationMs: 1 }), /config.durationMs must be between 100 and 300000/);
    assert.throws(() => parsePiCameraConfig({ fps: 0 }), /config.fps must be between 1 and 120/);
  });
});

describe("parseBmeSensorConfig", () => {
  it("defaults to bme280 on bus 1 at 0x76", () => {
    const config = parseBmeSensorConfig({});
    assert.equal(config.sensor, "bme280");
    assert.equal(config.bus, 1);
    assert.equal(config.address, "0x76");
  });

  it("accepts bme680 and 0x77", () => {
    const config = parseBmeSensorConfig({ sensor: "bme680", address: "0x77" });
    assert.equal(config.sensor, "bme680");
    assert.equal(config.address, "0x77");
  });

  it("rejects an unsupported sensor or out-of-range bus", () => {
    assert.throws(() => parseBmeSensorConfig({ sensor: "bogus" }), /config.sensor must be bme280 or bme680/);
    assert.throws(() => parseBmeSensorConfig({ bus: 99 }), /config.bus must be an I2C bus number from 0 to 10/);
  });
});

describe("parseDeviceSystemDataConfig", () => {
  it("defaults every include flag to true", () => {
    const config = parseDeviceSystemDataConfig({});
    assert.equal(config.includeSpecs, true);
    assert.equal(config.includePerformance, true);
    assert.equal(config.includeNetwork, true);
    assert.equal(config.includeLocation, true);
  });

  it("only false explicitly disables a flag", () => {
    const config = parseDeviceSystemDataConfig({ includeSpecs: false, includeNetwork: "no" as unknown as boolean });
    assert.equal(config.includeSpecs, false);
    assert.equal(config.includeNetwork, true);
  });
});

describe("parseDataSourceConfig", () => {
  it("dispatches to the parser matching each type", () => {
    assert.equal((parseDataSourceConfig("webhook", {}) as WebhookConfig).webhookToken !== undefined, true);
    assert.deepEqual(parseDataSourceConfig("mqtt", { brokerUrl: "mqtt://x", topic: "t" }), { brokerUrl: "mqtt://x", topic: "t", profile: undefined });
    assert.equal((parseDataSourceConfig("http-output", { url: "https://example.com" }) as HttpOutputConfig).method, "POST");
    assert.equal((parseDataSourceConfig("mqtt-output", { brokerUrl: "mqtt://x", topic: "t" }) as MqttOutputConfig).qos, 0);
    assert.equal((parseDataSourceConfig("gpio-input", { pin: 4 }) as GpioInputConfig).chip, "gpiochip0");
    assert.equal((parseDataSourceConfig("gpio-output", { pin: 4 }) as GpioOutputConfig).profile, "led");
    assert.equal((parseDataSourceConfig("pi-camera", {}) as PiCameraConfig).mode, "photo");
    assert.equal((parseDataSourceConfig("bme-sensor", {}) as BmeSensorConfig).sensor, "bme280");
    assert.equal((parseDataSourceConfig("device-system-data", {}) as DeviceSystemDataConfig).includeSpecs, true);
  });

  it("falls back to the JSON API parser for an unrecognized type", () => {
    const config = parseDataSourceConfig("json-api", { url: "https://example.com" });
    assert.equal((config as { url: string }).url, "https://example.com");
  });
});

describe("process*Payload helpers", () => {
  it("processWebhookPayload hashes canonical JSON and preserves the raw preview", () => {
    const result = processWebhookPayload({ b: 1, a: 2 });
    assert.equal(result.contentType, "application/json");
    assert.deepEqual(result.preview, { b: 1, a: 2 });
    assert.ok(result.bytesHash);
    assert.ok(result.receivedAt);
  });

  it("processMqttPayload and processGpioPayload behave the same way", () => {
    const mqtt = processMqttPayload({ x: 1 });
    const gpio = processGpioPayload({ x: 1 });
    assert.equal(mqtt.bytesHash, gpio.bytesHash);
  });
});

describe("readDeviceSystemDataSource", () => {
  it("includes only the sections enabled in config", async () => {
    const result = await readDeviceSystemDataSource({ includeSpecs: true, includePerformance: false, includeNetwork: false, includeLocation: false });
    const preview = result.preview as Record<string, unknown>;
    assert.ok("specs" in preview);
    assert.ok(!("performance" in preview));
    assert.ok(!("network" in preview));
    assert.ok(!("location" in preview));
    assert.equal(result.contentType, "application/json");
    assert.ok(result.bytesHash);
  });

  it("includes every section when all flags are enabled", async () => {
    const result = await readDeviceSystemDataSource({ includeSpecs: true, includePerformance: true, includeNetwork: true, includeLocation: true });
    const preview = result.preview as Record<string, unknown>;
    assert.ok("specs" in preview);
    assert.ok("performance" in preview);
    assert.ok("network" in preview);
    assert.ok("location" in preview);
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
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
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText) as unknown
  };
}

describe("checkDataSourceHealth", () => {
  it("requires a configured health status URL", async () => {
    await assert.rejects(checkDataSourceHealth({ url: "https://example.com", method: "GET" }), /Data source has no health status URL configured/);
  });

  it("fetches the health status URL and reports ok/status", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ up: true })));
    const result = await checkDataSourceHealth({ url: "https://example.com", method: "GET", healthStatusUrl: "https://example.com/health" });
    assert.equal(fetchMock.mock.calls[0][0], "https://example.com/health");
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { up: true });
  });
});

describe("readJsonApiSource", () => {
  it("fetches, hashes canonical JSON, and returns the parsed preview", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ a: 1 })));
    const result = await readJsonApiSource({ url: "https://example.com", method: "GET" });
    assert.equal(fetchMock.mock.calls[0][0], "https://example.com");
    assert.deepEqual(result.preview, { a: 1 });
    assert.ok(result.bytesHash);
  });

  it("sends a JSON body for POST requests", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ ok: true })));
    await readJsonApiSource({ url: "https://example.com", method: "POST", body: { hello: "world" } });
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    assert.equal(options.method, "POST");
    assert.equal(options.body, JSON.stringify({ hello: "world" }));
  });

  it("throws a friendly error when fetch itself fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await assert.rejects(readJsonApiSource({ url: "https://example.com", method: "GET" }), /Could not fetch https:\/\/example\.com/);
  });

  it("throws when the response body is not valid JSON", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, "not json"));
    await assert.rejects(readJsonApiSource({ url: "https://example.com", method: "GET" }), /Response was not valid JSON/);
  });

  it("throws when the response status is not ok", async () => {
    fetchMock.mockResolvedValue(mockResponse(500, JSON.stringify({ error: "boom" })));
    await assert.rejects(readJsonApiSource({ url: "https://example.com", method: "GET" }), /Source returned HTTP 500/);
  });
});

describe("sendHttpOutput", () => {
  it("sends a JSON payload and returns the response body on success", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ received: true })));
    const result = await sendHttpOutput({ url: "https://example.com", method: "POST" }, { a: 1 });
    assert.equal(result.status, 200);
    assert.deepEqual(result.response, { received: true });
  });

  it("throws on a non-ok response, including the response body", async () => {
    fetchMock.mockResolvedValue(mockResponse(500, JSON.stringify({ error: "boom" })));
    await assert.rejects(sendHttpOutput({ url: "https://example.com", method: "POST" }, { a: 1 }), /HTTP output returned HTTP 500/);
  });

  it("omits the body when hasBody is false", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ ok: true })));
    await sendHttpOutput({ url: "https://example.com", method: "POST" }, { a: 1 }, false);
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    assert.equal(options.body, undefined);
  });
});

describe("sendMultipartMediaOutput", () => {
  it("sends a multipart form with the file field and returns the response body on success", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ received: true })));
    const result = await sendMultipartMediaOutput({ url: "https://example.com", method: "POST" }, { fileFieldName: "file", fileName: "img.jpg", mediaType: "image/jpeg", bytes: Buffer.from([1, 2, 3]) });
    assert.equal(result.status, 200);
    assert.equal(result.sentMedia.fileName, "img.jpg");
    assert.equal(result.sentMedia.sizeBytes, 3);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    assert.ok(options.body instanceof FormData);
  });

  it("strips a caller-provided Content-Type header so the multipart boundary is set automatically", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ ok: true })));
    await sendMultipartMediaOutput({ url: "https://example.com", method: "POST", headers: { "Content-Type": "application/json", "X-Test": "1" } }, { fileFieldName: "file", fileName: "img.jpg", mediaType: "image/jpeg", bytes: Buffer.from([1]) });
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    assert.equal(headers["Content-Type"], undefined);
    assert.equal(headers["X-Test"], "1");
  });

  it("throws on a non-ok response", async () => {
    fetchMock.mockResolvedValue(mockResponse(500, JSON.stringify({ error: "boom" })));
    await assert.rejects(sendMultipartMediaOutput({ url: "https://example.com", method: "POST" }, { fileFieldName: "file", fileName: "img.jpg", mediaType: "image/jpeg", bytes: Buffer.from([1]) }), /HTTP output returned HTTP 500/);
  });
});
