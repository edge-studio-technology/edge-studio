import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { expectRowActionsPinned } from "../../../helpers/expectRowActionsPinned";
import {
  WatchRunControls,
  WatchRunHistory,
  WatchRuntimeOverview,
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

  async function openRunControlsPayload() {
    await userEvent.click(screen.getByText("Test with custom payload"));
  }

  it("disables Run now and shows a message for an archived workflow", () => {
    renderControls({ workflow: workflow({ archived: true }) });
    expect(
      screen.getByText("Archived workflows cannot run until restored from the workflow list."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run now" })).toBeDisabled();
  });

  it("shows a validation error message and disables running", async () => {
    renderControls({ hasValidationErrors: true });
    expect(screen.getByText("Fix validation errors before running.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run now" })).toBeDisabled();
    await openRunControlsPayload();
    expect(screen.getByRole("button", { name: "Run test payload" })).toBeDisabled();
  });

  it("disables actions while busy", async () => {
    renderControls({ busy: true });
    expect(screen.getByRole("button", { name: "Run now" })).toBeDisabled();
    await openRunControlsPayload();
    expect(screen.queryByRole("button", { name: "Reset example" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run test payload" })).toBeDisabled();
  });

  it("edits payload text from a modal and saves it", async () => {
    const onPayloadTextChange = vi.fn();
    renderControls({ onPayloadTextChange });
    await openRunControlsPayload();
    await userEvent.click(screen.getByRole("button", { name: "Edit payload" }));
    fireEvent.change(screen.getByLabelText("Trigger payload"), {
      target: { value: '{"foo":"bar"}' },
    });
    await userEvent.click(screen.getByRole("button", { name: "Save payload" }));
    expect(onPayloadTextChange).toHaveBeenCalledWith('{"foo":"bar"}');
  });

  it("opens the payload editor when the preview is clicked", async () => {
    renderControls({ payloadText: '{"foo":"bar"}' });
    await openRunControlsPayload();

    await userEvent.click(screen.getByRole("button", { name: '{"foo":"bar"}' }));

    expect(screen.getByRole("dialog", { name: "Edit trigger payload" })).toBeInTheDocument();
  });

  it("calls onResetPayload when Reset example is clicked", async () => {
    const onResetPayload = vi.fn();
    renderControls({ onResetPayload });
    await openRunControlsPayload();
    await userEvent.click(screen.getByRole("button", { name: "Edit payload" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset example" }));
    expect(onResetPayload).toHaveBeenCalled();
  });

  it("parses the payload text as JSON and calls onRunWithPayload", async () => {
    const onRunWithPayload = vi.fn();
    renderControls({ payloadText: '{"foo":"bar"}', onRunWithPayload });
    await openRunControlsPayload();
    await userEvent.click(screen.getByRole("button", { name: "Run test payload" }));
    expect(onRunWithPayload).toHaveBeenCalledWith({ foo: "bar" });
  });

  it("calls onPayloadError with a message when the payload is invalid JSON", async () => {
    const onPayloadError = vi.fn();
    const onRunWithPayload = vi.fn();
    renderControls({ payloadText: "not json", onPayloadError, onRunWithPayload });
    await openRunControlsPayload();
    await userEvent.click(screen.getByRole("button", { name: "Run test payload" }));
    expect(onRunWithPayload).not.toHaveBeenCalled();
    expect(onPayloadError).toHaveBeenCalledWith(expect.stringContaining("JSON"));
  });

  it("uses a single expanded trigger payload test for event workflows", async () => {
    const onRunNow = vi.fn();
    const onRunWithPayload = vi.fn();
    renderControls({
      workflow: workflow({ blocks: [block({ type: "gpio_event_start" })] }),
      payloadText: '{"active":true}',
      onRunNow,
      onRunWithPayload,
    });

    expect(screen.queryByRole("button", { name: "Run now" })).not.toBeInTheDocument();
    expect(screen.getByText("Test GPIO trigger")).toBeInTheDocument();
    expect(screen.getByText("Payload preview")).toBeInTheDocument();
    expect(screen.getByText('{"active":true}')).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Run with this payload" }));

    expect(onRunNow).not.toHaveBeenCalled();
    expect(onRunWithPayload).toHaveBeenCalledWith({ active: true });
  });

  it("shows a payload error message when set", () => {
    renderControls({ payloadError: "Payload must be valid JSON" });
    expect(screen.getByText("Payload must be valid JSON")).toBeInTheDocument();
  });
});

describe("WatchRuntimeOverview", () => {
  function renderOverview(props: Partial<React.ComponentProps<typeof WatchRuntimeOverview>> = {}) {
    return render(
      <WatchRuntimeOverview
        workflow={workflow({ enabled: true })}
        selectedRun={run()}
        latestRun={run()}
        followLiveRuns={true}
        hasValidationErrors={false}
        onFollowLiveRunsChange={vi.fn()}
        {...props}
      />,
    );
  }

  it("summarizes the workflow and selected run", () => {
    renderOverview();
    expect(screen.getByText("Runtime overview")).toBeInTheDocument();
    expect(screen.getByText("Active and ready for incoming triggers.")).toBeInTheDocument();
    expect(screen.getByText("Viewing latest run")).toBeInTheDocument();
    expect(screen.getByText("1/1 blocks completed")).toBeInTheDocument();
    expect(screen.getByText("manual")).toBeInTheDocument();
  });

  it("shows failed progress and the run error", () => {
    renderOverview({
      selectedRun: run({ status: "failed", error: "Camera failed", blockCount: 2 }),
      latestRun: run({ status: "failed", error: "Camera failed", blockCount: 2 }),
    });
    expect(screen.getByText("1/2 blocks completed before failure")).toBeInTheDocument();
    expect(screen.getByText("Camera failed")).toBeInTheDocument();
  });

  it("calls onFollowLiveRunsChange when the switch changes", async () => {
    const onFollowLiveRunsChange = vi.fn();
    renderOverview({ followLiveRuns: false, onFollowLiveRunsChange });
    await userEvent.click(screen.getByRole("switch", { name: "Follow live runs" }));
    expect(onFollowLiveRunsChange).toHaveBeenCalledWith(true);
  });

  it("shows when the latest run is available while inspecting history", () => {
    renderOverview({
      selectedRun: run({ id: "old-run" }),
      latestRun: run({ id: "new-run" }),
      followLiveRuns: false,
    });
    expect(screen.getByText("Viewing historic run")).toBeInTheDocument();
    expect(
      screen.getByText("Latest run available. Turn on follow live runs to jump back."),
    ).toBeInTheDocument();
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

  it("defaults to a collapsed selected-run navigator", () => {
    render(<WatchRunHistory runs={[run()]} selectedRunId="r1" onSelectRun={vi.fn()} />);
    expect(screen.getByText("Selected run")).toBeInTheDocument();
    expect(screen.getByTestId("collapsed-run-history")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Older run/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Newer run/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose fields for Selected run summary" })).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.getByText("Trigger")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("Blocks")).toBeInTheDocument();
  });

  it("opens compact summary field settings from collapsed mode", async () => {
    render(<WatchRunHistory runs={[run()]} selectedRunId="r1" onSelectRun={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Choose fields for Selected run summary" }));

    expect(screen.getByRole("dialog", { name: "Choose fields for Selected run summary" })).toBeInTheDocument();
    expect(screen.getByText("Finished")).toBeInTheDocument();
    expect(screen.getByText("Run ID")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("expands to a table with a row per run", async () => {
    render(<WatchRunHistory runs={[run()]} selectedRunId={null} onSelectRun={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Expand history/ }));
    const table = screen.getByRole("table");
    expect(within(table).getByText("manual")).toBeInTheDocument();
    expect(within(table).getByText("success")).toBeInTheDocument();
    expect(within(table).getByText("1/1")).toBeInTheDocument();
    expectRowActionsPinned(screen.getByRole("table"), "Details");
  });

  it("calls onSelectRun when 'Show on canvas' is clicked", async () => {
    const onSelectRun = vi.fn();
    render(<WatchRunHistory runs={[run()]} selectedRunId={null} onSelectRun={onSelectRun} />);
    await userEvent.click(screen.getByRole("button", { name: /Expand history/ }));
    await userEvent.click(screen.getByRole("button", { name: "Show on canvas" }));
    expect(onSelectRun).toHaveBeenCalledWith("r1");
  });

  it("shows 'Showing' and disables the button for the selected run", async () => {
    render(<WatchRunHistory runs={[run()]} selectedRunId="r1" onSelectRun={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Expand history/ }));
    expect(screen.getByRole("button", { name: "Showing" })).toBeDisabled();
  });

  it("navigates to older and newer runs from collapsed mode", async () => {
    const onSelectRun = vi.fn();
    render(
      <WatchRunHistory
        runs={[run({ id: "newer" }), run({ id: "current" }), run({ id: "older" })]}
        selectedRunId="current"
        onSelectRun={onSelectRun}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Older run/ }));
    expect(onSelectRun).toHaveBeenCalledWith("older");

    await userEvent.click(screen.getByRole("button", { name: /Newer run/ }));
    expect(onSelectRun).toHaveBeenCalledWith("newer");
  });

  it("opens raw run JSON details in a modal", async () => {
    render(<WatchRunHistory runs={[run()]} selectedRunId={null} onSelectRun={vi.fn()} />);
    expect(screen.queryByText("Raw workflow run JSON")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Raw details" }));
    expect(screen.getByRole("dialog", { name: "Raw workflow run JSON" })).toBeInTheDocument();
    expect(screen.getByText(/"workflowName": "Front gate flow"/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View JSON" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("Raw workflow run JSON")).not.toBeInTheDocument();
  });
});
