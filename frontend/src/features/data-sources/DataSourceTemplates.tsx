import {
  Camera,
  Check,
  Copy as CopyIcon,
  Cpu,
  Globe2,
  Lightbulb,
  RefreshCw,
  Settings2,
  Radio,
  ShieldAlert,
  ThermometerSun,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Modal } from "../../components/Modal";
import { ErrorAlert } from "../../components/patterns/ErrorAlert";
import { Pill } from "../../components/Pill";
import { Disclosure } from "../../components/ui/Disclosure";
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
  const [selectedHardware, setSelectedHardware] = useState<HostCapability["name"]>("camera");
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
  const hardwareItems: HardwareItem[] = [
    {
      name: "camera",
      label: "Camera",
      title: "Raspberry Pi Camera",
      description: "Install or disable the host camera helper used by camera capture workflows.",
      icon: Camera,
      capability: camera,
      onEnable: onEnableCamera,
      onDisable: onDisableCamera,
    },
    {
      name: "gpio",
      label: "GPIO",
      title: "GPIO",
      description: "Grant the backend container access to /dev/gpiochip0 for GPIO input and output workflows.",
      icon: Lightbulb,
      capability: gpio,
      onEnable: onEnableGpio,
      onDisable: onDisableGpio,
    },
    {
      name: "mqtt",
      label: "MQTT",
      title: "Local MQTT broker",
      description: "Enable or stop the app-managed Mosquitto broker for local MQTT devices.",
      icon: Radio,
      capability: mqtt,
      onEnable: onEnableMqtt,
      onDisable: onDisableMqtt,
    },
    {
      name: "sensors",
      label: "I2C sensors",
      title: "I2C sensors",
      description: "Install or disable the host sensor helper used by BME280/BME680 I2C sensor reads.",
      icon: ThermometerSun,
      capability: sensors,
      onEnable: onEnableSensors,
      onDisable: onDisableSensors,
    },
  ];
  const enabledCount = hardwareItems.filter((item) => item.capability?.enabled || (item.name === "mqtt" && broker?.enabled)).length;
  const selectedItem = hardwareItems.find((item) => item.name === selectedHardware) ?? hardwareItems[0];

  function openHardwareManager(name: HostCapability["name"]) {
    setSelectedHardware(name);
    setManagerOpen(true);
  }

  return (
    <Card className="gap-detail-near grid w-full">
      <div>
        <div className="gap-detail-close flex flex-wrap items-center justify-between">
          <div className="gap-detail-close flex flex-wrap items-center">
            <h2 className="type-title text-text-primary m-0">Hardware support</h2>
            <Pill tone={enabledCount > 0 ? "good" : "neutral"} indicator>
              {enabledCount} of {hardwareItems.length} enabled
            </Pill>
          </div>
          <Button
            type="button"
            variant="secondary"
            iconStart={<Settings2 aria-hidden />}
            onClick={() => setManagerOpen(true)}
          >
            Manage hardware
          </Button>
        </div>
        <p className="type-body text-text-secondary mt-detail-next m-0">
          Host-backed hardware and local services available to device workflows on this Pi.
        </p>
      </div>
      <div className="gap-detail-close flex flex-wrap">
        {hardwareItems.map((item) => (
          <HardwareStatusChip key={item.name} item={item} onClick={() => openHardwareManager(item.name)} />
        ))}
      </div>
      {managerOpen && (
        <Modal title="Hardware support" onClose={() => setManagerOpen(false)}>
          <div className="gap-detail-near grid">
            <div className="gap-detail-close flex flex-wrap items-center justify-between">
              <p className="type-body text-text-secondary m-0">
                Enable, repair, or disable app-managed hardware support on this Pi.
              </p>
              <Button type="button" variant="secondary" iconStart={<RefreshCw aria-hidden />} disabled={busy || !onRefreshHardware} onClick={() => void onRefreshHardware?.()}>
                Refresh status
              </Button>
            </div>
            <div className="gap-detail-next grid md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="gap-detail-tight flex overflow-x-auto pb-detail-tight md:grid md:overflow-visible md:pb-0">
                {hardwareItems.map((item) => (
                  <HardwareManagerNavItem
                    key={item.name}
                    item={item}
                    selected={item.name === selectedItem.name}
                    onClick={() => setSelectedHardware(item.name)}
                  />
                ))}
              </div>
              <HardwareDetailPanel
                item={selectedItem}
                busy={busy}
                lanUrl={lanUrl}
                internalUrl={internalUrl}
                onRefreshHardware={onRefreshHardware}
              />
            </div>
            <ErrorAlert status="warning" className="max-w-none py-detail-tight">
              Optional hardware starts disabled by default. Edge Studio changes app service configuration only; OS interfaces and packages stay operator-managed.
            </ErrorAlert>
          </div>
        </Modal>
      )}
    </Card>
  );
}

