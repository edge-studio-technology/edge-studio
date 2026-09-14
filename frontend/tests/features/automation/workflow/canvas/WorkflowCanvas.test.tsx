import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkflowCanvas } from "../../../../../src/features/automation/workflow/canvas/WorkflowCanvas";
import type { WorkflowCanvasBlock } from "../../../../../src/features/automation/workflow/canvas/types";

function manualStart(overrides: Partial<WorkflowCanvasBlock> = {}): WorkflowCanvasBlock {
  return { id: "b1", type: "manual_start", config: {}, ...overrides };
}

function waitBlock(overrides: Partial<WorkflowCanvasBlock> = {}): WorkflowCanvasBlock {
  return { id: "b2", type: "wait", config: { durationMs: 1000 }, ...overrides };
}

describe("WorkflowCanvas", () => {
  it("shows a build-mode empty state with no blocks", () => {
    render(
      <WorkflowCanvas
        mode="build"
        blocks={[]}
        sources={[]}
        addressBook={[]}
        selectedBlockId=""
        onSelectBlock={() => {}}
        onMoveBlock={() => {}}
        onRemoveBlock={() => {}}
      />,
    );
    expect(screen.getByText("Click from the toolkit to add a start block")).toBeInTheDocument();
  });

  it("shows an edit-mode empty state with no blocks", () => {
    render(
      <WorkflowCanvas
        mode="edit"
        blocks={[]}
        sources={[]}
        addressBook={[]}
        selectedBlockId=""
        onSelectBlock={() => {}}
        onMoveBlock={() => {}}
        onRemoveBlock={() => {}}
      />,
    );
    expect(screen.getByText("No blocks")).toBeInTheDocument();
  });

  it("renders a card per block with its title and description", () => {
    render(
      <WorkflowCanvas
        mode="build"
        blocks={[manualStart(), waitBlock()]}
        sources={[]}
        addressBook={[]}
        selectedBlockId=""
        onSelectBlock={() => {}}
        onMoveBlock={() => {}}
        onRemoveBlock={() => {}}
      />,
    );
    expect(screen.getByText("Manual run")).toBeInTheDocument();
    expect(screen.getByText("Wait")).toBeInTheDocument();
    expect(screen.getByText("Duration: 1 s")).toBeInTheDocument();
  });

  it("shows a status pill when statusLabel is given", () => {
    render(
      <WorkflowCanvas
        mode="build"
        blocks={[manualStart()]}
        sources={[]}
        addressBook={[]}
        selectedBlockId=""
        statusLabel="Validated"
        statusGood
        onSelectBlock={() => {}}
        onMoveBlock={() => {}}
        onRemoveBlock={() => {}}
      />,
    );
    expect(screen.getByText("Validated")).toBeInTheDocument();
  });

  it("selects a block on click", async () => {
    const onSelectBlock = vi.fn();
    render(
      <WorkflowCanvas
        mode="build"
        blocks={[manualStart()]}
        sources={[]}
        addressBook={[]}
        selectedBlockId=""
        onSelectBlock={onSelectBlock}
        onMoveBlock={() => {}}
        onRemoveBlock={() => {}}
      />,
    );

    await userEvent.click(screen.getByText("Manual run"));
    expect(onSelectBlock).toHaveBeenCalledWith("b1");
  });

  it("selects a block via keyboard Enter", async () => {
    const onSelectBlock = vi.fn();
    render(
      <WorkflowCanvas
        mode="build"
        blocks={[manualStart()]}
        sources={[]}
        addressBook={[]}
        selectedBlockId=""
        onSelectBlock={onSelectBlock}
        onMoveBlock={() => {}}
        onRemoveBlock={() => {}}
      />,
    );

    (screen.getByText("Manual run").closest('[role="button"]') as HTMLElement | null)?.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelectBlock).toHaveBeenCalledWith("b1");
  });

  it("does not show move/remove actions on start blocks", () => {
    render(
      <WorkflowCanvas
        mode="build"
        blocks={[manualStart()]}
        sources={[]}
        addressBook={[]}
        selectedBlockId=""
        onSelectBlock={() => {}}
        onMoveBlock={() => {}}
        onRemoveBlock={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("shows move/remove actions on non-start blocks and calls the right callbacks", async () => {
    const onMoveBlock = vi.fn();
    const onRemoveBlock = vi.fn();
    render(
      <WorkflowCanvas
        mode="build"
        blocks={[manualStart(), waitBlock(), waitBlock({ id: "b3" })]}
        sources={[]}
        addressBook={[]}
        selectedBlockId=""
        onSelectBlock={() => {}}
        onMoveBlock={onMoveBlock}
        onRemoveBlock={onRemoveBlock}
      />,
    );

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    expect(removeButtons).toHaveLength(2);
    await userEvent.click(removeButtons[0]);
    expect(onRemoveBlock).toHaveBeenCalledWith("b2");

    const upButtons = screen.getAllByRole("button", { name: "Up" });
    await userEvent.click(upButtons[upButtons.length - 1]);
    expect(onMoveBlock).toHaveBeenCalledWith("b3", -1);

    const downButtons = screen.getAllByRole("button", { name: "Down" });
    await userEvent.click(downButtons[0]);
    expect(onMoveBlock).toHaveBeenCalledWith("b2", 1);
  });

  it("uses 'Move up'/'Move down' action labels in edit/watch mode", () => {
    render(
      <WorkflowCanvas
        mode="edit"
        blocks={[manualStart(), waitBlock()]}
        sources={[]}
        addressBook={[]}
        selectedBlockId=""
        onSelectBlock={() => {}}
        onMoveBlock={() => {}}
        onRemoveBlock={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Move up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move down" })).toBeInTheDocument();
  });

  it("disables move up on the first movable block and move down on the last block", () => {
    render(
      <WorkflowCanvas
        mode="build"
        blocks={[manualStart(), waitBlock(), waitBlock({ id: "b3" })]}
        sources={[]}
        addressBook={[]}
        selectedBlockId=""
        onSelectBlock={() => {}}
        onMoveBlock={() => {}}
        onRemoveBlock={() => {}}
      />,
    );
    const upButtons = screen.getAllByRole("button", { name: "Up" });
    const downButtons = screen.getAllByRole("button", { name: "Down" });
    expect(upButtons[0]).toBeDisabled();
    expect(downButtons[downButtons.length - 1]).toBeDisabled();
  });

  it("renders attached blocks nested under their parent", () => {
    render(
      <WorkflowCanvas
        mode="build"
        blocks={[
          manualStart(),
          {
            ...waitBlock(),
            attachedBlocks: [{ id: "stamp-1", type: "stamp_integritas", config: {} }],
          },
        ]}
        sources={[]}
        addressBook={[]}
        selectedBlockId=""
        onSelectBlock={() => {}}
        onMoveBlock={() => {}}
        onRemoveBlock={() => {}}
      />,
    );
    expect(screen.getByText("Stamp data")).toBeInTheDocument();
    expect(screen.getByText("Attached")).toBeInTheDocument();
  });

  it("shows validation badges from validationByBlockId", () => {
    render(
      <WorkflowCanvas
        mode="build"
        blocks={[waitBlock()]}
        sources={[]}
        addressBook={[]}
        selectedBlockId=""
        validationByBlockId={{ b2: [{ level: "error", message: "Bad config" }] }}
        onSelectBlock={() => {}}
        onMoveBlock={() => {}}
        onRemoveBlock={() => {}}
      />,
    );
    expect(screen.getByText("1 validation error")).toBeInTheDocument();
  });

  it("shows runtime status badges from runtimeByBlockId", () => {
    render(
      <WorkflowCanvas
        mode="watch"
        blocks={[waitBlock()]}
        sources={[]}
        addressBook={[]}
        selectedBlockId=""
        runtimeByBlockId={{ b2: { status: "success", durationMs: 250 } }}
        onSelectBlock={() => {}}
        onMoveBlock={() => {}}
        onRemoveBlock={() => {}}
      />,
    );
    expect(screen.getByText("success · 250 ms")).toBeInTheDocument();
  });
});
