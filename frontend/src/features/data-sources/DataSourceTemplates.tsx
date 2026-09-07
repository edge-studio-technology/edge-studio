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
import { isTemplateActiveByCapability } from "./hardwareCapabilities";

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
    description: "Read temperature, humidity, air pressure, and gas resistance from a BME680 I2C module",
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
  return isTemplateActiveByCapability(template, capabilities, hostCapabilities);
}

export function LocalServicesCard({
  capabilities,
  hostCapabilities = [],
  busy = false,
  onEnableCamera,
  onDisableCamera,
  onEnableGpio,
  onDisableGpio,
  onEnableSensors,
  onDisableSensors,
  onEnableMqtt,
  onDisableMqtt,
  onRefreshHardware,
}: {
  capabilities: DataSourceCapabilities | null;
  hostCapabilities?: HostCapability[];
  busy?: boolean;
  onEnableCamera?: () => Promise<void>;
  onDisableCamera?: () => Promise<void>;
  onEnableGpio?: () => Promise<void>;
  onDisableGpio?: () => Promise<void>;
  onEnableSensors?: () => Promise<void>;
  onDisableSensors?: () => Promise<void>;
  onEnableMqtt?: () => Promise<void>;
  onDisableMqtt?: () => Promise<void>;
  onRefreshHardware?: () => Promise<void>;
}) {
  const [managerOpen, setManagerOpen] = useState(false);
  const broker = capabilities?.mqttBroker;
  const camera = hostCapabilities.find((capability) => capability.name === "camera");
  const gpio = hostCapabilities.find((capability) => capability.name === "gpio");
  const sensors = hostCapabilities.find((capability) => capability.name === "sensors");
  const mqtt = hostCapabilities.find((capability) => capability.name === "mqtt");
  const browserHost = typeof window === "undefined" ? "<pi-host-or-ip>" : window.location.hostname;
  const publicHost = broker?.publicHost || browserHost || "<pi-host-or-ip>";
  const publicPort = mqtt?.publicPort ?? broker?.publicPort ?? 1883;
  const lanUrl = `mqtt://${publicHost}:${publicPort}`;
  const internalUrl = mqtt?.internalUrl ?? broker?.internalUrl ?? "mqtt://mqtt:1883";
  const anyEnabled = Boolean(camera?.enabled || gpio?.enabled || sensors?.enabled || mqtt?.enabled || broker?.enabled);

  return (
    <Card className="gap-detail-near grid w-full">
      <div>
        <div className="gap-detail-close flex flex-wrap items-center justify-between">
          <div className="gap-detail-close flex flex-wrap items-center">
            <h2 className="type-title text-text-primary m-0">Hardware support</h2>
            <Pill tone={anyEnabled ? "good" : "neutral"} indicator>
              {anyEnabled ? "Some enabled" : "Disabled"}
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
        <HardwareStatus label="Camera" capability={camera} fallback="Camera support is disabled. Enable it from Devices -> Hardware support." />
        <HardwareStatus label="I2C sensors" capability={sensors} fallback="I2C sensor support is disabled. Enable it from Devices -> Hardware support." />
        <HardwareStatus label="GPIO" capability={gpio} fallback="GPIO support is disabled. Enable it from Devices -> Hardware support." />
        <HardwareStatus label="Local MQTT broker" capability={mqtt} fallback="Local MQTT broker is disabled. Enable it from Devices -> Hardware support." />
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
          <p className="type-meta text-text-tertiary m-0">Advanced install shortcut</p>
          <p className="type-body text-text-secondary mt-detail-tight m-0">
            <code>ENABLE_MQTT_BROKER=true</code> and the Docker Compose MQTT profile.
          </p>
        </div>
      )}
      {managerOpen && (
        <Modal title="Enable / disable hardware" onClose={() => setManagerOpen(false)}>
          <div className="gap-detail-near grid">
            <div className="gap-detail-close flex flex-wrap items-center justify-between">
              <p className="type-body text-text-secondary m-0">
                Enable, repair, or disable app-managed hardware support on this Pi.
              </p>
              <Button type="button" variant="secondary" disabled={busy || !onRefreshHardware} onClick={() => void onRefreshHardware?.()}>
                Refresh hardware status
              </Button>
            </div>
            <HardwareActionRow
              title="Raspberry Pi Camera"
              description="Install or disable the host camera helper used by camera capture workflows."
              capability={camera}
              busy={busy}
              onEnable={onEnableCamera}
              onDisable={onDisableCamera}
              onRefreshHardware={onRefreshHardware}
            />
            <HardwareActionRow
              title="GPIO"
              description="Grant the backend container access to /dev/gpiochip0 for GPIO input and output workflows."
              capability={gpio}
              busy={busy}
              onEnable={onEnableGpio}
              onDisable={onDisableGpio}
              onRefreshHardware={onRefreshHardware}
            />
            <HardwareActionRow
              title="Local MQTT broker"
              description="Enable or stop the app-managed Mosquitto broker for local MQTT devices."
              capability={mqtt}
              busy={busy}
              onEnable={onEnableMqtt}
              onDisable={onDisableMqtt}
              onRefreshHardware={onRefreshHardware}
            />
            <HardwareActionRow
              title="I2C sensors"
              description="Install or disable the host sensor helper used by BME280/BME680 I2C sensor reads."
              capability={sensors}
              busy={busy}
              onEnable={onEnableSensors}
              onDisable={onDisableSensors}
              onRefreshHardware={onRefreshHardware}
            />
            <ErrorAlert status="warning" className="max-w-none">
              Optional hardware starts disabled by default. Host-agent actions update Edge Studio service configuration only. Prerequisite commands shown here assume Raspberry Pi OS or another Debian-based Pi image.
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
          {capability?.state === "missing_prerequisites"
            ? "Action required"
            : isAvailable
              ? "Available"
              : isEnabled
                ? "Needs attention"
                : "Disabled"}
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
  onRefreshHardware,
}: {
  title: string;
  description: string;
  capability?: HostCapability;
  busy: boolean;
  onEnable?: () => Promise<void>;
  onDisable?: () => Promise<void>;
  onRefreshHardware?: () => Promise<void>;
}) {
  const enabled = capability?.enabled ?? false;
  const available = capability?.available ?? false;
  const missingPrerequisites = capability?.state === "missing_prerequisites";
  const needsRepair = enabled && !available && !missingPrerequisites;
  const actionLabel = missingPrerequisites && !enabled ? "Action required" : needsRepair ? "Repair" : enabled ? "Disable" : "Enable";
  const action = needsRepair || (!enabled && !missingPrerequisites) ? onEnable : enabled ? onDisable : undefined;
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
          disabled={busy || !action}
          onClick={() => void action?.()}
        >
          {actionLabel}
        </Button>
      </div>
      {capability?.reason && <p className="type-meta text-text-tertiary m-0">{capability.reason}</p>}
      <HardwarePrerequisites capability={capability} busy={busy} onRefreshHardware={onRefreshHardware} />
    </div>
  );
}

