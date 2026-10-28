export type ModuleCategory = "Hardware" | "Devices" | "Workflow" | "Integrations";
export type ModuleIcon =
  "camera" | "radio" | "thermometer" | "globe" | "workflow" | "shield" | "sprout" | "bell" | "cpu";

export type DemoModule = {
  id: string;
  name: string;
  summary: string;
  description: string;
  category: ModuleCategory;
  icon: ModuleIcon;
  color: "purple" | "green" | "blue" | "orange";
  author: string;
  official: boolean;
  version: string;
  downloads: number;
  ratingCount: number;
  ratingTotal: number;
  userRating?: number;
  contributions: string[];
  hostAccess: boolean;
  installed: boolean;
  enabled: boolean;
  update?: string;
  localOnly?: boolean;
  releaseFiles?: Record<string, string>;
  commercial?: boolean;
  entitled?: boolean;
  moderationPending?: boolean;
};

export const demoModules: DemoModule[] = [
  {
    id: "http-json",
    name: "HTTP Toolkit",
    summary: "Connect your workflows to the web.",
    description:
      "Bring any JSON API into your workspace. Fetch sensor readings, send a command, or connect to your favorite service with a device wizard that takes care of the details.",
    category: "Integrations",
    icon: "globe",
    color: "blue",
    author: "Edge Studio",
    official: true,
    version: "1.4.0",
    downloads: 2400,
    ratingCount: 128,
    ratingTotal: 614,
    contributions: ["2 device types", "3 workflow blocks"],
    hostAccess: false,
    installed: true,
    enabled: true,
  },
  {
    id: "pi-camera",
    name: "Raspberry Pi Camera",
    summary: "Give your edge a new perspective.",
    description:
      "Capture photos and video from your Raspberry Pi camera. Set up your camera, preview a capture, and bring images into workflows with ready-to-use capture blocks.",
    category: "Hardware",
    icon: "camera",
    color: "purple",
    author: "Edge Studio",
    official: true,
    version: "1.2.0",
    downloads: 1800,
    ratingCount: 96,
    ratingTotal: 442,
    contributions: ["Camera support", "1 device type", "2 workflow blocks"],
    hostAccess: true,
    installed: true,
    enabled: true,
    update: "1.3.0",
  },
  {
    id: "mqtt",
    name: "MQTT Connect",
    summary: "Small messages. Connected things.",
    description:
      "Connect ESP32 boards, smart sensors, and other devices through MQTT. Includes a local broker setup guide, subscriber and publisher devices, and event-driven workflow blocks.",
    category: "Integrations",
    icon: "radio",
    color: "orange",
    author: "Edge Studio",
    official: true,
    version: "2.0.1",
    downloads: 3100,
    ratingCount: 214,
    ratingTotal: 1027,
    contributions: ["Broker support", "2 device types", "3 workflow blocks"],
    hostAccess: true,
    installed: true,
    enabled: true,
  },
  {
    id: "environment",
    name: "Environmental Sensors",
    summary: "A feel for the world around you.",
    description:
      "Read temperature, humidity, pressure, and air quality with BME280 and BME680 sensors. Guided wiring, device discovery, and useful blocks make your first reading feel easy.",
    category: "Hardware",
    icon: "thermometer",
    color: "green",
    author: "Edge Studio",
    official: true,
    version: "1.1.0",
    downloads: 1200,
    ratingCount: 83,
    ratingTotal: 390,
    contributions: ["I²C support", "2 device types", "2 workflow blocks"],
    hostAccess: true,
    installed: true,
    enabled: true,
    update: "1.2.0",
  },
  {
    id: "workflow-essentials",
    name: "Workflow Essentials",
    summary: "The building blocks of a good idea.",
    description:
      "Start, schedule, transform, and preview. A collection of everyday workflow blocks for turning individual actions into something useful.",
    category: "Workflow",
    icon: "workflow",
    color: "purple",
    author: "Edge Studio",
    official: true,
    version: "1.0.2",
    downloads: 4200,
    ratingCount: 302,
    ratingTotal: 1480,
    contributions: ["8 workflow blocks", "4 templates"],
    hostAccess: false,
    installed: true,
    enabled: true,
  },
  {
    id: "integritas",
    name: "Integritas Proofs",
    summary: "Turn a moment into verifiable evidence.",
    description:
      "Attach Integritas stamping to your workflows and create verifiable proofs of captured data. Connect readings, media, and events to your existing Integritas account.",
    category: "Workflow",
    icon: "shield",
    color: "blue",
    author: "Edge Studio",
    official: true,
    version: "1.0.0",
    downloads: 1600,
    ratingCount: 110,
    ratingTotal: 517,
    contributions: ["2 workflow blocks", "2 templates"],
    hostAccess: false,
    installed: true,
    enabled: false,
  },
  {
    id: "greenhouse",
    name: "Greenhouse Companion",
    summary: "A little care for everything you grow.",
    description:
      "Build a more attentive greenhouse. Combine environmental readings with watering schedules and alerts, then start with a complete monitoring workflow you can make your own.",
    category: "Devices",
    icon: "sprout",
    color: "green",
    author: "Maya Chen",
    official: false,
    version: "1.2.0",
    downloads: 864,
    ratingCount: 74,
    ratingTotal: 363,
    contributions: ["1 device preset", "3 workflow blocks", "2 templates"],
    hostAccess: true,
    installed: false,
    enabled: false,
  },
  {
    id: "notifications",
    name: "Notify Me",
    summary: "The right update, right when it matters.",
    description:
      "Send clear, useful notifications from a workflow. Connect a webhook destination, choose your message, and keep up with what is happening at your edge.",
    category: "Integrations",
    icon: "bell",
    color: "orange",
    author: "Jonas Berg",
    official: false,
    version: "0.9.4",
    downloads: 672,
    ratingCount: 52,
    ratingTotal: 234,
    contributions: ["2 workflow blocks", "1 template"],
    hostAccess: false,
    installed: false,
    enabled: false,
  },
  {
    id: "gpio",
    name: "GPIO Workshop",
    commercial: true,
    summary: "Make something happen in the real world.",
    description:
      "Buttons, motion sensors, lights, and all the little things you can imagine. Configure Raspberry Pi GPIO inputs and outputs with guides and blocks that speak your language.",
    category: "Hardware",
    icon: "cpu",
    color: "purple",
    author: "Edge Studio",
    official: true,
    version: "1.3.0",
    downloads: 2200,
    ratingCount: 146,
    ratingTotal: 686,
    contributions: ["GPIO support", "4 device types", "3 workflow blocks"],
    hostAccess: true,
    installed: false,
    enabled: false,
  },
];

