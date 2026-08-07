import type { DataSource } from "../../data-sources/dataSourceTypes";
import type { AutomationBlock, AutomationBlockType } from "../automationTypes";
import type {
  DraftWorkflowBlock,
  WorkflowCanvasBlock,
  WorkflowCanvasRuntimeState,
  WorkflowCanvasValidationIssue,
} from "./types";

export function blockPresentation(
  block: DraftWorkflowBlock,
  sources: DataSource[],
  validationIssues: WorkflowCanvasValidationIssue[],
  runtime?: WorkflowCanvasRuntimeState,
) {
  const validationErrors = validationIssues.filter((issue) => issue.level === "error");
  const validationWarnings = validationIssues.filter((issue) => issue.level === "warning");
  const badges = capabilityBadges(block);

  if (typeof block.enabled === "boolean") badges.push(block.enabled ? "Enabled" : "Disabled");
  if (block.lastRunAt) badges.push(`Ran ${new Date(block.lastRunAt).toLocaleString()}`);
  if (block.lastError) badges.push("Error");
  if (validationErrors.length > 0)
    badges.push(
      `${validationErrors.length} validation error${validationErrors.length === 1 ? "" : "s"}`,
    );
  if (validationWarnings.length > 0)
    badges.push(
      `${validationWarnings.length} warning${validationWarnings.length === 1 ? "" : "s"}`,
    );
  if (runtime)
    badges.push(
      runtime.durationMs === null
        ? runtime.status
        : `${runtime.status} · ${formatDuration(runtime.durationMs)}`,
    );
  if (runtime?.error) badges.push("Run error");

  return {
    title: draftBlockTitle(block),
    description: draftBlockDescription(block, sources),
    badges,
    className: [
      blockCategoryClass(block.type),
      validationErrors.length > 0 ? "outline outline-4 outline-offset-4 outline-red-500/50" : "",
      validationWarnings.length > 0
        ? "outline outline-4 outline-offset-4 outline-amber-500/50"
        : "",
      runtimeClass(runtime),
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function automationBlockToCanvasBlock(
  block: AutomationBlock,
  allBlocks: AutomationBlock[],
): WorkflowCanvasBlock {
  return {
    id: block.id,
    type: block.type,
    config: block.config,
    enabled: block.enabled,
    lastRunAt: block.lastRunAt,
    lastError: block.lastError,
    attachedBlocks: allBlocks
      .filter((item) => item.parentBlockId === block.id)
      .map((attached) => ({
        id: attached.id,
        type: attached.type,
        config: attached.config,
        enabled: attached.enabled,
        lastRunAt: attached.lastRunAt,
        lastError: attached.lastError,
      })),
  };
}

export function isDataBlock(type: AutomationBlockType) {
  return (
    type === "record_trigger_event" || type === "fetch_data_source" || type === "capture_camera"
  );
}

export function draftBlockTitle(block: { type: AutomationBlockType }) {
  if (block.type === "manual_start") return "Manual run";
  if (block.type === "schedule_start") return "Schedule";
  if (block.type === "gpio_event_start") return "GPIO input event";
  if (block.type === "webhook_event_start") return "Webhook received";
  if (block.type === "mqtt_event_start") return "MQTT message received";
  if (block.type === "record_trigger_event") return "Record trigger event";
  if (block.type === "fetch_data_source") return "Fetch data source";
  if (block.type === "capture_camera") return "Capture camera";
  if (block.type === "set_variable") return "Set variable";
  if (block.type === "show_preview") return "Show preview";
  if (block.type === "stamp_integritas") return "Stamp data";
  if (block.type === "control_output") return "Control device";
  if (block.type === "send_transaction") return "Send payment";
  return block.type;
}

export function draftBlockDescription(
  block: { type: AutomationBlockType; config: AutomationBlock["config"] },
  sources: DataSource[],
) {
  if (block.type === "schedule_start")
    return `Every ${formatInterval(Number(block.config.intervalSeconds ?? 60)).replace("Every ", "")}`;
  const sourceId = block.config.sourceId ?? block.config.targetId;
  const source = sourceId ? sources.find((item) => item.id === sourceId) : undefined;
  if (source) return `${source.name} - ${sourceLabel(source)}`;
  if (block.type === "manual_start") return "Runs only from a manual test/action.";
  if (block.type === "record_trigger_event") return "Stores the trigger payload as a data read.";
  if (block.type === "fetch_data_source") return "Fetches JSON and creates a hash.";
  if (block.type === "capture_camera")
    return "Captures media, hashes the file bytes, and stores capture metadata.";
  if (block.type === "set_variable")
    return `Save ${block.config.variableName || "a variable"} for later blocks.`;
  if (block.type === "show_preview")
    return `Display ${block.config.previewFormat ?? "text"} in the Automation inbox.`;
  if (block.type === "stamp_integritas") return "Stamp this data block's hash.";
  if (block.type === "control_output") return "Send a command to a configured output target.";
  if (block.type === "send_transaction")
    return `Send ${block.config.amount || "?"} to a saved recipient.`;
  return "Select a source in Setup.";
}

function capabilityBadges(block: DraftWorkflowBlock) {
  const badges: string[] = [];
  if (block.type.endsWith("_start")) badges.push("Provides trigger event");
  if (isDataBlock(block.type)) badges.push("Provides latest data");
  if (block.type === "if_payload_field_equals")
    badges.push(
      (block.config.source ?? "trigger") === "variable" ? "Reads variable" : "Reads trigger event",
    );
  if (block.type === "stamp_integritas") badges.push("Reads parent data");
  return badges;
}

function blockCategoryClass(type: AutomationBlockType) {
  if (type.endsWith("_start")) return "border-feedback-warning bg-[#fff0c7]";
  if (type === "record_trigger_event" || type === "fetch_data_source" || type === "capture_camera")
    return "border-[#4f9cff] bg-[#cfe8ff]";
  if (type === "set_variable" || type === "if_payload_field_equals" || type === "wait")
    return "border-[#d35cff] bg-[#ead1ff]";
  if (type === "stamp_integritas") return "border-[#63c893] bg-[#bee9d4]";
  return "border-[#ff7f9b] bg-[#ffc4d3]";
}

function runtimeClass(runtime?: WorkflowCanvasRuntimeState) {
  if (!runtime) return "";
  if (runtime.status === "running") return "shadow-[0_0_0_2px_#4f9cff]";
  if (runtime.status === "success") return "shadow-[0_0_0_2px_var(--color-stroke-success)]";
  if (runtime.status === "failed") return "shadow-[0_0_0_2px_var(--color-stroke-error)]";
  if (runtime.status === "skipped") return "opacity-80";
  return "";
}

function sourceLabel(source: DataSource) {
  if (source.type === "webhook") return "Webhook receive URL";
  if (source.type === "mqtt")
    return `${source.config.brokerUrl ?? "MQTT broker"} ${source.config.topic ?? ""}`;
  if (source.type === "gpio-input")
    return `${source.config.profile === "pir-motion" ? "PIR motion " : ""}${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"}`;
  if (source.type === "gpio-output")
    return `${source.config.profile ?? "led"} ${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"}`;
  if (source.type === "pi-camera")
    return `${source.config.mode ?? "photo"} ${source.config.width ?? 1280}x${source.config.height ?? 720}`;
  return source.config.url ?? "HTTP JSON Source";
}

function formatInterval(seconds: number) {
  if (seconds < 60) return `Every ${seconds}s`;
  if (seconds < 3600) return `Every ${seconds / 60}m`;
  return `Every ${seconds / 3600}h`;
}

function formatDuration(ms: number | null) {
  if (ms === null) return "running";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
