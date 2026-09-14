import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AutomationRunsTable } from "../../../src/features/automation/AutomationRunsTable";
import type { AutomationRun } from "../../../src/features/automation/automationTypes";

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
    blockCount: 2,
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

function renderTable(props: Partial<React.ComponentProps<typeof AutomationRunsTable>> = {}) {
  return render(
    <MemoryRouter>
      <AutomationRunsTable runs={[]} {...props} />
    </MemoryRouter>,
  );
}

describe("AutomationRunsTable", () => {
  it("shows a loading state", () => {
    renderTable({ loading: true });
    expect(screen.getByText("Fetching your workflow runs")).toBeInTheDocument();
  });

  it("shows an empty state with no runs and no filters active", () => {
    renderTable();
    expect(screen.getByText("No workflow runs yet")).toBeInTheDocument();
  });

  it("shows a filtered empty state with a clear-filters action", async () => {
    const onClearFilters = vi.fn();
    renderTable({ filtered: true, onClearFilters });
    expect(screen.getByText("No matching workflow runs")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it("renders a row per run with workflow name, trigger, status, duration, and block counts", () => {
    renderTable({ runs: [run()] });
    const table = screen.getByRole("table", { name: "Workflow logs" });
    expect(within(table).getByText("Front gate flow")).toBeInTheDocument();
    expect(within(table).getByText("manual")).toBeInTheDocument();
    expect(within(table).getByText("Success")).toBeInTheDocument();
    expect(within(table).getByText("1.0 s")).toBeInTheDocument();
    expect(within(table).getByText("1/2")).toBeInTheDocument();
  });

  it("hides the Workflow column in compact mode", () => {
    renderTable({ runs: [run()], compact: true });
    const table = screen.getByRole("table", { name: "Workflow logs" });
    expect(within(table).queryByText("Workflow")).not.toBeInTheDocument();
    expect(within(table).queryByText("Front gate flow")).not.toBeInTheDocument();
  });

  it("opens the inspect modal for a run and closes it", async () => {
    renderTable({ runs: [run()] });

    await userEvent.click(screen.getByRole("button", { name: "View details for Front gate flow" }));
    const dialog = screen.getByRole("dialog", { name: "Front gate flow workflow" });
    expect(dialog).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
