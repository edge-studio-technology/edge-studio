import { ErrorAlert } from "../../../components/patterns/ErrorAlert";
import { OptionCard } from "../../../components/patterns/OptionCard";
import { MutedText } from "../../../components/Text";
import {
  inputTemplates,
  outputTemplates,
  resolveTemplateConfig,
  templateIcon,
} from "../DataSourceTemplates";
import type { DataSourceCapabilities, DataSourceTemplate } from "../dataSourceTypes";

/** Wiring/capability notes shown alongside a template's form. */
export function TemplateNotes({
  template,
  capabilities,
}: {
  template: DataSourceTemplate;
  capabilities: DataSourceCapabilities | null;
}) {
  const missingBme680Support =
    template.type === "bme-sensor" && template.config.sensor === "bme680"
      ? bme680SupportWarning(capabilities)
      : null;

  return (
    <>
      {template.type === "gpio-output" && (
        <MutedText className="m-0">
          LED profile only. Use a 220-330 ohm resistor in series with the LED.
        </MutedText>
      )}
      {template.config.profile === "pir-motion" && (
        <MutedText className="m-0">
          Tested default: OUT to GPIO23 / physical pin 16, active high, no pull resistor. Let the
          sensor warm up for 60-90 seconds.
        </MutedText>
      )}
      {template.config.profile === "esp32-mqtt-board" && (
        <MutedText className="m-0">
          Creates a normal MQTT input source and shows copyable Arduino ESP32 starter firmware after
          saving.
        </MutedText>
      )}
      {template.type === "bme-sensor" && (
        <MutedText className="m-0">
          Wire VIN, GND, SCL, SDA to the Pi I2C pins and enable I2C/sensor support before reading.
        </MutedText>
      )}
      {missingBme680Support && (
        <ErrorAlert status="warning" className="max-w-none">
          {missingBme680Support}
        </ErrorAlert>
      )}
      {template.type === "bme-sensor" &&
        capabilities?.sensors?.enabled &&
        capabilities.sensors.available === false && (
          <ErrorAlert status="warning" className="max-w-none">
            Sensor helper is not ready yet: {capabilities.sensors.reason}
          </ErrorAlert>
        )}
      {template.type === "pi-camera" && (
        <MutedText className="m-0">
          Captures are stored locally under{" "}
          <code>{capabilities?.camera?.captureDir ?? "/data/captures"}</code> and hashed for
          stamping.
        </MutedText>
      )}
      {template.type === "pi-camera" &&
        capabilities?.camera?.enabled &&
        capabilities.camera.available === false && (
          <ErrorAlert status="warning" className="max-w-none">
            Camera capture is not ready yet: {capabilities.camera.reason}
          </ErrorAlert>
        )}
      {(template.type === "mqtt" || template.type === "mqtt-output") &&
        capabilities?.mqttBroker?.enabled && (
          <MutedText className="m-0">
            Local broker available: <code>{capabilities.mqttBroker.internalUrl}</code>
          </MutedText>
        )}
      {hardwareSetupWarning(template, capabilities) && (
        <ErrorAlert status="warning" className="max-w-none">
          {hardwareSetupWarning(template, capabilities)}
        </ErrorAlert>
      )}
    </>
  );
}

export function templateKind(template: DataSourceTemplate) {
  if (
    template.title === "GPIO Button" ||
    template.config.profile === "esp32-mqtt-board" ||
    template.config.profile === "pir-motion" ||
    template.type === "pi-camera" ||
    template.type === "bme-sensor" ||
    template.type === "gpio-output"
  )
    return "template";
  return "manual";
}

/** Add-device template picker: a grid of pressable template cards. */
export function DataSourceTemplates({
  mode,
  category,
  capabilities,
  onSelect,
}: {
  mode: "input" | "output";
  category?: "template" | "manual";
  capabilities: DataSourceCapabilities | null;
  onSelect: (template: DataSourceTemplate) => void;
}) {
  const templates = (mode === "input" ? inputTemplates : outputTemplates).filter(
    (template) => !category || templateKind(template) === category,
  );

  return (
    <div className="grid gap-6">
      <div>
        <strong>
          {category === "template"
            ? "Templates and examples"
            : category === "manual"
              ? "Manual setup"
              : mode === "input"
                ? "Input sources"
                : "Output targets"}
        </strong>
        <MutedText className="m-0 mt-1">
          {category === "template"
            ? "Start from guided presets for common devices, examples, and hardware setups."
            : category === "manual"
              ? "Configure the protocol, endpoint, topic, or GPIO settings yourself."
              : mode === "input"
                ? "Inputs produce JSON, messages, or hardware events that workflows can record or use as triggers."
                : "Outputs are devices or endpoints the app can control from workflow action blocks."}
        </MutedText>
      </div>
      <div className="flex flex-wrap gap-4">
        {templates.map((template) => (
          <OptionCard
            key={template.title}
            className="w-full sm:w-80"
            icon={templateIcon(template)}
            title={template.title}
            description={template.description}
            actionLabel={mode === "input" ? "Add input" : "Add output"}
            onClick={() =>
              onSelect({ ...template, config: resolveTemplateConfig(template, capabilities) })
            }
          >
            <TemplateNotes template={template} capabilities={capabilities} />
          </OptionCard>
        ))}
      </div>
    </div>
  );
}

function hardwareSetupWarning(
  template: DataSourceTemplate,
  capabilities: DataSourceCapabilities | null,
) {
  if (
    (template.type === "gpio-input" || template.type === "gpio-output") &&
    capabilities?.gpioInput.available === false
  )
    return (
      capabilities.gpioInput.reason ??
      "GPIO support is not enabled yet. You can save this device now, then follow its setup guide before using it."
    );
  if (template.type === "pi-camera" && capabilities?.camera?.enabled === false)
    return (
      capabilities.camera.reason ??
      "Camera support is not enabled yet. You can save this device now, then follow its setup guide before using it."
    );
  if (template.type === "bme-sensor" && capabilities?.sensors?.enabled === false)
    return (
      capabilities.sensors.reason ??
      "Sensor support is not enabled yet. You can save this device now, then follow its setup guide before reading it."
    );
  return null;
}

function bme680SupportWarning(capabilities: DataSourceCapabilities | null) {
  if (!capabilities?.sensors?.enabled || capabilities.sensors.available === false) return null;
  const supportedSensors = capabilities.sensors.supportedSensors;
  if (!supportedSensors || supportedSensors.includes("bme680")) return null;
  return "The sensor helper is not reporting BME680 support yet. Re-run the installer with ENABLE_SENSORS=true or install the PyPI bme680 module in /opt/edge-studio/.venv-sensor-helper, then restart the sensor helper.";
}
