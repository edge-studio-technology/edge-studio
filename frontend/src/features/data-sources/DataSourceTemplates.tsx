import {
  Camera,
  Cpu,
  Globe2,
  Lightbulb,
  Settings2,
  Radio,
  ShieldAlert,
  ThermometerSun,
  Webhook,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Modal } from "../../components/Modal";
import { ErrorAlert } from "../../components/patterns/ErrorAlert";
import { CopyField } from "../../components/patterns/CopyField";
import { Pill } from "../../components/Pill";
import type { DataSourceCapabilities, DataSourceTemplate, HostCapability } from "./dataSourceTypes";

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
    title: "Device System Data",
    description: "Read local device specs, performance, network status, and coarse locale data",
    type: "device-system-data",
    config: {
      includeSpecs: true,
      includePerformance: true,
      includeNetwork: true,
      includeLocation: true,
    },
  },
  {
    title: "Raspberry Pi Camera",
    description: "Capture photos or short video clips from workflows",
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
    description: "Low-current LED output target controlled by workflows",
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
    description: "Send JSON commands to an HTTP endpoint from workflows",
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
    description: "Publish JSON commands to a broker topic from workflows",
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
  if (template.type === "device-system-data") return Cpu;
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

export function activeInputTemplates(
  capabilities: DataSourceCapabilities | null,
  hostCapabilities: HostCapability[] = [],
) {
  return inputTemplates.filter((template) => isTemplateActive(template, capabilities, hostCapabilities));
}

export function activeOutputTemplates(
  capabilities: DataSourceCapabilities | null,
  hostCapabilities: HostCapability[] = [],
) {
  return outputTemplates.filter((template) => isTemplateActive(template, capabilities, hostCapabilities));
}

function isTemplateActive(
  template: DataSourceTemplate,
  capabilities: DataSourceCapabilities | null,
  hostCapabilities: HostCapability[],
) {
  const camera = hostCapabilities.find((capability) => capability.name === "camera");
  if (template.type === "pi-camera") return Boolean(camera?.enabled ?? capabilities?.camera?.enabled);
  if (template.type === "bme-sensor") return Boolean(capabilities?.sensors?.enabled);
  if (template.type === "gpio-input" || template.type === "gpio-output") {
    return Boolean(capabilities?.gpioInput.available);
  }
  return true;
}

export function LocalServicesCard({
  capabilities,
  hostCapabilities = [],
  busy = false,
  onEnableCamera,
  onDisableCamera,
}: {
  capabilities: DataSourceCapabilities | null;
  hostCapabilities?: HostCapability[];
  busy?: boolean;
  onEnableCamera?: () => Promise<void>;
  onDisableCamera?: () => Promise<void>;
}) {
  const [managerOpen, setManagerOpen] = useState(false);
  const broker = capabilities?.mqttBroker;
  const camera = hostCapabilities.find((capability) => capability.name === "camera");
  const browserHost = typeof window === "undefined" ? "<pi-host-or-ip>" : window.location.hostname;
  const publicHost = broker?.publicHost || browserHost || "<pi-host-or-ip>";
  const publicPort = broker?.publicPort ?? 1883;
  const lanUrl = `mqtt://${publicHost}:${publicPort}`;
  const internalUrl = broker?.internalUrl ?? "mqtt://mqtt:1883";

  return (
    <Card className="gap-detail-near grid w-full">
      <div>
        <div className="gap-detail-close flex flex-wrap items-center justify-between">
          <div className="gap-detail-close flex flex-wrap items-center">
            <h2 className="type-title text-text-primary m-0">Hardware support</h2>
            <Pill tone={camera?.enabled || broker?.enabled ? "good" : "neutral"} indicator>
              {camera?.enabled || broker?.enabled ? "Some enabled" : "Disabled"}
            </Pill>
          </div>
          <Button
            type="button"
            variant="secondary"
            iconStart={<Settings2 aria-hidden />}
            onClick={() => setManagerOpen(true)}
          >
            Enable / disable hardware
          </Button>
        </div>
        <p className="type-body text-text-secondary mt-detail-next m-0">
          Host-backed hardware and local services available to device workflows on this Pi.
        </p>
      </div>
      <div className="gap-detail-close grid md:grid-cols-2">
        <HardwareStatus label="Camera" capability={camera} fallback="Camera support is disabled." />
        <HardwareStatus
          label="I2C sensors"
          enabled={capabilities?.sensors?.enabled}
          available={capabilities?.sensors?.available}
          reason={capabilities?.sensors?.reason ?? "Sensor support is disabled."}
        />
        <HardwareStatus
          label="GPIO"
          enabled={capabilities?.gpioInput.available}
          available={capabilities?.gpioInput.available}
          reason={capabilities?.gpioInput.reason ?? null}
        />
        <HardwareStatus
          label="Local MQTT broker"
          enabled={broker?.enabled}
          available={broker?.enabled}
          reason={broker?.enabled ? null : "Local broker is disabled."}
        />
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
          description="Use this in Edge Studio MQTT device configs."
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
      {managerOpen && (
        <Modal title="Enable / disable hardware" onClose={() => setManagerOpen(false)}>
          <div className="gap-detail-near grid">
            <HardwareActionRow
              title="Raspberry Pi Camera"
              description="Install or disable the host camera helper used by camera capture workflows."
              capability={camera}
              busy={busy}
              onEnable={onEnableCamera}
              onDisable={onDisableCamera}
            />
            <ErrorAlert status="warning" className="max-w-none">
              Sensor, GPIO, and local broker toggles will use this same host-agent path later. For now,
              only camera support can be changed from the app.
            </ErrorAlert>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function HardwareStatus({
  label,
  capability,
  enabled,
  available,
  reason,
  fallback,
}: {
  label: string;
  capability?: HostCapability;
  enabled?: boolean;
  available?: boolean;
  reason?: string | null;
  fallback?: string;
}) {
  const isEnabled = capability?.enabled ?? enabled ?? false;
  const isAvailable = capability?.available ?? available ?? false;
  return (
    <div className="border-border-subtle rounded-card-inner gap-detail-tight grid border p-pad-tight">
      <div className="gap-detail-close flex items-center justify-between">
        <p className="type-body-em text-text-primary m-0">{label}</p>
        <Pill tone={isAvailable ? "good" : isEnabled ? "warn" : "neutral"} indicator>
          {isAvailable ? "Available" : isEnabled ? "Needs attention" : "Disabled"}
        </Pill>
      </div>
      <p className="type-meta text-text-tertiary m-0">
        {isAvailable ? "Ready for device workflows." : capability?.reason ?? reason ?? fallback}
      </p>
    </div>
  );
}

function HardwareActionRow({
  title,
  description,
  capability,
  busy,
  onEnable,
  onDisable,
}: {
  title: string;
  description: string;
  capability?: HostCapability;
  busy: boolean;
  onEnable?: () => Promise<void>;
  onDisable?: () => Promise<void>;
}) {
  const enabled = capability?.enabled ?? false;
  return (
    <div className="border-border-subtle rounded-card-inner gap-detail-close grid border p-pad-tight">
      <div className="gap-detail-close flex flex-wrap items-center justify-between">
        <div>
          <p className="type-body-em text-text-primary m-0">{title}</p>
          <p className="type-body text-text-secondary mt-detail-tight m-0">{description}</p>
        </div>
        <Button
          type="button"
          variant={enabled ? "secondary" : "primary"}
          disabled={busy || (!onEnable && !onDisable)}
          onClick={() => void (enabled ? onDisable?.() : onEnable?.())}
        >
          {enabled ? "Disable" : "Enable"}
        </Button>
      </div>
      {capability?.reason && <p className="type-meta text-text-tertiary m-0">{capability.reason}</p>}
    </div>
  );
}
