import { env } from "../../config/env.js";
import { getAddressBookEntryById } from "../address-book/address-book.repository.js";
import { getCameraCapability } from "../data-sources/cameraCapture.service.js";
import { getDataSource } from "../data-sources/dataSources.repository.js";
import { getGpioInputCapability } from "../data-sources/gpioIngestion.service.js";
import { getSensorHelperCapability } from "../data-sources/sensorHelper.service.js";
import { parseGpioOutputConfig } from "../data-sources/dataSources.service.js";
import { getIntegritasApiKey } from "../settings/secrets.service.js";
import { getWalletStatus } from "../wallet/wallet.service.js";
import { listAutomationBlocks, type AutomationBlockType } from "./automation.repository.js";

export type AutomationValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  blockId?: string;
  blockType?: AutomationBlockType;
};

export type AutomationValidationResult = {
  ok: boolean;
  errors: AutomationValidationIssue[];
  warnings: AutomationValidationIssue[];
};

export type AutomationDraftValidationBlock = {
  clientId?: string | null;
  type: AutomationBlockType;
  enabled?: boolean;
  parentBlockId?: string | null;
  config: BlockConfig;
};

type ValidationBlock = {
  id: string;
  type: AutomationBlockType;
  enabled: boolean;
  parentId: string | null;
  config: BlockConfig;
};

export type BlockConfig = {
  sourceId?: string;
  targetId?: string;
  action?: string;
  durationMs?: number;
  bodyMode?: string;
  bodyTemplateText?: string;
  bodyTemplate?: unknown;
  multipartFileField?: string;
  multipartJsonField?: string;
  multipartJsonText?: string;
  variableName?: string;
  variableSource?: string;
  valueJsonText?: string;
  source?: "trigger" | "variable";
  fieldPath?: string;
  operator?: string;
  value?: unknown;
  condition?: { source?: "trigger" | "data" } | null;
  recipientAddressBookId?: string;
  tokenId?: string;
  amount?: string;
  activeOnly?: boolean;
  cooldownSeconds?: number;
  title?: string;
  previewFormat?: string;
  contentMode?: string;
  contentTemplateText?: string;
  imageSource?: string;
};

export async function validateAutomationWorkflow(workflowId: string): Promise<AutomationValidationResult> {
  const blocks = listAutomationBlocks(workflowId).map((block): ValidationBlock => ({
    id: block.id,
    type: block.type,
    enabled: Boolean(block.enabled),
    parentId: block.parent_block_id,
    config: parseConfig(block)
  }));
  return validateAutomationBlockGraph(blocks);
}

export async function validateAutomationDraft(blocks: AutomationDraftValidationBlock[]): Promise<AutomationValidationResult> {
  return validateAutomationBlockGraph(blocks.map((block, index): ValidationBlock => ({
    id: block.clientId || `draft-${index}`,
    type: block.type,
    enabled: block.enabled !== false,
    parentId: block.parentBlockId ?? null,
    config: block.config
  })));
}

