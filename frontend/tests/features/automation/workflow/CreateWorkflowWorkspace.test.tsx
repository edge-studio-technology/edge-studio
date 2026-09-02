import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateWorkflowWorkspace } from "../../../../src/features/automation/workflow/CreateWorkflowWorkspace";
import type { AutomationValidationResult } from "../../../../src/features/automation/automationTypes";
import type { DataSource } from "../../../../src/features/data-sources/dataSourceTypes";

const blockerRef: { current: { state: "unblocked" | "blocked"; proceed: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn> } } = {
  current: { state: "unblocked", proceed: vi.fn(), reset: vi.fn() },
};
let blockerPredicate: ((args: { currentLocation: { pathname: string; search: string }; nextLocation: { pathname: string; search: string } }) => boolean) | null = null;

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useBlocker: (predicate: typeof blockerPredicate) => {
      blockerPredicate = predicate;
      return blockerRef.current;
    },
  };
});

const validateAutomationDraft = vi.fn();
vi.mock("../../../../src/features/automation/automationApi", () => ({
  validateAutomationDraft: (...args: unknown[]) => validateAutomationDraft(...args),
}));

vi.mock("../../../../src/features/automation/workflow/WorkflowBlockInspectors", () => ({
  DraftBlockInspector: (props: {
    block: { attachedBlocks?: { id: string }[] };
    onChange: (config: Record<string, unknown>) => void;
    onAttachedChange: (id: string, config: Record<string, unknown>) => void;
    onAttachedRemove: (id: string) => void;
  }) => (
    <div>
      <button type="button" onClick={() => props.onChange({ changed: true })}>
        change-config
      </button>
      <span>attached-count:{props.block.attachedBlocks?.length ?? 0}</span>
      {props.block.attachedBlocks?.[0] ? <>
        <button type="button" onClick={() => props.onAttachedChange(props.block.attachedBlocks![0].id, { attachedChanged: true })}>change-attached</button>
        <button type="button" onClick={() => props.onAttachedRemove(props.block.attachedBlocks![0].id)}>remove-attached</button>
      </> : null}
    </div>
  ),
}));

vi.mock("../../../../src/features/automation/workflow/canvas", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/features/automation/workflow/canvas")>();
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
              select-{block.type}
            </button>
            <button type="button" onClick={() => props.onMoveBlock(block.id, -1)}>
              move-up-{block.type}
            </button>
            <button type="button" onClick={() => props.onRemoveBlock(block.id)}>
              remove-{block.type}
            </button>
          </div>
        ))}
      </div>
    ),
  };
});

vi.mock("../../../../src/features/automation/workflow/toolkit/WorkflowBlockLibrary", () => ({
  WorkflowBlockLibrary: (props: {
    hasStartBlock: boolean;
    onSelectStartBlock: (type: string) => void;
    onAddBlock: (type: string) => void;
  }) => (
    <div>
      <span>{props.hasStartBlock ? "has-start" : "no-start"}</span>
      <button type="button" onClick={() => props.onSelectStartBlock("manual_start")}>
        pick-manual-start
      </button>
      <button type="button" onClick={() => props.onSelectStartBlock("schedule_start")}>
        pick-schedule-start
      </button>
      <button type="button" onClick={() => props.onAddBlock("fetch_data_source")}>
        add-fetch-data-source
      </button>
      <button type="button" onClick={() => props.onAddBlock("show_preview")}>add-show-preview</button>
      <button type="button" onClick={() => props.onAddBlock("send_transaction")}>add-send-transaction</button>
    </div>
  ),
}));

function source(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: "s1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    name: "HTTP source",
    type: "json-api",
    status: "ok",
    description: null,
    config: { url: "https://example.com" },
    ...overrides,
  } as DataSource;
}

function okValidation(): AutomationValidationResult {
  return { ok: true, errors: [], warnings: [] };
}

