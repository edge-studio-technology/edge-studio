import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, IconButton } from "../../components/Button";
import { DetailList, DetailRow } from "../../components/patterns/DetailList";
import { useToast } from "../../components/ToastProvider";
import piGpioPinoutUrl from "../../assets/header_map_rpi.png";
import type { AutomationBlock, AutomationBlockType } from "../automation/automationTypes";
import type { DataSource } from "./dataSourceTypes";

type GuideSection = {
  title: string;
  description?: string;
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
      [
        {
          title: "Saved settings",
          table: [
            ["Broker", source.config.brokerUrl ?? ""],
            ["Topic", source.config.topic ?? "sensors/esp32/data"],
          ],
        },
      ],
      "docs/guides/esp32-mqtt-sensors.md",
    );
  if (source.type === "gpio-input" && source.config.profile === "pir-motion")
    return pirGuide(source);
  if (source.type === "gpio-input" && source.config.profile === "gpio-button")
    return gpioButtonGuide(source);
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
  return (
    <DeviceGuideWorkspace
      guide={setupGuide}
      createdWorkflowIds={createdWorkflowIds}
      runningActionKey={runningActionKey}
      onAction={onAction}
      onGoToWorkflow={onGoToWorkflow}
    />
  );
}

type GuideTopic =
  | { id: "overview"; title: string }
  | { id: `section:${number}`; title: string; section: GuideSection }
  | { id: "actions"; title: string }
  | { id: "documentation"; title: string };

export function DeviceGuideWorkspace({
  guide,
  createdWorkflowIds,
  runningActionKey,
  onAction,
  onGoToWorkflow,
  overview,
}: {
  guide: DeviceSetupGuide;
  createdWorkflowIds?: Record<string, string>;
  runningActionKey?: string | null;
  onAction?: (action: DeviceGuideAction) => void;
  onGoToWorkflow?: (workflowId: string) => void;
  overview?: ReactNode;
}) {
  const [activeTopicId, setActiveTopicId] = useState<GuideTopic["id"]>("overview");
  const topics: GuideTopic[] = [
    { id: "overview", title: "Overview" },
    ...guide.sections
      .map((section, index) => ({ id: `section:${index}` as const, title: section.title, section })),
    ...(guide.actions?.length ? [{ id: "actions" as const, title: "Guide actions" }] : []),
    ...(guide.docPath ? [{ id: "documentation" as const, title: "Documentation" }] : []),
  ];
  const activeTopic = topics.find((topic) => topic.id === activeTopicId) ?? topics[0];
  const activeTopicIndex = topics.indexOf(activeTopic);

  function selectTopic(index: number) {
    setActiveTopicId(topics[index].id);
  }

  return (
    <section className="grid h-full min-h-0 min-w-0 grid-cols-[240px_minmax(0,1fr)] overflow-hidden">
      <nav className="bg-surface-secondary gap-detail-tight flex min-h-0 flex-col px-detail-next py-pad-close" aria-label="Device guide topics">
        {topics.map((topic) => {
          const active = topic.id === activeTopic.id;
          return (
            <button
              key={topic.id}
              type="button"
              aria-current={active ? "page" : undefined}
              className={`rounded-soft px-detail-next py-detail-tight type-body cursor-pointer text-left transition-colors focus-visible:ring-stroke-active focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${active ? "bg-surface-accent text-text-inverse" : "text-text-secondary hover:bg-surface-primary hover:text-text-primary"}`}
              onClick={() => setActiveTopicId(topic.id)}
            >
              {topic.title}
            </button>
          );
        })}
        <div className="gap-detail-tight mt-auto grid pt-pad-relaxed">
          <Button
            variant="secondary"
            size="sm"
            className="!grid w-full grid-cols-[1rem_1fr_1rem] !border-stroke-primary after:size-4 after:content-['']"
            iconStart={<ChevronUp aria-hidden />}
            disabled={activeTopicIndex === 0}
            onClick={() => selectTopic(activeTopicIndex - 1)}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="!grid w-full grid-cols-[1rem_1fr_1rem] !border-stroke-primary after:size-4 after:content-['']"
            iconStart={<ChevronDown aria-hidden />}
            disabled={activeTopicIndex === topics.length - 1}
            onClick={() => selectTopic(activeTopicIndex + 1)}
          >
            Next
          </Button>
        </div>
      </nav>
      <div className="border-stroke-secondary bg-surface-primary min-h-0 min-w-0 overflow-y-auto border-l px-detail-next pb-pad-close pl-6 pt-pad-tight">
        {activeTopic.id === "overview" && <GuideOverview guide={guide} content={overview} />}
        {"section" in activeTopic && <GuideSectionCard section={activeTopic.section} />}
        {activeTopic.id === "actions" && guide.actions && <GuideActions actions={guide.actions} createdWorkflowIds={createdWorkflowIds} runningActionKey={runningActionKey} onAction={onAction} onGoToWorkflow={onGoToWorkflow} />}
        {activeTopic.id === "documentation" && guide.docPath && <GuideDocumentation docPath={guide.docPath} />}
      </div>
    </section>
  );
}