async function validateAutomationBlockGraph(blocks: ValidationBlock[]): Promise<AutomationValidationResult> {
  const issues: AutomationValidationIssue[] = [];
  const mainBlocks = blocks.filter((block) => !block.parentId);
  const startBlock = mainBlocks[0];

  if (mainBlocks.length === 0) {
    addIssue(issues, "error", "workflow.no_blocks", "Workflow has no blocks.");
  } else if (!startBlock.type.endsWith("_start")) {
    addIssue(issues, "error", "workflow.missing_start", "The first workflow block must be a start block.", startBlock);
  }

  if (mainBlocks.slice(1).some((block) => block.type.endsWith("_start"))) {
    addIssue(issues, "error", "workflow.multiple_starts", "Only the first workflow block can be a start block.");
  }

  if (startBlock && !startBlock.enabled) {
    addIssue(issues, "error", "workflow.start_disabled", "The start block is disabled, so this workflow cannot run.", startBlock);
  }

  if (blocks.filter((block) => block.enabled && !block.type.endsWith("_start") && !block.parentId).length === 0) {
    addIssue(issues, "warning", "workflow.no_enabled_actions", "Workflow has no enabled action blocks after the start block.");
  }

  let hasData = false;
  const variables = new Set<string>();
  const startType = startBlock?.type;
  const startConfig = startBlock?.config ?? {};
  const hostBackedSourceTypes = new Set<string>();
  for (const block of blocks.filter((item) => item.enabled)) {
    const source = block.config.sourceId ? getDataSource(block.config.sourceId) : undefined;
    const target = block.config.targetId ? getDataSource(block.config.targetId) : undefined;
    if (source?.type) hostBackedSourceTypes.add(source.type);
    if (target?.type) hostBackedSourceTypes.add(target.type);
  }
  const hardwareCapabilities: HardwareCapabilities = {
    camera: blocks.some((block) => block.enabled && block.type === "capture_camera") || hostBackedSourceTypes.has("pi-camera") ? normalizeRuntimeCapability(await getCameraCapability()) : null,
    gpio: hostBackedSourceTypes.has("gpio-input") || hostBackedSourceTypes.has("gpio-output") ? getGpioInputCapability() : null,
    sensors: hostBackedSourceTypes.has("bme-sensor") ? await getSensorHelperCapability() : null,
    mqtt: hostBackedSourceTypes.has("mqtt") || hostBackedSourceTypes.has("mqtt-output") ? { enabled: env.mqttBrokerEnabled, available: env.mqttBrokerEnabled, reason: env.mqttBrokerEnabled ? null : "Local MQTT broker is disabled." } : null,
  };

  for (const block of mainBlocks) {
    if (!block.enabled) continue;
    const config = block.config;

    validateBlockReference(block, config, issues, hardwareCapabilities);
    if (block.type === "gpio_event_start" || block.type === "webhook_event_start" || block.type === "mqtt_event_start") validateEventStartConfig(block, config, issues);

    if (block.type === "record_trigger_event") {
      if (startType !== "gpio_event_start" && startType !== "webhook_event_start" && startType !== "mqtt_event_start") {
        addIssue(issues, "error", "record_trigger_event.requires_event_start", "Record trigger event requires a GPIO, webhook, or MQTT event start block.", block);
      }
      if (!startConfig.sourceId) addIssue(issues, "error", "record_trigger_event.missing_source", "Record trigger event requires the start block to reference a device/source.", block);
      hasData = true;
    }

    if (block.type === "fetch_data_source") {
      hasData = true;
    }

    if (block.type === "capture_camera") {
      hasData = true;
    }

    if (block.type === "set_variable") {
      validateSetVariableBlock(block, config, hasData, issues);
      const variableName = String(config.variableName ?? "").trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(variableName)) variables.add(variableName);
    }

    if (block.type === "if_payload_field_equals") {
      validateWorkflowConditionBlock(block, config, variables, issues);
    }

    if (block.type === "show_preview") {
      validateShowPreviewBlock(block, config, hasData, issues);
    }

    for (const attachedBlock of blocks.filter((item) => item.enabled && item.parentId === block.id)) {
      const attachedConfig = attachedBlock.config;
      if (attachedBlock.type !== "stamp_integritas") {
        addIssue(issues, "error", "attached.unsupported", "Only Integritas stamp blocks can be attached to another block.", attachedBlock);
        continue;
      }
      if (block.type !== "record_trigger_event" && block.type !== "fetch_data_source" && block.type !== "capture_camera") {
        addIssue(issues, "error", "stamp_integritas.invalid_parent", "Integritas stamps must be attached to a record, fetch, or camera capture block.", attachedBlock);
      }
      if (!hasData) {
        addIssue(issues, "error", "stamp_integritas.no_hash", "Integritas stamping requires a prior record/fetch block that creates a hash.", attachedBlock);
      }
      if (attachedConfig.condition && (attachedConfig.condition.source ?? "data") === "data" && !hasData) {
        addIssue(issues, "error", "stamp_integritas.condition_data_before_data_block", "Stamp condition reads Data, but no data is available before this stamp.", attachedBlock);
      }
      if (!getIntegritasApiKey()) {
        addIssue(issues, "warning", "stamp_integritas.no_api_key", "Integritas API key is not configured; this stamp block will fail until a key is saved.", attachedBlock);
      }
    }
  }

  await validateTransactionBalances(blocks.filter((block) => block.enabled), issues);

  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  return { ok: errors.length === 0, errors, warnings };
}

