import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, IconButton } from "../../components/Button";
import { DetailList, DetailRow } from "../../components/patterns/DetailList";
import { useToast } from "../../components/ToastProvider";
import { Disclosure } from "../../components/ui/Disclosure";
import piGpioPinoutUrl from "../../assets/pi-gpio-pinout.svg";
import type { AutomationBlock, AutomationBlockType } from "../automation/automationTypes";
import type { DataSource } from "./dataSourceTypes";

type GuideSection = {
  title: string;
  body?: string;
  items?: string[];
  table?: Array<[string, string]>;
  commands?: string;
  schematic?: "pi-gpio";
};

type GuideWorkflowBlock = {
  type: AutomationBlockType;
  config?: AutomationBlock["config"];
  enabled?: boolean;
  parentBlockId?: string | null;
  clientId?: string | null;
};

export type DeviceGuideWorkflowInput = {
  name: string;
  enabled: boolean;
  blocks: GuideWorkflowBlock[];
};

export type DeviceGuideAction = {
  key: string;
  label: string;
  description?: string;
  kind: "create_workflow";
  workflow: (source: DataSource) => DeviceGuideWorkflowInput;
};

export type DeviceSetupGuide = {
  title: string;
  intro: string;
  sections: GuideSection[];
  docPath?: string;
  actions?: DeviceGuideAction[];
};

export function hasDeviceSetupGuide(source: DataSource) {
  return Boolean(getDeviceSetupGuide(source));
}

export function getDeviceSetupGuide(source: DataSource): DeviceSetupGuide | null {
  if (source.type === "mqtt" && source.config.profile === "esp32-mqtt-board")
    return guide(
      source,
      "ESP32 MQTT Board Setup Guide",
      "Flash starter firmware, connect the board to Wi-Fi, publish JSON over MQTT, then use an MQTT event workflow.",
      [],
      "docs/guides/esp32-mqtt-sensors.md",
    );
  if (source.type === "gpio-input" && source.config.profile === "pir-motion")
    return pirGuide(source);
  if (source.type === "gpio-input") return gpioInputGuide(source);
  if (source.type === "gpio-output") return gpioLedGuide(source);
  if (source.type === "bme-sensor") return bmeSensorGuide(source);
  if (source.type === "device-system-data") return deviceSystemDataGuide(source);
  if (source.type === "pi-camera") return piCameraGuide(source);
  if (source.type === "json-api")
    return httpJsonSourceGuide(source);
  if (source.type === "webhook") return webhookGuide(source);
  if (source.type === "mqtt") return mqttSubscriberGuide(source);
  if (source.type === "http-output") return httpJsonTargetGuide(source);
  if (source.type === "mqtt-output") return mqttPublisherGuide(source);
  return null;
}

export function StandardDeviceSetupGuide({
  source,
  createdWorkflowIds,
  runningActionKey,
  onAction,
  onGoToWorkflow,
}: {
  source: DataSource;
  createdWorkflowIds?: Record<string, string>;
  runningActionKey?: string | null;
  onAction?: (action: DeviceGuideAction) => void;
  onGoToWorkflow?: (workflowId: string) => void;
}) {
  const setupGuide = getDeviceSetupGuide(source);
  if (!setupGuide) return null;
  const tableSections = setupGuide.sections.filter(isTableOnlySection);
  const otherSections = setupGuide.sections.filter((section) => !isTableOnlySection(section));
  return (
    <DeviceSetupGuideShell guide={setupGuide}>
      {tableSections.map((section) => (
        <DetailList key={section.title}>
          {section.table!.map(([label, value]) => (
            <DetailRow key={label} label={label} value={value} mono />
          ))}
        </DetailList>
      ))}
      <div className="flex flex-col gap-4 pb-2 pl-2">
        {otherSections.map((section) => (
          <GuideSectionCard key={section.title} section={section} />
        ))}
        {setupGuide.actions && setupGuide.actions.length > 0 && (
          <GuideActions
            actions={setupGuide.actions}
            createdWorkflowIds={createdWorkflowIds}
            runningActionKey={runningActionKey}
            onAction={onAction}
            onGoToWorkflow={onGoToWorkflow}
          />
        )}
      </div>
    </DeviceSetupGuideShell>
  );
}

