import { inputTemplates, outputTemplates } from "../DataSourceTemplates";
import type { DataSourceTemplate } from "../dataSourceTypes";

/**
 * Guided presets excluded from the alt flow: it is manual setup only for now, so a card
 * maps to a device/protocol you configure yourself rather than a pre-wired example board.
 * Guided setup is being reworked separately.
 */
const guidedOnlyTitles = ["ESP32 MQTT Board", "GPIO Button", "PIR Motion Sensor"];

/**
 * BME280 and BME680 share one picker card here; `AltDeviceForm` asks which model on the
 * next step instead of splitting them into two cards like the classic flow does.
 */
const environmentalSensorOption: DataSourceTemplate = {
  title: "I2C Environmental Sensor",
  description: "Read temperature, humidity, and air pressure from a BME280 or BME680 model",
  type: "bme-sensor",
  config: { sensor: "bme280", bus: 1, address: "0x76" },
};

export function altDeviceOptions(mode: "input" | "output") {
  const templates = (mode === "input" ? inputTemplates : outputTemplates).filter(
    (template) => !guidedOnlyTitles.includes(template.title),
  );
  if (mode !== "input") return templates;

  let sensorInserted = false;
  return templates.reduce<DataSourceTemplate[]>((options, template) => {
    if (template.type !== "bme-sensor") {
      options.push(template);
      return options;
    }
    if (!sensorInserted) {
      options.push(environmentalSensorOption);
      sensorInserted = true;
    }
    return options;
  }, []);
}