function GuideOverview({
  guide,
  content,
}: {
  guide: DeviceSetupGuide;
  content?: ReactNode;
}) {
  return (
    <GuideTopic title="Overview" description={guide.intro}>
      <div>
        <h4 className="type-body-em text-text-primary m-0">How to use this guide</h4>
        <p className="type-body text-text-secondary mt-detail-tight m-0">
          Follow the relevant topics in order, then verify the device before using it in a workflow or quick action.
        </p>
      </div>
      {content}
    </GuideTopic>
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
    <GuideTopic
      title="Guide actions"
      description="Create a starter workflow or open one created from this guide."
    >
      <div className="gap-detail-tight grid">
        {actions.map((action) => {
          const workflowId = createdWorkflowIds?.[action.key] ?? null;
          return (
            <div key={action.key} className="gap-detail-near grid justify-items-start">
              {action.description && (
                <p className="type-body text-text-secondary m-0">{action.description}</p>
              )}
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
    </GuideTopic>
  );
}

function GuideSectionCard({ section }: { section: GuideSection }) {
  const [schematicVisible, setSchematicVisible] = useState(false);
  const description = section.description ?? standardSectionDescriptions[section.title];
  return (
    <GuideTopic title={section.title} description={description}>
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
          <a
            className="gap-detail-tight group flex w-full flex-col items-center"
            href={piGpioPinoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open full-size Raspberry Pi GPIO header pinout"
          >
            <img
              className="max-h-72 w-full max-w-160 cursor-zoom-in object-contain"
              src={piGpioPinoutUrl}
              alt="Raspberry Pi 40-pin GPIO header pinout showing 3V3, 5V, ground, SDA, SCL, and GPIO pins"
            />
            <span className="type-meta text-text-secondary group-hover:text-text-primary">Open full-size image</span>
          </a>
        </div>
      )}
    </GuideTopic>
  );
}

function GuideTopic({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="gap-detail-near grid">
      <div>
        <h3 className="type-title text-text-primary m-0">{title}</h3>
        {description && <p className="type-body text-text-secondary mt-detail-tight m-0">{description}</p>}
      </div>
      {children}
    </div>
  );
}

const standardSectionDescriptions: Record<string, string> = {
  Requirements: "Conditions that must be in place before this device can be used.",
  Wiring: "Connections required to use this device safely.",
  "Saved settings": "Configuration currently saved for this device.",
  Verify: "Checks that confirm the device works before it is used in automation.",
  "Workflow use": "How to use this device in an automation workflow.",
};

function GuideDocumentation({ docPath }: { docPath: string }) {
  return (
    <GuideTopic title="Documentation" description="Open the full setup documentation in a new tab.">
      <Button type="button" size="sm" className="justify-self-start" onClick={() => openExternalDoc(docPath)}>
        Open documentation
      </Button>
    </GuideTopic>
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
    source.config.sensor === "bme680"
      ? "Read temperature, humidity, air pressure, and gas resistance from a BME680 module over the Pi I2C bus."
      : "Read temperature, humidity, and air pressure from a BME280 module over the Pi I2C bus.",
    [
      {
        title: "Requirements",
        items: [
          "I2C sensors are enabled in Devices -> Hardware support so the host-side sensor helper is running.",
          "I2C is enabled on the Raspberry Pi host; reboot if /dev/i2c-1 is still missing.",
          ...(source.config.sensor === "bme680"
            ? [
                "Hardware support installs the PyPI bme680 module in /opt/edge-studio/.venv-sensor-helper for BME680 reads.",
              ]
            : []),
          "Default address: 0x76. Try 0x77 if reads fail.",
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
              description: "Additional pins some BME680 breakout boards need for I2C mode.",
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
        description: "The categories of local system data collected by this source.",
        items: [
          "Device specs: hostname, OS platform, kernel release, CPU model/count, architecture, and total memory.",
          "Performance: uptime, load average, free memory, total memory, and CPU temperature when the Pi exposes it.",
          "Network: local interface names, IP addresses, address family, CIDR, and whether the address is internal.",
          "Location context: timezone and locale only.",
        ],
      },
      {
        title: "Privacy boundaries",
        description: "Data this source intentionally excludes and the privacy implications of what remains.",
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
  return guide(
    source,
    "GPIO Input Setup Guide",
    "Record Raspberry Pi BCM pin edge events as JSON while an enabled workflow watches this source.",
    [
      {
        title: "Requirements",
        items: [
          "GPIO is enabled in Devices -> Hardware support so /dev/gpiochip0 is available to the backend.",
          "BCM pin numbering is used instead of physical header numbering.",
          "GPIO inputs are never connected directly to 5V.",
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
          ["Debounce", `${source.config.debounceMs ?? 100} ms`],
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
          "GPIO is enabled in Devices -> Hardware support so /dev/gpiochip0 is available to the backend.",
          "BCM pin numbering is used instead of physical header numbering.",
          "GPIO inputs are never connected directly to 5V.",
        ],
      },
      {
        title: "Wiring",
        schematic: "pi-gpio",
        table: [
          ["GPIO", `${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? 17}`],
          ["Button path", "GPIO -> button -> GND"],
        ],
      },
      {
        title: "Saved settings",
        table: [
          ["GPIO chip", source.config.chip ?? "gpiochip0"],
          ["BCM pin", String(source.config.pin ?? 17)],
          ["Pull", source.config.pull ?? "up"],
          ["Edge", source.config.edge ?? "falling"],
          ["Debounce", `${source.config.debounceMs ?? 100} ms`],
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
          "GPIO is enabled in Devices -> Hardware support.",
          "The PIR sensor has warmed up for 60-90 seconds after power-on.",
          "The module output voltage is verified before an unknown clone is connected to a Pi GPIO pin.",
        ],
      },
      {
        title: "Wiring",
        schematic: "pi-gpio",
        table: [
          ["PIR VCC", "5V"],
          ["PIR GND", "GND"],
          ["PIR OUT", `Configured BCM GPIO${source.config.pin ?? 23}; GPIO23 is physical pin 16 for the default template.`],
        ],
      },
      {
        title: "Saved settings",
        table: [
          ["GPIO chip", source.config.chip ?? "gpiochip0"],
          ["BCM pin", String(source.config.pin ?? 23)],
          ["Pull", source.config.pull ?? "off"],
          ["Edge", source.config.edge ?? "rising"],
          ["Debounce", `${source.config.debounceMs ?? 500} ms`],
          ["Active state", source.config.activeState ?? "high"],
        ],
      },
      {
        title: "Workflow use",
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
          "GPIO is enabled in Devices -> Hardware support.",
          "A 220-330 ohm resistor is installed in series with the LED.",
          "GPIO is never connected directly to 5V, motors, relays, or mains voltage.",
        ],
      },
      {
        title: "Wiring",
        schematic: "pi-gpio",
        table: [
          ["GPIO", `${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? 18}`],
          ["Path", "GPIO -> resistor -> LED anode -> LED cathode -> GND"],
        ],
      },
      {
        title: "Saved settings",
        table: [
          ["GPIO chip", source.config.chip ?? "gpiochip0"],
          ["BCM pin", String(source.config.pin ?? 18)],
          ["Active state", source.config.activeState ?? "high"],
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
          "Camera is enabled in Devices -> Hardware support so the host camera helper is running.",
          "The Pi host can see the camera with rpicam-still --list-cameras or libcamera-still --list-cameras.",
          "The camera is placed with consent and privacy in mind.",
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
        title: "Workflow use",
        items: [
          "Add a Capture camera block and select this camera device.",
          "Attach Stamp data to create an Integritas proof for the captured media hash.",
          "Captured media stays local but is pruned opportunistically after CAMERA_RETENTION_DAYS (7 days by default). Export evidence you need before retention expires; read history retains metadata and the media hash.",
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
        title: "Saved settings",
        table: [
          ["Method", source.config.method ?? "GET"],
          ["URL", source.config.url ?? ""],
        ],
      },
      {
        title: "Requirements",
        items: [
          "The endpoint returns valid JSON.",
          "GET is used for normal reads, or POST is configured when the source requires a request body.",
          "Secrets are not placed in URLs because they can appear in logs or history.",
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
        title: "Saved settings",
        table: [
          ["URL", url],
          ["Method", "POST"],
          ["Body", "application/json"],
        ],
      },
      {
        title: "Workflow use",
        items: [
          "Create or enable a workflow with Webhook received as the start block.",
          "POST JSON to the webhook URL.",
          "The app records the payload only while an enabled workflow exists for this source.",
          "Treat the webhook URL as a bearer secret. Anyone who can reach it can submit JSON and trigger an enabled workflow.",
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
  const topic = source.config.topic ?? "sensors/example/data";
  const publishTopic = /[+#]/.test(topic) ? "<concrete-matching-topic>" : topic;
  return guide(
    source,
    "MQTT Subscriber Setup Guide",
    "Subscribe to a broker topic and record incoming JSON messages while an enabled workflow listens.",
    [
      {
        title: "Saved settings",
        table: [
          ["Broker", source.config.brokerUrl ?? ""],
          ["Topic", source.config.topic ?? ""],
        ],
      },
      {
        title: "Workflow use",
        items: [
          "Create or enable a workflow with MQTT message received as the start block.",
          "Publish valid JSON to the configured topic.",
          "The backend subscribes only while an enabled workflow exists for this source.",
        ],
      },
      {
        title: "Verify",
        items: /[+#]/.test(topic)
          ? ["The saved subscription contains MQTT wildcards. Publish to a concrete topic that matches it; publishers cannot publish to + or #."]
          : undefined,
        commands: `mosquitto_pub -h <broker-host> -t "${publishTopic}" -m '{"event":"test","value":1}'`,
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
        title: "Saved settings",
        table: [
          ["Method", source.config.method ?? "POST"],
          ["URL", source.config.url ?? ""],
          ["Timeout", `${source.config.timeoutMs ?? 5000} ms`],
        ],
      },
      {
        title: "Workflow use",
        items: [
          "Add Control device to a workflow and select this target.",
          "Set the JSON body in the workflow block so this target can be reused.",
        ],
      },
      {
        title: "Verify",
        items: [
          "Use Test output in Devices and confirm the endpoint receives the expected JSON request.",
          "Confirm the device reports a successful output before enabling the workflow.",
          "Test output sends a real request. Use a safe test endpoint or confirm the receiver treats the payload as non-operational.",
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
        title: "Saved settings",
        table: [
          ["Broker", source.config.brokerUrl ?? ""],
          ["Topic", source.config.topic ?? ""],
          ["QoS", String(source.config.qos ?? 0)],
          ["Retain", String(source.config.retain ?? false)],
        ],
      },
      {
        title: "Workflow use",
        items: [
          "Add Control device to a workflow and select this target.",
          "Set the JSON payload in the workflow block.",
          "Leave Retain off unless intended: a retained command is delivered to future subscribers when they connect.",
        ],
      },
      {
        title: "Verify",
        items: [
          "Use Test output in Devices and confirm the broker receives the expected JSON message.",
          "Confirm the message reaches the configured topic before enabling the workflow.",
          "Test output sends a real message. Use a safe test topic or confirm subscribers treat the payload as non-operational.",
        ],
      },
    ],
  );
}

function browserOrigin() {
  return typeof window === "undefined" ? "https://<pi-host>:8080" : window.location.origin;
}
