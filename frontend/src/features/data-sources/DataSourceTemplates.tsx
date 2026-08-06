import { Camera, Cpu, Globe2, Lightbulb, Radio, ShieldAlert, ThermometerSun, Webhook } from "lucide-react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { CopyField } from "../../components/patterns/CopyField";
import { Pill } from "../../components/Pill";
import { MutedText } from "../../components/Text";
import type { DataSourceCapabilities, DataSourceTemplate } from "./dataSourceTypes";

export const inputTemplates: DataSourceTemplate[] = [
  { title: "HTTP JSON Source", description: "Fetch JSON from an external API, Pi service, or Docker-network endpoint", type: "json-api", config: { url: "https://example.com/data.json", method: "GET", headers: {} } },
  { title: "Webhook Receiver", description: "Receive pushed JSON from another app, device, or workflow", type: "webhook", config: {} },
  { title: "MQTT Subscriber", description: "Subscribe to a broker topic and ingest JSON messages", type: "mqtt", config: { brokerUrl: "mqtt://localhost:1883", topic: "sensors/+/data" } },
  { title: "ESP32 MQTT Board", description: "Generate starter firmware for an ESP32 board that publishes JSON over MQTT", type: "mqtt", config: { brokerUrl: "mqtt://localhost:1883", topic: "boards/esp32/data", profile: "esp32-mqtt-board" } },
  { title: "GPIO Input Pin", description: "Record Raspberry Pi GPIO pin edge events as JSON", type: "gpio-input", config: { chip: "gpiochip0", pin: 17, pull: "off", edge: "both", debounceMs: 100, activeState: "high" } },
  { title: "GPIO Button", description: "Detect a simple push button wired between GPIO17 and GND", type: "gpio-input", config: { chip: "gpiochip0", pin: 17, profile: "generic", pull: "up", edge: "falling", debounceMs: 100, activeState: "low" } },
  { title: "PIR Motion Sensor", description: "Detect HC-SR501-style motion events from a GPIO input pin", type: "gpio-input", config: { chip: "gpiochip0", pin: 23, profile: "pir-motion", pull: "off", edge: "rising", debounceMs: 500, activeState: "high" } },
  { title: "BME280 Environmental Sensor", description: "Read temperature, humidity, and air pressure from a BME280 I2C module", type: "bme-sensor", config: { sensor: "bme280", bus: 1, address: "0x76" } },
  { title: "BME680 Environmental Sensor", description: "Read temperature, humidity, and air pressure from a BME680 I2C module", type: "bme-sensor", config: { sensor: "bme680", bus: 1, address: "0x76" } },
  { title: "Raspberry Pi Camera", description: "Capture photos or short video clips from automation workflows", type: "pi-camera", config: { mode: "photo", width: 1280, height: 720, durationMs: 1000, fps: 30, outputFormat: "jpg" } }
];

export const outputTemplates: DataSourceTemplate[] = [
  { title: "GPIO LED", description: "Low-current LED output target controlled by automation workflows", type: "gpio-output", config: { chip: "gpiochip0", pin: 18, profile: "led", activeState: "high", initialState: "inactive" } },
  { title: "HTTP JSON Target", description: "Send JSON commands to an HTTP endpoint from automation workflows", type: "http-output", config: { url: "https://example.com/device/command", method: "POST", headers: {}, timeoutMs: 5000 } },
  { title: "MQTT Publisher", description: "Publish JSON commands to a broker topic from automation workflows", type: "mqtt-output", config: { brokerUrl: "mqtt://localhost:1883", topic: "devices/example/set", qos: 0, retain: false } }
];

