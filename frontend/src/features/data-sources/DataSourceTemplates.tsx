import {
  Camera,
  Cpu,
  Globe2,
  Lightbulb,
  Radio,
  ShieldAlert,
  ThermometerSun,
  Webhook,
} from "lucide-react";
import { Card } from "../../components/Card";
import { CopyField } from "../../components/patterns/CopyField";
import { ErrorAlert } from "../../components/patterns/ErrorAlert";
import { OptionCard } from "../../components/patterns/OptionCard";
import { Pill } from "../../components/Pill";
import { MutedText } from "../../components/Text";
import type { DataSourceCapabilities, DataSourceTemplate } from "./dataSourceTypes";

export const inputTemplates: DataSourceTemplate[] = [
  {
    title: "HTTP JSON Source",
    description: "Fetch JSON from an external API, Pi service, or Docker-network endpoint",
    type: "json-api",
    config: { url: "https://example.com/data.json", method: "GET", headers: {} },
  },
  {
    title: "Webhook Receiver",
    description: "Receive pushed JSON from another app, device, or workflow",
    type: "webhook",
    config: {},
  },
  {
    title: "MQTT Subscriber",
    description: "Subscribe to a broker topic and ingest JSON messages",
    type: "mqtt",
    config: { brokerUrl: "mqtt://localhost:1883", topic: "sensors/+/data" },
  },
  {
    title: "ESP32 MQTT Board",
    description: "Generate starter firmware for an ESP32 board that publishes JSON over MQTT",
    type: "mqtt",
    config: {
      brokerUrl: "mqtt://localhost:1883",
      topic: "boards/esp32/data",
      profile: "esp32-mqtt-board",
    },
  },
  {
    title: "GPIO Input Pin",
    description: "Record Raspberry Pi GPIO pin edge events as JSON",
    type: "gpio-input",
    config: {
      chip: "gpiochip0",
      pin: 17,
      pull: "off",
      edge: "both",
      debounceMs: 100,
      activeState: "high",
    },
  },
  {
    title: "GPIO Button",
    description: "Detect a simple push button wired between GPIO17 and GND",
    type: "gpio-input",
    config: {
      chip: "gpiochip0",
      pin: 17,
      profile: "generic",
      pull: "up",
      edge: "falling",
      debounceMs: 100,
      activeState: "low",
    },
  },
  {
    title: "PIR Motion Sensor",
    description: "Detect HC-SR501-style motion events from a GPIO input pin",
    type: "gpio-input",
    config: {
      chip: "gpiochip0",
      pin: 23,
      profile: "pir-motion",
      pull: "off",
      edge: "rising",
      debounceMs: 500,
      activeState: "high",
    },
  },
  {
    title: "BME280 Environmental Sensor",
    description: "Read temperature, humidity, and air pressure from a BME280 I2C module",
    type: "bme-sensor",
    config: { sensor: "bme280", bus: 1, address: "0x76" },
  },
  {
    title: "BME680 Environmental Sensor",
    description: "Read temperature, humidity, and air pressure from a BME680 I2C module",
    type: "bme-sensor",
    config: { sensor: "bme680", bus: 1, address: "0x76" },
  },
  {
    title: "Raspberry Pi Camera",
    description: "Capture photos or short video clips from automation workflows",
    type: "pi-camera",
    config: {
      mode: "photo",
      width: 1280,
      height: 720,
      durationMs: 1000,
      fps: 30,
      outputFormat: "jpg",
    },
  },
];

export const outputTemplates: DataSourceTemplate[] = [
  {
    title: "GPIO LED",
    description: "Low-current LED output target controlled by automation workflows",
    type: "gpio-output",
    config: {
      chip: "gpiochip0",
      pin: 18,
      profile: "led",
      activeState: "high",
      initialState: "inactive",
    },
  },
  {
    title: "HTTP JSON Target",
    description: "Send JSON commands to an HTTP endpoint from automation workflows",
    type: "http-output",
    config: {
      url: "https://example.com/device/command",
      method: "POST",
      headers: {},
      timeoutMs: 5000,
    },
  },
  {
    title: "MQTT Publisher",
    description: "Publish JSON commands to a broker topic from automation workflows",
    type: "mqtt-output",
    config: {
      brokerUrl: "mqtt://localhost:1883",
      topic: "devices/example/set",
      qos: 0,
      retain: false,
    },
  },
];

export function templateIcon(template: DataSourceTemplate) {
  if (template.config.profile === "pir-motion") return ShieldAlert;
  if (template.config.profile === "esp32-mqtt-board") return Cpu;
  if (template.type === "json-api" || template.type === "http-output") return Globe2;
  if (template.type === "webhook") return Webhook;
  if (template.type === "mqtt" || template.type === "mqtt-output") return Radio;
  if (template.type === "gpio-output") return Lightbulb;
  if (template.type === "pi-camera") return Camera;
  if (template.type === "bme-sensor") return ThermometerSun;
  return Cpu;
}

/** Applies runtime capability values (currently the local broker URL) to a template's saved config. */
export function resolveTemplateConfig(
  template: DataSourceTemplate,
  capabilities: DataSourceCapabilities | null,
) {
  if (template.type !== "mqtt" && template.type !== "mqtt-output") return template.config;
  const brokerUrl = capabilities?.mqttBroker?.enabled
    ? capabilities.mqttBroker.internalUrl
    : "mqtt://localhost:1883";
  return { ...template.config, brokerUrl };
}

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
                : "Outputs are devices or endpoints the app can control from automation action blocks."}
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
  return "The sensor helper is not reporting BME680 support yet. Re-run the installer with ENABLE_SENSORS=true or install the PyPI bme680 module in /opt/integritas-pi/.venv-sensor-helper, then restart the sensor helper.";
}

export function LocalServicesCard({
  capabilities,
}: {
  capabilities: DataSourceCapabilities | null;
}) {
  const broker = capabilities?.mqttBroker;
  const browserHost = typeof window === "undefined" ? "<pi-host-or-ip>" : window.location.hostname;
  const publicHost = broker?.publicHost || browserHost || "<pi-host-or-ip>";
  const publicPort = broker?.publicPort ?? 1883;
  const lanUrl = `mqtt://${publicHost}:${publicPort}`;
  const internalUrl = broker?.internalUrl ?? "mqtt://mqtt:1883";

  return (
    <Card className="gap-detail-near grid w-full">
      <div>
        <div className="gap-detail-close flex flex-wrap items-center">
          <h2 className="type-title text-text-primary m-0">Local services</h2>
          <Pill tone={broker?.enabled ? "good" : "neutral"} indicator>
            {broker?.enabled ? "Enabled" : "Disabled"}
          </Pill>
        </div>
        <p className="type-body text-text-secondary mt-detail-next m-0">
          Connection details for the local MQTT broker, so devices can connect directly to this Pi
          without a separate broker.
        </p>
      </div>
      <div className="gap-detail-close grid md:grid-cols-2">
        <CopyField
          label="LAN URL"
          value={lanUrl}
          description="Use this from external devices on the LAN."
        />
        <CopyField
          label="Internal URL"
          value={internalUrl}
          description="Use this in Integritas Pi MQTT device configs."
        />
      </div>
      {!broker?.enabled && (
        <div>
          <p className="type-meta text-text-tertiary m-0">Enable with</p>
          <p className="type-body text-text-secondary mt-detail-tight m-0">
            <code>ENABLE_MQTT_BROKER=true</code> and the Docker Compose MQTT profile.
          </p>
        </div>
      )}
    </Card>
  );
}
