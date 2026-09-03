import { describe, expect, it } from "vitest";
import { blockSummary } from "../../../../src/features/automation/workflow/workflowBlockSummaries";
import type { AddressBookEntry } from "../../../../src/features/address-book/addressBookTypes";
import type { DataSource } from "../../../../src/features/data-sources/dataSourceTypes";

function source(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: "src-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    name: "Front gate webhook",
    type: "webhook",
    status: "ok",
    description: null,
    config: {},
    lastReadAt: null,
    lastError: null,
    lastPreview: null,
    lastHash: null,
    ...overrides,
  };
}

function contact(overrides: Partial<AddressBookEntry> = {}): AddressBookEntry {
  return {
    id: "c1",
    label: "Alice",
    address: "Mx1234",
    notes: null,
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const emptyContext = { sources: [] as DataSource[], addressBook: [] as AddressBookEntry[] };

describe("workflowBlockSummaries: blockSummary", () => {
  it("manual_start summarizes as Manual run mode", () => {
    const result = blockSummary({ type: "manual_start", config: {} }, emptyContext);
    expect(result.fields).toEqual([{ label: "Run mode", value: "Manual" }]);
    expect(result.sentence).toBe("Run mode: Manual");
  });

  it("schedule_start formats the interval, defaulting to 60s", () => {
    const result = blockSummary({ type: "schedule_start", config: {} }, emptyContext);
    expect(result.fields).toEqual([{ label: "Interval", value: "Every 1 minute" }]);
  });

  it("schedule_start formats a configured interval", () => {
    const result = blockSummary(
      { type: "schedule_start", config: { intervalSeconds: 300 } },
      emptyContext,
    );
    expect(result.fields).toEqual([{ label: "Interval", value: "Every 5 minutes" }]);
  });

  it("gpio_event_start shows source, active-only, and cooldown", () => {
    const gpio = source({ id: "gpio-1", name: "PIR sensor", type: "gpio-input" });
    const result = blockSummary(
      { type: "gpio_event_start", config: { sourceId: "gpio-1", activeOnly: true, cooldownSeconds: 30 } },
      { sources: [gpio], addressBook: [] },
    );
    expect(result.fields).toEqual([
      { label: "Source", value: "PIR sensor - gpiochip0 GPIO?" },
      { label: "Active only", value: "Yes" },
      { label: "Cooldown", value: "30 s" },
    ]);
  });

  it("gpio_event_start falls back to 'Not selected' with no matching source", () => {
    const result = blockSummary(
      { type: "gpio_event_start", config: { sourceId: "missing" } },
      emptyContext,
    );
    expect(result.fields[0]).toEqual({ label: "Source", value: "Not selected" });
    expect(result.fields[2]).toEqual({ label: "Cooldown", value: "Off" });
  });

  it("webhook_event_start and mqtt_event_start show source + cooldown (no active-only)", () => {
    const webhook = source({ id: "wh-1", name: "Prod webhook", type: "webhook" });
    const result = blockSummary(
      { type: "webhook_event_start", config: { sourceId: "wh-1", cooldownSeconds: 0 } },
      { sources: [webhook], addressBook: [] },
    );
    expect(result.fields).toEqual([
      { label: "Source", value: "Prod webhook - Webhook receive URL" },
      { label: "Cooldown", value: "Off" },
    ]);
  });

  it("record_trigger_event summarizes as trigger event payload", () => {
    const result = blockSummary({ type: "record_trigger_event", config: {} }, emptyContext);
    expect(result.fields).toEqual([{ label: "Input", value: "Trigger event payload" }]);
  });

  it("fetch_data_source and capture_camera show only the source", () => {
    const camera = source({ id: "cam-1", name: "Front gate camera", type: "pi-camera" });
    const result = blockSummary(
      { type: "capture_camera", config: { sourceId: "cam-1" } },
      { sources: [camera], addressBook: [] },
    );
    expect(result.fields).toEqual([
      { label: "Source", value: "Front gate camera - photo 1280x720" },
    ]);
  });

  it("set_variable shows the value for custom_json source", () => {
    const result = blockSummary(
      {
        type: "set_variable",
        config: { variableName: "message", variableSource: "custom_json", valueJsonText: '"hi"' },
      },
      emptyContext,
    );
    expect(result.fields).toEqual([
      { label: "Variable", value: "message" },
      { label: "Source", value: "custom JSON" },
      { label: "Value", value: '"hi"' },
    ]);
  });

  it("set_variable shows the field path for a non-custom source", () => {
    const result = blockSummary(
      {
        type: "set_variable",
        config: { variableName: "pin", variableSource: "trigger_field", fieldPath: "pin" },
      },
      emptyContext,
    );
    expect(result.fields).toEqual([
      { label: "Variable", value: "pin" },
      { label: "Source", value: "trigger field" },
      { label: "Field", value: "pin" },
    ]);
  });

  it("if_payload_field_equals includes the compare value when the operator needs one", () => {
    const result = blockSummary(
      {
        type: "if_payload_field_equals",
        config: { source: "trigger", fieldPath: "active", operator: "equals", value: true },
      },
      emptyContext,
    );
    expect(result.fields).toEqual([
      { label: "Source", value: "Trigger event" },
      { label: "Field", value: "active" },
      { label: "Operator", value: "equals" },
      { label: "Value", value: "true" },
    ]);
  });

  it("if_payload_field_equals omits the value for exists/does_not_exist", () => {
    const result = blockSummary(
      { type: "if_payload_field_equals", config: { source: "variable", operator: "exists" } },
      emptyContext,
    );
    expect(result.fields).toEqual([
      { label: "Source", value: "Variable" },
      { label: "Field", value: "variable" },
      { label: "Operator", value: "exists" },
    ]);
  });

  it("wait formats sub-second and multi-second durations", () => {
    expect(blockSummary({ type: "wait", config: { durationMs: 500 } }, emptyContext).fields).toEqual([
      { label: "Duration", value: "500 ms" },
    ]);
    expect(blockSummary({ type: "wait", config: { durationMs: 1000 } }, emptyContext).fields).toEqual([
      { label: "Duration", value: "1 s" },
    ]);
    expect(blockSummary({ type: "wait", config: { durationMs: 1500 } }, emptyContext).fields).toEqual([
      { label: "Duration", value: "1.5 s" },
    ]);
  });

  it("show_preview reports format, title, and content source", () => {
    const result = blockSummary(
      {
        type: "show_preview",
        config: { previewFormat: "json", title: "My preview", contentMode: "latest_data" },
      },
      emptyContext,
    );
    expect(result.fields).toEqual([
      { label: "Format", value: "JSON" },
      { label: "Title", value: "My preview" },
      { label: "Content source", value: "latest data" },
    ]);
  });

  it("stamp_integritas summarizes as parent block hash", () => {
    const result = blockSummary({ type: "stamp_integritas", config: {} }, emptyContext);
    expect(result.fields).toEqual([{ label: "Data", value: "Parent block hash" }]);
  });

  it("control_output shows pulse duration for GPIO pulse actions", () => {
    const led = source({ id: "led-1", name: "Status LED", type: "gpio-output" });
    const result = blockSummary(
      { type: "control_output", config: { targetId: "led-1", action: "pulse", durationMs: 500 } },
      { sources: [led], addressBook: [] },
    );
    expect(result.fields).toEqual([
      { label: "Target", value: "Status LED - led gpiochip0 GPIO? active:high" },
      { label: "Action", value: "Pulse" },
      { label: "Duration", value: "500 ms" },
    ]);
  });

  it("control_output shows a payload label for non-pulse actions", () => {
    const http = source({ id: "http-1", name: "HTTP output", type: "http-output" });
    const result = blockSummary(
      { type: "control_output", config: { targetId: "http-1", action: "send_request", bodyMode: "custom" } },
      { sources: [http], addressBook: [] },
    );
    expect(result.fields).toEqual([
      { label: "Target", value: "HTTP output - POST HTTP output" },
      { label: "Action", value: "Send request" },
      { label: "Payload", value: "custom JSON" },
    ]);
  });

  it("send_transaction resolves the recipient label from the address book", () => {
    const recipient = contact({ id: "c1", label: "Alice" });
    const result = blockSummary(
      { type: "send_transaction", config: { recipientAddressBookId: "c1", amount: "0.5" } },
      { sources: [], addressBook: [recipient] },
    );
    expect(result.fields).toEqual([
      { label: "Recipient", value: "Alice" },
      { label: "Amount", value: "0.5" },
    ]);
  });

  it("send_transaction falls back to placeholders when unset", () => {
    const result = blockSummary(
      { type: "send_transaction", config: {} },
      emptyContext,
    );
    expect(result.fields).toEqual([
      { label: "Recipient", value: "saved recipient" },
      { label: "Amount", value: "amount not set" },
    ]);
  });

  it("sentence joins fields with a middle dot separator", () => {
    const result = blockSummary({ type: "wait", config: { durationMs: 1000 } }, emptyContext);
    expect(result.sentence).toBe("Duration: 1 s");
  });
});
