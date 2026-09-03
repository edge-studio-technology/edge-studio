import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDeviceFormFields } from "../../../src/features/data-sources/useDeviceFormFields";
import type { DataSource, DataSourceTemplate } from "../../../src/features/data-sources/dataSourceTypes";

describe("useDeviceFormFields", () => {
  it("starts with default field values", () => {
    const { result } = renderHook(() => useDeviceFormFields());
    const { fields } = result.current;
    expect(fields.name).toBe("");
    expect(fields.description).toBe("");
    expect(fields.type).toBe("json-api");
    expect(fields.url).toBe("");
    expect(fields.gpioChip).toBe("gpiochip0");
    expect(fields.gpioPin).toBe("17");
    expect(fields.gpioProfile).toBe("generic");
    expect(fields.gpioPull).toBe("off");
    expect(fields.gpioEdge).toBe("both");
    expect(fields.gpioDebounceMs).toBe("100");
    expect(fields.gpioActiveState).toBe("high");
    expect(fields.cameraMode).toBe("photo");
    expect(fields.cameraWidth).toBe("1280");
    expect(fields.cameraHeight).toBe("720");
    expect(fields.cameraDurationMs).toBe("1000");
    expect(fields.cameraFps).toBe("30");
    expect(fields.bmeSensor).toBe("bme280");
    expect(fields.bmeBus).toBe("1");
    expect(fields.bmeAddress).toBe("0x76");
    expect(fields.method).toBe("GET");
  });

  it("field setters update their own field", () => {
    const { result } = renderHook(() => useDeviceFormFields());
    act(() => result.current.fields.setName("My device"));
    expect(result.current.fields.name).toBe("My device");
    act(() => result.current.fields.setType("mqtt"));
    expect(result.current.fields.type).toBe("mqtt");
  });

  it("fillFromTemplate fills name/description/type/config, defaulting unset config fields", () => {
    const template: DataSourceTemplate = {
      title: "GPIO Button",
      description: "Detect a push button",
      type: "gpio-input",
      config: { chip: "gpiochip0", pin: 17, profile: "generic", pull: "up", edge: "falling", debounceMs: 100, activeState: "low" },
    };
    const { result } = renderHook(() => useDeviceFormFields());
    act(() => result.current.fillFromTemplate(template));
    const { fields } = result.current;
    expect(fields.name).toBe("GPIO Button");
    expect(fields.description).toBe("Detect a push button");
    expect(fields.type).toBe("gpio-input");
    expect(fields.gpioPull).toBe("up");
    expect(fields.gpioEdge).toBe("falling");
    expect(fields.gpioActiveState).toBe("low");
    // url wasn't in the template config, defaults to empty
    expect(fields.url).toBe("");
  });

  it("fillFromTemplate falls back gpioProfile to 'generic' when the template profile isn't pir-motion", () => {
    const template: DataSourceTemplate = {
      title: "MQTT Subscriber",
      description: "",
      type: "mqtt",
      config: { profile: "esp32-mqtt-board" },
    };
    const { result } = renderHook(() => useDeviceFormFields());
    act(() => result.current.fillFromTemplate(template));
    expect(result.current.fields.gpioProfile).toBe("generic");
  });

  it("fillFromSource fills fields from an existing data source, defaulting missing description", () => {
    const source: DataSource = {
      id: "s1",
      createdAt: "",
      updatedAt: "",
      name: "Kitchen Sensor",
      type: "bme-sensor",
      status: "active",
      description: null,
      config: { sensor: "bme680", bus: 1, address: "0x77" },
      lastReadAt: null,
      lastError: null,
      lastPreview: null,
      lastHash: null,
    };
    const { result } = renderHook(() => useDeviceFormFields());
    act(() => result.current.fillFromSource(source));
    const { fields } = result.current;
    expect(fields.name).toBe("Kitchen Sensor");
    expect(fields.description).toBe("");
    expect(fields.type).toBe("bme-sensor");
    expect(fields.bmeSensor).toBe("bme680");
    expect(fields.bmeBus).toBe("1");
    expect(fields.bmeAddress).toBe("0x77");
  });

  it("reset clears fields back to defaults after filling them", () => {
    const { result } = renderHook(() => useDeviceFormFields());
    act(() => {
      result.current.fields.setName("Changed");
      result.current.fields.setType("mqtt");
      result.current.fields.setGpioPin("23");
    });
    act(() => result.current.reset());
    const { fields } = result.current;
    expect(fields.name).toBe("");
    expect(fields.type).toBe("json-api");
    expect(fields.gpioPin).toBe("17");
  });
});
