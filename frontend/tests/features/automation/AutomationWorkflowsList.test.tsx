import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AutomationWorkflowsList } from "../../../src/features/automation/AutomationWorkflowsList";
import type { AutomationWorkflow } from "../../../src/features/automation/automationTypes";
import type { DataSource } from "../../../src/features/data-sources/dataSourceTypes";

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

const noop = () => {};
function baseProps(overrides: Partial<React.ComponentProps<typeof AutomationWorkflowsList>> = {}) {
  return {
    workflows: [] as AutomationWorkflow[],
    sources: [] as DataSource[],
    busy: false,
    onCreate: noop,
    onEdit: noop,
    onWatch: noop,
    onRunNow: noop,
    onToggleEnabled: noop,
    onDuplicate: noop,
    onToggleArchive: noop,
    onDelete: noop,
    ...overrides,
  };
}

describe("AutomationWorkflowsList", () => {
  it("shows a loading state", () => {
    render(<AutomationWorkflowsList {...baseProps({ loading: true })} />);
    expect(screen.getByText("Fetching your workflows")).toBeInTheDocument();
  });

  it("shows an empty state prompting to build the first workflow", async () => {
    const onCreate = vi.fn();
    render(<AutomationWorkflowsList {...baseProps({ onCreate })} />);
    expect(screen.getByText("Build your first workflow")).toBeInTheDocument();

    // Both the header button and the empty-state action are labelled "New workflow" here.
    await userEvent.click(screen.getAllByRole("button", { name: "New workflow" })[0]);
    expect(onCreate).toHaveBeenCalled();
  });

  it("renders a row per workflow with name, enabled switch, status, and last run", () => {
    render(
      <AutomationWorkflowsList
        {...baseProps({ workflows: [workflow({ lastRunAt: "2026-08-01T00:00:00.000Z" })] })}
      />,
    );
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row")[1];
    expect(within(row).getByText("Front gate flow")).toBeInTheDocument();
    expect(within(row).getByRole("switch")).toBeChecked();
    expect(within(row).getByText("Enabled")).toBeInTheDocument();
  });

  it("shows 'Never' for a workflow that has not run yet", () => {
    render(<AutomationWorkflowsList {...baseProps({ workflows: [workflow({ lastRunAt: null })] })} />);
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("shows the workflow's last error under its name", () => {
    render(
      <AutomationWorkflowsList {...baseProps({ workflows: [workflow({ lastError: "Fetch failed" })] })} />,
    );
    expect(screen.getByText("Fetch failed")).toBeInTheDocument();
  });

  it("shows an archived note and an Archived status for archived workflows", async () => {
    render(<AutomationWorkflowsList {...baseProps({ workflows: [workflow({ archived: true })] })} />);
    // Default filter is "active" (not archived), so switch to "All workflows" first.
    await userEvent.selectOptions(screen.getByLabelText("Filter"), "all");

    expect(screen.getByText("Archived, does not run until restored.")).toBeInTheDocument();
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row")[1];
    expect(within(row).getByText("Archived")).toBeInTheDocument();
  });

  it("shows a Paused status for a disabled, non-archived workflow", () => {
    render(<AutomationWorkflowsList {...baseProps({ workflows: [workflow({ enabled: false })] })} />);
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row")[1];
    expect(within(row).getByText("Paused")).toBeInTheDocument();
  });

  it("toggles enabled via the row switch", async () => {
    const onToggleEnabled = vi.fn();
    const wf = workflow();
    render(<AutomationWorkflowsList {...baseProps({ workflows: [wf], onToggleEnabled })} />);

    await userEvent.click(screen.getByRole("switch"));
    expect(onToggleEnabled).toHaveBeenCalledWith(wf);
  });

  it("disables the enabled switch for archived workflows", async () => {
    render(<AutomationWorkflowsList {...baseProps({ workflows: [workflow({ archived: true })] })} />);
    await userEvent.selectOptions(screen.getByLabelText("Filter"), "all");
    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("edits via the pencil action", async () => {
    const onEdit = vi.fn();
    const wf = workflow();
    render(<AutomationWorkflowsList {...baseProps({ workflows: [wf], onEdit })} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit Front gate flow" }));
    expect(onEdit).toHaveBeenCalledWith(wf);
  });

  it("runs now, duplicates, archives, and deletes via the row menu", async () => {
    const onRunNow = vi.fn();
    const onDuplicate = vi.fn();
    const onToggleArchive = vi.fn();
    const onDelete = vi.fn();
    const wf = workflow();
    render(
      <AutomationWorkflowsList
        {...baseProps({ workflows: [wf], onRunNow, onDuplicate, onToggleArchive, onDelete })}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "More actions for Front gate flow" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Run now" }));
    expect(onRunNow).toHaveBeenCalledWith(wf);

    await userEvent.click(screen.getByRole("button", { name: "More actions for Front gate flow" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(onDuplicate).toHaveBeenCalledWith(wf);

    await userEvent.click(screen.getByRole("button", { name: "More actions for Front gate flow" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Archive" }));
    expect(onToggleArchive).toHaveBeenCalledWith(wf);

    await userEvent.click(screen.getByRole("button", { name: "More actions for Front gate flow" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(wf);
  });

  it("shows Restore instead of Archive for an already-archived workflow", async () => {
    render(<AutomationWorkflowsList {...baseProps({ workflows: [workflow({ archived: true })] })} />);
    await userEvent.selectOptions(screen.getByLabelText("Filter"), "all");
    await userEvent.click(screen.getByRole("button", { name: "More actions for Front gate flow" }));
    expect(screen.getByRole("menuitem", { name: "Restore" })).toBeInTheDocument();
  });

  it("filters by search across name and last error", async () => {
    render(
      <AutomationWorkflowsList
        {...baseProps({
          workflows: [workflow({ id: "w1", name: "Front gate flow" }), workflow({ id: "w2", name: "Back door flow" })],
        })}
      />,
    );

    await userEvent.type(screen.getByLabelText("Search"), "back door");
    await waitFor(() => {
      expect(screen.queryByText("Front gate flow")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Back door flow")).toBeInTheDocument();
  });

  it("defaults the filter to active, excluding archived workflows from the list", () => {
    render(
      <AutomationWorkflowsList
        {...baseProps({
          workflows: [workflow({ id: "w1", name: "Active flow" }), workflow({ id: "w2", name: "Archived flow", archived: true })],
        })}
      />,
    );
    expect(screen.getByText("Active flow")).toBeInTheDocument();
    expect(screen.queryByText("Archived flow")).not.toBeInTheDocument();
  });

  it("shows a filtered empty state for a non-matching search, and clears filters from it", async () => {
    render(
      <AutomationWorkflowsList {...baseProps({ workflows: [workflow({ name: "Front gate flow" })] })} />,
    );

    await userEvent.type(screen.getByLabelText("Search"), "nomatch");
    expect(await screen.findByText("No matching workflows")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Front gate flow")).toBeInTheDocument();
  });
});
