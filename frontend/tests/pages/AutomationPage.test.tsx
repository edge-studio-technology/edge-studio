import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/components/ToastProvider";
import { AutomationPage } from "../../src/pages/AutomationPage";

const listDataSources = vi.fn();
const listAutomationWorkflows = vi.fn();
const listAutomationInbox = vi.fn();
const updateAutomationWorkflow = vi.fn();
const createAutomationWorkflow = vi.fn();

vi.mock("../../src/features/data-sources/dataSourcesApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/data-sources/dataSourcesApi")>()),
  listDataSources: (...args: unknown[]) => listDataSources(...args),
}));

vi.mock("../../src/features/automation/automationApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/automation/automationApi")>()),
  listAutomationWorkflows: (...args: unknown[]) => listAutomationWorkflows(...args),
  listAutomationInbox: (...args: unknown[]) => listAutomationInbox(...args),
  updateAutomationWorkflow: (...args: unknown[]) => updateAutomationWorkflow(...args),
  createAutomationWorkflow: (...args: unknown[]) => createAutomationWorkflow(...args),
}));

vi.mock("../../src/features/automation/workflow/CreateWorkflowWorkspace", () => ({
  CreateWorkflowWorkspace: (props: {
    onCreate: (blocks: { type: "manual_start"; config: Record<string, never> }[]) => void;
  }) => (
    <button type="button" onClick={() => props.onCreate([{ type: "manual_start", config: {} }])}>
      submit-create
    </button>
  ),
}));

vi.mock("../../src/features/address-book/addressBookApi", () => ({
  listAddressBookEntries: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/features/wallet/walletApi", () => ({
  getWalletStatus: vi.fn().mockResolvedValue(null),
}));

function workflow(overrides: Record<string, unknown> = {}) {
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

function renderPage(initialEntries = ["/workflows"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ToastProvider>
        <Routes>
          <Route path="/workflows" element={<AutomationPage />} />
          <Route path="/workflows/new" element={<AutomationPage />} />
          <Route path="/workflows/:workflowId/edit" element={<div>Edit route</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("AutomationPage", () => {
  beforeEach(() => {
    listDataSources.mockReset().mockResolvedValue({ items: [] });
    listAutomationWorkflows.mockReset().mockResolvedValue({ items: [] });
    listAutomationInbox
      .mockReset()
      .mockResolvedValue({ items: [], total: 0, limit: 500, offset: 0 });
    updateAutomationWorkflow.mockReset().mockResolvedValue({ item: workflow({ enabled: false }) });
    createAutomationWorkflow.mockReset().mockResolvedValue({ item: workflow({ id: "created", enabled: false }) });
  });

  it("replaces failed workflow data with a retryable error instead of empty lists", async () => {
    listAutomationWorkflows.mockRejectedValueOnce(new Error("workflows down"));
    renderPage();

    expect(await screen.findByText("Workflows aren't available")).toBeInTheDocument();
    expect(screen.queryByText("Build your first workflow")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(listAutomationWorkflows).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Build your first workflow")).toBeInTheDocument();
  });

  it("asks before editing an enabled workflow and pauses before opening edit", async () => {
    listAutomationWorkflows.mockResolvedValue({ items: [workflow()] });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Edit Front gate flow" }));

    expect(screen.getByRole("dialog", { name: "Editing will pause this workflow." })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(updateAutomationWorkflow).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Edit Front gate flow" }));
    await userEvent.click(screen.getByRole("button", { name: "Pause and edit" }));

    expect(updateAutomationWorkflow).toHaveBeenCalledWith("w1", { enabled: false });
    expect(await screen.findByText("Edit route")).toBeInTheDocument();
  });

  it("creates workflows paused, shows a success toast, and returns to the list", async () => {
    renderPage(["/workflows/new"]);

    await userEvent.click(await screen.findByRole("button", { name: "submit-create" }));

    expect(createAutomationWorkflow).toHaveBeenCalledWith({
      name: expect.any(String),
      enabled: false,
      blocks: [{ type: "manual_start", config: {} }],
    });
    expect(await screen.findByText("Workflow created")).toBeInTheDocument();
    expect(await screen.findByText("Build your first workflow")).toBeInTheDocument();
  });
});
