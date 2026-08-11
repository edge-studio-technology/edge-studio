import type { AddressBookEntry } from "../../address-book/addressBookTypes";
import type { DataSource } from "../../data-sources/dataSourceTypes";
import type { WalletStatus } from "../../wallet/walletTypes";
import { formatRunDuration } from "../automationRunDisplay";
import type {
  AutomationBlock,
  AutomationBlockType,
  AutomationInboxItem,
  AutomationRun,
  AutomationValidationResult,
  AutomationWorkflow,
  ConditionOperator,
} from "../automationTypes";
import type {
  DraftWorkflowBlock,
  WorkflowCanvasRuntimeState,
  WorkflowCanvasValidationIssue,
} from "./canvas";

/** Pure workflow draft/config/label helpers (no React). Graph visuals stay in `workflow/canvas/`. */
export const WORKFLOW_INTERVAL_OPTIONS = [10, 30, 60, 300, 900, 3600] as const;

export const conditionOperatorOptions: { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "greater_than", label: "is greater than" },
  { value: "greater_than_or_equals", label: "is greater than or equal to" },
  { value: "less_than", label: "is less than" },
  { value: "less_than_or_equals", label: "is less than or equal to" },
  { value: "exists", label: "exists" },
  { value: "does_not_exist", label: "does not exist" },
];

export { formatRunDuration as formatDuration };

/** Default name when opening create workflow (e.g. "New workflow - 7 Aug 2026"). */
export function defaultCreateWorkflowName(now = new Date()) {
  const date = now.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `New workflow - ${date}`;
}

export function flattenDraftBlocks(blocks: DraftWorkflowBlock[]) {
  return blocks.flatMap((block) => [
    { type: block.type, config: block.config, clientId: block.id },
    ...(block.attachedBlocks ?? []).map((attached) => ({
      type: attached.type,
      config: attached.config,
      clientId: attached.id,
      parentBlockId: block.id,
    })),
  ]);
}

export function createDraftBlock(
  type: AutomationBlockType,
  sources: DataSource[],
  pollingIntervalSeconds = 60,
): DraftWorkflowBlock {
  return {
    id: `${type}-${crypto.randomUUID()}`,
    type,
    config: defaultDraftConfig(type, sources, pollingIntervalSeconds),
  };
}

export function defaultDraftConfig(
  type: AutomationBlockType,
  sources: DataSource[],
  pollingIntervalSeconds = 60,
): AutomationBlock["config"] {
  if (type === "schedule_start") return { intervalSeconds: pollingIntervalSeconds };
  if (type === "manual_start") return {};
  if (type === "fetch_data_source") return { sourceId: firstReadableSource(sources)?.id ?? "" };
  if (type === "capture_camera") return { sourceId: firstCameraSource(sources)?.id ?? "" };
  if (
    type === "gpio_event_start" ||
    type === "webhook_event_start" ||
    type === "mqtt_event_start"
  ) {
    const source = defaultSourceForStart(type, sources);
    return {
      sourceId: source?.id ?? "",
      activeOnly: source?.config.profile === "pir-motion" ? true : undefined,
      cooldownSeconds: source?.config.profile === "pir-motion" ? 60 : 0,
    };
  }
  if (type === "if_payload_field_equals")
    return { source: "trigger", fieldPath: "active", operator: "equals", value: true };
  if (type === "wait") return { durationMs: 1000 };
  if (type === "show_preview") {
    return {
      title: "Workflow preview",
      previewFormat: "text",
      contentMode: "custom",
      contentTemplateText: "Workflow preview",
    };
  }
  if (type === "set_variable") {
    return {
      variableName: "message",
      variableSource: "custom_json",
      valueJsonText: '"Button pressed"',
    };
  }
  if (type === "control_output") {
    const target = sources.find((source) => isOutputTarget(source));
    return defaultOutputBlockConfig(target, 500);
  }
  if (type === "send_transaction")
    return { recipientAddressBookId: "", tokenId: "0x00", amount: "" };
  if (type === "stamp_integritas") return { condition: null };
  return {};
}

