import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  WatchRunControls,
  WatchRunHistory,
  WatchRuntimeInspector,
} from "../../../../src/features/automation/workflow/WorkflowWatchUi";
import type {
  AutomationBlock,
  AutomationRun,
  AutomationWorkflow,
} from "../../../../src/features/automation/automationTypes";

function workflow(overrides: Partial<AutomationWorkflow> = {}): AutomationWorkflow {
  return {
    id: "w1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    name: "Front gate flow",
    enabled: true,
    archived: false,
    lastRunAt: null,
    nextRunAt: null,
    lastHash: null,
    lastProofId: null,
    lastError: null,
    blocks: [],
    ...overrides,
  };
}

function block(overrides: Partial<AutomationBlock> = {}): AutomationBlock {
  return {
    id: "b1",
    workflowId: "w1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    type: "manual_start",
    enabled: true,
    order: 0,
    parentBlockId: null,
    config: {},
    lastRunAt: null,
    lastError: null,
    ...overrides,
  } as AutomationBlock;
}

function run(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: "r1",
    workflowId: "w1",
    workflowName: "Front gate flow",
    startedAt: "2026-08-01T00:00:00.000Z",
    finishedAt: "2026-08-01T00:00:01.000Z",
    status: "success",
    triggerType: "manual",
    triggerSourceId: null,
    triggerPayload: null,
    durationMs: 1000,
    blockCount: 1,
    error: null,
    blocks: [
      {
        id: "br1",
        runId: "r1",
        workflowId: "w1",
        blockId: "b1",
        order: 0,
        blockType: "manual_start",
        blockLabel: "Start",
        startedAt: "2026-08-01T00:00:00.000Z",
        finishedAt: "2026-08-01T00:00:00.500Z",
        status: "success",
        durationMs: 500,
        input: null,
        output: null,
        error: null,
      },
    ],
    ...overrides,
  };
}

function blockRun(overrides: Partial<AutomationRun["blocks"][number]> = {}) {
  return {
    id: "br1",
    runId: "r1",
    workflowId: "w1",
    blockId: "b1",
    order: 0,
    blockType: "manual_start" as const,
    blockLabel: "Start",
    startedAt: "2026-08-01T00:00:00.000Z",
    finishedAt: "2026-08-01T00:00:00.500Z",
    status: "success" as const,
    durationMs: 500,
    input: null,
    output: null,
    error: null,
    ...overrides,
  };
}

