import type { AutomationBlockType } from "./automation.repository.js";

// Fixed security policy; not operator-configurable. See docs/adr/0022-bound-external-automation-effects.md.
export const WORKFLOW_RUN_BUDGET_MAX_RUNS = 10;
export const WORKFLOW_RUN_BUDGET_WINDOW_MS = 60 * 60 * 1000;

export const PRIVILEGED_AUTOMATION_BLOCK_TYPES: ReadonlySet<AutomationBlockType> = new Set<AutomationBlockType>([
  "send_transaction",
  "control_output",
  "capture_camera",
  "stamp_integritas"
]);

export function isPrivilegedAutomationBlock(type: AutomationBlockType) {
  return PRIVILEGED_AUTOMATION_BLOCK_TYPES.has(type);
}

export function isEventStartBlock(type: AutomationBlockType) {
  return type === "gpio_event_start" || type === "webhook_event_start" || type === "mqtt_event_start";
}

/** Event-started workflows that send transactions need a whole-second cooldown of at least 1. */
export function isValidTransactionCooldown(cooldownSeconds: unknown) {
  return typeof cooldownSeconds === "number" && Number.isInteger(cooldownSeconds) && cooldownSeconds >= 1;
}
