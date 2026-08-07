import { inputTemplates, outputTemplates } from "../DataSourceTemplates";

/**
 * Guided presets excluded from the alt flow: it is manual setup only for now, so a card
 * maps to a device/protocol you configure yourself rather than a pre-wired example board.
 * Guided setup is being reworked separately.
 */
const guidedOnlyTitles = ["ESP32 MQTT Board", "GPIO Button", "PIR Motion Sensor"];

export function altDeviceOptions(mode: "input" | "output") {
  return (mode === "input" ? inputTemplates : outputTemplates).filter(
    (template) => !guidedOnlyTitles.includes(template.title),
  );
}
