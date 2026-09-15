import { describe, expect, it } from "vitest";
import {
  fallbackCapabilityState,
  hostCapabilityForDevice,
  hostCapabilityForDeviceType,
  isTemplateActiveByCapability,
} from "../../../src/features/data-sources/hardwareCapabilities";
import type { DataSource, DataSourceCapabilities, DataSourceTemplate, HostCapability } from "../../../src/features/data-sources/dataSourceTypes";

function source(overrides: Partial<DataSource>): DataSource {
  return {
    id: "src-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    name: "Source",
    type: "json-api",
    status: "active",
    description: null,
    config: {},
    lastReadAt: null,
    lastError: null,
    lastPreview: null,
    lastHash: null,
    ...overrides,
  };
}

function template(type: DataSourceTemplate["type"]): DataSourceTemplate {
  return { title: type, description: type, type, config: {} };
}

const hostCapabilities: HostCapability[] = [
  { name: "camera", enabled: true, installed: true, available: true, state: "enabled", reason: null },
  { name: "gpio", enabled: false, installed: true, available: false, state: "disabled", reason: "GPIO disabled" },
  { name: "sensors", enabled: true, installed: true, available: false, state: "failed", reason: "Sensor helper stopped" },
  { name: "mqtt", enabled: false, installed: true, available: false, state: "disabled", reason: "MQTT disabled" },
];

describe("hostCapabilityForDeviceType", () => {
  it("maps host-backed device types to their host capability", () => {
    expect(hostCapabilityForDeviceType("pi-camera")).toBe("camera");
    expect(hostCapabilityForDeviceType("bme-sensor")).toBe("sensors");
    expect(hostCapabilityForDeviceType("gpio-input")).toBe("gpio");
    expect(hostCapabilityForDeviceType("gpio-output")).toBe("gpio");
    expect(hostCapabilityForDeviceType("json-api")).toBeNull();
  });
});

describe("hostCapabilityForDevice", () => {
  it("uses the local MQTT host capability only for local broker URLs", () => {
    expect(hostCapabilityForDevice(source({ type: "mqtt", config: { brokerUrl: "mqtt://mqtt:1883" } }), hostCapabilities)?.name).toBe("mqtt");
    expect(hostCapabilityForDevice(source({ type: "mqtt-output", config: { brokerUrl: "mqtt://localhost:1883" } }), hostCapabilities)?.name).toBe("mqtt");
    expect(hostCapabilityForDevice(source({ type: "mqtt", config: { brokerUrl: "mqtt://127.0.0.1:1883" } }), hostCapabilities)?.name).toBe("mqtt");
    expect(hostCapabilityForDevice(source({ type: "mqtt", config: { brokerUrl: "mqtt://broker.example:1883" } }), hostCapabilities)).toBeNull();
  });
});

describe("isTemplateActiveByCapability", () => {
  it("uses host capability enabled state when host status is available", () => {
    expect(isTemplateActiveByCapability(template("pi-camera"), null, hostCapabilities)).toBe(true);
    expect(isTemplateActiveByCapability(template("gpio-input"), null, hostCapabilities)).toBe(false);
    expect(isTemplateActiveByCapability(template("bme-sensor"), null, hostCapabilities)).toBe(true);
  });

  it("falls back to legacy runtime capabilities when host status is unavailable", () => {
    const capabilities: DataSourceCapabilities = {
      gpioInput: { enabled: false, available: false, devicePath: "/dev/gpiochip0", reason: "GPIO disabled" },
      camera: { enabled: true, available: true, captureDir: "/data/captures", reason: null },
      sensors: { enabled: false, available: false, reason: "Sensors disabled" },
    };

    expect(isTemplateActiveByCapability(template("pi-camera"), capabilities, [])).toBe(true);
    expect(isTemplateActiveByCapability(template("gpio-output"), capabilities, [])).toBe(false);
    expect(isTemplateActiveByCapability(template("bme-sensor"), capabilities, [])).toBe(false);
    expect(isTemplateActiveByCapability(template("json-api"), capabilities, [])).toBe(true);
  });
});

describe("fallbackCapabilityState", () => {
  it("returns fallback state for host-backed device types", () => {
    const capabilities: DataSourceCapabilities = {
      gpioInput: { enabled: true, available: false, devicePath: "/dev/gpiochip0", reason: "Backend cannot see GPIO" },
      mqttBroker: { enabled: false, internalUrl: "mqtt://mqtt:1883", publicHost: "pi.local", publicPort: 1883 },
      camera: { enabled: true, available: true, captureDir: "/data/captures", reason: null },
      sensors: { enabled: false, available: false, reason: "Sensors disabled" },
    };

    expect(fallbackCapabilityState(source({ type: "gpio-output" }), capabilities)).toEqual({ enabled: true, available: false, reason: "Backend cannot see GPIO" });
    expect(fallbackCapabilityState(source({ type: "mqtt", config: { brokerUrl: "mqtt://mqtt:1883" } }), capabilities)).toEqual({ enabled: false, available: false, reason: "Local MQTT broker is disabled. Enable it from Devices -> Hardware support." });
    expect(fallbackCapabilityState(source({ type: "mqtt", config: { brokerUrl: "mqtt://broker.example:1883" } }), capabilities)).toBeNull();
  });
});
