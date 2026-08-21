import { forwardRef, useImperativeHandle } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowWorkspace } from "../../../../src/features/automation/workflow/WorkflowWorkspace";
import type {
  AutomationBlock,
  AutomationRun,
  AutomationWorkflow,
} from "../../../../src/features/automation/automationTypes";
import type { AddressBookEntry } from "../../../../src/features/address-book/addressBookTypes";
import type { DataSource } from "../../../../src/features/data-sources/dataSourceTypes";

vi.mock("../../../../src/features/automation/workflow/WorkflowBlockInspectors", () => ({
  DraftBlockInspector: (props: { onChange: (config: Record<string, unknown>) => void }) => (
    <div>
      <button
        type="button"
        onClick={() => props.onChange({ recipientAddressBookId: "a1", amount: "5" })}
      >
        set-valid-draft-config
      </button>
      <button
        type="button"
        onClick={() => props.onChange({ recipientAddressBookId: "", amount: "" })}
      >
        set-invalid-draft-config
      </button>
    </div>
  ),
  PersistedBlockInspector: forwardRef(function PersistedBlockInspectorMock(
    props: {
      block: AutomationBlock;
      attachedBlocks: AutomationBlock[];
      onDirty: () => void;
      onAttachStamp: () => void;
      onUpdate: (input: unknown) => void;
      onDelete: () => void;
    },
    ref,
  ) {
    useImperativeHandle(ref, () => ({ flush: vi.fn() }));
    return (
      <div>
        <span>editing-{props.block.type}</span>
        <span>attached-{props.attachedBlocks.length}</span>
        <button type="button" onClick={() => props.onUpdate({ config: { touched: true } })}>
          persisted-update
        </button>
        <button type="button" onClick={() => props.onAttachStamp()}>
          persisted-attach-stamp
        </button>
        <button type="button" onClick={() => props.onDelete()}>
          persisted-delete
        </button>
        <button type="button" onClick={() => props.onDirty()}>
          persisted-dirty
        </button>
      </div>
    );
  }),
}));

vi.mock("../../../../src/features/automation/workflow/canvas", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../src/features/automation/workflow/canvas")>();
  return {
    ...actual,
    WorkflowCanvas: (props: {
      blocks: { id: string; type: string }[];
      onSelectBlock: (id: string) => void;
      onMoveBlock: (id: string, direction: -1 | 1) => void;
      onRemoveBlock: (id: string) => void;
    }) => (
      <div>
        {props.blocks.map((block) => (
          <div key={block.id}>
            <button type="button" onClick={() => props.onSelectBlock(block.id)}>
              select-{block.type}-{block.id}
            </button>
            <button type="button" onClick={() => props.onMoveBlock(block.id, -1)}>
              move-up-{block.id}
            </button>
            <button type="button" onClick={() => props.onRemoveBlock(block.id)}>
              remove-{block.id}
            </button>
          </div>
        ))}
      </div>
    ),
  };
});

vi.mock("../../../../src/features/automation/workflow/toolkit/WorkflowBlockLibrary", () => ({
  WorkflowBlockLibrary: (props: { onAddBlock: (type: string) => void | Promise<unknown> }) => (
    <div>
      <button type="button" onClick={() => props.onAddBlock("wait")}>
        add-wait
      </button>
      <button type="button" onClick={() => props.onAddBlock("send_transaction")}>
        add-send-transaction
      </button>
      <button type="button" onClick={() => props.onAddBlock("control_output")}>
        add-control-output
      </button>
    </div>
  ),
}));

function block(overrides: Partial<AutomationBlock> = {}): AutomationBlock {
  return {
    id: "b-start",
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
    blocks: [block()],
    ...overrides,
  };
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
    blocks: [],
    ...overrides,
  };
}

