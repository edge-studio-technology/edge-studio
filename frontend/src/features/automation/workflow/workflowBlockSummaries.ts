import type { AddressBookEntry } from "../../address-book/addressBookTypes";
import type { DataSource } from "../../data-sources/dataSourceTypes";
import type { AutomationBlock, AutomationBlockType, ConditionOperator } from "../automationTypes";
import { blockHelp } from "./workflowBlockHelp";
import { conditionOperatorOptions, formatInterval, sourceLabel } from "./workflowHelpers";

export type WorkflowBlockSummaryField = {
  label: string;
  value: string;
};

export type WorkflowBlockSummary = {
  sentence: string;
  fields: WorkflowBlockSummaryField[];
};

export type WorkflowBlockSummaryContext = {
  sources: DataSource[];
  addressBook: AddressBookEntry[];
};

type WorkflowBlockSummaryInput = {
  type: AutomationBlockType;
  config: AutomationBlock["config"];
};

type WorkflowBlockSummaryFormatter = (
  block: WorkflowBlockSummaryInput,
  context: WorkflowBlockSummaryContext,
) => WorkflowBlockSummary;

const blockSummaryFormatters = {
  manual_start: () => summary("Manual run only"),
  schedule_start: (block) => {
    const interval = formatInterval(Number(block.config.intervalSeconds ?? 60));
    return summary(interval, [{ label: "Interval", value: interval }]);
  },
  gpio_event_start: (block, context) => {
    const source = sourceById(context.sources, block.config.sourceId);
    return summaryWithSource(block.type, source, [
      { label: "Source", value: sourceDisplay(source) },
      { label: "Active only", value: block.config.activeOnly ? "Yes" : "No" },
      { label: "Cooldown", value: formatSeconds(Number(block.config.cooldownSeconds ?? 0)) },
    ]);
  },
  webhook_event_start: (block, context) => eventStartSummary(block, context),
  mqtt_event_start: (block, context) => eventStartSummary(block, context),
  record_trigger_event: () => summary("Record the trigger event payload"),
  fetch_data_source: (block, context) => sourceBlockSummary(block, context),
  capture_camera: (block, context) => sourceBlockSummary(block, context),
  set_variable: (block) => {
    const name = stringValue(block.config.variableName, "variable");
    const source = variableSourceLabel(block.config.variableSource);
    const field = stringValue(block.config.fieldPath, "value");
    const value = block.config.variableSource === "custom_json" ? shortText(block.config.valueJsonText) : field;
    return summary(`Set ${name} from ${source}: ${value}`, [
      { label: "Variable", value: name },
      { label: "Source", value: source },
      { label: block.config.variableSource === "custom_json" ? "Value" : "Field", value },
    ]);
  },
  if_payload_field_equals: (block) => {
    const source = block.config.source === "variable" ? "Variable" : "Trigger event";
    const field = conditionField(block.config);
    const operator = operatorLabel(block.config.operator);
    const fields: WorkflowBlockSummaryField[] = [
      { label: "Source", value: source },
      { label: "Field", value: field },
      { label: "Operator", value: operator },
    ];
    const valueRequired = !operatorHasNoValue(block.config.operator);
    const value = valueRequired ? formatValue(block.config.value) : "";
    if (valueRequired) fields.push({ label: "Value", value });
    return summary(
      valueRequired ? `${source} ${field} ${operator} ${value}` : `${source} ${field} ${operator}`,
      fields,
    );
  },
  wait: (block) => {
    const duration = formatDurationMs(Number(block.config.durationMs ?? 1000));
    return summary(`Wait ${duration}`, [{ label: "Duration", value: duration }]);
  },
  show_preview: (block) => {
    const format = previewFormatLabel(block.config.previewFormat);
    const mode = contentModeLabel(block.config.contentMode);
    const title = stringValue(block.config.title, "Workflow preview");
    return summary(`${format} preview: ${title}`, [
      { label: "Title", value: title },
      { label: "Format", value: format },
      { label: "Content", value: mode },
    ]);
  },
  stamp_integritas: () => summary("Stamp parent data hash"),
  control_output: (block, context) => {
    const target = sourceById(context.sources, block.config.targetId);
    const action = outputActionLabel(block.config.action);
    return summary(target ? `${action} ${target.name}` : "Choose an output target", [
      { label: "Target", value: sourceDisplay(target) },
      { label: "Action", value: action },
      ...(block.config.action === "pulse"
        ? [{ label: "Duration", value: formatDurationMs(Number(block.config.durationMs ?? 500)) }]
        : [{ label: "Payload", value: bodyModeLabel(block.config.bodyMode) }]),
    ]);
  },
  send_transaction: (block, context) => {
    const recipient = recipientName(context.addressBook, block.config.recipientAddressBookId);
    const amount = stringValue(block.config.amount, "amount not set");
    return summary(`Send ${amount} Minima to ${recipient}`, [
      { label: "Recipient", value: recipient },
      { label: "Amount", value: amount },
    ]);
  },
} satisfies Record<AutomationBlockType, WorkflowBlockSummaryFormatter>;