export const categories: ModuleCategory[] = ["Hardware", "Devices", "Workflow", "Integrations"];

export const sampleFiles: Record<string, string> = {
  "src/index.ts": `import { defineModule } from "@edge-studio/sdk";

export default defineModule({
  id: "local.greenhouse-monitor",
  name: "Greenhouse Monitor",
  version: "0.1.0",

  blocks: [{
    id: "check-temperature",
    name: "Check temperature",
    category: "condition",
    async run({ input, config, log }) {
      const temperature = input.temperature;
      const aboveThreshold = temperature > config.threshold;

      log.info(\`Temperature: \${temperature}°C\`);

      return {
        temperature,
        aboveThreshold,
        message: aboveThreshold ? "Time to cool down" : "All good!",
      };
    },
  }],
});`,
  "module.json": `{
  "id": "local.greenhouse-monitor",
  "name": "Greenhouse Monitor",
  "version": "0.1.0",
  "description": "Keep an eye on the things you grow.",
  "entry": "src/index.ts",
  "category": "Workflow",
  "compatibility": { "edgeStudio": ">=0.42.0" },
  "contributions": { "blocks": ["check-temperature"] },
  "access": { "host": false },
  "license": "MIT"
}`,
  "schemas/config.json": `{
  "type": "object",
  "properties": {
    "threshold": {
      "type": "number",
      "title": "Temperature threshold",
      "description": "Alert when the temperature goes above this value.",
      "default": 28
    }
  },
  "required": ["threshold"]
}`,
  "README.md": `# Greenhouse Monitor

A small workflow block for the things you grow.

## Get started

1. Add a temperature sensor to your devices.
2. Connect its readings to Check temperature.
3. Set your threshold and choose what happens next.

## Example input

{ "temperature": 31.4, "humidity": 62 }

## License

MIT`,
};

export type DemoDraft = {
  id: string;
  name: string;
  description: string;
  icon: ModuleIcon;
  color: DemoModule["color"];
  files: Record<string, string>;
  saved: boolean;
};

export const demoDrafts: DemoDraft[] = [
  {
    id: "greenhouse-monitor",
    name: "Greenhouse Monitor",
    description: "A little more care for your greenhouse.",
    icon: "sprout",
    color: "green",
    files: { ...sampleFiles },
    saved: true,
  },
  {
    id: "doorbell",
    name: "A smarter doorbell",
    description: "A button, a camera, and a friendly notification.",
    icon: "bell",
    color: "orange",
    files: {
      ...sampleFiles,
      "src/index.ts": "// A smarter doorbell\n// Start building your module here.\n",
    },
    saved: true,
  },
  {
    id: "air-quality",
    name: "Air Quality Log",
    description: "Make room for a breath of fresh air.",
    icon: "thermometer",
    color: "blue",
    files: { ...sampleFiles },
    saved: true,
  },
];
