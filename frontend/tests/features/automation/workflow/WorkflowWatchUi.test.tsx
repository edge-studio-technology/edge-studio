import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { expectRowActionsPinned } from "../../../helpers/expectRowActionsPinned";
import {
  WatchRunControls,
  WatchRunHistory,
  WatchReplayControls,
  WatchRuntimeOverview,
  WatchRuntimeInspector,
} from "../../../../src/features/automation/workflow/WorkflowWatchUi";
import type {
  AutomationBlock,
  AutomationRun,
  AutomationWorkflow,
} from "../../../../src/features/automation/automationTypes";

const getDataSourceRead = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/features/data-reads/dataReadsApi", () => ({
  getDataSourceRead: (...args: unknown[]) => getDataSourceRead(...args),
}));

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

  it("uses a single collapsed trigger payload test for event workflows", async () => {
    const onRunNow = vi.fn();
    const onRunWithPayload = vi.fn();
    renderControls({
      workflow: workflow({ blocks: [block({ type: "gpio_event_start" })] }),
      payloadText: '{"active":true}',
      onRunNow,
      onRunWithPayload,
    });

    expect(screen.queryByRole("button", { name: "Run now" })).not.toBeInTheDocument();
    const triggerSummary = screen.getByText("Test GPIO trigger");
    expect(triggerSummary).toBeInTheDocument();
    expect(triggerSummary.closest("details")).not.toHaveAttribute("open");
    await userEvent.click(triggerSummary);
    expect(triggerSummary.closest("details")).toHaveAttribute("open");
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

describe("WatchReplayControls", () => {
  it("shows an empty replay state when no run is selected", () => {
    render(
      <WatchReplayControls
        selectedRun={undefined}
        latestRun={undefined}
        followLiveRuns={false}
        stepCount={0}
        currentStepIndex={-1}
        playing={false}
        onFollowLiveRunsChange={vi.fn()}
        onPlayingChange={vi.fn()}
        onSelectStep={vi.fn()}
      />,
    );

    expect(screen.getByText("No steps")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
  });

  it("selects previous and next replay steps", async () => {
    const onSelectStep = vi.fn();
    render(
      <WatchReplayControls
        selectedRun={run()}
        latestRun={run()}
        followLiveRuns={false}
        stepCount={3}
        currentStepIndex={1}
        playing={false}
        onFollowLiveRunsChange={vi.fn()}
        onPlayingChange={vi.fn()}
        onSelectStep={onSelectStep}
      />,
    );

    expect(screen.getByText("2/3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(onSelectStep).toHaveBeenCalledWith(0);
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(onSelectStep).toHaveBeenCalledWith(2);
  });

  it("keeps play and pause as separate actions", async () => {
    const onPlayingChange = vi.fn();
    render(
      <WatchReplayControls
        selectedRun={run()}
        latestRun={run()}
        followLiveRuns
        stepCount={2}
        currentStepIndex={0}
        playing={false}
        onFollowLiveRunsChange={vi.fn()}
        onPlayingChange={onPlayingChange}
        onSelectStep={vi.fn()}
      />,
    );

    expect(screen.getByText("Play live")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onPlayingChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  });

  it("changes follow-live setting", async () => {
    const onFollowLiveRunsChange = vi.fn();
    render(
      <WatchReplayControls
        selectedRun={run({ id: "old-run" })}
        latestRun={run({ id: "new-run" })}
        followLiveRuns={false}
        stepCount={2}
        currentStepIndex={0}
        playing={false}
        onFollowLiveRunsChange={onFollowLiveRunsChange}
        onPlayingChange={vi.fn()}
        onSelectStep={vi.fn()}
      />,
    );

    expect(screen.getByText("Replay run")).toBeInTheDocument();
    expect(screen.getByText("Latest run available. Turn on follow latest run to jump back.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Follow latest run" }));
    expect(onFollowLiveRunsChange).toHaveBeenCalledWith(true);
    expect(screen.getByText("1.5s/block")).toBeInTheDocument();
  });
});

describe("WatchRuntimeOverview", () => {
  function renderOverview(props: Partial<React.ComponentProps<typeof WatchRuntimeOverview>> = {}) {
    return render(
      <WatchRuntimeOverview
        workflow={workflow({ enabled: true })}
        selectedRun={run()}
        latestRun={run()}
        hasValidationErrors={false}
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

  it("shows when the latest run is available while inspecting history", () => {
    renderOverview({
      selectedRun: run({ id: "old-run" }),
      latestRun: run({ id: "new-run" }),
    });
    expect(screen.getByText("Viewing historic run")).toBeInTheDocument();
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

  it("shows friendly input and result summaries before raw JSON actions", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block({ type: "control_output", config: { targetId: "target-1", action: "publish", bodyMode: "trigger_payload" } })}
        latestBlockRun={blockRun({ input: { source: "trigger", active: true }, output: { foo: "bar" } })}
        selectedRun={undefined}
      />,
    );
    expect(screen.getByText("Input")).toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByText("Target ID")).toBeInTheDocument();
    expect(screen.getByText("target-1")).toBeInTheDocument();
    expect(screen.getByText("Trigger payload")).toBeInTheDocument();
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.getByText("bar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View pre-block context" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View post-block context" })).toBeInTheDocument();
  });

  it("summarizes fetch data source results with source, read, and hash", () => {
    render(
      <MemoryRouter>
        <WatchRuntimeInspector
          selectedBlock={block({ type: "fetch_data_source" })}
          latestBlockRun={blockRun({
            output: {
              data: { sourceName: "Device System Data", readId: "read-1" },
              hash: "hash-1",
            },
          })}
          selectedRun={undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Fetched latest data")).toBeInTheDocument();
    expect(screen.getByText("Device System Data")).toBeInTheDocument();
    expect(screen.getByText("read-1")).toBeInTheDocument();
    expect(screen.getByText("hash-1")).toBeInTheDocument();
  });

  it("summarizes show preview results with preview details", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block({ type: "show_preview" })}
        latestBlockRun={blockRun({
          output: {
            output: {
              action: "show_preview",
              inboxItemId: "inbox-1",
              title: "Device System Data latest data",
              format: "json",
            },
          },
        })}
        selectedRun={undefined}
      />,
    );

    expect(screen.getByText("Created preview")).toBeInTheDocument();
    expect(screen.getByText("Device System Data latest data")).toBeInTheDocument();
    expect(screen.getByText("json")).toBeInTheDocument();
    expect(screen.getByText("inbox-1")).toBeInTheDocument();
  });

  it("summarizes start block input separately from run-context result", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block({ type: "mqtt_event_start" })}
        latestBlockRun={blockRun({
          input: {
            trigger: { type: "mqtt", sourceId: "source-1", payload: { temperature: 21.5 } },
            variables: {},
          },
          output: {
            trigger: { type: "mqtt", sourceId: "source-1", payload: { temperature: 21.5 } },
            variables: {},
          },
        })}
        selectedRun={undefined}
      />,
    );

    expect(screen.getByText("Received trigger")).toBeInTheDocument();
    expect(screen.getByText("Initialized run context")).toBeInTheDocument();
    expect(screen.getAllByText("mqtt")).toHaveLength(2);
    expect(screen.getByText("source-1")).toBeInTheDocument();
    expect(screen.getByText("1 field")).toBeInTheDocument();
    expect(screen.getByText("Not created yet")).toBeInTheDocument();
    expect(screen.getByText("0 fields")).toBeInTheDocument();
  });

  it("summarizes record trigger event results", () => {
    render(
      <MemoryRouter>
        <WatchRuntimeInspector
          selectedBlock={block({ type: "record_trigger_event" })}
          latestBlockRun={blockRun({
            output: {
              data: { sourceName: "MQTT Subscriber", readId: "read-1" },
              hash: "hash-1",
            },
          })}
          selectedRun={undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Recorded trigger event")).toBeInTheDocument();
    expect(screen.getByText("MQTT Subscriber")).toBeInTheDocument();
    expect(screen.getByText("read-1")).toBeInTheDocument();
  });

  it("summarizes set variable results", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block({ type: "set_variable" })}
        latestBlockRun={blockRun({
          input: {
            trigger: { type: "manual", payload: { message: "Button pressed" } },
          },
          output: {
            output: { action: "set_variable", name: "message", value: "Button pressed" },
          },
        })}
        selectedRun={undefined}
      />,
    );

    expect(screen.getAllByText("Set variable").length).toBeGreaterThan(0);
    expect(screen.getByText("message")).toBeInTheDocument();
    expect(screen.getByText("Button pressed")).toBeInTheDocument();
  });

  it("summarizes condition input with expected and actual values", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block({
          type: "if_payload_field_equals",
          config: { source: "trigger", fieldPath: "event.kind", operator: "equals", value: "doorbell" },
        })}
        latestBlockRun={blockRun({
          input: {
            trigger: { type: "webhook", payload: { event: { kind: "doorbell" } } },
          },
          output: {
            output: {
              fieldPath: "event.kind",
              operator: "equals",
              expected: "doorbell",
              actual: "doorbell",
              matched: true,
            },
          },
        })}
        selectedRun={undefined}
      />,
    );

    expect(screen.getByText("Trigger payload")).toBeInTheDocument();
    expect(screen.getAllByText("event.kind")).toHaveLength(2);
    expect(screen.getAllByText("doorbell")).toHaveLength(2);
    expect(screen.getByText("Matched")).toBeInTheDocument();
  });

  it("summarizes send transaction results", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block({ type: "send_transaction" })}
        latestBlockRun={blockRun({
          output: {
            output: {
              action: "sent_transaction",
              recipientLabel: "Alice",
              amount: "1.25",
              txpowId: "0xabc",
            },
          },
        })}
        selectedRun={undefined}
      />,
    );

    expect(screen.getByText("Sent transaction")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("1.25 MINIMA")).toBeInTheDocument();
    expect(screen.getByText("0xabc")).toBeInTheDocument();
  });

  it("hides null workflow-context fields in generic result summaries", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block({ type: "control_output" })}
        latestBlockRun={blockRun({
          input: {
            trigger: { type: "manual", payload: { active: true, source: "run-now" } },
            data: null,
            output: null,
            hash: null,
            proofId: null,
            stopped: false,
            variables: {},
          },
          output: {
            trigger: { type: "manual", payload: { active: true, source: "run-now" } },
            data: null,
            output: null,
            hash: null,
            proofId: null,
            stopped: false,
            variables: {},
          },
        })}
        selectedRun={undefined}
      />,
    );

    expect(screen.getByText("trigger")).toBeInTheDocument();
    expect(screen.getByText("manual · payload 2 fields")).toBeInTheDocument();
    expect(screen.queryByText("data")).not.toBeInTheDocument();
    expect(screen.queryByText("output")).not.toBeInTheDocument();
    expect(screen.queryByText("hash")).not.toBeInTheDocument();
    expect(screen.queryByText("proofId")).not.toBeInTheDocument();
    expect(screen.queryByText("variables")).not.toBeInTheDocument();
  });

  it("shows fallback messages when there is no input or result", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block()}
        latestBlockRun={blockRun({ input: null, output: null })}
        selectedRun={undefined}
      />,
    );
    expect(
      screen.getByText("No input recorded for the latest selected-block run."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No result recorded for the latest selected-block run."),
    ).toBeInTheDocument();
  });

  it("explains when a block was skipped", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block()}
        latestBlockRun={blockRun({ status: "skipped", input: null, output: null })}
        selectedRun={run()}
      />,
    );

    expect(screen.getAllByText("This block was skipped during the selected run.")).toHaveLength(2);
  });

  it("explains when a failed run stopped before the selected block", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block()}
        latestBlockRun={null}
        selectedRun={run({ status: "failed", error: "Earlier block failed" })}
      />,
    );

    expect(screen.getByText("Not reached")).toBeInTheDocument();
    expect(screen.getAllByText("The selected run stopped before this block could execute.")).toHaveLength(2);
  });

  it("explains when a selected block was not reached in the selected run", () => {
    render(
      <WatchRuntimeInspector
        selectedBlock={block()}
        latestBlockRun={null}
        selectedRun={run({ status: "success" })}
      />,
    );

    expect(screen.getAllByText("This block was not reached in the selected run.")).toHaveLength(2);
  });

  it("opens read details for blocks that fetch device data", async () => {
    getDataSourceRead.mockResolvedValue({
      item: {
        id: "read-1",
        createdAt: "2026-08-01T00:00:00.000Z",
        dataSourceId: "source-1",
        workflowId: "w1",
        integritasProofId: null,
        sourceName: "Device System Data",
        sourceUrl: "device-system-data:local",
        triggerType: "automation",
        status: "success",
        hash: null,
        preview: { cpu: 1 },
        error: null,
        triggerSourceId: null,
        triggerPayload: null,
        blockId: "b1",
      },
    });
    render(
      <MemoryRouter>
        <WatchRuntimeInspector
          selectedBlock={block({ type: "fetch_data_source" })}
          latestBlockRun={blockRun({ output: { readId: "read-1" } })}
          selectedRun={undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Open in diagnostics" })).toHaveAttribute(
      "href",
      expect.stringContaining("q=read-1"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Open read" }));
    expect(await screen.findByRole("dialog", { name: "Read details" })).toBeInTheDocument();
    expect(screen.getByText("Device System Data")).toBeInTheDocument();
  });

  it("does not show read diagnostics for blocks that only consume prior read data", () => {
    render(
      <MemoryRouter>
        <WatchRuntimeInspector
          selectedBlock={block({ type: "show_preview" })}
          latestBlockRun={blockRun({ output: { readId: "read-1" } })}
          selectedRun={undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Open read" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open in diagnostics" })).not.toBeInTheDocument();
  });

  it("shows proof diagnostics and a close button", async () => {
    const onCloseSelectedBlock = vi.fn();
    render(
      <MemoryRouter>
        <WatchRuntimeInspector
          selectedBlock={block()}
          latestBlockRun={blockRun({ output: { proofId: "proof-1" } })}
          selectedRun={undefined}
          onCloseSelectedBlock={onCloseSelectedBlock}
        />
      </MemoryRouter>,
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