export function defaultEditBlockConfig(
  type: AutomationBlockType,
  sources: DataSource[],
  addressBook: AddressBookEntry[],
): AutomationBlock["config"] {
  const config = defaultDraftConfig(type, sources);
  if (type === "send_transaction")
    return { ...config, recipientAddressBookId: addressBook[0]?.id ?? "" };
  return config;
}

/** True when send payment config can be persisted (API requires recipient + positive amount). */
export function canPersistSendTransactionConfig(config: AutomationBlock["config"]) {
  const errors = sendPaymentFieldErrors(config, { revealRequired: true });
  return !errors.recipient && !errors.amount;
}

/** Field errors for Send payment. Pass revealRequired after the user tries Done. */
export function sendPaymentFieldErrors(
  config: AutomationBlock["config"],
  options: { revealRequired?: boolean } = {},
) {
  const recipient = String(config.recipientAddressBookId ?? "").trim();
  const amount = String(config.amount ?? "").trim();
  const revealRequired = options.revealRequired === true;

  let recipientError: string | undefined;
  let amountError: string | undefined;

  if (revealRequired && !recipient) {
    recipientError = "Choose an address book recipient.";
  }

  if (amount) {
    if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
      amountError = "Enter a positive amount (for example 1 or 0.5).";
    }
  } else if (revealRequired) {
    amountError = "Enter a positive amount.";
  }

  return { recipient: recipientError, amount: amountError };
}

export function groupValidationIssues(
  issues: AutomationValidationResult["errors"],
): { issue: AutomationValidationResult["errors"][number]; count: number }[] {
  const grouped = new Map<
    string,
    { issue: AutomationValidationResult["errors"][number]; count: number }
  >();
  for (const issue of issues) {
    const key = [issue.level, issue.code, issue.message, issue.blockType ?? ""].join("|");
    const existing = grouped.get(key);
    if (existing) existing.count += 1;
    else grouped.set(key, { issue, count: 1 });
  }
  return [...grouped.values()];
}

export function validationIssuesByBlockId(
  validation: AutomationValidationResult | null,
): Record<string, WorkflowCanvasValidationIssue[]> {
  const result: Record<string, WorkflowCanvasValidationIssue[]> = {};
  if (!validation) return result;
  for (const issue of [...validation.errors, ...validation.warnings]) {
    if (!issue.blockId) continue;
    result[issue.blockId] = [
      ...(result[issue.blockId] ?? []),
      { level: issue.level, message: issue.message },
    ];
  }
  return result;
}

/**
 * Frontend-only: treat insufficient wallet balance as a warning so operators can
 * save/enable/create before funding. Backend still returns it as an error and
 * run-time send still fails until funded.
 */
export function withSoftenedInsufficientBalance(
  validation: AutomationValidationResult | null,
): AutomationValidationResult | null {
  if (!validation) return null;
  const demoted = validation.errors.filter(
    (issue) => issue.code === "send_transaction.insufficient_balance",
  );
  if (demoted.length === 0) return validation;
  const errors = validation.errors.filter(
    (issue) => issue.code !== "send_transaction.insufficient_balance",
  );
  return {
    ok: errors.length === 0,
    errors,
    warnings: [
      ...validation.warnings,
      ...demoted.map((issue) => ({ ...issue, level: "warning" as const })),
    ],
  };
}

export function runtimeByBlockIdFromRun(
  run: AutomationRun | undefined,
): Record<string, WorkflowCanvasRuntimeState> {
  const result: Record<string, WorkflowCanvasRuntimeState> = {};
  if (!run) return result;
  for (const block of run.blocks) {
    if (!block.blockId) continue;
    result[block.blockId] = {
      status: block.status,
      durationMs: block.durationMs,
      error: block.error,
    };
  }
  return result;
}

export function blockRunForBlock(run: AutomationRun | undefined, blockId: string | null) {
  if (!run || !blockId) return null;
  return run.blocks.find((block) => block.blockId === blockId) ?? null;
}

export function diagnosticsLink(tab: "proofs" | "reads", id: string) {
  const params = new URLSearchParams({ tab, page: "1", pageSize: "25", q: id });
  return `/diagnostics?${params.toString()}`;
}

