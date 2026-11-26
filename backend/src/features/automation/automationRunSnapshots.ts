import { redactDeep } from "../../shared/redact.js";

const configFields: Record<string, string[]> = {
  manual_start: [],
  schedule_start: ["intervalSeconds"],
  gpio_event_start: ["sourceId", "activeOnly", "cooldownSeconds"],
  webhook_event_start: ["sourceId", "activeOnly", "cooldownSeconds"],
  mqtt_event_start: ["sourceId", "activeOnly", "cooldownSeconds"],
  record_trigger_event: [],
  fetch_data_source: ["sourceId"],
  capture_camera: ["sourceId", "durationMs"],
  set_variable: ["variableName", "variableSource", "fieldPath", "valueJsonText"],
  if_payload_field_equals: ["source", "variableName", "fieldPath", "operator", "value"],
  wait: ["durationMs"],
  show_preview: ["title", "previewFormat", "contentMode", "contentTemplateText", "imageSource"],
  stamp_integritas: ["condition"],
  control_output: ["targetId", "action", "durationMs", "bodyMode", "bodyTemplate", "bodyTemplateText", "multipartFileField", "multipartJsonField", "multipartJsonText"],
  send_transaction: ["recipientAddressBookId", "tokenId", "amount"],
};

/** A diagnostic copy only: never pass a redacted or truncated value to execution. */
export function runSnapshot(value: unknown, maxBytes = 16384): unknown {
  const original = JSON.stringify(value);
  if (original === undefined) return null;
  const originalBytes = Buffer.byteLength(original);
  if (originalBytes > maxBytes) return { omitted: "Diagnostic value exceeds size limit", sizeBytes: originalBytes };
  const redacted = redactDeep(value);
  const json = JSON.stringify(redacted);
  if (Buffer.byteLength(json) <= maxBytes) return redacted;
  return { omitted: "Diagnostic value exceeds size limit", sizeBytes: Buffer.byteLength(json) };
}

export function namedRunSnapshot(name: string, value: unknown) {
  if (value === undefined) return { missing: true };
  return runSnapshot(redactDeep({ [name]: value })[name]);
}

export function blockConfigSnapshot(type: string, config: Record<string, unknown>) {
  const snapshot: Record<string, unknown> = {};
  for (const key of configFields[type] ?? []) {
    if (config[key] === undefined) continue;
    let value = config[key];
    if (key === "condition" && value && typeof value === "object") {
      const condition = value as Record<string, unknown>;
      value = { ...condition, ...(Object.prototype.hasOwnProperty.call(condition, "value") ? { value: namedRunSnapshot(String(condition.fieldPath), condition.value) } : {}) };
    }
    if (key.endsWith("JsonText") || key === "bodyTemplateText" || (key === "contentTemplateText" && config.previewFormat === "json")) {
      try { value = JSON.stringify(namedRunSnapshot(String(config.variableName ?? key), JSON.parse(String(value)))); }
      catch { value = "[invalid JSON omitted]"; }
    }
    const bounded = runSnapshot(value, 4096);
    snapshot[key] = typeof value === "string" && typeof bounded !== "string" ? JSON.stringify(bounded) : bounded;
  }
  if (type === "if_payload_field_equals" && "value" in config) {
    snapshot.value = runSnapshot(namedRunSnapshot(String(config.source === "variable" ? config.variableName : config.fieldPath), config.value), 4096);
  }
  return snapshot;
}
