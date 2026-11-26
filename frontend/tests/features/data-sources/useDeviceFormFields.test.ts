import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDeviceFormFields } from "../../../src/features/data-sources/useDeviceFormFields";
import type { DataSource, DataSourceTemplate } from "../../../src/features/data-sources/dataSourceTypes";
import { buildDeviceConfigInput } from "../../../src/features/data-sources/buildDeviceConfig";

describe("useDeviceFormFields", () => {
  it("round trips the saved display rotation without introducing unrelated fields", () => {
    const { result } = renderHook(() => useDeviceFormFields());
    act(() => result.current.fillFromSource({ id: "lcd", name: "Screen", type: "spi-display", config: { model: "pim576", rotation: 270 } } as DataSource));
    expect(buildDeviceConfigInput(result.current.fields, {})).toEqual({ model: "pim576", rotation: 270 });
    act(() => result.current.reset());
    expect(result.current.fields.displayRotation).toBe(0);
  });
  it("round trips saved BH1750 editing and keeps BME defaults separate", () => {
    const { result } = renderHook(() => useDeviceFormFields());
    act(() => result.current.fillFromSource({ id: "light", name: "Room light", description: "", type: "bh1750-sensor", config: { sensor: "bh1750", bus: 1, address: "0x5c" } } as DataSource));
    expect(buildDeviceConfigInput(result.current.fields, {})).toEqual({ sensor: "bh1750", bus: 1, address: "0x5c" });
    act(() => result.current.fillFromTemplate({ title: "Light", description: "", type: "bh1750-sensor", config: {} }));
    expect(result.current.fields.bmeAddress).toBe("0x23");
    act(() => result.current.fillFromTemplate({ title: "BME", description: "", type: "bme-sensor", config: {} }));
    expect(buildDeviceConfigInput(result.current.fields, {})).toEqual({ sensor: "bme280", bus: 1, address: "0x76" });
  });
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
      config: { chip: "gpiochip0", pin: 17, profile: "gpio-button", pull: "up", edge: "falling", debounceMs: 100, activeState: "low" },
    };
    const { result } = renderHook(() => useDeviceFormFields());
    act(() => result.current.fillFromTemplate(template));
    const { fields } = result.current;
    expect(fields.name).toBe("GPIO Button");
    expect(fields.description).toBe("Detect a push button");
    expect(fields.type).toBe("gpio-input");
    expect(fields.gpioProfile).toBe("gpio-button");
    expect(fields.gpioPull).toBe("up");
    expect(fields.gpioEdge).toBe("falling");
    expect(fields.gpioActiveState).toBe("low");
    // url wasn't in the template config, defaults to empty
    expect(fields.url).toBe("");
  });

  it("fillFromTemplate falls back gpioProfile to 'generic' when the template profile is not a GPIO input profile", () => {
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