function renderWorkspace(
  props: Partial<React.ComponentProps<typeof WorkflowWorkspace>> = {},
) {
  return render(
    <MemoryRouter>
      <WorkflowWorkspace
        workflow={workflow()}
        runs={[]}
        validation={null}
        source={undefined}
        sources={[] as DataSource[]}
        addressBook={[] as AddressBookEntry[]}
        walletStatus={null}
        busy={false}
        mode="edit"
        onBack={vi.fn()}
        onNavigateMode={vi.fn()}
        onSelectWatchRun={vi.fn()}
        onAddBlock={vi.fn()}
        onDeleteBlock={vi.fn()}
        onUpdateBlock={vi.fn()}
        onUpdateWorkflow={vi.fn()}
        onReorderBlocks={vi.fn()}
        onRunNow={vi.fn()}
        onRunWithPayload={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("WorkflowWorkspace edit mode", () => {
  it("shows a required-name error and saves the trimmed name on blur", async () => {
    const onUpdateWorkflow = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({ onUpdateWorkflow });

    const nameField = screen.getByRole("textbox", { name: "Workflow name" });
    await user.clear(nameField);
    expect(screen.getByText("Workflow name is required.")).toBeInTheDocument();

    await user.type(nameField, "New name");
    nameField.blur();
    expect(onUpdateWorkflow).toHaveBeenCalledWith({ name: "New name" });
  });

  it("pauses an enabled workflow once per editing session on the first real edit", async () => {
    const onUpdateWorkflow = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({ onUpdateWorkflow, workflow: workflow({ enabled: true }) });

    await user.type(screen.getByRole("textbox", { name: "Workflow name" }), "!");
    expect(onUpdateWorkflow).toHaveBeenCalledWith({ enabled: false });
    expect(
      screen.getByText(
        "Workflow is paused while editing, enable it again from the workflow list.",
        { exact: false },
      ),
    ).toBeInTheDocument();
  });

  it("debounce-saves the name 500ms after the last keystroke", async () => {
    const onUpdateWorkflow = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({ onUpdateWorkflow });

    await user.type(screen.getByRole("textbox", { name: "Workflow name" }), " v2");
    expect(onUpdateWorkflow).not.toHaveBeenCalledWith({ name: "Front gate flow v2" });

    await vi.advanceTimersByTimeAsync(500);
    expect(onUpdateWorkflow).toHaveBeenCalledWith({ name: "Front gate flow v2" });
  });

  it("activates a paused workflow via the status button", async () => {
    const onUpdateWorkflow = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({ onUpdateWorkflow, workflow: workflow({ enabled: false }) });

    const button = screen.getByRole("button", { name: "Workflow paused" });
    expect(button).not.toBeDisabled();
    await user.click(button);
    expect(onUpdateWorkflow).toHaveBeenCalledWith({ enabled: true });
  });

  it("disables the status button and shows a title while validation errors exist", () => {
    renderWorkspace({
      workflow: workflow({ enabled: false }),
      validation: { ok: false, errors: [{ code: "x", level: "error", message: "bad" }], warnings: [] },
    });
    const button = screen.getByRole("button", { name: "Workflow paused" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Fix validation errors before activating.");
  });

  it("skips adding a block that needs a missing device", async () => {
    const onAddBlock = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({ onAddBlock, sources: [] });

    await user.click(screen.getByRole("button", { name: "add-control-output" }));
    expect(onAddBlock).not.toHaveBeenCalled();
  });

  it("adds a normal block via the library and opens its persisted inspector", async () => {
    const onAddBlock = vi
      .fn()
      .mockResolvedValue({ item: { id: "b-wait", parentBlockId: null } });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({
      onAddBlock,
      workflow: workflow({ blocks: [block(), block({ id: "b-wait", type: "wait" })] }),
    });

    await user.click(screen.getByRole("button", { name: "add-wait" }));
    expect(onAddBlock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wait" }),
    );
    await waitFor(() => expect(screen.getByText("editing-wait")).toBeInTheDocument());
  });

  it("opens a local Send payment draft sheet instead of calling onAddBlock directly", async () => {
    const onAddBlock = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({
      onAddBlock,
      addressBook: [{ id: "a1", label: "Alice", address: "Mx1" }] as AddressBookEntry[],
    });

    await user.click(screen.getByRole("button", { name: "add-send-transaction" }));
    expect(onAddBlock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "set-valid-draft-config" })).toBeInTheDocument();
  });

  it("keeps the draft sheet open and reveals errors when Done is clicked with an invalid payment", async () => {
    const onAddBlock = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({
      onAddBlock,
      addressBook: [{ id: "a1", label: "Alice", address: "Mx1" }] as AddressBookEntry[],
    });

    await user.click(screen.getByRole("button", { name: "add-send-transaction" }));
    await user.click(screen.getByRole("button", { name: "set-invalid-draft-config" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onAddBlock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "set-valid-draft-config" })).toBeInTheDocument();
  });

  it("persists the draft payment and closes the sheet once valid", async () => {
    const onAddBlock = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({
      onAddBlock,
      addressBook: [{ id: "a1", label: "Alice", address: "Mx1" }] as AddressBookEntry[],
    });

    await user.click(screen.getByRole("button", { name: "add-send-transaction" }));
    await user.click(screen.getByRole("button", { name: "set-valid-draft-config" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onAddBlock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "send_transaction" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "set-valid-draft-config" })).not.toBeInTheDocument(),
    );
  });

  it("does not open the sheet when selecting the manual start block", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace();
    await user.click(screen.getByRole("button", { name: "select-manual_start-b-start" }));
    expect(screen.queryByText("editing-manual_start")).not.toBeInTheDocument();
  });

  it("moves a block up via the canvas move action", async () => {
    const onReorderBlocks = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({
      onReorderBlocks,
      workflow: workflow({ blocks: [block(), block({ id: "b-wait", type: "wait", order: 1 })] }),
    });

    await user.click(screen.getByRole("button", { name: "move-up-b-wait" }));
    expect(onReorderBlocks).toHaveBeenCalledWith(["b-wait", "b-start"]);
  });

  it("deletes a non-start block via the canvas remove action, but not a start block", async () => {
    const onDeleteBlock = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({
      onDeleteBlock,
      workflow: workflow({ blocks: [block(), block({ id: "b-wait", type: "wait" })] }),
    });

    await user.click(screen.getByRole("button", { name: "remove-b-start" }));
    expect(onDeleteBlock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "remove-b-wait" }));
    expect(onDeleteBlock).toHaveBeenCalledWith("b-wait");
  });

  it("wires persisted-inspector callbacks to onUpdateBlock/onAttachStamp/onDelete", async () => {
    const onUpdateBlock = vi.fn();
    const onAddBlock = vi.fn();
    const onDeleteBlock = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({
      onUpdateBlock,
      onAddBlock,
      onDeleteBlock,
      workflow: workflow({ blocks: [block(), block({ id: "b-wait", type: "wait" })] }),
    });

    await user.click(screen.getByRole("button", { name: "select-wait-b-wait" }));
    await waitFor(() => expect(screen.getByText("editing-wait")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "persisted-update" }));
    expect(onUpdateBlock).toHaveBeenCalledWith("b-wait", { config: { touched: true } });

    await user.click(screen.getByRole("button", { name: "persisted-attach-stamp" }));
    expect(onAddBlock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "stamp_integritas", parentBlockId: "b-wait" }),
    );

    await user.click(screen.getByRole("button", { name: "persisted-delete" }));
    expect(onDeleteBlock).toHaveBeenCalledWith("b-wait");
  });

  it("shows notices for archived workflows and the last run error", () => {
    renderWorkspace({
      workflow: workflow({ archived: true, lastError: "boom" }),
    });
    expect(
      screen.getByText("Archived workflows do not run automatically or manually until restored."),
    ).toBeInTheDocument();
    expect(screen.getByText("Last run failed: boom")).toBeInTheDocument();
  });

  it("shows block/last-run/next-run status pills", () => {
    renderWorkspace({
      workflow: workflow({
        blocks: [block(), block({ id: "b-wait", type: "wait" })],
        lastRunAt: "2026-08-01T00:00:00.000Z",
      }),
    });
    expect(screen.getByText("Blocks 2")).toBeInTheDocument();
  });
});

describe("WorkflowWorkspace watch mode", () => {
  it("auto-selects the first run and shows it in run history", () => {
    const onSelectWatchRun = vi.fn();
    renderWorkspace({
      mode: "watch",
      runs: [run()],
      onSelectWatchRun,
    });
    expect(screen.getByText("Viewing historic run")).toBeInTheDocument();
  });

  it("calls onSelectWatchRun when a different run is chosen from history", async () => {
    const onSelectWatchRun = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({
      mode: "watch",
      runs: [run(), run({ id: "r2" })],
      onSelectWatchRun,
    });

    await user.click(screen.getByRole("button", { name: "Show on canvas" }));
    expect(onSelectWatchRun).toHaveBeenCalledWith("r2");
  });

  it("opens the watch runtime inspector even for the manual start block", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkspace({ mode: "watch", runs: [run()] });

    await user.click(screen.getByRole("button", { name: "select-manual_start-b-start" }));
    expect(screen.getByText("Start manually runtime")).toBeInTheDocument();
  });

  it("shows Run controls in the rail instead of the block library", () => {
    renderWorkspace({ mode: "watch", runs: [run()] });
    expect(screen.getByText("Run controls")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "add-wait" })).not.toBeInTheDocument();
  });
});