function renderWorkspace(props: Partial<React.ComponentProps<typeof CreateWorkflowWorkspace>> = {}) {
  return render(
    <MemoryRouter>
      <CreateWorkflowWorkspace
        name="My workflow"
        initialName=""
        enabled={true}
        sources={[source()]}
        addressBook={[]}
        walletStatus={null}
        busy={false}
        onNameChange={vi.fn()}
        onEnabledChange={vi.fn()}
        onCancel={vi.fn()}
        onCreate={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  blockerRef.current = { state: "unblocked", proceed: vi.fn(), reset: vi.fn() };
  blockerPredicate = null;
  validateAutomationDraft.mockReset();
  validateAutomationDraft.mockResolvedValue({ item: okValidation() });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CreateWorkflowWorkspace", () => {
  it("shows a name-required error and disables Create when the name is blank", async () => {
    renderWorkspace({ name: "" });
    await waitFor(() => expect(validateAutomationDraft).toHaveBeenCalled());
    expect(screen.getByText("Workflow name is required.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create workflow" })).toBeDisabled();
  });

  it("calls onNameChange when the name field changes", async () => {
    const onNameChange = vi.fn();
    renderWorkspace({ onNameChange });
    await userEvent.type(screen.getByRole("textbox", { name: "Workflow name" }), "x");
    expect(onNameChange).toHaveBeenCalled();
  });

  it("keeps Create disabled while validation is pending, enables once it resolves ok", async () => {
    let resolveValidation!: (value: { item: AutomationValidationResult }) => void;
    validateAutomationDraft.mockReturnValue(
      new Promise((resolve) => {
        resolveValidation = resolve;
      }),
    );
    renderWorkspace();
    expect(screen.getByRole("button", { name: "Create workflow" })).toBeDisabled();

    await act(async () => {
      resolveValidation({ item: okValidation() });
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create workflow" })).not.toBeDisabled(),
    );
  });

  it("disables Create and shows an unavailable reason when validation fails to load", async () => {
    validateAutomationDraft.mockRejectedValue(new Error("network down"));
    renderWorkspace();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create workflow" })).toHaveAttribute(
        "title",
        "Validation is unavailable.",
      ),
    );
    expect(screen.getByRole("button", { name: "Create workflow" })).toBeDisabled();
  });

  it("disables Create when the backend reports validation errors", async () => {
    validateAutomationDraft.mockResolvedValue({
      item: { ok: false, errors: [{ code: "x", level: "error", message: "bad" }], warnings: [] },
    });
    renderWorkspace();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create workflow" })).toBeDisabled(),
    );
  });

  it("adds a start block from the library and marks the workspace dirty", async () => {
    renderWorkspace();
    expect(screen.getByText("no-start")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    expect(screen.getByText("has-start")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "select-manual_start" })).toBeInTheDocument();
  });

  it("does not open the selected-block sheet for a manual start block", async () => {
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    await userEvent.click(screen.getByRole("button", { name: "select-manual_start" }));
    expect(screen.queryByRole("button", { name: "change-config" })).not.toBeInTheDocument();
  });

  it("opens the selected-block sheet for a non-manual block and closes it with Done", async () => {
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    await userEvent.click(screen.getByRole("button", { name: "add-fetch-data-source" }));

    expect(screen.getByRole("button", { name: "change-config" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("button", { name: "change-config" })).not.toBeInTheDocument();
  });

  it("persists inspector configuration changes into the create payload", async () => {
    const onCreate = vi.fn().mockResolvedValue(true);
    renderWorkspace({ onCreate });
    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    await userEvent.click(screen.getByRole("button", { name: "add-fetch-data-source" }));
    await userEvent.click(screen.getByRole("button", { name: "change-config" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create workflow" })).not.toBeDisabled());
    await userEvent.click(screen.getByRole("button", { name: "Create workflow" }));
    expect(onCreate).toHaveBeenCalledWith([
      expect.objectContaining({ type: "manual_start" }),
      expect.objectContaining({ type: "fetch_data_source", config: { changed: true } }),
    ]);
  });

  it("shows an Attach stamp action for a data block with no stamp attached yet", async () => {
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    await userEvent.click(screen.getByRole("button", { name: "add-fetch-data-source" }));

    expect(screen.getByRole("button", { name: "Attach stamp" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Attach stamp" }));
    expect(screen.queryByRole("button", { name: "Attach stamp" })).not.toBeInTheDocument();
  });

  it("updates and removes an attached stamp block", async () => {
    const onCreate = vi.fn().mockResolvedValue(true);
    renderWorkspace({ onCreate });
    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    await userEvent.click(screen.getByRole("button", { name: "add-fetch-data-source" }));
    await userEvent.click(screen.getByRole("button", { name: "Attach stamp" }));
    expect(screen.getByText("attached-count:1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "change-attached" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create workflow" })).not.toBeDisabled());
    await userEvent.click(screen.getByRole("button", { name: "Create workflow" }));
    expect(onCreate).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ type: "stamp_integritas", config: { attachedChanged: true } }),
    ]));
    await userEvent.click(screen.getByRole("button", { name: "remove-attached" }));
    expect(screen.getByText("attached-count:0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Attach stamp" })).toBeInTheDocument();
  });

  it("removes a block via the canvas remove action", async () => {
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    await userEvent.click(screen.getByRole("button", { name: "add-fetch-data-source" }));
    expect(screen.getByRole("button", { name: "select-fetch_data_source" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "remove-fetch_data_source" }));
    expect(screen.queryByRole("button", { name: "select-fetch_data_source" })).not.toBeInTheDocument();
  });

  it("reorders non-start blocks without moving them ahead of the start block", async () => {
    const onCreate = vi.fn().mockResolvedValue(true);
    renderWorkspace({ onCreate });
    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    await userEvent.click(screen.getByRole("button", { name: "add-fetch-data-source" }));
    await userEvent.click(screen.getByRole("button", { name: "add-show-preview" }));
    await userEvent.click(screen.getByRole("button", { name: "move-up-show_preview" }));
    await userEvent.click(screen.getByRole("button", { name: "move-up-show_preview" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create workflow" })).not.toBeDisabled());
    await userEvent.click(screen.getByRole("button", { name: "Create workflow" }));
    expect(onCreate.mock.calls[0][0].map((block: { type: string }) => block.type)).toEqual(["manual_start", "show_preview", "fetch_data_source"]);
  });

  it("reopens a configurable start and replaces it with a different start type", async () => {
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "pick-schedule-start" }));
    expect(screen.getByRole("button", { name: "change-config" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await userEvent.click(screen.getByRole("button", { name: "pick-schedule-start" }));
    expect(screen.getByRole("button", { name: "change-config" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    expect(screen.queryByRole("button", { name: "select-schedule_start" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "select-manual_start" })).toBeInTheDocument();
  });

  it("does not add a payment block when the address book is empty", async () => {
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    await userEvent.click(screen.getByRole("button", { name: "add-send-transaction" }));
    expect(screen.queryByRole("button", { name: "select-send_transaction" })).not.toBeInTheDocument();
  });

  it("disables Reset canvas until a block is added, then clears blocks", async () => {
    renderWorkspace();
    expect(screen.getByRole("button", { name: "Reset canvas" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    expect(screen.getByRole("button", { name: "Reset canvas" })).not.toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Reset canvas" }));
    expect(screen.getByText("no-start")).toBeInTheDocument();
  });

  it("calls onCancel directly when leaving a clean workspace", async () => {
    const onCancel = vi.fn();
    renderWorkspace({ name: "", initialName: "", onCancel });
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onCancel).toHaveBeenCalled();
    expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();
  });

  it("shows a leave-confirmation modal instead of cancelling directly when dirty", async () => {
    const onCancel = vi.fn();
    renderWorkspace({ onCancel });
    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onCancel).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Are you sure?" });

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("confirms leaving via the leave-confirmation modal", async () => {
    const onCancel = vi.fn();
    renderWorkspace({ onCancel });
    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("resets a blocked router transition when leave confirmation is cancelled", async () => {
    blockerRef.current = { state: "blocked", proceed: vi.fn(), reset: vi.fn() };
    renderWorkspace();
    const dialog = await screen.findByRole("dialog", { name: "Are you sure?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(blockerRef.current.reset).toHaveBeenCalledOnce();
    expect(blockerRef.current.proceed).not.toHaveBeenCalled();
  });

  it("proceeds with a blocked router transition when leaving is confirmed", async () => {
    const onCancel = vi.fn();
    blockerRef.current = { state: "blocked", proceed: vi.fn(), reset: vi.fn() };
    renderWorkspace({ onCancel });
    const dialog = await screen.findByRole("dialog", { name: "Are you sure?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Leave" }));
    expect(blockerRef.current.proceed).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("prevents browser unload while the workspace is dirty", () => {
    renderWorkspace();
    const event = new Event("beforeunload", { cancelable: true });
    const dispatched = window.dispatchEvent(event);
    expect(dispatched).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it("calls onCreate with flattened blocks when Create workflow is clicked", async () => {
    const onCreate = vi.fn().mockResolvedValue(true);
    renderWorkspace({ onCreate });
    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create workflow" })).not.toBeDisabled(),
    );

    await userEvent.click(screen.getByRole("button", { name: "Create workflow" }));
    expect(onCreate).toHaveBeenCalledWith([
      expect.objectContaining({ type: "manual_start" }),
    ]);
  });

  it("re-enables navigation blocking when create returns false", async () => {
    let resolveCreate!: (result: boolean) => void;
    const onCreate = vi.fn(() => new Promise<boolean>((resolve) => { resolveCreate = resolve; }));
    renderWorkspace({ onCreate });
    await userEvent.click(screen.getByRole("button", { name: "pick-manual-start" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create workflow" })).not.toBeDisabled());
    await userEvent.click(screen.getByRole("button", { name: "Create workflow" }));
    const navigation = {
      currentLocation: { pathname: "/automation/new", search: "" },
      nextLocation: { pathname: "/automation", search: "" },
    };
    expect(blockerPredicate?.(navigation)).toBe(false);
    await act(async () => resolveCreate(false));
    expect(blockerPredicate?.(navigation)).toBe(true);
  });

  it("disables all actions while busy", () => {
    renderWorkspace({ busy: true });
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create workflow" })).toBeDisabled();
  });
});
