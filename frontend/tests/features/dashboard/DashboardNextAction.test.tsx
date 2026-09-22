import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardNextAction } from "../../../src/features/dashboard/DashboardNextAction";
import type { AutomationWorkflow } from "../../../src/features/automation/automationTypes";
import type { DataSource } from "../../../src/features/data-sources/dataSourceTypes";

const listDataSources = vi.fn();
const listAutomationWorkflows = vi.fn();

vi.mock("../../../src/features/data-sources/dataSourcesApi", () => ({
  listDataSources: (...args: unknown[]) => listDataSources(...args),
}));

vi.mock("../../../src/features/automation/automationApi", () => ({
  listAutomationWorkflows: (...args: unknown[]) => listAutomationWorkflows(...args),
}));

function dataSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: "ds1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    name: "Source",
    type: "json-api",
    status: "ok",
    description: null,
    config: {},
    lastReadAt: null,
    lastError: null,
    lastPreview: null,
    lastHash: null,
    ...overrides,
  };
}

function workflow(overrides: Partial<AutomationWorkflow> = {}): AutomationWorkflow {
  return {
    id: "w1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    name: "Flow",
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

function renderNextAction() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<DashboardNextAction />} />
        <Route path="/data" element={<p>Data page</p>} />
        <Route path="/workflows" element={<p>Workflows page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DashboardNextAction", () => {
  beforeEach(() => {
    listDataSources.mockReset();
    listAutomationWorkflows.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an accessible placeholder while counts are loading", () => {
    listDataSources.mockReturnValue(new Promise(() => {}));
    listAutomationWorkflows.mockReturnValue(new Promise(() => {}));

    renderNextAction();

    expect(screen.getByRole("status")).toHaveTextContent("Checking your next step");
  });

  it("renders nothing once at least one device and one enabled workflow exist", async () => {
    listDataSources.mockResolvedValue({ items: [dataSource()] });
    listAutomationWorkflows.mockResolvedValue({ items: [workflow()] });

    const { container } = renderNextAction();

    await waitFor(() => expect(listAutomationWorkflows).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("prompts to connect a device when there are no devices", async () => {
    listDataSources.mockResolvedValue({ items: [] });
    listAutomationWorkflows.mockResolvedValue({ items: [workflow()] });

    renderNextAction();

    expect(await screen.findByText("Connect a device to get started")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Connect a device to get started" })).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "Connect devices" });
    await userEvent.click(button);

    expect(await screen.findByText("Data page")).toBeInTheDocument();
  });

  it("prompts to create a workflow once a device exists but no enabled workflow does", async () => {
    listDataSources.mockResolvedValue({ items: [dataSource()] });
    listAutomationWorkflows.mockResolvedValue({ items: [] });

    renderNextAction();

    expect(await screen.findByText("Create your first workflow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create workflow" })).toBeInTheDocument();

    const manageButton = screen.getByRole("button", { name: "Manage devices" });
    await userEvent.click(manageButton);

    expect(await screen.findByText("Data page")).toBeInTheDocument();
  });

  it("navigates to /workflows when the create-workflow button is clicked", async () => {
    listDataSources.mockResolvedValue({ items: [dataSource()] });
    listAutomationWorkflows.mockResolvedValue({ items: [] });

    renderNextAction();

    const createButton = await screen.findByRole("button", { name: "Create workflow" });
    await userEvent.click(createButton);

    expect(await screen.findByText("Workflows page")).toBeInTheDocument();
  });

  it("only counts non-archived workflows toward the enabled-workflow check", async () => {
    listDataSources.mockResolvedValue({ items: [dataSource()] });
    listAutomationWorkflows.mockResolvedValue({ items: [workflow({ archived: true })] });

    renderNextAction();

    // Archived-only workflows behave like zero workflows, so the flow still prompts step 2.
    expect(await screen.findByText("Create your first workflow")).toBeInTheDocument();
  });

  it("shows an error instead of onboarding when the devices request fails", async () => {
    listDataSources.mockRejectedValue(new Error("boom"));
    listAutomationWorkflows.mockResolvedValue({ items: [workflow()] });

    renderNextAction();

    expect(await screen.findByText("Your next step isn't available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("Connect a device to get started")).not.toBeInTheDocument();
    expect(screen.queryByText("Create your first workflow")).not.toBeInTheDocument();
  });

  it("recovers from a failed load through Retry", async () => {
    listDataSources
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ items: [] });
    listAutomationWorkflows.mockResolvedValue({ items: [] });

    renderNextAction();

    expect(await screen.findByText("Your next step isn't available")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Connect a device to get started")).toBeInTheDocument();
    expect(screen.queryByText("Your next step isn't available")).not.toBeInTheDocument();
  });

  it("shows an error instead of onboarding when the workflows request fails", async () => {
    listDataSources.mockResolvedValue({ items: [dataSource()] });
    listAutomationWorkflows.mockRejectedValue(new Error("boom"));

    renderNextAction();

    expect(await screen.findByText("Your next step isn't available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("Connect a device to get started")).not.toBeInTheDocument();
    expect(screen.queryByText("Create your first workflow")).not.toBeInTheDocument();
  });
});