function validateBlockReference(block: ValidationBlock, config: BlockConfig, issues: AutomationValidationIssue[], hardwareCapabilities: HardwareCapabilities) {
  if (block.type === "gpio_event_start" || block.type === "webhook_event_start" || block.type === "mqtt_event_start" || block.type === "fetch_data_source" || block.type === "capture_camera") {
    const source = config.sourceId ? getDataSource(config.sourceId) : undefined;
    if (!source) {
      addIssue(issues, "error", `${block.type}.missing_source`, "Block references a missing device/source.", block);
      return;
    }
    if (block.type === "gpio_event_start" && source.type !== "gpio-input") addIssue(issues, "error", "gpio_event_start.invalid_source", "GPIO start requires a GPIO input source.", block);
    if (block.type === "webhook_event_start" && source.type !== "webhook") addIssue(issues, "error", "webhook_event_start.invalid_source", "Webhook start requires a webhook source.", block);
    if (block.type === "mqtt_event_start" && source.type !== "mqtt") addIssue(issues, "error", "mqtt_event_start.invalid_source", "MQTT start requires an MQTT source.", block);
    if (block.type === "fetch_data_source" && !isReadableDataSource(source.type)) addIssue(issues, "error", "fetch_data_source.invalid_source", "Fetch block requires a readable data source.", block);
    if (block.type === "capture_camera" && source.type !== "pi-camera") addIssue(issues, "error", "capture_camera.invalid_source", "Capture camera requires a Pi Camera device.", block);
    if (block.type === "capture_camera") addIssue(issues, "warning", "capture_camera.privacy", "Camera capture can record private images or video. Verify consent, placement, and retention before enabling this workflow.", block);
    validateSourceHardware(block, source, hardwareCapabilities, issues);
  }

  if (block.type === "control_output") {
    const target = config.targetId ? getDataSource(config.targetId) : undefined;
    if (!target || !isOutputTarget(target.type)) {
      addIssue(issues, "error", "control_output.missing_target", "Control output references a missing or non-output device.", block);
      return;
    }
    if (target.type === "gpio-output") {
      const targetConfig = parseGpioOutputConfig(JSON.parse(target.config) as unknown);
      if (targetConfig.profile !== "led") addIssue(issues, "error", "control_output.unsupported_profile", "Only LED output targets are supported.", block);
      addIssue(issues, "warning", "control_output.hardware", "Control output drives GPIO hardware. Verify wiring and test pulse before enabling this workflow.", block);
    }
    if (target.type === "http-output") addIssue(issues, "warning", "control_output.http", "Control output sends an HTTP request to the configured target when this workflow runs.", block);
    if (target.type === "mqtt-output") addIssue(issues, "warning", "control_output.mqtt", "Control output publishes an MQTT message to the configured broker/topic when this workflow runs.", block);
    validateSourceHardware(block, target, hardwareCapabilities, issues);
    validateOutputBodyConfig(block, config, target.type, issues);
  }

  if (block.type === "send_transaction") {
    const recipient = config.recipientAddressBookId ? getAddressBookEntryById(config.recipientAddressBookId) : null;
    if (!recipient) addIssue(issues, "error", "send_transaction.missing_recipient", "Send transaction references a missing address book recipient.", block);
    if (String(config.tokenId ?? "0x00").toLowerCase() !== "0x00") addIssue(issues, "error", "send_transaction.unsupported_token", "Send transaction currently supports only native MINIMA tokenid 0x00.", block);
    if (!isPositiveDecimal(String(config.amount ?? ""))) addIssue(issues, "error", "send_transaction.invalid_amount", "Send transaction requires a positive amount.", block);
    addIssue(issues, "warning", "send_transaction.moves_funds", "This block sends wallet funds automatically when the workflow runs.", block);
  }
}

type RuntimeCapability = { enabled?: boolean; available: boolean; reason?: string | null } | null;
type HardwareCapabilities = {
  camera: RuntimeCapability;
  gpio: RuntimeCapability;
  sensors: RuntimeCapability;
  mqtt: RuntimeCapability;
};

