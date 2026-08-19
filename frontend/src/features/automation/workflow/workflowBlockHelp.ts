import type { AutomationBlockType } from "../automationTypes";

export type WorkflowBlockCategory = "Start" | "Data" | "Logic" | "Action" | "Attached";

export type WorkflowBlockHelp = {
  category: WorkflowBlockCategory;
  title: string;
  shortTitle: string;
  shortDescription: string;
  tooltip: string;
  whatItDoes: string;
  whenToUse: string;
  fields: WorkflowBlockHelpField[];
  configuration: string[];
  outputs: string[];
  examples: string[];
};

export type WorkflowBlockHelpField = {
  label: string;
  description: string;
  required?: boolean;
  shownWhen?: string;
  example?: string;
};

export const workflowBlockHelp = {
  manual_start: {
    category: "Start",
    title: "Manual run",
    shortTitle: "Start manually",
    shortDescription: "Run only when an operator starts it.",
    tooltip: "Use this when a workflow should never run automatically.",
    whatItDoes: "Starts the workflow only from the UI or an explicit run action.",
    whenToUse:
      "Use it for tests, one-off captures, setup checks, or workflows that require operator control.",
    fields: [],
    configuration: ["No setup is required."],
    outputs: ["Starts the workflow with an empty trigger context."],
    examples: [
      "Manually fetch a device reading and show a preview before enabling automatic runs.",
    ],
  },
  schedule_start: {
    category: "Start",
    title: "Schedule",
    shortTitle: "Start on schedule",
    shortDescription: "Run repeatedly on an interval.",
    tooltip:
      "Runs the workflow automatically every configured interval while the workflow is enabled.",
    whatItDoes: "Starts the workflow from the backend scheduler at a fixed interval.",
    whenToUse:
      "Use it for regular sensor reads, periodic API polling, or recurring proof creation.",
    fields: [
      {
        label: "Interval",
        description: "How often the enabled workflow should start automatically.",
        required: true,
        example: "Every 5 minutes",
      },
    ],
    configuration: ["Choose how often the workflow should run."],
    outputs: ["Starts the workflow with schedule timing information."],
    examples: ["Fetch environmental data every 5 minutes and stamp the result."],
  },
  gpio_event_start: {
    category: "Start",
    title: "GPIO input event",
    shortTitle: "Start on GPIO event",
    shortDescription: "Start from a configured GPIO input device.",
    tooltip:
      "Runs when a GPIO input source reports an event, such as a button press or PIR motion edge.",
    whatItDoes:
      "Listens to an enabled GPIO input device and starts the workflow when matching events arrive.",
    whenToUse:
      "Use it for physical buttons, PIR motion sensors, door contacts, or other local GPIO inputs.",
    fields: [
      {
        label: "Start source",
        description: "The GPIO input device that can start this workflow.",
        required: true,
        example: "PIR motion GPIO23",
      },
      {
        label: "Cooldown between runs, seconds",
        description:
          "How long to ignore extra events after this workflow starts. This helps avoid repeated runs from noisy inputs.",
        example: "60",
      },
      {
        label: "Only run when the GPIO event is active",
        description: "Ignore inactive GPIO edges, such as motion_cleared from a PIR sensor.",
        example: "Enabled",
      },
    ],
    configuration: [
      "Choose the GPIO input device.",
      "Optionally ignore inactive events and set a cooldown.",
    ],
    outputs: ["Provides the GPIO event payload to later blocks as the trigger event."],
    examples: [
      "When motion is detected, capture a camera image and show it in the Workflow Inbox.",
    ],
  },
  webhook_event_start: {
    category: "Start",
    title: "Webhook received",
    shortTitle: "Start on webhook",
    shortDescription: "Start when JSON arrives at a webhook URL.",
    tooltip: "Runs when the configured webhook receiver accepts a JSON payload.",
    whatItDoes:
      "Waits for HTTP JSON sent to a configured webhook device, then starts the workflow.",
    whenToUse: "Use it when another system should push events into Edge Studio.",
    fields: [
      {
        label: "Start source",
        description: "The webhook receiver device that can start this workflow.",
        required: true,
        example: "Production event webhook",
      },
      {
        label: "Cooldown between runs, seconds",
        description: "How long to ignore extra webhook events after this workflow starts.",
        example: "30",
      },
    ],
    configuration: [
      "Choose the webhook receiver device.",
      "Optionally set a cooldown between runs.",
    ],
    outputs: ["Provides the received JSON to later blocks as the trigger event."],
    examples: ["Receive a production event, record it, and create an Integritas proof."],
  },
  mqtt_event_start: {
    category: "Start",
    title: "MQTT message received",
    shortTitle: "Start on MQTT message",
    shortDescription: "Start when JSON arrives on an MQTT topic.",
    tooltip: "Runs when the configured MQTT subscriber receives a message.",
    whatItDoes:
      "Listens to a configured MQTT input device and starts the workflow for incoming messages.",
    whenToUse: "Use it for IoT boards, brokers, and sensor networks that publish MQTT events.",
    fields: [
      {
        label: "Start source",
        description: "The MQTT subscriber device that can start this workflow.",
        required: true,
        example: "ESP32 sensor topic",
      },
      {
        label: "Cooldown between runs, seconds",
        description: "How long to ignore extra MQTT messages after this workflow starts.",
        example: "30",
      },
    ],
    configuration: [
      "Choose the MQTT subscriber device.",
      "Optionally set a cooldown between runs.",
    ],
    outputs: ["Provides the MQTT message payload to later blocks as the trigger event."],
    examples: ["React to an ESP32 MQTT message and pulse a GPIO LED output."],
  },
  record_trigger_event: {
    category: "Data",
    title: "Record trigger event",
    shortTitle: "Record event",
    shortDescription: "Store the trigger payload as data.",
    tooltip: "Creates a durable data read from the event that started the workflow.",
    whatItDoes: "Stores the current trigger event payload and creates a hash for it.",
    whenToUse: "Use it when the incoming event itself is the evidence you want to keep or stamp.",
    fields: [],
    configuration: ["Available after GPIO, webhook, or MQTT start blocks."],
    outputs: ["Provides latest data for later blocks.", "Creates a read id and hash."],
    examples: ["Record an incoming webhook payload, then stamp the recorded data."],
  },
  fetch_data_source: {
    category: "Data",
    title: "Fetch data source",
    shortTitle: "Fetch source",
    shortDescription: "Read a configured source such as HTTP JSON or BME sensor.",
    tooltip: "Reads the selected source on demand and hashes the returned data.",
    whatItDoes:
      "Fetches current JSON data from a readable device or source and records the result.",
    whenToUse: "Use it when the workflow should pull current data during the run.",
    fields: [
      {
        label: "Readable source",
        description: "The configured device or source to read when this block runs.",
        required: true,
        example: "BME280 Environmental Sensor",
      },
    ],
    configuration: ["Choose a readable data source."],
    outputs: ["Provides latest data for later blocks.", "Creates a read id and hash."],
    examples: ["Every 10 minutes, fetch a BME280 sensor reading and stamp the hash."],
  },
  capture_camera: {
    category: "Data",
    title: "Capture camera",
    shortTitle: "Capture camera",
    shortDescription: "Capture media from a configured Raspberry Pi Camera.",
    tooltip:
      "Captures a camera image or clip, hashes the media bytes, and stores capture metadata.",
    whatItDoes:
      "Asks the configured camera helper to capture media and records both metadata and the media hash.",
    whenToUse: "Use it when visual evidence should be captured during a workflow run.",
    fields: [
      {
        label: "Camera device",
        description: "The configured Raspberry Pi Camera device to capture from.",
        required: true,
        example: "Front gate camera",
      },
      {
        label: "Capture duration ms",
        description:
          "How long to record video for when the selected camera is configured for video mode.",
        shownWhen: "Camera mode is video",
        example: "5000",
      },
    ],
    configuration: ["Choose a Raspberry Pi Camera device."],
    outputs: [
      "Provides latest capture metadata for later blocks.",
      "Creates a read id and media hash.",
    ],
    examples: ["When PIR motion is detected, capture an image and show it in the inbox."],
  },
  set_variable: {
    category: "Data",
    title: "Set variable",
    shortTitle: "Set variable",
    shortDescription: "Save a value for later blocks.",
    tooltip: "Stores a per-run value that later conditions and output templates can read.",
    whatItDoes: "Creates or updates a workflow variable for the current run only.",
    whenToUse:
      "Use it to reuse values from trigger data, latest data, context fields, or custom JSON.",
    fields: [
      {
        label: "Variable name",
        description: "The name later blocks use to read this saved value.",
        required: true,
        example: "message",
      },
      {
        label: "Value source",
        description:
          "Where the variable value comes from: custom JSON, trigger data, latest data, or workflow context.",
        required: true,
        example: "Trigger field",
      },
      {
        label: "Field path",
        description:
          "The JSON field to copy into the variable when the value source reads from trigger data, latest data, or context.",
        shownWhen: "Value source is not Custom JSON",
        example: "payload.message",
      },
      {
        label: "Custom JSON value",
        description: "The literal JSON value to store when the value source is Custom JSON.",
        shownWhen: "Value source is Custom JSON",
        example: '"Button pressed"',
      },
    ],
    configuration: ["Choose a variable name.", "Choose where the value comes from."],
    outputs: ["Provides a named variable to later blocks in the same run."],
    examples: ["Save a message field from a trigger, then publish it in a custom MQTT payload."],
  },
  if_payload_field_equals: {
    category: "Logic",
    title: "If field matches",
    shortTitle: "If field matches",
    shortDescription: "Stop unless a trigger field or variable matches.",
    tooltip:
      "Checks a trigger field or variable and skips the rest of the workflow when it does not match.",
    whatItDoes: "Compares a selected value against a condition before later blocks run.",
    whenToUse:
      "Use it to filter events, ignore inactive sensor edges, or branch simple yes/no workflows.",
    fields: [
      {
        label: "Condition source",
        description:
          "Where to read the value from. Trigger event reads the event that started the workflow. Variable reads a value saved earlier by Set variable.",
        required: true,
        example: "Trigger event",
      },
      {
        label: "Field path",
        description:
          "The JSON field to check inside the selected source. Use dot notation for nested fields.",
        required: true,
        shownWhen: "Condition source is Trigger event",
        example: "active or payload.temperature",
      },
      {
        label: "Operator",
        description:
          "The comparison to run. Exists and does not exist only check whether the field is present; other operators compare against the value below.",
        required: true,
        example: "equals",
      },
      {
        label: "Compare value",
        description:
          'The value to compare against. Values are parsed as JSON when possible, so true, 25, and "ready" are different values.',
        shownWhen: "Operator is not exists or does not exist",
        example: "true",
      },
    ],
    configuration: [
      "Choose trigger or variable source.",
      "Enter the field path and comparison operator.",
      "Enter a comparison value when the operator needs one.",
    ],
    outputs: [
      "Allows later blocks to continue when the condition passes.",
      "Skips later blocks when the condition fails.",
    ],
    examples: ["Continue only when trigger field active equals true."],
  },
  wait: {
    category: "Logic",
    title: "Wait",
    shortTitle: "Wait",
    shortDescription: "Pause before the next block.",
    tooltip: "Delays the workflow before continuing to the next block.",
    whatItDoes: "Pauses the current workflow run for the configured duration.",
    whenToUse: "Use it between hardware output changes, retries, or staged actions.",
    fields: [
      {
        label: "Wait duration ms",
        description: "How long this workflow run should pause before the next block runs.",
        required: true,
        example: "1000",
      },
    ],
    configuration: ["Choose the wait duration in milliseconds."],
    outputs: ["No data output; the workflow continues after the delay."],
    examples: ["Turn on an LED, wait 500 ms, then turn it off."],
  },
  show_preview: {
    category: "Action",
    title: "Show preview",
    shortTitle: "Show preview",
    shortDescription: "Display a message, JSON, link, or image in the Pi UI.",
    tooltip: "Writes a local Workflow Inbox item for an operator to review.",
    whatItDoes:
      "Creates a durable local preview item from custom text, workflow context, trigger data, or latest data.",
    whenToUse: "Use it when a workflow should leave a human-readable result in the app.",
    fields: [
      {
        label: "Preview title",
        description: "The title shown for the item in the Workflow Inbox.",
        required: true,
        example: "Workflow preview",
      },
      {
        label: "Preview format",
        description: "How the inbox should render the preview: text, JSON, link, or image.",
        required: true,
        example: "JSON",
      },
      {
        label: "Image source",
        description: "Whether an image preview points to a URL or a local path.",
        shownWhen: "Preview format is Image",
        example: "URL",
      },
      {
        label: "Content source",
        description:
          "Where the preview content comes from: custom content, workflow context, trigger payload, or latest data.",
        required: true,
        example: "Custom content",
      },
      {
        label: "Custom content",
        description:
          "The text, JSON, link, or image reference to render when Content source is Custom content.",
        shownWhen: "Content source is Custom content",
        example: "Workflow preview",
      },
    ],
    configuration: [
      "Choose a preview title.",
      "Choose text, JSON, link, or image format.",
      "Choose the content source or template.",
    ],
    outputs: ["Creates a Workflow Inbox item."],
    examples: ["Show the latest camera image after a motion-triggered capture."],
  },
  stamp_integritas: {
    category: "Attached",
    title: "Stamp data",
    shortTitle: "Stamp",
    shortDescription: "Create an Integritas proof for recorded, fetched, or captured data.",
    tooltip: "Attached to a data block, this creates an Integritas proof for that block's hash.",
    whatItDoes: "Uses the parent data block's hash to request an Integritas proof.",
    whenToUse: "Use it when data captured by a workflow needs tamper-evident proof.",
    fields: [
      {
        label: "Enable stamp",
        description:
          "Whether this attached stamp block should run when its parent data block runs.",
        example: "Enabled",
      },
      {
        label: "Stamp condition",
        description:
          "Optional comparison against the parent data block output before creating the proof.",
        shownWhen: "A stamp condition is enabled",
        example: "active equals true",
      },
    ],
    configuration: [
      "Attach it from a stampable data block's setup sheet.",
      "Optionally add a condition.",
    ],
    outputs: ["Creates an Integritas proof id when stamping succeeds."],
    examples: ["Fetch a sensor reading, then stamp the resulting hash."],
  },
  control_output: {
    category: "Action",
    title: "Control device",
    shortTitle: "Control device",
    shortDescription: "Send a command to a configured output target.",
    tooltip: "Controls a GPIO, HTTP, or MQTT output target from the workflow.",
    whatItDoes: "Sends the configured action or payload to an output device.",
    whenToUse:
      "Use it to pulse LEDs, publish MQTT messages, or send HTTP requests from a workflow.",
    fields: [
      {
        label: "Output target",
        description: "The configured GPIO, HTTP, or MQTT output device this block controls.",
        required: true,
        example: "GPIO LED",
      },
      {
        label: "Action",
        description:
          "What to do with the target. GPIO targets pulse; HTTP targets send requests; MQTT targets publish messages.",
        required: true,
        example: "Pulse",
      },
      {
        label: "Pulse duration ms",
        description: "How long a GPIO output should stay active before turning off.",
        shownWhen: "Output target is GPIO",
        example: "500",
      },
      {
        label: "Body mode",
        description: "Which payload to send to an HTTP or MQTT output target.",
        shownWhen: "Output target is HTTP or MQTT",
        example: "Workflow context",
      },
      {
        label: "Custom JSON body",
        description:
          "The JSON payload to send when Body mode is Custom JSON. Variables can be inserted with template syntax.",
        shownWhen: "Body mode is Custom JSON",
        example: '{ "content": "Edge Studio workflow triggered." }',
      },
      {
        label: "Multipart fields",
        description:
          "The form field names used when uploading captured media to an HTTP output target.",
        shownWhen: "Body mode is Multipart media upload",
        example: "file and metadata",
      },
    ],
    configuration: ["Choose an output target.", "Configure the action or payload for that target."],
    outputs: ["Sends the output command and records the block result."],
    examples: ["Pulse a GPIO LED when a webhook event arrives."],
  },
  send_transaction: {
    category: "Action",
    title: "Send payment",
    shortTitle: "Send payment",
    shortDescription: "Send funds to a saved recipient.",
    tooltip:
      "Sends a Minima payment to an address book recipient when the workflow reaches this block.",
    whatItDoes:
      "Submits a wallet transaction using the configured saved recipient, token, and amount.",
    whenToUse:
      "Use it only when a workflow should automatically make a payment after validation passes.",
    fields: [
      {
        label: "Recipient",
        description: "The address book contact that will receive the payment.",
        required: true,
        example: "Alice",
      },
      {
        label: "Token",
        description: "The wallet token to send. Workflow payments currently use native Minima.",
        required: true,
        example: "Minima (native)",
      },
      {
        label: "Amount",
        description:
          "The amount of Minima to send. It must be a positive number and within the available balance.",
        required: true,
        example: "0.5",
      },
    ],
    configuration: ["Choose an address book recipient.", "Enter a positive amount."],
    outputs: ["Creates a wallet transaction result when the payment succeeds."],
    examples: ["Send a small payment after a verified manual workflow run."],
  },
} satisfies Record<AutomationBlockType, WorkflowBlockHelp>;

export const workflowBlockCategoryOrder: WorkflowBlockCategory[] = [
  "Start",
  "Data",
  "Logic",
  "Action",
  "Attached",
];

export const workflowBlockLibraryTypes = {
  Start: [
    "manual_start",
    "schedule_start",
    "gpio_event_start",
    "webhook_event_start",
    "mqtt_event_start",
  ],
  Data: ["record_trigger_event", "fetch_data_source", "capture_camera", "set_variable"],
  Logic: ["if_payload_field_equals", "wait"],
  Action: ["show_preview", "control_output", "send_transaction"],
  Attached: ["stamp_integritas"],
} satisfies Record<WorkflowBlockCategory, AutomationBlockType[]>;

export function blockHelp(type: AutomationBlockType) {
  return workflowBlockHelp[type];
}