export function readIdFromOutput(output: unknown) {
  if (!output || typeof output !== "object") return null;
  const record = output as { readId?: unknown; data?: { readId?: unknown } };
  if (typeof record.readId === "string") return record.readId;
  if (record.data && typeof record.data.readId === "string") return record.data.readId;
  return null;
}

export function proofIdFromOutput(output: unknown) {
  if (!output || typeof output !== "object") return null;
  const record = output as { proofId?: unknown };
  return typeof record.proofId === "string" ? record.proofId : null;
}

export function workflowMatchesFilter(
  workflow: AutomationWorkflow,
  search: string,
  filter: "active" | "all" | "enabled" | "paused" | "error" | "archived",
  sourceName: string,
) {
  if (filter === "active" && workflow.archived) return false;
  if (filter === "enabled" && (!workflow.enabled || workflow.archived)) return false;
  if (filter === "paused" && (workflow.enabled || workflow.archived)) return false;
  if (filter === "error" && !workflow.lastError) return false;
  if (filter === "archived" && !workflow.archived) return false;

  const query = search.trim().toLowerCase();
  if (!query) return true;
  const haystack = [
    workflow.name,
    workflowPrimarySourceId(workflow),
    sourceName,
    workflow.lastHash ?? "",
    workflow.lastProofId ?? "",
    workflow.lastError ?? "",
    workflow.blocks
      .map((block) => `${block.type} ${block.config.sourceId ?? ""} ${block.config.targetId ?? ""}`)
      .join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function moveBlock(blocks: AutomationBlock[], from: number, to: number) {
  const next = blocks.map((block) => block.id);
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function summarizeBlocks(workflow: AutomationWorkflow) {
  const mainBlocks = workflow.blocks.filter((block) => !block.parentBlockId);
  if (mainBlocks.length === 0) return "No blocks";
  return mainBlocks
    .map((block) => {
      const hasStamp = workflow.blocks.some(
        (item) => item.parentBlockId === block.id && item.type === "stamp_integritas",
      );
      return `${blockShortLabel(block)}${hasStamp ? " (+Stamp)" : ""}`;
    })
    .join(" -> ");
}

export function blockLabel(block: AutomationBlock) {
  if (block.type === "schedule_start") return "Start on schedule";
  if (block.type === "gpio_event_start") return "Start on GPIO event";
  if (block.type === "webhook_event_start") return "Start on webhook";
  if (block.type === "mqtt_event_start") return "Start on MQTT message";
  if (block.type === "manual_start") return "Start manually";
  if (block.type === "record_trigger_event") return "Record trigger event";
  if (block.type === "fetch_data_source") return "Fetch data source";
  if (block.type === "capture_camera") return "Capture camera";
  if (block.type === "set_variable") return "Set variable";
  if (block.type === "if_payload_field_equals") {
    return `If ${conditionSourceLabel(block.config.source ?? "trigger")} field matches`;
  }
  if (block.type === "wait") return "Wait";
  if (block.type === "show_preview") return "Show preview";
  if (block.type === "stamp_integritas") return "Stamp data";
  if (block.type === "control_output") return "Control device";
  if (block.type === "send_transaction") return "Send payment";
  return block.type;
}

export function blockShortLabel(block: AutomationBlock) {
  if (block.type.endsWith("_start")) return "Start";
  if (block.type === "record_trigger_event") return "Record event";
  if (block.type === "fetch_data_source") return "Fetch source";
  if (block.type === "capture_camera") return "Capture camera";
  if (block.type === "set_variable") return "Set variable";
  if (block.type === "if_payload_field_equals") return "If field matches";
  if (block.type === "show_preview") return "Show preview";
  if (block.type === "stamp_integritas") return "Stamp";
  if (block.type === "control_output") return "Control device";
  if (block.type === "send_transaction") return "Send payment";
  if (block.type === "wait") return "Wait";
  return block.type;
}

export function conditionSourceLabel(source: "trigger" | "variable") {
  return source === "variable" ? "variable" : "trigger";
}

export function operatorHasNoValue(operator: ConditionOperator) {
  return operator === "exists" || operator === "does_not_exist";
}

export function compareValueInputText(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function parseCompareValueInput(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function sourcesForStart(type: AutomationBlockType, sources: DataSource[]) {
  if (type === "gpio_event_start") return sources.filter((source) => source.type === "gpio-input");
  if (type === "webhook_event_start") return sources.filter((source) => source.type === "webhook");
  if (type === "mqtt_event_start") return sources.filter((source) => source.type === "mqtt");
  return [];
}

export function defaultSourceForStart(type: AutomationBlockType, sources: DataSource[]) {
  return sourcesForStart(type, sources)[0] ?? null;
}

export function workflowPrimarySourceId(workflow: AutomationWorkflow) {
  const mainBlocks = workflow.blocks.filter((block) => !block.parentBlockId);
  const fetchBlock = mainBlocks.find((block) => block.type === "fetch_data_source");
  const captureBlock = mainBlocks.find((block) => block.type === "capture_camera");
  const startBlock = mainBlocks.find((block) => block.type.endsWith("_start"));
  return (
    fetchBlock?.config.sourceId ??
    captureBlock?.config.sourceId ??
    startBlock?.config.sourceId ??
    ""
  );
}

export function workflowIntervalSeconds(workflow: AutomationWorkflow) {
  const startBlock = workflow.blocks.find(
    (block) => !block.parentBlockId && block.type === "schedule_start",
  );
  const intervalSeconds = Number(startBlock?.config.intervalSeconds);
  return Number.isFinite(intervalSeconds) ? intervalSeconds : 0;
}

export function firstReadableSource(sources: DataSource[]) {
  return sources.find(isReadableSource) ?? null;
}

export function firstCameraSource(sources: DataSource[]) {
  return sources.find((source) => source.type === "pi-camera") ?? null;
}

export function nativeMinimaTokens(walletStatus: WalletStatus | null) {
  return (walletStatus?.tokens ?? []).filter(
    (token) => token.isNative || token.tokenId.toLowerCase() === "0x00",
  );
}

export function examplePayload(workflow: AutomationWorkflow) {
  const startBlock = workflow.blocks.find(
    (block) => !block.parentBlockId && block.type.endsWith("_start"),
  );
  const now = new Date().toISOString();

  if (startBlock?.type === "gpio_event_start") {
    return {
      source: "run-with-payload",
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggeredAt: now,
      chip: "gpiochip0",
      pin: 23,
      profile: "pir-motion",
      edge: "rising",
      event: "motion_detected",
      active: true,
    };
  }

  if (startBlock?.type === "webhook_event_start") {
    return {
      source: "run-with-payload",
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggeredAt: now,
      event: "test-webhook",
      temperature: 21.5,
      unit: "celsius",
    };
  }

  if (startBlock?.type === "mqtt_event_start") {
    return {
      source: "run-with-payload",
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggeredAt: now,
      topic: "test/topic",
      temperature: 21.5,
      unit: "celsius",
    };
  }

  return {
    source: "run-with-payload",
    workflowId: workflow.id,
    workflowName: workflow.name,
    triggeredAt: now,
    note: "Manual workflow test run with custom payload",
  };
}

export function sourceLabel(source: DataSource) {
  if (source.type === "webhook") return "Webhook receive URL";
  if (source.type === "mqtt")
    return `${source.config.brokerUrl ?? "MQTT broker"} ${source.config.topic ?? ""}`;
  if (source.type === "gpio-input") {
    return `${source.config.profile === "pir-motion" ? "PIR motion " : ""}${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"}`;
  }
  if (source.type === "gpio-output") {
    return `${source.config.profile ?? "led"} ${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"} active:${source.config.activeState ?? "high"}`;
  }
  if (source.type === "http-output")
    return `${source.config.method ?? "POST"} ${source.config.url ?? "HTTP output"}`;
  if (source.type === "mqtt-output")
    return `${source.config.brokerUrl ?? "MQTT broker"} ${source.config.topic ?? ""}`;
  if (source.type === "pi-camera") {
    return `${source.config.mode ?? "photo"} ${source.config.width ?? 1280}x${source.config.height ?? 720}`;
  }
  if (source.type === "bme-sensor") {
    return `${source.config.sensor ?? "bme280"} i2c-${source.config.bus ?? 1} ${source.config.address ?? "0x76"}`;
  }
  return source.config.url ?? "HTTP JSON Source";
}

export function isReadableSource(source: DataSource) {
  return (
    source.type === "json-api" ||
    source.type === "internal-json-api" ||
    source.type === "bme-sensor"
  );
}

export function isOutputTarget(source: DataSource) {
  return (
    source.type === "gpio-output" || source.type === "http-output" || source.type === "mqtt-output"
  );
}

export function outputActionForTarget(source: DataSource | undefined) {
  if (source?.type === "http-output") return "send_request";
  if (source?.type === "mqtt-output") return "publish";
  return "pulse";
}

export function defaultOutputBlockConfig(
  source: DataSource | undefined,
  durationMs: number,
): AutomationBlock["config"] {
  if (source?.type === "gpio-output") return { targetId: source.id, action: "pulse", durationMs };
  if (source?.type === "http-output") {
    return {
      targetId: source.id,
      action: "send_request",
      bodyMode: "custom",
      bodyTemplateText: defaultCustomBodyText(),
    };
  }
  if (source?.type === "mqtt-output") {
    return {
      targetId: source.id,
      action: "publish",
      bodyMode: "custom",
      bodyTemplateText: defaultCustomBodyText(),
    };
  }
  return { targetId: "", action: "pulse", durationMs };
}

export function retargetOutputBlockConfig(
  config: AutomationBlock["config"],
  target: DataSource | undefined,
): AutomationBlock["config"] {
  if (!target) return { ...config, targetId: "" };
  if (target.type === "gpio-output")
    return { targetId: target.id, action: "pulse", durationMs: config.durationMs ?? 500 };
  if (target.type !== "http-output" && target.type !== "mqtt-output")
    return { ...config, targetId: target.id };

  const action = outputActionForTarget(target);
  const bodyMode = compatibleBodyMode(config.bodyMode, target.type);
  return outputBodyModeConfig({ ...config, targetId: target.id, action }, bodyMode, target.type);
}

export function compatibleBodyMode(
  bodyMode: AutomationBlock["config"]["bodyMode"],
  targetType: "http-output" | "mqtt-output",
) {
  if (!bodyMode) return "custom";
  if (targetType === "mqtt-output" && (bodyMode === "none" || bodyMode === "multipart_media")) {
    return "workflow_context";
  }
  return bodyMode;
}

export function outputBodyModeConfig(
  config: AutomationBlock["config"],
  bodyMode: NonNullable<AutomationBlock["config"]["bodyMode"]>,
  targetType: "http-output" | "mqtt-output",
): AutomationBlock["config"] {
  const next = { ...config, bodyMode };
  if (bodyMode === "custom" && !next.bodyTemplateText)
    next.bodyTemplateText = defaultCustomBodyText();
  if (bodyMode !== "custom") delete next.bodyTemplateText;
  if (bodyMode === "multipart_media") {
    next.multipartFileField = next.multipartFileField ?? "file";
    next.multipartJsonField = next.multipartJsonField ?? "metadata";
    next.multipartJsonText = next.multipartJsonText ?? defaultMultipartJsonText();
  } else {
    delete next.multipartFileField;
    delete next.multipartJsonField;
    delete next.multipartJsonText;
  }
  if (targetType === "mqtt-output" && bodyMode === "none")
    return { ...next, bodyMode: "workflow_context" };
  return next;
}

export function defaultVariableSourceConfig(
  config: AutomationBlock["config"],
  variableSource: NonNullable<AutomationBlock["config"]["variableSource"]>,
): AutomationBlock["config"] {
  const base = { variableName: config.variableName ?? "message", variableSource };
  if (variableSource === "custom_json") {
    return { ...base, valueJsonText: config.valueJsonText ?? '"Button pressed"' };
  }
  return {
    ...base,
    fieldPath:
      variableSource === "trigger_field"
        ? "pin"
        : variableSource === "latest_data_field"
          ? "temperature"
          : "hash",
  };
}

export function defaultConditionSourceConfig(
  config: AutomationBlock["config"],
  source: "trigger" | "variable",
): AutomationBlock["config"] {
  if (source === "variable") {
    return { ...config, source, variableName: config.variableName ?? "temp", fieldPath: undefined };
  }
  return { ...config, source, fieldPath: config.fieldPath ?? "active", variableName: undefined };
}

export function defaultPreviewFormatConfig(
  config: AutomationBlock["config"],
  previewFormat: NonNullable<AutomationBlock["config"]["previewFormat"]>,
): AutomationBlock["config"] {
  return {
    ...config,
    previewFormat,
    contentTemplateText: defaultPreviewContentText(previewFormat, config.imageSource),
    imageSource: previewFormat === "image" ? (config.imageSource ?? "url") : undefined,
  };
}

export function previewContentModeConfig(
  config: AutomationBlock["config"],
  contentMode: NonNullable<AutomationBlock["config"]["contentMode"]>,
): AutomationBlock["config"] {
  if (contentMode === "custom") {
    return {
      ...config,
      contentMode,
      contentTemplateText:
        config.contentTemplateText ??
        defaultPreviewContentText(config.previewFormat ?? "text", config.imageSource),
    };
  }
  return { ...config, contentMode, contentTemplateText: undefined };
}

export function defaultPreviewContentText(
  format: AutomationBlock["config"]["previewFormat"],
  imageSource?: AutomationBlock["config"]["imageSource"],
) {
  if (format === "json") return "{}";
  if (format === "link") return "https://integritas.technology";
  if (format === "image") {
    return imageSource === "local_path"
      ? "camera/snapshot.jpg"
      : "https://integritas.technology/favicon.ico";
  }
  return "Workflow preview";
}

export function outputBodyModes(targetType: "http-output" | "mqtt-output") {
  return [
    { value: "custom", label: "Custom JSON" },
    { value: "workflow_context", label: "Workflow context" },
    { value: "trigger_payload", label: "Trigger payload" },
    { value: "latest_data", label: "Latest data" },
    { value: "latest_data_with_media", label: "Latest data + media" },
    ...(targetType === "http-output"
      ? [{ value: "multipart_media", label: "Multipart media upload" }]
      : []),
    ...(targetType === "http-output" ? [{ value: "none", label: "No body" }] : []),
  ] as { value: NonNullable<AutomationBlock["config"]["bodyMode"]>; label: string }[];
}

export function bodyModeDescription(
  bodyMode: AutomationBlock["config"]["bodyMode"],
  targetType: "http-output" | "mqtt-output",
) {
  if (bodyMode === "custom") {
    return targetType === "http-output"
      ? "Send exactly this JSON as the request body."
      : "Publish exactly this JSON as the message payload.";
  }
  if (bodyMode === "trigger_payload")
    return "Send only the event payload that started this workflow.";
  if (bodyMode === "latest_data")
    return "Send the data recorded or fetched earlier in this workflow.";
  if (bodyMode === "latest_data_with_media") {
    return "Send latest data plus captured media bytes as base64 JSON. Requires a camera capture earlier in the workflow.";
  }
  if (bodyMode === "multipart_media") {
    return "Upload the latest camera capture as a multipart file attachment. Configure field names to match the target service.";
  }
  if (bodyMode === "none") return "Send the request without a body.";
  return "Send workflow trigger, data, output, hash, and proof references.";
}

export function defaultCustomBodyText() {
  return '{\n  "content": "Integritas Pi workflow triggered."\n}';
}

export function defaultMultipartJsonText() {
  return '{\n  "message": "Integritas Pi camera capture",\n  "hash": "{{hash}}",\n  "readId": "{{readId}}",\n  "sourceName": "{{sourceName}}",\n  "fileName": "{{fileName}}"\n}';
}

export function formatInterval(seconds: number) {
  if (seconds < 60) return `Every ${seconds} seconds`;
  if (seconds < 3600) return `Every ${seconds / 60} minute${seconds === 60 ? "" : "s"}`;
  return `Every ${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`;
}

export function textPreviewContent(item: AutomationInboxItem) {
  if (typeof item.content === "string") return item.content;
  if (item.content == null) return item.renderedText ?? "";
  return JSON.stringify(item.content, null, 2);
}

export function isImagePreviewContent(
  value: unknown,
): value is { source: "url" | "local_path"; value: string } {
  return Boolean(
    value &&
    typeof value === "object" &&
    "source" in value &&
    "value" in value &&
    typeof (value as { value?: unknown }).value === "string",
  );
}