type HardwareItem = {
  name: HostCapability["name"];
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  capability?: HostCapability;
  onEnable?: () => Promise<void>;
  onDisable?: () => Promise<void>;
};

function HardwareStatusChip({ item, onClick }: { item: HardwareItem; onClick: () => void }) {
  const status = hardwareStatus(item.capability);
  const Icon = item.icon;
  return (
    <button
      type="button"
      className="border-stroke-secondary bg-surface-primary hover:border-stroke-primary gap-detail-tight rounded-soft flex min-w-[150px] flex-1 items-center border p-pad-tight text-left transition-colors"
      aria-label={`${item.label}: ${status.label}`}
      onClick={onClick}
    >
      <span className="bg-surface-secondary text-text-secondary grid size-9 shrink-0 place-items-center rounded-full">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-body-em text-text-primary block">{item.label}</span>
        <span className="type-meta text-text-tertiary gap-detail-tight flex items-center">
          <StatusDot status={status.kind} />
          {status.label}
        </span>
      </span>
    </button>
  );
}

function HardwareManagerNavItem({
  item,
  selected,
  onClick,
}: {
  item: HardwareItem;
  selected: boolean;
  onClick: () => void;
}) {
  const status = hardwareStatus(item.capability);
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={`gap-detail-tight rounded-soft flex min-w-[180px] items-center border p-pad-tight text-left transition-colors md:min-w-0 ${
        selected
          ? "border-stroke-primary bg-surface-secondary"
          : "border-stroke-secondary bg-surface-primary hover:border-stroke-primary"
      }`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <Icon aria-hidden className="text-text-secondary size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="type-body-em text-text-primary block">{item.label}</span>
        <span className="type-meta text-text-tertiary gap-detail-tight flex items-center">
          <StatusDot status={status.kind} />
          {status.label}
        </span>
      </span>
    </button>
  );
}

function HardwareDetailPanel({
  item,
  busy,
  lanUrl,
  internalUrl,
  onRefreshHardware,
}: {
  item: HardwareItem;
  busy: boolean;
  lanUrl: string;
  internalUrl: string;
  onRefreshHardware?: () => Promise<void>;
}) {
  const capability = item.capability;
  const status = hardwareStatus(capability);
  const action = hardwareAction(item);
  const Icon = item.icon;
  return (
    <section className="border-stroke-secondary bg-surface-primary rounded-soft grid overflow-hidden border" aria-label={`${item.title} details`}>
      <div className="gap-detail-close flex items-start justify-between px-detail-close py-detail-next">
        <div className="gap-detail-tight flex min-w-0 items-start">
          <span className="bg-surface-secondary text-text-secondary mt-[2px] grid size-8 shrink-0 place-items-center rounded-full">
            <Icon aria-hidden className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="gap-detail-tight flex flex-wrap items-center">
              <h3 className="type-body-em text-text-primary m-0">{item.title}</h3>
              <Pill tone={status.tone} indicator>{status.label}</Pill>
            </div>
            <p className="type-meta text-text-secondary mt-detail-tight m-0">{hardwareStateSummary(item, status.label)}</p>
          </div>
        </div>
        <Button
          type="button"
          variant={action.variant}
          size="sm"
          disabled={busy || !action.onClick}
          onClick={() => void action.onClick?.()}
        >
          {action.label}
        </Button>
      </div>
      {capability?.reason && <CompactReason tone={status.kind === "error" ? "error" : status.kind === "warn" ? "warn" : "neutral"}>{capability.reason}</CompactReason>}
      {item.name === "mqtt" && (
        <div className="grid">
          <CompactCopyRow label="LAN URL" value={lanUrl} description="External devices on the LAN" />
          <CompactCopyRow label="Internal URL" value={internalUrl} description="Edge Studio MQTT configs" />
        </div>
      )}
      <HardwarePrerequisites capability={capability} busy={busy} onRefreshHardware={onRefreshHardware} />
    </section>
  );
}

function hardwareStateSummary(item: HardwareItem, statusLabel: string) {
  if (item.capability?.state === "missing_prerequisites") return "Complete the host setup steps, then refresh status.";
  if (item.capability?.available) return "Ready for device workflows.";
  if (item.capability?.enabled) return "Support is enabled but not currently usable.";
  if (item.name === "mqtt") return "Enable the local broker for MQTT devices and workflows.";
  return item.description;
}

