import { describe, expect, it, vi } from "vitest";
import { buildDeviceConfigInput } from "../../../src/features/data-sources/buildDeviceConfig";
import type { DeviceFormFields } from "../../../src/features/data-sources/useDeviceFormFields";
import type { DataSource, DataSourceTemplate } from "../../../src/features/data-sources/dataSourceTypes";

function fields(overrides: Partial<DeviceFormFields> = {}): DeviceFormFields {
  return {
    name: "My device",
    setName: vi.fn(),
    description: "",
    setDescription: vi.fn(),
    type: "json-api",
    setType: vi.fn(),
    url: "https://example.com/data.json",
    setUrl: vi.fn(),
    healthStatusUrl: "",
    setHealthStatusUrl: vi.fn(),
    brokerUrl: "mqtt://localhost:1883",
    setBrokerUrl: vi.fn(),
    topic: "sensors/+/data",
    setTopic: vi.fn(),
    gpioChip: "gpiochip0",
    setGpioChip: vi.fn(),
    gpioPin: "17",
    setGpioPin: vi.fn(),
    gpioProfile: "generic",
    setGpioProfile: vi.fn(),
    gpioPull: "off",
    setGpioPull: vi.fn(),
    gpioEdge: "both",
    setGpioEdge: vi.fn(),
    gpioDebounceMs: "100",
    setGpioDebounceMs: vi.fn(),
    gpioActiveState: "high",
    setGpioActiveState: vi.fn(),
    cameraMode: "photo",
    setCameraMode: vi.fn(),
    cameraWidth: "1280",
    setCameraWidth: vi.fn(),
    cameraHeight: "720",
    setCameraHeight: vi.fn(),
    cameraDurationMs: "1000",
    setCameraDurationMs: vi.fn(),
    cameraFps: "30",
    setCameraFps: vi.fn(),
    bmeSensor: "bme280",
    setBmeSensor: vi.fn(),
    bmeBus: "1",
    setBmeBus: vi.fn(),
    bmeAddress: "0x76",
    setBmeAddress: vi.fn(),
    method: "GET",
    setMethod: vi.fn(),
    ...overrides,
  };
}

