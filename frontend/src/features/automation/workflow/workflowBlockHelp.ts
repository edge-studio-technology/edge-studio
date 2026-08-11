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
  configuration: string[];
  outputs: string[];
  examples: string[];
};

export const workflowBlockHelp = {
  manual_start: {
    category: "Start",
    title: "Manual run",
    shortTitle: "Start manually",
    shortDescription: "Run only when an operator starts it.",
    tooltip: "Use this when a workflow should never run automatically.",
    whatItDoes: "Starts the workflow only from the UI or an explicit run action.",
    whenToUse: "Use it for tests, one-off captures, setup checks, or workflows that require operator control.",
    configuration: ["No setup is required."],
    outputs: ["Starts the workflow with an empty trigger context."],
    examples: ["Manually fetch a device reading and show a preview before enabling automatic runs."],
  },
  schedule_start: {
    category: "Start",
    title: "Schedule",
    shortTitle: "Start on schedule",
    shortDescription: "Run repeatedly on an interval.",
    tooltip: "Runs the workflow automatically every configured interval while the workflow is enabled.",
    whatItDoes: "Starts the workflow from the backend scheduler at a fixed interval.",
    whenToUse: "Use it for regular sensor reads, periodic API polling, or recurring proof creation.",
    configuration: ["Choose how often the workflow should run."],
    outputs: ["Starts the workflow with schedule timing information."],
    examples: ["Fetch environmental data every 5 minutes and stamp the result."],
  },
  gpio_event_start: {
    category: "Start",
    title: "GPIO input event",
    shortTitle: "Start on GPIO event",
    shortDescription: "Start from a configured GPIO input device.",
    tooltip: "Runs when a GPIO input source reports an event, such as a button press or PIR motion edge.",
    whatItDoes: "Listens to an enabled GPIO input device and starts the workflow when matching events arrive.",
    whenToUse: "Use it for physical buttons, PIR motion sensors, door contacts, or other local GPIO inputs.",
    configuration: ["Choose the GPIO input device.", "Optionally ignore inactive events and set a cooldown."],
    outputs: ["Provides the GPIO event payload to later blocks as the trigger event."],
    examples: ["When motion is detected, capture a camera image and show it in the Automation inbox."],
  },
  webhook_event_start: {
    category: "Start",
    title: "Webhook received",
    shortTitle: "Start on webhook",
    shortDescription: "Start when JSON arrives at a webhook URL.",
    tooltip: "Runs when the configured webhook receiver accepts a JSON payload.",
    whatItDoes: "Waits for HTTP JSON sent to a configured webhook device, then starts the workflow.",
    whenToUse: "Use it when another system should push events into Integritas Pi.",
    configuration: ["Choose the webhook receiver device.", "Optionally set a cooldown between runs."],
    outputs: ["Provides the received JSON to later blocks as the trigger event."],
    examples: ["Receive a production event, record it, and create an Integritas proof."],
  },
  mqtt_event_start: {
    category: "Start",
    title: "MQTT message received",
    shortTitle: "Start on MQTT message",
    shortDescription: "Start when JSON arrives on an MQTT topic.",
    tooltip: "Runs when the configured MQTT subscriber receives a message.",
    whatItDoes: "Listens to a configured MQTT input device and starts the workflow for incoming messages.",
    whenToUse: "Use it for IoT boards, brokers, and sensor networks that publish MQTT events.",
    configuration: ["Choose the MQTT subscriber device.", "Optionally set a cooldown between runs."],
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
    whatItDoes: "Fetches current JSON data from a readable device or source and records the result.",
    whenToUse: "Use it when the workflow should pull current data during the run.",
    configuration: ["Choose a readable data source."],
    outputs: ["Provides latest data for later blocks.", "Creates a read id and hash."],
    examples: ["Every 10 minutes, fetch a BME280 sensor reading and stamp the hash."],
  },
  capture_camera: {
    category: "Data",
    title: "Capture camera",
    shortTitle: "Capture camera",
    shortDescription: "Capture media from a configured Raspberry Pi Camera.",
    tooltip: "Captures a camera image or clip, hashes the media bytes, and stores capture metadata.",
    whatItDoes: "Asks the configured camera helper to capture media and records both metadata and the media hash.",
    whenToUse: "Use it when visual evidence should be captured during a workflow run.",
    configuration: ["Choose a Raspberry Pi Camera device."],
    outputs: ["Provides latest capture metadata for later blocks.", "Creates a read id and media hash."],
    examples: ["When PIR motion is detected, capture an image and show it in the inbox."],
  },
  set_variable: {
    category: "Data",
    title: "Set variable",
    shortTitle: "Set variable",
    shortDescription: "Save a value for later blocks.",
    tooltip: "Stores a per-run value that later conditions and output templates can read.",
    whatItDoes: "Creates or updates a workflow variable for the current run only.",
    whenToUse: "Use it to reuse values from trigger data, latest data, context fields, or custom JSON.",
    configuration: ["Choose a variable name.", "Choose where the value comes from."],
    outputs: ["Provides a named variable to later blocks in the same run."],
    examples: ["Save a message field from a trigger, then publish it in a custom MQTT payload."],
  },
  if_payload_field_equals: {
    category: "Logic",
    title: "If field matches",
    shortTitle: "If field matches",
    shortDescription: "Stop unless a trigger field or variable matches.",
    tooltip: "Checks a trigger field or variable and skips the rest of the workflow when it does not match.",
    whatItDoes: "Compares a selected value against a condition before later blocks run.",
    whenToUse: "Use it to filter events, ignore inactive sensor edges, or branch simple yes/no workflows.",
    configuration: ["Choose trigger or variable source.", "Enter the field path and comparison operator.", "Enter a comparison value when the operator needs one."],
    outputs: ["Allows later blocks to continue when the condition passes.", "Skips later blocks when the condition fails."],
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
    configuration: ["Choose the wait duration in milliseconds."],
    outputs: ["No data output; the workflow continues after the delay."],
    examples: ["Turn on an LED, wait 500 ms, then turn it off."],
  },
  show_preview: {
    category: "Action",
    title: "Show preview",
    shortTitle: "Show preview",
    shortDescription: "Display a message, JSON, link, or image in the Pi UI.",
    tooltip: "Writes a local Automation inbox item for an operator to review.",
    whatItDoes: "Creates a durable local preview item from custom text, workflow context, trigger data, or latest data.",
    whenToUse: "Use it when a workflow should leave a human-readable result in the app.",
    configuration: ["Choose a preview title.", "Choose text, JSON, link, or image format.", "Choose the content source or template."],
    outputs: ["Creates an Automation inbox item."],
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
    configuration: ["Attach it from a stampable data block's setup sheet.", "Optionally add a condition."],
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
    whenToUse: "Use it to pulse LEDs, publish MQTT messages, or send HTTP requests from a workflow.",
    configuration: ["Choose an output target.", "Configure the action or payload for that target."],
    outputs: ["Sends the output command and records the block result."],
    examples: ["Pulse a GPIO LED when a webhook event arrives."],
  },
  send_transaction: {
    category: "Action",
    title: "Send payment",
    shortTitle: "Send payment",
    shortDescription: "Send funds to a saved recipient.",
    tooltip: "Sends a Minima payment to an address book recipient when the workflow reaches this block.",
    whatItDoes: "Submits a wallet transaction using the configured saved recipient, token, and amount.",
    whenToUse: "Use it only when a workflow should automatically make a payment after validation passes.",
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