function isTableOnlySection(section: GuideSection) {
  return (
    Boolean(section.table) &&
    !section.body &&
    !section.items &&
    !section.commands &&
    !section.schematic
  );
}

export function DeviceSetupGuideShell({
  guide,
  children,
}: {
  guide: DeviceSetupGuide;
  children: ReactNode;
}) {
  return (
    <div className="gap-detail-near grid">
      {children}
      {guide.docPath && (
        <p className="type-body text-text-secondary m-0">
          More detail:{" "}
          <button
            type="button"
            className="type-mono text-text-accent underline decoration-dotted underline-offset-2"
            onClick={() => openExternalDoc(guide.docPath!)}
          >
            {guide.docPath}
          </button>
        </p>
      )}
    </div>
  );
}

function GuideActions({
  actions,
  createdWorkflowIds,
  runningActionKey,
  onAction,
  onGoToWorkflow,
}: {
  actions: DeviceGuideAction[];
  createdWorkflowIds?: Record<string, string>;
  runningActionKey?: string | null;
  onAction?: (action: DeviceGuideAction) => void;
  onGoToWorkflow?: (workflowId: string) => void;
}) {
  return (
    <Disclosure title="Guide actions">
      <div className="gap-detail-tight grid">
        {actions.map((action) => {
          const workflowId = createdWorkflowIds?.[action.key] ?? null;
          return (
            <div
              key={action.key}
              className="border-stroke-secondary bg-surface-always-white rounded-loose p-pad-close gap-detail-close flex flex-wrap items-center justify-between border"
            >
              <div>
                <div className="type-body-em text-text-primary">{action.label}</div>
                {action.description && (
                  <p className="type-body text-text-secondary m-0 mt-1">{action.description}</p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                disabled={workflowId ? !onGoToWorkflow : !onAction || Boolean(runningActionKey)}
                onClick={() => (workflowId ? onGoToWorkflow?.(workflowId) : onAction?.(action))}
              >
                {workflowId
                  ? "Go to workflow"
                  : runningActionKey === action.key
                    ? "Creating..."
                    : action.label}
              </Button>
            </div>
          );
        })}
      </div>
    </Disclosure>
  );
}

function GuideSectionCard({ section }: { section: GuideSection }) {
  const [schematicVisible, setSchematicVisible] = useState(false);
  return (
    <Disclosure title={section.title}>
      {section.body && <p className="type-body text-text-secondary m-0">{section.body}</p>}
      {section.items && (
        <ul className="type-body text-text-secondary gap-detail-tight m-0 grid list-disc pl-5">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {section.table && (
        <DetailList>
          {section.table.map(([label, value]) => (
            <DetailRow key={label} label={label} value={value} mono />
          ))}
        </DetailList>
      )}
      {section.commands && <CommandBlock value={section.commands} />}
      {section.schematic === "pi-gpio" && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="justify-self-start"
          onClick={() => setSchematicVisible((value) => !value)}
        >
          {schematicVisible ? "Hide wiring schematic" : "Show wiring schematic"}
        </Button>
      )}
      {section.schematic === "pi-gpio" && schematicVisible && (
        <div className="border-stroke-secondary bg-surface-always-white rounded-soft p-pad-close overflow-auto border">
          <img
            className="h-auto w-full min-w-190"
            src={piGpioPinoutUrl}
            alt="Raspberry Pi 40-pin GPIO header pinout showing 3V3, 5V, ground, SDA, SCL, and GPIO pins"
          />
        </div>
      )}
    </Disclosure>
  );
}

function openExternalDoc(path: string) {
  const url = `https://github.com/integritas-technology/edge-studio/blob/main/${path}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function CommandBlock({ value }: { value: string }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      showToast({
        tone: "success",
        title: "Copied",
        message: "Commands copied to clipboard.",
        timeoutMs: 2500,
      });
    } catch {
      showToast({
        tone: "error",
        title: "Copy failed",
        message: "Clipboard is unavailable in this context.",
        timeoutMs: 5000,
      });
    }
  }

  return (
    <div className="bg-surface-inverse border-stroke-secondary rounded-soft p-pad-tight relative grid border">
      <pre className="type-mono text-text-inverse m-0 overflow-x-auto pr-10 leading-[1.5] whitespace-pre [tab-size:2]">
        {value}
      </pre>
      <IconButton
        type="button"
        size="compact"
        variant="secondary"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy commands"}
        title={copied ? "Copied" : "Copy commands"}
        className="top-detail-tight right-detail-tight absolute"
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </IconButton>
    </div>
  );
}

function guide(
  source: DataSource,
  title: string,
  intro: string,
  sections: GuideSection[],
  docPath?: string,
  actions?: DeviceGuideAction[],
): DeviceSetupGuide {
  return { title, intro, sections, docPath, actions };
}

function readableSourcePreviewAction(): DeviceGuideAction {
  return {
    key: "create-readable-preview-workflow",
    label: "Create basic workflow for this device",
    description:
      "Adds a disabled manual workflow that reads this device and writes the latest JSON to the Workflow Inbox.",
    kind: "create_workflow",
    workflow: readableSourcePreviewWorkflow,
  };
}

function readableSourcePreviewWorkflow(source: DataSource): DeviceGuideWorkflowInput {
  return {
    name: `${source.name} preview`,
    enabled: false,
    blocks: [
      { type: "manual_start", config: {}, clientId: "start" },
      { type: "fetch_data_source", config: { sourceId: source.id }, clientId: "fetch" },
      {
        type: "show_preview",
        config: {
          title: `${source.name} latest data`,
          previewFormat: "json",
          contentMode: "latest_data",
        },
        clientId: "preview",
      },
    ],
  };
}

function bmeSensorGuide(source: DataSource) {
  const sensorName = source.config.sensor === "bme680" ? "BME680" : "BME280";
  return guide(
    source,
    `${sensorName} Environmental Sensor Setup`,
    `Read temperature, humidity, and air pressure from a ${sensorName} module over the Pi I2C bus.`,
    [
      {
        title: "Requirements",
        items: [
          "Install with ENABLE_SENSORS=true so the host-side sensor helper is running.",
          "Enable I2C on the Raspberry Pi host and reboot if needed.",
          ...(source.config.sensor === "bme680"
            ? [
                "The installer installs the PyPI bme680 module in /opt/edge-studio/.venv-sensor-helper for BME680 reads.",
              ]
            : []),
          "Use address 0x76 first, then try 0x77 if reads fail.",
        ],
      },
      {
        title: "Wiring",
        schematic: "pi-gpio",
        table: [
          ["VIN", "3.3V pin 1 or 5V pin 2/4"],
          ["GND", "GND pin 6/9/etc."],
          ["SCL", "GPIO3 / physical pin 5"],
          ["SDA", "GPIO2 / physical pin 3"],
        ],
      },
      ...(source.config.sensor === "bme680"
        ? [
            {
              title: "BME680 extra pins",
              body: "Many BME680 breakouts expose six pins because the chip can also speak SPI. Basic I2C still uses VIN, GND, SCL, and SDA, but some boards need SDO and CS/CSB set explicitly.",
              table: [
                ["SDO", "Optional I2C address select: GND for 0x76, 3.3V for 0x77"],
                [
                  "CS / CSB",
                  "Tie to 3.3V for I2C mode if your breakout does not already pull it high",
                ],
              ] as Array<[string, string]>,
            },
          ]
        : []),
      {
        title: "Saved settings",
        table: [
          ["Sensor", source.config.sensor ?? "bme280"],
          ["I2C bus", String(source.config.bus ?? 1)],
          ["I2C address", source.config.address ?? "0x76"],
        ],
      },
      {
        title: "Verify",
        items: [
          "Click manual read in Devices and confirm a JSON preview appears.",
          "Use the source in a Workflows Fetch data source block, then attach Stamp data if you want Integritas proofs.",
        ],
      },
    ],
    "docs/guides/bme280-sensor.md",
    [readableSourcePreviewAction()],
  );
}

function deviceSystemDataGuide(source: DataSource) {
  return guide(
    source,
    "Device System Data Setup Guide",
    "Read local system facts from this Raspberry Pi without wiring an external sensor or calling an external API.",
    [
      {
        title: "What gets read",
        items: [
          "Device specs: hostname, OS platform, kernel release, CPU model/count, architecture, and total memory.",
          "Performance: uptime, load average, free memory, total memory, and CPU temperature when the Pi exposes it.",
          "Network: local interface names, IP addresses, address family, CIDR, and whether the address is internal.",
          "Location context: timezone and locale only.",
        ],
      },
      {
        title: "Privacy boundaries",
        items: [
          "This source does not collect public-IP geolocation, GPS coordinates, Wi-Fi SSIDs, Wi-Fi BSSIDs, MAC addresses, or CPU serial numbers.",
          "Network interface IP addresses can still identify the device on your LAN. Review previews before stamping data publicly.",
          "No URL, API key, wiring, helper service, or external endpoint is required.",
        ],
      },
      {
        title: "Saved settings",
        table: [
          ["Specs", source.config.includeSpecs === false ? "Disabled" : "Enabled"],
          ["Performance", source.config.includePerformance === false ? "Disabled" : "Enabled"],
          ["Network", source.config.includeNetwork === false ? "Disabled" : "Enabled"],
          ["Timezone/locale", source.config.includeLocation === false ? "Disabled" : "Enabled"],
        ],
      },
      {
        title: "Verify",
        items: [
          "Click manual read in Devices and confirm a JSON preview/hash appears.",
          "Use Fetch data source in Workflows for manual or scheduled snapshots, then attach Stamp data if you want Integritas proofs.",
        ],
      },
    ],
    undefined,
    [readableSourcePreviewAction()],
  );
}

function gpioInputGuide(source: DataSource) {
  if (source.name.toLowerCase().includes("button")) return gpioButtonGuide(source);
  return guide(
    source,
    "GPIO Input Setup Guide",
    "Record Raspberry Pi BCM pin edge events as JSON while an enabled workflow watches this source.",
    [
      {
        title: "Requirements",
        items: [
          "Install with ENABLE_GPIO=true so /dev/gpiochip0 is available to the backend.",
          "Use BCM pin numbering, not physical header numbering.",
          "Never connect a GPIO input directly to 5V.",
        ],
      },
      {
        title: "Saved settings",
        schematic: "pi-gpio",
        table: [
          ["GPIO chip", source.config.chip ?? "gpiochip0"],
          ["BCM pin", String(source.config.pin ?? "?")],
          ["Pull", source.config.pull ?? "off"],
          ["Edge", source.config.edge ?? "both"],
          ["Active state", source.config.activeState ?? "high"],
        ],
      },
      {
        title: "Verify",
        items: [
          "Create or enable a workflow with Start on GPIO event and this source selected.",
          "Trigger the input and confirm a read-history row appears with the GPIO event payload.",
        ],
      },
    ],
    "docs/guides/gpio-device-settings.md",
  );
}

function gpioButtonGuide(source: DataSource) {
  return guide(
    source,
    "GPIO Button Setup Guide",
    "Detect a simple push button connected to a Raspberry Pi GPIO input pin.",
    [
      {
        title: "Requirements",
        items: [
          "Install with ENABLE_GPIO=true so /dev/gpiochip0 is available to the backend.",
          "Use BCM pin numbering, not physical header numbering.",
          "Never connect a GPIO input directly to 5V.",
        ],
      },
      {
        title: "Typical wiring",
        schematic: "pi-gpio",
        table: [
          ["GPIO", `${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? 17}`],
          ["Button path", "GPIO -> button -> GND"],
          ["Pull", source.config.pull ?? "up"],
          ["Edge", source.config.edge ?? "falling"],
          ["Active state", source.config.activeState ?? "low"],
        ],
      },
      {
        title: "Verify",
        items: [
          "Create or enable a workflow with Start on GPIO event and this source selected.",
          "Press the button and confirm a read-history row appears with an active GPIO event.",
        ],
      },
    ],
    "docs/guides/gpio-device-settings.md",
  );
}

function pirGuide(source: DataSource) {
  return guide(
    source,
    "PIR Motion Sensor Setup Guide",
    "Detect HC-SR501-style motion events from a GPIO input pin.",
    [
      {
        title: "Requirements",
        items: [
          "Install with ENABLE_GPIO=true.",
          "Let the PIR sensor warm up for 60-90 seconds after power-on.",
          "Verify the module output voltage before connecting unknown clones to a Pi GPIO pin.",
        ],
      },
      {
        title: "Tested wiring",
        schematic: "pi-gpio",
        table: [
          ["PIR VCC", "5V"],
          ["PIR GND", "GND"],
          ["PIR OUT", `GPIO${source.config.pin ?? 23} / physical pin 16 for GPIO23`],
        ],
      },
      {
        title: "Recommended workflow",
        items: [
          "Use Start on GPIO event with this source.",
          "Enable Only run when the GPIO event is active to ignore motion_cleared events.",
          "Use a 30-60 second cooldown for noisy motion sensors or notifications.",
        ],
      },
    ],
    "docs/guides/gpio-device-settings.md",
  );
}

function gpioLedGuide(source: DataSource) {
  return guide(
    source,
    "GPIO LED Output Setup Guide",
    "Pulse a low-current LED from Workflows control-output blocks.",
    [
      {
        title: "Requirements",
        items: [
          "Install with ENABLE_GPIO=true.",
          "Use a 220-330 ohm resistor in series with the LED.",
          "Never connect GPIO directly to 5V, motors, relays, or mains voltage.",
        ],
      },
      {
        title: "Typical wiring",
        schematic: "pi-gpio",
        table: [
          ["GPIO", `${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? 18}`],
          ["Active state", source.config.activeState ?? "high"],
          ["Path", "GPIO -> resistor -> LED anode -> LED cathode -> GND"],
        ],
      },
      {
        title: "Verify",
        items: [
          "Use the Test pulse action in Devices before adding it to a workflow.",
          "Use Workflows Control device with Pulse once the LED behaves correctly.",
        ],
      },
    ],
    "docs/guides/gpio-device-settings.md",
  );
}

function piCameraGuide(source: DataSource) {
  return guide(
    source,
    "Raspberry Pi Camera Setup Guide",
    "Capture photos or short video clips from workflows and hash captured media bytes.",
    [
      {
        title: "Requirements",
        items: [
          "Install with ENABLE_CAMERA=true so the host camera helper is running.",
          "Verify the Pi host can see the camera with rpicam-still --list-cameras or libcamera-still --list-cameras.",
          "Place the camera with consent and privacy in mind.",
        ],
      },
      {
        title: "Saved settings",
        table: [
          ["Mode", source.config.mode ?? "photo"],
          ["Resolution", `${source.config.width ?? 1280}x${source.config.height ?? 720}`],
          ["Duration/warmup", `${source.config.durationMs ?? 1000} ms`],
          ["FPS", String(source.config.fps ?? 30)],
        ],
      },
      {
        title: "Use in Workflows",
        items: [
          "Add a Capture camera block and select this camera device.",
          "Attach Stamp data to create an Integritas proof for the captured media hash.",
          "Captured media stays on the Pi under the configured capture directory.",
        ],
      },
    ],
  );
}

function httpJsonSourceGuide(source: DataSource) {
  return guide(
    source,
    "HTTP JSON Source Setup Guide",
    "Fetch JSON from an HTTP endpoint manually or from workflows.",
    [
      {
        title: "Endpoint",
        table: [
          ["Method", source.config.method ?? "GET"],
          ["URL", source.config.url ?? ""],
          ["Health URL", source.config.healthStatusUrl ?? "Not configured"],
        ],
      },
      {
        title: "Requirements",
        items: [
          "The endpoint must return valid JSON.",
          "Use GET for normal reads, or POST when the source requires a request body configured by backend/API paths.",
          "Avoid placing secrets in URLs because they can appear in logs/history.",
        ],
      },
      {
        title: "Verify",
        items: [
          "Click manual read in Devices and confirm a preview/hash appears.",
          "Use Fetch data source in Workflows for scheduled or manual workflow reads.",
        ],
      },
    ],
    undefined,
    [readableSourcePreviewAction()],
  );
}

function webhookGuide(source: DataSource) {
  const url = `${browserOrigin()}/api/data-source-webhooks/${source.config.webhookToken ?? "<token>"}`;
  return guide(
    source,
    "Webhook Receiver Setup Guide",
    "Receive pushed JSON at a generated URL while an enabled workflow listens to this source.",
    [
      {
        title: "Endpoint",
        table: [
          ["URL", url],
          ["Method", "POST"],
          ["Body", "application/json"],
        ],
      },
      {
        title: "Use in Workflows",
        items: [
          "Create or enable a workflow with Webhook received as the start block.",
          "POST JSON to the webhook URL.",
          "The app records the payload only while an enabled workflow exists for this source.",
        ],
      },
      {
        title: "Verify",
        commands: [
          `curl -X POST ${url}`,
          `  -H "Content-Type: application/json"`,
          `  -d '{"event":"test","value":1}'`,
        ].join(" \\\n"),
      },
    ],
  );
}

function mqttSubscriberGuide(source: DataSource) {
  return guide(
    source,
    "MQTT Subscriber Setup Guide",
    "Subscribe to a broker topic and record incoming JSON messages while an enabled workflow listens.",
    [
      {
        title: "Topic",
        table: [
          ["Broker", source.config.brokerUrl ?? ""],
          ["Topic", source.config.topic ?? ""],
        ],
      },
      {
        title: "Use in Workflows",
        items: [
          "Create or enable a workflow with MQTT message received as the start block.",
          "Publish valid JSON to the configured topic.",
          "The backend subscribes only while an enabled workflow exists for this source.",
        ],
      },
      {
        title: "Verify",
        commands: `mosquitto_pub -h <broker-host> -t "${source.config.topic ?? "sensors/example/data"}" -m '{"event":"test","value":1}'`,
      },
    ],
  );
}

function httpJsonTargetGuide(source: DataSource) {
  return guide(
    source,
    "HTTP JSON Target Setup Guide",
    "Send JSON commands to an HTTP endpoint from Workflows Control device blocks.",
    [
      {
        title: "Endpoint",
        table: [
          ["Method", source.config.method ?? "POST"],
          ["URL", source.config.url ?? ""],
          ["Timeout", `${source.config.timeoutMs ?? 5000} ms`],
        ],
      },
      {
        title: "Use in Workflows",
        items: [
          "Add Control device to a workflow and select this target.",
          "Set the JSON body in the workflow block so this target can be reused.",
          "Use Test output in Devices for a basic request before enabling workflows.",
        ],
      },
    ],
  );
}

function mqttPublisherGuide(source: DataSource) {
  return guide(
    source,
    "MQTT Publisher Setup Guide",
    "Publish JSON commands to a broker topic from Workflows Control device blocks.",
    [
      {
        title: "Topic",
        table: [
          ["Broker", source.config.brokerUrl ?? ""],
          ["Topic", source.config.topic ?? ""],
          ["QoS", String(source.config.qos ?? 0)],
          ["Retain", String(source.config.retain ?? false)],
        ],
      },
      {
        title: "Use in Workflows",
        items: [
          "Add Control device to a workflow and select this target.",
          "Set the JSON payload in the workflow block.",
          "Use Test output in Devices to publish a basic test message.",
        ],
      },
    ],
  );
}

function browserOrigin() {
  return typeof window === "undefined" ? "https://<pi-host>:8080" : window.location.origin;
}