function validateSourceHardware(
  block: ValidationBlock,
  source: { type: string; config: string },
  hardwareCapabilities: HardwareCapabilities,
  issues: AutomationValidationIssue[],
) {
  if (source.type === "pi-camera") validateHardwareCapability(block, "camera", hardwareCapabilities.camera, issues);
  if (source.type === "bme-sensor") validateHardwareCapability(block, "sensors", hardwareCapabilities.sensors, issues);
  if (source.type === "gpio-input" || source.type === "gpio-output") validateHardwareCapability(block, "gpio", hardwareCapabilities.gpio, issues);
  if ((source.type === "mqtt" || source.type === "mqtt-output") && usesLocalMqttBroker(source.config)) validateHardwareCapability(block, "mqtt", hardwareCapabilities.mqtt, issues);
}

function normalizeRuntimeCapability(capability: { enabled?: boolean; available?: boolean; reason?: string | null }): RuntimeCapability {
  return { enabled: capability.enabled, available: Boolean(capability.available), reason: capability.reason ?? null };
}

function validateHardwareCapability(
  block: ValidationBlock,
  capabilityName: keyof HardwareCapabilities,
  capability: RuntimeCapability,
  issues: AutomationValidationIssue[],
) {
  if (!capability) return;
  if (capability.enabled === false) addIssue(issues, "error", `${capabilityName}.disabled`, capability.reason ?? `${capabilityLabel(capabilityName)} support is disabled.`, block);
  else if (!capability.available) addIssue(issues, "warning", `${capabilityName}.unavailable`, capability.reason ?? `${capabilityLabel(capabilityName)} support is not ready.`, block);
}

function capabilityLabel(name: keyof HardwareCapabilities) {
  if (name === "camera") return "Pi Camera";
  if (name === "gpio") return "GPIO";
  if (name === "sensors") return "I2C sensor";
  return "Local MQTT broker";
}

function usesLocalMqttBroker(configJson: string) {
  try {
    const config = JSON.parse(configJson) as { brokerUrl?: string };
    const brokerUrl = config.brokerUrl?.trim().toLowerCase() ?? "";
    return brokerUrl === "mqtt://mqtt:1883" || brokerUrl === "mqtt://localhost:1883" || brokerUrl === "mqtt://127.0.0.1:1883";
  } catch {
    return false;
  }
}

function validateEventStartConfig(block: ValidationBlock, config: BlockConfig, issues: AutomationValidationIssue[]) {
  const cooldownSeconds = Number(config.cooldownSeconds ?? 0);
  if (!Number.isFinite(cooldownSeconds) || cooldownSeconds < 0 || cooldownSeconds > 86400) {
    addIssue(issues, "error", `${block.type}.invalid_cooldown`, "Event start cooldown must be between 0 and 86400 seconds.", block);
  }
}

function isOutputTarget(type: string) {
  return type === "gpio-output" || type === "http-output" || type === "mqtt-output";
}

function isReadableDataSource(type: string) {
  return type === "json-api" || type === "bme-sensor" || type === "device-system-data";
}

function validateOutputBodyConfig(block: ValidationBlock, config: BlockConfig, targetType: string, issues: AutomationValidationIssue[]) {
  if (targetType !== "http-output" && targetType !== "mqtt-output") return;
  const bodyMode = String(config.bodyMode ?? "workflow_context");
  if (bodyMode !== "custom" && bodyMode !== "workflow_context" && bodyMode !== "trigger_payload" && bodyMode !== "latest_data" && bodyMode !== "latest_data_with_media" && bodyMode !== "multipart_media" && bodyMode !== "none") {
    addIssue(issues, "error", "control_output.invalid_body_mode", "Output body mode is invalid.", block);
  }
  if (targetType === "mqtt-output" && bodyMode === "none") addIssue(issues, "error", "control_output.mqtt_body_required", "MQTT output requires a message payload.", block);
  if (targetType !== "http-output" && bodyMode === "multipart_media") addIssue(issues, "error", "control_output.multipart_http_required", "Multipart media upload requires an HTTP output target.", block);
  if (bodyMode === "multipart_media") validateMultipartConfig(block, config, issues);
  if (bodyMode === "custom") {
    const text = typeof config.bodyTemplateText === "string" ? config.bodyTemplateText : JSON.stringify(config.bodyTemplate ?? {});
    try {
      JSON.parse(text) as unknown;
    } catch {
      addIssue(issues, "error", "control_output.invalid_custom_body", "Custom output body must be valid JSON.", block);
    }
  }
}

