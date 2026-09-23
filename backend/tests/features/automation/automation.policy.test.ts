import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  isEventStartBlock,
  isPrivilegedAutomationBlock,
  isValidTransactionCooldown,
  PRIVILEGED_AUTOMATION_BLOCK_TYPES,
  WORKFLOW_RUN_BUDGET_MAX_RUNS,
  WORKFLOW_RUN_BUDGET_WINDOW_MS
} from "../../../src/features/automation/automation.policy.js";

describe("automation.policy", () => {
  it("fixes the workflow run budget at 10 runs per rolling hour", () => {
    assert.equal(WORKFLOW_RUN_BUDGET_MAX_RUNS, 10);
    assert.equal(WORKFLOW_RUN_BUDGET_WINDOW_MS, 60 * 60 * 1000);
  });

  it("treats payment, device output, camera, and stamping blocks as privileged", () => {
    assert.deepEqual([...PRIVILEGED_AUTOMATION_BLOCK_TYPES].sort(), ["capture_camera", "control_output", "send_transaction", "stamp_integritas"]);
    for (const type of ["manual_start", "webhook_event_start", "record_trigger_event", "fetch_data_source", "set_variable", "if_payload_field_equals", "wait", "show_preview"] as const) {
      assert.equal(isPrivilegedAutomationBlock(type), false, type);
    }
  });

  it("recognizes only GPIO, webhook, and MQTT starts as event starts", () => {
    assert.equal(isEventStartBlock("gpio_event_start"), true);
    assert.equal(isEventStartBlock("webhook_event_start"), true);
    assert.equal(isEventStartBlock("mqtt_event_start"), true);
    assert.equal(isEventStartBlock("manual_start"), false);
    assert.equal(isEventStartBlock("schedule_start"), false);
  });

  it("requires a whole-number transaction cooldown of at least one second", () => {
    for (const valid of [1, 60, 86400]) assert.equal(isValidTransactionCooldown(valid), true, String(valid));
    for (const invalid of [undefined, null, 0, -1, 0.5, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "5", true]) {
      assert.equal(isValidTransactionCooldown(invalid), false, String(invalid));
    }
  });
});