describe("buildDeviceConfigInput", () => {
  it("webhook passes through the editing source's token", () => {
    const editingSource = { config: { webhookToken: "tok-123" } } as DataSource;
    expect(buildDeviceConfigInput(fields({ type: "webhook" }), { editingSource })).toEqual({
      webhookToken: "tok-123",
    });
  });

  it("webhook has no token when there is no editing source", () => {
    expect(buildDeviceConfigInput(fields({ type: "webhook" }), {})).toEqual({
      webhookToken: undefined,
    });
  });

  it("mqtt builds brokerUrl/topic without a profile by default", () => {
    expect(
      buildDeviceConfigInput(fields({ type: "mqtt", brokerUrl: "mqtt://host:1883", topic: "t" }), {}),
    ).toEqual({ brokerUrl: "mqtt://host:1883", topic: "t", profile: undefined });
  });

  it("mqtt sets the esp32-mqtt-board profile when the template says so", () => {
    const template: DataSourceTemplate = {
      title: "ESP32 MQTT Board",
      description: "",
      type: "mqtt",
      config: { profile: "esp32-mqtt-board" },
    };
    expect(
      buildDeviceConfigInput(fields({ type: "mqtt", brokerUrl: "mqtt://host:1883", topic: "t" }), {
        template,
      }),
    ).toEqual({ brokerUrl: "mqtt://host:1883", topic: "t", profile: "esp32-mqtt-board" });
  });

  it("mqtt does not set the esp32 profile for a non-matching template profile", () => {
    const template: DataSourceTemplate = {
      title: "MQTT Subscriber",
      description: "",
      type: "mqtt",
      config: {},
    };
    expect(
      buildDeviceConfigInput(fields({ type: "mqtt" }), { template }).profile,
    ).toBeUndefined();
  });

  it("mqtt-output builds fixed qos/retain", () => {
    expect(
      buildDeviceConfigInput(
        fields({ type: "mqtt-output", brokerUrl: "mqtt://host:1883", topic: "devices/x/set" }),
        {},
      ),
    ).toEqual({ brokerUrl: "mqtt://host:1883", topic: "devices/x/set", qos: 0, retain: false });
  });

  it("http-output forces GET to POST and fixes headers/timeout", () => {
    expect(
      buildDeviceConfigInput(fields({ type: "http-output", url: "https://x", method: "GET" }), {}),
    ).toEqual({ url: "https://x", method: "POST", headers: {}, timeoutMs: 5000 });
  });

  it("http-output keeps a non-GET method as-is", () => {
    expect(
      buildDeviceConfigInput(fields({ type: "http-output", url: "https://x", method: "PATCH" }), {})
        .method,
    ).toBe("PATCH");
  });

  it("gpio-input coerces pin/debounce to numbers", () => {
    expect(
      buildDeviceConfigInput(
        fields({
          type: "gpio-input",
          gpioChip: "gpiochip0",
          gpioPin: "23",
          gpioProfile: "pir-motion",
          gpioPull: "up",
          gpioEdge: "rising",
          gpioDebounceMs: "500",
          gpioActiveState: "low",
        }),
        {},
      ),
    ).toEqual({
      chip: "gpiochip0",
      pin: 23,
      profile: "pir-motion",
      pull: "up",
      edge: "rising",
      debounceMs: 500,
      activeState: "low",
    });
  });

  it("gpio-output fixes the led profile and inactive initial state", () => {
    expect(
      buildDeviceConfigInput(
        fields({ type: "gpio-output", gpioChip: "gpiochip0", gpioPin: "18", gpioActiveState: "high" }),
        {},
      ),
    ).toEqual({
      chip: "gpiochip0",
      pin: 18,
      profile: "led",
      activeState: "high",
      initialState: "inactive",
    });
  });

  it("pi-camera coerces numeric fields and picks output format by mode", () => {
    expect(
      buildDeviceConfigInput(
        fields({
          type: "pi-camera",
          cameraMode: "photo",
          cameraWidth: "1280",
          cameraHeight: "720",
          cameraDurationMs: "1000",
          cameraFps: "30",
        }),
        {},
      ),
    ).toEqual({
      mode: "photo",
      width: 1280,
      height: 720,
      durationMs: 1000,
      fps: 30,
      outputFormat: "jpg",
    });
  });

  it("pi-camera uses h264 output for video mode", () => {
    expect(
      buildDeviceConfigInput(fields({ type: "pi-camera", cameraMode: "video" }), {}).outputFormat,
    ).toBe("h264");
  });

  it("bme-sensor coerces bus to a number", () => {
    expect(
      buildDeviceConfigInput(
        fields({ type: "bme-sensor", bmeSensor: "bme680", bmeBus: "1", bmeAddress: "0x77" }),
        {},
      ),
    ).toEqual({ sensor: "bme680", bus: 1, address: "0x77" });
  });

  it("device-system-data enables every collection flag", () => {
    expect(buildDeviceConfigInput(fields({ type: "device-system-data" }), {})).toEqual({
      includeSpecs: true,
      includePerformance: true,
      includeNetwork: true,
      includeLocation: true,
    });
  });

  it("json-api (default) trims an empty health status URL to undefined", () => {
    expect(
      buildDeviceConfigInput(
        fields({ type: "json-api", url: "https://x", healthStatusUrl: "  ", method: "GET" }),
        {},
      ),
    ).toEqual({ url: "https://x", method: "GET", healthStatusUrl: undefined, headers: {} });
  });

  it("json-api (default) keeps a trimmed health status URL and forces PUT/PATCH to POST", () => {
    expect(
      buildDeviceConfigInput(
        fields({
          type: "json-api",
          url: "https://x",
          healthStatusUrl: " https://x/health ",
          method: "PATCH",
        }),
        {},
      ),
    ).toEqual({
      url: "https://x",
      method: "POST",
      healthStatusUrl: "https://x/health",
      headers: {},
    });
  });
});