function validateMultipartConfig(block: ValidationBlock, config: BlockConfig, issues: AutomationValidationIssue[]) {
  const fileField = String(config.multipartFileField ?? "file").trim();
  const jsonField = String(config.multipartJsonField ?? "").trim();
  if (!fileField) addIssue(issues, "error", "control_output.multipart_file_field_required", "Multipart file field name is required.", block);
  if (jsonField && typeof config.multipartJsonText === "string" && config.multipartJsonText.trim()) {
    try {
      JSON.parse(config.multipartJsonText) as unknown;
    } catch {
      addIssue(issues, "error", "control_output.multipart_json_invalid", "Multipart JSON field must be valid JSON.", block);
    }
  }
}

function validateSetVariableBlock(block: ValidationBlock, config: BlockConfig, hasData: boolean, issues: AutomationValidationIssue[]) {
  const variableName = String(config.variableName ?? "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variableName)) addIssue(issues, "error", "set_variable.invalid_name", "Set variable requires a valid variable name.", block);
  const variableSource = String(config.variableSource ?? "custom_json");
  if (variableSource !== "custom_json" && variableSource !== "trigger_field" && variableSource !== "latest_data_field" && variableSource !== "context_field") addIssue(issues, "error", "set_variable.invalid_source", "Set variable source is invalid.", block);
  if (variableSource === "latest_data_field" && !hasData) addIssue(issues, "error", "set_variable.data_before_data_block", "Latest data variables require a Record trigger event or Fetch data block before this block.", block);
  if (variableSource === "custom_json") {
    try {
      JSON.parse(config.valueJsonText ?? "null") as unknown;
    } catch {
      addIssue(issues, "error", "set_variable.invalid_json", "Variable custom JSON must be valid JSON.", block);
    }
    return;
  }
  const fieldPath = String(config.fieldPath ?? "").trim();
  if (!fieldPath) addIssue(issues, "error", "set_variable.missing_field_path", "Set variable field source requires a field path.", block);
  if (fieldPath && !/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(fieldPath)) addIssue(issues, "error", "set_variable.invalid_field_path", "Field path can only contain letters, numbers, underscores, dashes, and dots.", block);
}

function validateWorkflowConditionBlock(block: ValidationBlock, config: BlockConfig, variables: Set<string>, issues: AutomationValidationIssue[]) {
  const source = String(config.source ?? "trigger");
  if (source !== "trigger" && source !== "variable") addIssue(issues, "error", "condition.invalid_source", "Condition source must be Trigger event or Variable.", block);
  if (source === "variable") {
    const variableName = String(config.variableName ?? "").trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variableName)) addIssue(issues, "error", "condition.invalid_variable_name", "Variable conditions require a valid variable name.", block);
    else if (!variables.has(variableName)) addIssue(issues, "error", "condition.variable_before_set", `Variable '${variableName}' must be set by an enabled Set variable block before this condition.`, block);
  } else {
    const fieldPath = String(config.fieldPath ?? "").trim();
    if (!fieldPath) addIssue(issues, "error", "condition.missing_field_path", "Trigger conditions require a field path.", block);
    if (fieldPath && !/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(fieldPath)) addIssue(issues, "error", "condition.invalid_field_path", "Field path can only contain letters, numbers, underscores, dashes, and dots.", block);
  }
  if (!isConditionOperator(String(config.operator ?? ""))) addIssue(issues, "error", "condition.invalid_operator", "Condition requires a valid operator.", block);
  if (config.operator !== "exists" && config.operator !== "does_not_exist" && !Object.prototype.hasOwnProperty.call(config, "value")) addIssue(issues, "error", "condition.missing_value", "Condition requires a compare value.", block);
}

