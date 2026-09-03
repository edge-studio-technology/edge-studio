import { describe, expect, it } from "vitest";
import {
  blockHelp,
  workflowBlockCategoryOrder,
  workflowBlockHelp,
  workflowBlockLibraryTypes,
} from "../../../../src/features/automation/workflow/workflowBlockHelp";
import type { AutomationBlockType } from "../../../../src/features/automation/automationTypes";

const ALL_TYPES: AutomationBlockType[] = [
  "manual_start",
  "schedule_start",
  "gpio_event_start",
  "webhook_event_start",
  "mqtt_event_start",
  "record_trigger_event",
  "fetch_data_source",
  "capture_camera",
  "set_variable",
  "if_payload_field_equals",
  "wait",
  "show_preview",
  "stamp_integritas",
  "control_output",
  "send_transaction",
];

describe("workflowBlockHelp", () => {
  it("has a help entry for every automation block type", () => {
    for (const type of ALL_TYPES) {
      expect(workflowBlockHelp[type]).toBeDefined();
    }
  });

  it("blockHelp(type) returns the matching entry", () => {
    expect(blockHelp("wait")).toBe(workflowBlockHelp.wait);
    expect(blockHelp("wait").title).toBe("Wait");
    expect(blockHelp("stamp_integritas").category).toBe("Attached");
  });

  it("every entry has non-empty title/shortTitle/tooltip text", () => {
    for (const type of ALL_TYPES) {
      const help = workflowBlockHelp[type];
      expect(help.title.length).toBeGreaterThan(0);
      expect(help.shortTitle.length).toBeGreaterThan(0);
      expect(help.tooltip.length).toBeGreaterThan(0);
      expect(help.whatItDoes.length).toBeGreaterThan(0);
      expect(help.whenToUse.length).toBeGreaterThan(0);
    }
  });

  it("workflowBlockCategoryOrder lists all five categories", () => {
    expect(workflowBlockCategoryOrder).toEqual(["Start", "Data", "Logic", "Action", "Attached"]);
  });

  it("workflowBlockLibraryTypes groups every block type into exactly one category", () => {
    const grouped = Object.values(workflowBlockLibraryTypes).flat();
    expect(grouped.sort()).toEqual([...ALL_TYPES].sort());
  });

  it("workflowBlockLibraryTypes.Start matches the five start block types", () => {
    expect(workflowBlockLibraryTypes.Start).toEqual([
      "manual_start",
      "schedule_start",
      "gpio_event_start",
      "webhook_event_start",
      "mqtt_event_start",
    ]);
  });

  it("workflowBlockLibraryTypes.Attached only contains stamp_integritas", () => {
    expect(workflowBlockLibraryTypes.Attached).toEqual(["stamp_integritas"]);
  });

  it("required fields carry required: true and non-required fields omit it", () => {
    const intervalField = workflowBlockHelp.schedule_start.fields[0];
    expect(intervalField.label).toBe("Interval");
    expect(intervalField.required).toBe(true);

    const cooldownField = workflowBlockHelp.gpio_event_start.fields.find(
      (field) => field.label.startsWith("Cooldown"),
    );
    expect(cooldownField?.required).toBeUndefined();
  });
});
