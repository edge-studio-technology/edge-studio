import { describe, expect, it } from "vitest";
import { altDeviceOptions } from "../../../../src/features/data-sources/add-device-alt/altDeviceOptions";

describe("altDeviceOptions", () => {
  it("excludes guided-only templates (ESP32 MQTT Board, GPIO Button, PIR Motion Sensor) for input mode", () => {
    const titles = altDeviceOptions("input").map((option) => option.title);
    expect(titles).not.toContain("ESP32 MQTT Board");
    expect(titles).not.toContain("GPIO Button");
    expect(titles).not.toContain("PIR Motion Sensor");
  });

  it("replaces the two BME sensor templates with a single combined I2C Environmental Sensor option", () => {
    const options = altDeviceOptions("input");
    const titles = options.map((option) => option.title);
    expect(titles).not.toContain("BME280 Environmental Sensor");
    expect(titles).not.toContain("BME680 Environmental Sensor");
    expect(titles.filter((title) => title === "I2C Environmental Sensor")).toHaveLength(1);
    const combined = options.find((option) => option.title === "I2C Environmental Sensor")!;
    expect(combined.type).toBe("bme-sensor");
  });

  it("keeps the combined sensor option's grid position where the first BME template was", () => {
    const titles = altDeviceOptions("input").map((option) => option.title);
    const index = titles.indexOf("I2C Environmental Sensor");
    // Device System Data comes right after both BME templates in the source list.
    expect(titles[index + 1]).toBe("Device System Data");
  });

  it("returns output templates unfiltered (no guided-only titles or bme-sensor types among outputs)", () => {
    const options = altDeviceOptions("output");
    const titles = options.map((option) => option.title);
    expect(titles).toEqual(["GPIO LED", "HTTP JSON Target", "MQTT Publisher"]);
  });
});