function validateShowPreviewBlock(block: ValidationBlock, config: BlockConfig, hasData: boolean, issues: AutomationValidationIssue[]) {
  const title = String(config.title ?? "Workflow preview").trim();
  if (!title || title.length > 120) addIssue(issues, "error", "show_preview.invalid_title", "Show preview title is required and must be 120 characters or less.", block);
  const format = String(config.previewFormat ?? "text");
  if (format !== "text" && format !== "json" && format !== "link" && format !== "image") addIssue(issues, "error", "show_preview.invalid_format", "Show preview format is invalid.", block);
  const contentMode = String(config.contentMode ?? "custom");
  if (contentMode !== "custom" && contentMode !== "workflow_context" && contentMode !== "trigger_payload" && contentMode !== "latest_data") addIssue(issues, "error", "show_preview.invalid_content_mode", "Show preview content source is invalid.", block);
  if (contentMode === "latest_data" && !hasData) addIssue(issues, "error", "show_preview.data_before_data_block", "Latest data previews require a Record trigger event, Fetch data, or Capture camera block before this block.", block);
  if (format === "image") {
    const imageSource = String(config.imageSource ?? "url");
    if (imageSource !== "url" && imageSource !== "local_path") addIssue(issues, "error", "show_preview.invalid_image_source", "Show preview image source is invalid.", block);
  }
  if (contentMode === "custom" && format === "json") {
    try {
      JSON.parse(config.contentTemplateText ?? "{}") as unknown;
    } catch {
      addIssue(issues, "error", "show_preview.invalid_json", "Show preview JSON content must be valid JSON.", block);
    }
  }
}

async function validateTransactionBalances(blocks: ValidationBlock[], issues: AutomationValidationIssue[]) {
  const transactionBlocks = blocks.filter((block) => block.type === "send_transaction");
  if (transactionBlocks.length === 0) return;

  try {
    const wallet = await getWalletStatus();
    const nativeToken = wallet.tokens.find((token) => token.isNative || token.tokenId.toLowerCase() === "0x00");
    if (!nativeToken) {
      for (const block of transactionBlocks) addIssue(issues, "error", "send_transaction.no_native_balance", "Wallet does not report a native MINIMA balance.", block);
      return;
    }
    for (const block of transactionBlocks) {
      const amount = String(block.config.amount ?? "").trim();
      if (isPositiveDecimal(amount) && compareDecimalStrings(amount, nativeToken.sendable) > 0) {
        addIssue(issues, "error", "send_transaction.insufficient_balance", `Amount exceeds available balance (${nativeToken.sendable} MINIMA).`, block);
      }
    }
  } catch (error) {
    for (const block of transactionBlocks) {
      addIssue(issues, "error", "send_transaction.wallet_unavailable", `Wallet balance could not be checked: ${error instanceof Error ? error.message : "unknown error"}.`, block);
    }
  }
}

function parseConfig(block: { config_json: string }) {
  return JSON.parse(block.config_json) as BlockConfig;
}

function addIssue(issues: AutomationValidationIssue[], level: AutomationValidationIssue["level"], code: string, message: string, block?: ValidationBlock) {
  issues.push({ level, code, message, blockId: block?.id, blockType: block?.type });
}

function isPositiveDecimal(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;
  return compareDecimalStrings(trimmed, "0") > 0;
}

function isConditionOperator(value: string) {
  return value === "equals"
    || value === "not_equals"
    || value === "greater_than"
    || value === "greater_than_or_equals"
    || value === "less_than"
    || value === "less_than_or_equals"
    || value === "exists"
    || value === "does_not_exist";
}

function compareDecimalStrings(a: string, b: string) {
  const normalize = (value: string) => {
    const trimmed = value.trim();
    const [intPart = "0", fracPart = ""] = trimmed.split(".");
    return {
      int: intPart.replace(/^0+(?=\d)/, "") || "0",
      frac: fracPart
    };
  };
  const aNorm = normalize(a);
  const bNorm = normalize(b);
  const fracLen = Math.max(aNorm.frac.length, bNorm.frac.length);
  const aCombined = `${aNorm.int}${aNorm.frac.padEnd(fracLen, "0")}`;
  const bCombined = `${bNorm.int}${bNorm.frac.padEnd(fracLen, "0")}`;
  if (aCombined === bCombined) return 0;
  return BigInt(aCombined) > BigInt(bCombined) ? 1 : -1;
}