function CompactReason({ children, tone }: { children: string; tone: "neutral" | "warn" | "error" }) {
  const className = {
    neutral: "border-stroke-secondary bg-surface-secondary text-text-secondary",
    warn: "border-stroke-warning bg-feedback-warning/10 text-text-primary",
    error: "border-stroke-error bg-feedback-error/10 text-text-primary",
  }[tone];
  return <p className={`type-meta m-0 border-t px-detail-close py-detail-tight ${className}`}>{children}</p>;
}

function CompactCopyRow({ label, value, description }: { label: string; value: string; description: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail on non-secure origins; the value remains visible for manual copy.
    }
  }

  return (
    <div className="border-stroke-secondary gap-detail-tight grid grid-cols-[92px_minmax(0,1fr)_auto] items-center border-t px-detail-close py-detail-tight">
      <div className="min-w-0">
        <p className="type-meta text-text-primary m-0">{label}</p>
        <p className="type-meta text-text-tertiary m-0">{description}</p>
      </div>
      <code className="type-mono text-text-primary min-w-0 truncate rounded-loose bg-surface-secondary px-detail-tight py-[3px]">{value}</code>
      <Button type="button" variant="ghost" size="sm" iconEnd={copied ? <Check aria-hidden /> : <CopyIcon aria-hidden />} onClick={handleCopy}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function hardwareStatus(capability?: HostCapability): { label: string; kind: "good" | "neutral" | "warn" | "error"; tone: "good" | "neutral" | "warn" | "error" } {
  const enabled = capability?.enabled ?? false;
  const available = capability?.available ?? false;
  if (capability?.state === "missing_prerequisites") return { label: "Action required", kind: "warn", tone: "warn" };
  if (available) return { label: "Available", kind: "good", tone: "good" };
  if (enabled) return { label: "Needs repair", kind: "error", tone: "error" };
  return { label: "Disabled", kind: "neutral", tone: "neutral" };
}

function hardwareAction(item: HardwareItem): { label: string; variant: "primary" | "secondary"; onClick?: () => Promise<void> } {
  const capability = item.capability;
  const enabled = capability?.enabled ?? false;
  const available = capability?.available ?? false;
  const missingPrerequisites = capability?.state === "missing_prerequisites";
  const needsRepair = enabled && !available && !missingPrerequisites;
  if (missingPrerequisites && !enabled) return { label: "Action required", variant: "primary" };
  if (needsRepair) return { label: "Repair", variant: "primary", onClick: item.onEnable };
  if (enabled) return { label: "Disable", variant: "secondary", onClick: item.onDisable };
  return { label: "Enable", variant: "primary", onClick: item.onEnable };
}

function StatusDot({ status }: { status: "good" | "neutral" | "warn" | "error" }) {
  const className = {
    good: "bg-feedback-positive",
    neutral: "bg-grey-04",
    warn: "bg-feedback-warning",
    error: "bg-feedback-error",
  }[status];
  return <span aria-hidden className={`inline-block size-2 rounded-full ${className}`} />;
}

function HardwarePrerequisites({ capability, busy, onRefreshHardware }: { capability?: HostCapability; busy: boolean; onRefreshHardware?: () => Promise<void> }) {
  if (!capability) return null;
  const guidance = capability ? prerequisiteGuidance[capability.name] : null;
  if (!guidance) return null;
  const isBlocking = capability.state === "missing_prerequisites";
  if (!isBlocking) return null;
  return (
    <Disclosure
      title={
        <span className="gap-detail-close flex flex-wrap items-center">
          <span>Setup steps</span>
          <Pill tone="warn">Action needed</Pill>
        </span>
      }
      defaultOpen={false}
      className="border-stroke-secondary bg-surface-primary border-t p-0"
      summaryClassName="px-detail-close py-detail-next"
      contentClassName="gap-detail-tight grid pb-detail-next"
    >
      <p className="type-meta text-text-tertiary m-0 px-detail-close">
        Enable the required Raspberry Pi OS interface or package on the host, then refresh status.
      </p>
      <div className="grid">
        {guidance.map((item) => (
          <CompactCopyRow key={item.label} label={item.label} value={item.command} description={item.description} />
        ))}
      </div>
      <div className="px-detail-close">
        <Button type="button" variant="secondary" size="sm" disabled={busy || !onRefreshHardware} onClick={() => void onRefreshHardware?.()}>
          I have completed this, refresh now
        </Button>
      </div>
    </Disclosure>
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
      label: "Reboot the Pi",
      command: "sudo reboot",
      description: "Run after enabling I2C if /dev/i2c-1 is still missing or raspi-config prompts for a reboot.",
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
