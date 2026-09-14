import { describe, expect, it } from "vitest";
import {
  automationBlockToCanvasBlock,
  blockPresentation,
  isDataBlock,
  draftBlockTitle,
  draftBlockDescription,
} from "../../../../../src/features/automation/workflow/canvas/blockPresentation";
import type { DraftWorkflowBlock } from "../../../../../src/features/automation/workflow/canvas/types";
import type { AutomationBlock } from "../../../../../src/features/automation/automationTypes";

function draft(overrides: Partial<DraftWorkflowBlock> = {}): DraftWorkflowBlock {
  return {
    id: "b1",
    type: "wait",
    config: { durationMs: 1000 },
    ...overrides,
  };
}

function persistedBlock(overrides: Partial<AutomationBlock> = {}): AutomationBlock {
  return {
    id: "b1",
    workflowId: "w1",
    createdAt: "now",
    updatedAt: "now",
    type: "wait",
    enabled: true,
    order: 0,
    parentBlockId: null,
    config: {},
    lastRunAt: null,
    lastError: null,
    ...overrides,
  };
}

describe("blockPresentation: isDataBlock", () => {
  it("flags record_trigger_event, fetch_data_source, and capture_camera as data blocks", () => {
    expect(isDataBlock("record_trigger_event")).toBe(true);
    expect(isDataBlock("fetch_data_source")).toBe(true);
    expect(isDataBlock("capture_camera")).toBe(true);
    expect(isDataBlock("wait")).toBe(false);
  });
});

describe("blockPresentation: draftBlockTitle / draftBlockDescription", () => {
  it("uses the block help title", () => {
    expect(draftBlockTitle({ type: "wait" })).toBe("Wait");
  });

  it("summarizes the block config via the sentence", () => {
    expect(draftBlockDescription({ type: "wait", config: { durationMs: 500 } }, [])).toBe(
      "Duration: 500 ms",
    );
  });
});

describe("blockPresentation: automationBlockToCanvasBlock", () => {
  it("maps a persisted block and nests its attached blocks by parentBlockId", () => {
    const main = persistedBlock({ id: "b1", type: "fetch_data_source" });
    const attached = persistedBlock({ id: "b2", type: "stamp_integritas", parentBlockId: "b1" });
    const other = persistedBlock({ id: "b3", type: "wait", parentBlockId: "other" });

    const canvasBlock = automationBlockToCanvasBlock(main, [main, attached, other]);
    expect(canvasBlock.id).toBe("b1");
    expect(canvasBlock.attachedBlocks).toHaveLength(1);
    expect(canvasBlock.attachedBlocks?.[0].id).toBe("b2");
  });
});

describe("blockPresentation: blockPresentation", () => {
  it("returns title/description and no badges for a plain enabled block with no issues", () => {
    const presentation = blockPresentation(draft(), [], [], []);
    expect(presentation.title).toBe("Wait");
    expect(presentation.description).toBe("Duration: 1 s");
    expect(presentation.badges).toEqual([]);
  });

  it("adds an error badge for validation errors and a warning badge for warnings", () => {
    const presentation = blockPresentation(draft(), [], [], [
      { level: "error", message: "Bad" },
      { level: "warning", message: "Careful" },
    ]);
    expect(presentation.badges).toEqual(
      expect.arrayContaining([
        { label: "1 validation error", tone: "error", alert: true },
        { label: "1 warning", tone: "warn", alert: true },
      ]),
    );
  });

  it("pluralizes multiple validation errors/warnings", () => {
    const presentation = blockPresentation(draft(), [], [], [
      { level: "error", message: "Bad" },
      { level: "error", message: "Also bad" },
    ]);
    expect(presentation.badges[0]).toEqual({
      label: "2 validation errors",
      tone: "error",
      alert: true,
    });
  });

  it("adds capability badges for start, data, and attached-reads block types", () => {
    const startPresentation = blockPresentation(draft({ type: "manual_start" }), [], [], []);
    expect(startPresentation.badges).toEqual(
      expect.arrayContaining([{ label: "Provides trigger event" }]),
    );

    const dataPresentation = blockPresentation(
      draft({ type: "fetch_data_source", config: { sourceId: "" } }),
      [],
      [],
      [],
    );
    expect(dataPresentation.badges).toEqual(
      expect.arrayContaining([{ label: "Provides latest data" }]),
    );

    const stampPresentation = blockPresentation(draft({ type: "stamp_integritas" }), [], [], []);
    expect(stampPresentation.badges).toEqual(
      expect.arrayContaining([{ label: "Reads parent data" }]),
    );
  });

  it("adds a Disabled badge only when enabled is explicitly false", () => {
    const disabled = blockPresentation(draft({ enabled: false }), [], [], []);
    expect(disabled.badges).toEqual(
      expect.arrayContaining([{ label: "Disabled", tone: "neutral", alert: true }]),
    );
    expect(disabled.className).toMatch(/opacity-60/);

    const enabledByDefault = blockPresentation(draft(), [], [], []);
    expect(enabledByDefault.badges.some((badge) => badge.label === "Disabled")).toBe(false);
  });

  it("adds a last-ran badge and an error badge when the block previously errored", () => {
    const presentation = blockPresentation(
      draft({ lastRunAt: "2026-08-01T00:00:00.000Z", lastError: "failed" }),
      [],
      [],
      [],
    );
    expect(presentation.badges.some((badge) => badge.label.startsWith("Ran "))).toBe(true);
    expect(presentation.badges).toEqual(
      expect.arrayContaining([{ label: "Error", tone: "error", alert: true }]),
    );
  });

  it("adds a runtime status badge with duration, and a run-error badge on runtime failure", () => {
    const running = blockPresentation(draft(), [], [], [], { status: "running", durationMs: null });
    expect(running.badges).toEqual(expect.arrayContaining([{ label: "running" }]));

    const success = blockPresentation(draft(), [], [], [], { status: "success", durationMs: 250 });
    expect(success.badges).toEqual(expect.arrayContaining([{ label: "success · 250 ms" }]));

    const failed = blockPresentation(draft(), [], [], [], {
      status: "failed",
      durationMs: 10,
      error: "boom",
    });
    expect(failed.badges).toEqual(
      expect.arrayContaining([{ label: "Run error", tone: "error", alert: true }]),
    );
  });
});