export function DataSourceTemplates({ mode, category, capabilities, onSelect }: { mode: "input" | "output"; category?: "template" | "manual"; capabilities: DataSourceCapabilities | null; onSelect: (template: DataSourceTemplate) => void }) {
  const templates = (mode === "input" ? inputTemplates : outputTemplates).filter((template) => !category || templateKind(template) === category);
  const brokerUrl = capabilities?.mqttBroker?.enabled ? capabilities.mqttBroker.internalUrl : "mqtt://localhost:1883";

  return (
    <Card className="grid gap-6">
      <div>
        <strong>{category === "template" ? "Templates and examples" : category === "manual" ? "Manual setup" : mode === "input" ? "Input sources" : "Output targets"}</strong>
        <MutedText className="m-0 mt-1">{category === "template" ? "Start from guided presets for common devices, examples, and hardware setups." : category === "manual" ? "Configure the protocol, endpoint, topic, or GPIO settings yourself." : mode === "input" ? "Inputs produce JSON, messages, or hardware events that workflows can record or use as triggers." : "Outputs are devices or endpoints the app can control from automation action blocks."}</MutedText>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {templates.map((template) => {
          const Icon = template.config.profile === "pir-motion" ? ShieldAlert : template.config.profile === "esp32-mqtt-board" ? Cpu : template.type === "json-api" || template.type === "http-output" ? Globe2 : template.type === "webhook" ? Webhook : template.type === "mqtt" || template.type === "mqtt-output" ? Radio : template.type === "gpio-output" ? Lightbulb : template.type === "pi-camera" ? Camera : template.type === "bme-sensor" ? ThermometerSun : Cpu;
          const config = template.type === "mqtt" || template.type === "mqtt-output" ? { ...template.config, brokerUrl } : template.config;
          const missingBme680Support = template.type === "bme-sensor" && template.config.sensor === "bme680" ? bme680SupportWarning(capabilities) : null;
          return (
            <Card className="grid gap-3 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]" key={template.title}>
              <Icon size={24} />
              <h3 className="m-0">{template.title}</h3>
              <MutedText className="m-0">{template.description}</MutedText>
              {template.type === "gpio-output" && <MutedText className="m-0">LED profile only. Use a 220-330 ohm resistor in series with the LED.</MutedText>}
              {template.config.profile === "pir-motion" && <MutedText className="m-0">Tested default: OUT to GPIO23 / physical pin 16, active high, no pull resistor. Let the sensor warm up for 60-90 seconds.</MutedText>}
              {template.config.profile === "esp32-mqtt-board" && <MutedText className="m-0">Creates a normal MQTT input source and shows copyable Arduino ESP32 starter firmware after saving.</MutedText>}
              {template.type === "bme-sensor" && <MutedText className="m-0">Wire VIN, GND, SCL, SDA to the Pi I2C pins and enable I2C/sensor support before reading.</MutedText>}
              {missingBme680Support && <MutedText className="m-0">{missingBme680Support}</MutedText>}
              {template.type === "bme-sensor" && capabilities?.sensors?.enabled && capabilities.sensors.available === false && <MutedText className="m-0">Sensor helper is not ready yet: {capabilities.sensors.reason}</MutedText>}
              {template.type === "pi-camera" && <MutedText className="m-0">Captures are stored locally under <code>{capabilities?.camera?.captureDir ?? "/data/captures"}</code> and hashed for stamping.</MutedText>}
              {template.type === "pi-camera" && capabilities?.camera?.enabled && capabilities.camera.available === false && <MutedText className="m-0">Camera capture is not ready yet: {capabilities.camera.reason}</MutedText>}
              {(template.type === "mqtt" || template.type === "mqtt-output") && capabilities?.mqttBroker?.enabled && <MutedText className="m-0">Local broker available: <code>{capabilities.mqttBroker.internalUrl}</code></MutedText>}
              {hardwareSetupWarning(template, capabilities) && <MutedText className="m-0">{hardwareSetupWarning(template, capabilities)}</MutedText>}
              <Button type="button" onClick={() => onSelect({ ...template, config })}>{mode === "input" ? "Add input" : "Add output"}</Button>
            </Card>
          );
        })}
      </div>
    </Card>
  );
}

function templateKind(template: DataSourceTemplate) {
  if (template.title === "GPIO Button" || template.config.profile === "esp32-mqtt-board" || template.config.profile === "pir-motion" || template.type === "pi-camera" || template.type === "bme-sensor" || template.type === "gpio-output") return "template";
  return "manual";
}

function hardwareSetupWarning(template: DataSourceTemplate, capabilities: DataSourceCapabilities | null) {
  if ((template.type === "gpio-input" || template.type === "gpio-output") && capabilities?.gpioInput.available === false) return capabilities.gpioInput.reason ?? "GPIO support is not enabled yet. You can save this device now, then follow its setup guide before using it.";
  if (template.type === "pi-camera" && capabilities?.camera?.enabled === false) return capabilities.camera.reason ?? "Camera support is not enabled yet. You can save this device now, then follow its setup guide before using it.";
  if (template.type === "bme-sensor" && capabilities?.sensors?.enabled === false) return capabilities.sensors.reason ?? "Sensor support is not enabled yet. You can save this device now, then follow its setup guide before reading it.";
  return null;
}

function bme680SupportWarning(capabilities: DataSourceCapabilities | null) {
  if (!capabilities?.sensors?.enabled || capabilities.sensors.available === false) return null;
  const supportedSensors = capabilities.sensors.supportedSensors;
  if (!supportedSensors || supportedSensors.includes("bme680")) return null;
  return "The sensor helper is not reporting BME680 support yet. Re-run the installer with ENABLE_SENSORS=true or install the PyPI bme680 module in /opt/integritas-pi/.venv-sensor-helper, then restart the sensor helper.";
}

export function LocalServicesCard({ capabilities }: { capabilities: DataSourceCapabilities | null }) {
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
          <Pill tone={broker?.enabled ? "good" : "neutral"} indicator>{broker?.enabled ? "Enabled" : "Disabled"}</Pill>
        </div>
        <p className="type-body text-text-secondary mt-detail-next m-0">Connection details for the local MQTT broker, so devices can connect directly to this Pi without a separate broker.</p>
      </div>
      <div className="gap-detail-close grid md:grid-cols-2">
        <CopyField label="LAN URL" value={lanUrl} description="Use this from external devices on the LAN." />
        <CopyField label="Internal URL" value={internalUrl} description="Use this in Integritas Pi MQTT device configs." />
      </div>
      {!broker?.enabled && (
        <div>
          <p className="type-meta text-text-tertiary m-0">Enable with</p>
          <p className="type-body text-text-secondary mt-detail-tight m-0"><code>ENABLE_MQTT_BROKER=true</code> and the Docker Compose MQTT profile.</p>
        </div>
      )}
    </Card>
  );
}