function HardwarePrerequisites({ capability, busy, onRefreshHardware }: { capability?: HostCapability; busy: boolean; onRefreshHardware?: () => Promise<void> }) {
  if (!capability) return null;
  const guidance = capability ? prerequisiteGuidance[capability.name] : null;
  if (!guidance) return null;
  const isBlocking = capability.state === "missing_prerequisites";
  if (!isBlocking) return null;
  return (
    <div className="border-border-subtle bg-surface-subtle rounded-card-inner gap-detail-tight grid border p-pad-tight">
      <div className="gap-detail-close flex flex-wrap items-center justify-between">
        <p className="type-body-em text-text-primary m-0">Prerequisites for Raspberry Pi OS</p>
        <Pill tone="warn">Action needed</Pill>
      </div>
      <p className="type-meta text-text-tertiary m-0">
        Edge Studio manages its own helper services and app configuration in this version. Raspberry Pi OS interfaces and packages must be enabled on the host first.
      </p>
      <p className="type-meta text-text-tertiary m-0">
        These steps assume Raspberry Pi OS or another Debian-based Pi image. Other Linux distributions may use different package names or setup tools.
      </p>
      <div className="gap-detail-tight grid">
        {guidance.map((item) => (
          <CopyField key={item.label} label={item.label} value={item.command} description={item.description} />
        ))}
      </div>
      <Button type="button" variant="secondary" disabled={busy || !onRefreshHardware} onClick={() => void onRefreshHardware?.()}>
        I have completed this, refresh now
      </Button>
    </div>
  );
}

type PrerequisiteCommand = { label: string; command: string; description: string };

const prerequisiteGuidance: Partial<Record<HostCapability["name"], PrerequisiteCommand[]>> = {
  camera: [
    {
      label: "Install camera tools",
      command: "sudo apt-get update\nsudo apt-get install -y rpicam-apps",
      description: "Run on the Pi host if rpicam-still or libcamera-still is missing.",
    },
    {
      label: "Check camera detection",
      command: "rpicam-still --list-cameras",
      description: "Run after connecting and enabling the camera hardware.",
    },
  ],
  gpio: [
    {
      label: "Check GPIO device",
      command: "ls -l /dev/gpiochip0",
      description: "GPIO support requires this host device to exist on the Pi.",
    },
  ],
  sensors: [
    {
      label: "Enable I2C interface",
      command: "sudo raspi-config",
      description: "Open Interface Options -> I2C -> Enable, then reboot if prompted.",
    },
    {
      label: "Install I2C tools",
      command: "sudo apt-get update\nsudo apt-get install -y python3-smbus i2c-tools",
      description: "Run if Python SMBus support or I2C tools are missing.",
    },
    {
      label: "Check I2C device",
      command: "ls -l /dev/i2c-1",
      description: "Run after enabling I2C and rebooting the Pi.",
    },
  ],
  mqtt: [
    {
      label: "Check Compose services",
      command: "cd /opt/edge-studio\ndocker compose config --services\ndocker compose ps mqtt",
      description: "Run if Docker Compose or the local mqtt service is not available.",
    },
  ],
};