export function blockSummary(
  block: WorkflowBlockSummaryInput,
  context: WorkflowBlockSummaryContext,
): WorkflowBlockSummary {
  return blockSummaryFormatters[block.type](block, context);
}

function eventStartSummary(block: WorkflowBlockSummaryInput, context: WorkflowBlockSummaryContext) {
  const source = sourceById(context.sources, block.config.sourceId);
  return summaryWithSource(block.type, source, [
    { label: "Source", value: sourceDisplay(source) },
    { label: "Cooldown", value: formatSeconds(Number(block.config.cooldownSeconds ?? 0)) },
  ]);
}

function sourceBlockSummary(block: WorkflowBlockSummaryInput, context: WorkflowBlockSummaryContext) {
  const source = sourceById(context.sources, block.config.sourceId);
  return summaryWithSource(block.type, source, [{ label: "Source", value: sourceDisplay(source) }]);
}

function summaryWithSource(
  type: AutomationBlockType,
  source: DataSource | undefined,
  fields: WorkflowBlockSummaryField[],
) {
  if (!source) return summary(`Choose ${blockHelp(type).title.toLowerCase()} source`, fields);
  return summary(`${source.name} - ${sourceLabel(source)}`, fields);
}

function summary(sentence: string, fields: WorkflowBlockSummaryField[] = []): WorkflowBlockSummary {
  return { sentence, fields };
}

function sourceById(sources: DataSource[], sourceId: string | undefined) {
  return sourceId ? sources.find((source) => source.id === sourceId) : undefined;
}

function sourceDisplay(source: DataSource | undefined) {
  return source ? `${source.name} - ${sourceLabel(source)}` : "Not selected";
}

function recipientName(addressBook: AddressBookEntry[], id: string | undefined) {
  if (!id) return "saved recipient";
  const recipient = addressBook.find((entry) => entry.id === id);
  return recipient?.label ?? recipient?.address ?? "saved recipient";
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function shortText(value: unknown) {
  const text = stringValue(value, "value not set").replace(/\s+/g, " ");
  return text.length > 48 ? `${text.slice(0, 45)}...` : text;
}

function conditionField(config: AutomationBlock["config"]) {
  return config.source === "variable"
    ? stringValue(config.variableName, "variable")
    : stringValue(config.fieldPath, "field");
}

function operatorLabel(operator: ConditionOperator | undefined) {
  return conditionOperatorOptions.find((option) => option.value === operator)?.label ?? "equals";
}

function operatorHasNoValue(operator: ConditionOperator | undefined) {
  return operator === "exists" || operator === "does_not_exist";
}

function formatValue(value: unknown) {
  if (value === undefined) return "value not set";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function formatDurationMs(ms: number) {
  if (!Number.isFinite(ms)) return "not set";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} s`;
}

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Off";
  return `${seconds} s`;
}

function variableSourceLabel(source: AutomationBlock["config"]["variableSource"]) {
  if (source === "trigger_field") return "trigger field";
  if (source === "latest_data_field") return "latest data field";
  if (source === "context_field") return "context field";
  return "custom JSON";
}

function previewFormatLabel(format: AutomationBlock["config"]["previewFormat"]) {
  if (format === "json") return "JSON";
  if (format === "link") return "Link";
  if (format === "image") return "Image";
  return "Text";
}

function contentModeLabel(mode: AutomationBlock["config"]["contentMode"]) {
  if (mode === "workflow_context") return "workflow context";
  if (mode === "trigger_payload") return "trigger payload";
  if (mode === "latest_data") return "latest data";
  return "custom content";
}

function outputActionLabel(action: AutomationBlock["config"]["action"]) {
  if (action === "send_request") return "Send request to";
  if (action === "publish") return "Publish to";
  return "Pulse";
}

function bodyModeLabel(mode: AutomationBlock["config"]["bodyMode"]) {
  if (mode === "custom") return "custom JSON";
  if (mode === "trigger_payload") return "trigger payload";
  if (mode === "latest_data") return "latest data";
  if (mode === "latest_data_with_media") return "latest data + media";
  if (mode === "multipart_media") return "multipart media";
  if (mode === "none") return "no body";
  return "workflow context";
}
