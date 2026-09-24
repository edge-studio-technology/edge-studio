import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { WorkflowWorkspaceShell } from "../../../../../src/features/automation/workflow/chrome/WorkflowWorkspaceShell";

function renderShell(props: Partial<React.ComponentProps<typeof WorkflowWorkspaceShell>> = {}) {
  return render(
    <MemoryRouter>
      <WorkflowWorkspaceShell
        breadcrumbLabel="New workflow"
        nameControl={<input aria-label="Workflow name" />}
        canvas={<div>Canvas</div>}
        rail={<div>Rail</div>}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("WorkflowWorkspaceShell", () => {
  it("renders a breadcrumb link back to Workflows and the current label", () => {
    renderShell();
    const link = screen.getByRole("link", { name: "Workflows" });
    expect(link).toHaveAttribute("href", "/workflows");
    expect(screen.getByText("New workflow")).toBeInTheDocument();
  });

  it("renders the name control, canvas, and rail", () => {
    renderShell();
    expect(screen.getByLabelText("Workflow name")).toBeInTheDocument();
    expect(screen.getByText("Canvas")).toBeInTheDocument();
    expect(screen.getByText("Rail")).toBeInTheDocument();
  });

  it("renders actions when given", () => {
    renderShell({ actions: <button type="button">Save</button> });
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders a status strip and notices row only when either is given", () => {
    const { rerender } = render(
      <MemoryRouter>
        <WorkflowWorkspaceShell
          breadcrumbLabel="New workflow"
          nameControl={<input aria-label="Workflow name" />}
          canvas={<div>Canvas</div>}
          rail={<div>Rail</div>}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Status strip")).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <WorkflowWorkspaceShell
          breadcrumbLabel="New workflow"
          nameControl={<input aria-label="Workflow name" />}
          canvas={<div>Canvas</div>}
          rail={<div>Rail</div>}
          statusStrip={<span>Status strip</span>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Status strip")).toBeInTheDocument();
  });

  it("renders the selected block sheet and bottom overlay when given", () => {
    renderShell({
      selectedSheet: <div>Selected sheet</div>,
      bottom: <div>Bottom overlay</div>,
    });
    expect(screen.getByText("Selected sheet")).toBeInTheDocument();
    expect(screen.getByText("Bottom overlay")).toBeInTheDocument();
  });

  describe("rail drawer", () => {
    const toggle = () => screen.getByRole("button", { name: "Toolkit" });
    const rail = () => document.getElementById("workflow-rail");

    it("starts closed and toggles open with aria-expanded", () => {
      renderShell();
      expect(toggle()).toHaveAttribute("aria-expanded", "false");
      expect(rail()).toHaveAttribute("data-open", "false");
      fireEvent.click(toggle());
      expect(toggle()).toHaveAttribute("aria-expanded", "true");
      expect(rail()).toHaveAttribute("data-open", "true");
      fireEvent.click(toggle());
      expect(rail()).toHaveAttribute("data-open", "false");
    });

    it("closes on Escape", () => {
      renderShell();
      fireEvent.click(toggle());
      fireEvent.keyDown(document, { key: "Escape" });
      expect(rail()).toHaveAttribute("data-open", "false");
    });

    it("closes on a click outside", () => {
      renderShell();
      fireEvent.click(toggle());
      fireEvent.pointerDown(screen.getByTestId("workflow-rail-backdrop"));
      expect(rail()).toHaveAttribute("data-open", "false");
      expect(screen.queryByTestId("workflow-rail-backdrop")).not.toBeInTheDocument();
    });

    it("closes when a block sheet opens, e.g. after adding a block", () => {
      const props = {
        breadcrumbLabel: "New workflow",
        nameControl: <input aria-label="Workflow name" />,
        canvas: <div>Canvas</div>,
        rail: <div>Rail</div>,
      };
      const { rerender } = render(
        <MemoryRouter>
          <WorkflowWorkspaceShell {...props} />
        </MemoryRouter>,
      );
      fireEvent.click(toggle());
      rerender(
        <MemoryRouter>
          <WorkflowWorkspaceShell {...props} selectedSheet={<div>Sheet</div>} />
        </MemoryRouter>,
      );
      expect(rail()).toHaveAttribute("data-open", "false");
    });
  });
});