describe("WatchRunControls", () => {
  function renderControls(props: Partial<React.ComponentProps<typeof WatchRunControls>> = {}) {
    return render(
      <WatchRunControls
        workflow={workflow()}
        busy={false}
        hasValidationErrors={false}
        payloadText="{}"
        payloadError={null}
        onPayloadTextChange={vi.fn()}
        onPayloadError={vi.fn()}
        onResetPayload={vi.fn()}
        onRunNow={vi.fn()}
        onRunWithPayload={vi.fn()}
        {...props}
      />,
    );
  }

  it("calls onRunNow when Run now is clicked", async () => {
    const onRunNow = vi.fn();
    renderControls({ onRunNow });
    await userEvent.click(screen.getByRole("button", { name: "Run now" }));
    expect(onRunNow).toHaveBeenCalled();
  });

  it("disables Run now and shows a message for an archived workflow", () => {
    renderControls({ workflow: workflow({ archived: true }) });
    expect(
      screen.getByText("Archived workflows cannot run until restored from the workflow list."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run now" })).toBeDisabled();
  });

  it("shows a validation error message and disables running", () => {
    renderControls({ hasValidationErrors: true });
    expect(screen.getByText("Fix validation errors before running.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run with payload" })).toBeDisabled();
  });

  it("disables actions while busy", () => {
    renderControls({ busy: true });
    expect(screen.getByRole("button", { name: "Run now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset example" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run with payload" })).toBeDisabled();
  });

  it("calls onPayloadTextChange when the textarea changes", async () => {
    const onPayloadTextChange = vi.fn();
    renderControls({ onPayloadTextChange });
    await userEvent.type(screen.getByLabelText("Trigger payload"), "x");
    expect(onPayloadTextChange).toHaveBeenCalled();
  });

  it("calls onResetPayload when Reset example is clicked", async () => {
    const onResetPayload = vi.fn();
    renderControls({ onResetPayload });
    await userEvent.click(screen.getByRole("button", { name: "Reset example" }));
    expect(onResetPayload).toHaveBeenCalled();
  });

  it("parses the payload text as JSON and calls onRunWithPayload", async () => {
    const onRunWithPayload = vi.fn();
    renderControls({ payloadText: '{"foo":"bar"}', onRunWithPayload });
    await userEvent.click(screen.getByRole("button", { name: "Run with payload" }));
    expect(onRunWithPayload).toHaveBeenCalledWith({ foo: "bar" });
  });

  it("calls onPayloadError with a message when the payload is invalid JSON", async () => {
    const onPayloadError = vi.fn();
    const onRunWithPayload = vi.fn();
    renderControls({ payloadText: "not json", onPayloadError, onRunWithPayload });
    await userEvent.click(screen.getByRole("button", { name: "Run with payload" }));
    expect(onRunWithPayload).not.toHaveBeenCalled();
    expect(onPayloadError).toHaveBeenCalledWith(expect.stringContaining("JSON"));
  });

  it("shows a payload error message when set", () => {
    renderControls({ payloadError: "Payload must be valid JSON" });
    expect(screen.getByText("Payload must be valid JSON")).toBeInTheDocument();
  });
});

describe("WatchRuntimeInspector", () => {
  it("shows a prompt when no run is selected", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={undefined}
        latestBlockRun={null}
        selectedRun={undefined}
      />,
    );
    expect(
      screen.getByText("No run selected yet. Run the workflow or choose a historic run below."),
    ).toBeInTheDocument();
  });

  it("shows selected run summary and error", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={undefined}
        latestBlockRun={null}
        selectedRun={run({ status: "failed", error: "boom" })}
      />,
    );
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByText("manual")).toBeInTheDocument();
  });

  it("shows a prompt to select a block when none is selected", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={undefined}
        latestBlockRun={null}
        selectedRun={undefined}
      />,
    );
    expect(
      screen.getByText("Select a block on the canvas to inspect its latest run output."),
    ).toBeInTheDocument();
  });

  it("shows 'Not run yet' when the block has never run", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block()}
        latestBlockRun={null}
        selectedRun={undefined}
      />,
    );
    expect(screen.getByText("Not run yet")).toBeInTheDocument();
    expect(screen.getByText("No timing")).toBeInTheDocument();
  });

  it("shows 'No run details' when the block has a lastRunAt but no run details", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block({ lastRunAt: "2026-08-01T00:00:00.000Z" })}
        latestBlockRun={null}
        selectedRun={undefined}
      />,
    );
    expect(screen.getByText("No run details")).toBeInTheDocument();
  });

  it("shows block run status, duration, and errors", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block({ lastError: "block boom" })}
        latestBlockRun={blockRun({ status: "failed", error: "run boom" })}
        selectedRun={undefined}
      />,
    );
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("block boom")).toBeInTheDocument();
    expect(screen.getByText("run boom")).toBeInTheDocument();
  });

  it("shows output JSON preview when the latest block run has output", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block()}
        latestBlockRun={blockRun({ output: { foo: "bar" } })}
        selectedRun={undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "View output JSON" })).toBeInTheDocument();
  });

  it("shows a fallback message when there is no output", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block()}
        latestBlockRun={blockRun({ output: null })}
        selectedRun={undefined}
      />,
    );
    expect(
      screen.getByText("No output recorded for the latest selected-block run."),
    ).toBeInTheDocument();
  });

  it("shows diagnostics links for read and proof ids and a close button", async () => {
    const onCloseSelectedBlock = vi.fn();
    render(
      <MemoryRouter>
        <WatchRuntimeInspector
          selectedBlock={block()}
          latestBlockRun={blockRun({ output: { readId: "read-1", proofId: "proof-1" } })}
          selectedRun={undefined}
          onCloseSelectedBlock={onCloseSelectedBlock}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Open read" })).toHaveAttribute(
      "href",
      expect.stringContaining("q=read-1"),
    );
    expect(screen.getByRole("link", { name: "Open proof" })).toHaveAttribute(
      "href",
      expect.stringContaining("q=proof-1"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Close inspector" }));
    expect(onCloseSelectedBlock).toHaveBeenCalled();
  });

  it("does not show the diagnostics section when there is nothing to show", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block()}
        latestBlockRun={blockRun({ output: null })}
        selectedRun={undefined}
      />,
    );
    expect(screen.queryByText("Diagnostics")).not.toBeInTheDocument();
  });
});

describe("WatchRunHistory", () => {
  it("shows an empty state with no runs", () => {
    render(<WatchRunHistory runs={[]} selectedRunId={null} onSelectRun={vi.fn()} />);
    expect(screen.getByText("No workflow runs recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("0 run(s)")).toBeInTheDocument();
  });

  it("renders a row per run with trigger, status, and block counts", () => {
    render(<WatchRunHistory runs={[run()]} selectedRunId={null} onSelectRun={vi.fn()} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("manual")).toBeInTheDocument();
    expect(within(table).getByText("success")).toBeInTheDocument();
    expect(within(table).getByText("1/1")).toBeInTheDocument();
  });

  it("calls onSelectRun when 'Show on canvas' is clicked", async () => {
    const onSelectRun = vi.fn();
    render(<WatchRunHistory runs={[run()]} selectedRunId={null} onSelectRun={onSelectRun} />);
    await userEvent.click(screen.getByRole("button", { name: "Show on canvas" }));
    expect(onSelectRun).toHaveBeenCalledWith("r1");
  });

  it("shows 'Showing' and disables the button for the selected run", () => {
    render(<WatchRunHistory runs={[run()]} selectedRunId="r1" onSelectRun={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Showing" })).toBeDisabled();
  });

  it("toggles raw run JSON details", async () => {
    render(<WatchRunHistory runs={[run()]} selectedRunId={null} onSelectRun={vi.fn()} />);
    expect(screen.queryByText("Raw workflow run JSON")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Raw details" }));
    expect(screen.getByText("Raw workflow run JSON")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Hide raw" }));
    expect(screen.queryByText("Raw workflow run JSON")).not.toBeInTheDocument();
  });
});
