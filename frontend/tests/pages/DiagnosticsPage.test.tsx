import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/components/ToastProvider";
import { DiagnosticsPage } from "../../src/pages/DiagnosticsPage";

const getHistory = vi.fn();
const listDataReads = vi.fn();
const listAutomationRuns = vi.fn();

vi.mock("../../src/features/integritas/integritasApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/integritas/integritasApi")>()),
  getHistory: (...args: unknown[]) => getHistory(...args),
}));

vi.mock("../../src/features/data-reads/dataReadsApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/data-reads/dataReadsApi")>()),
  listDataReads: (...args: unknown[]) => listDataReads(...args),
}));

vi.mock("../../src/features/automation/automationApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/automation/automationApi")>()),
  listAutomationRuns: (...args: unknown[]) => listAutomationRuns(...args),
}));

vi.mock("../../src/features/integritas/useIntegritasHistoryAutoRefresh", () => ({
  useIntegritasHistoryAutoRefresh: vi.fn(),
}));

const emptyPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  pendingTotal: 0,
};

const emptyListPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

function pageOf(total: number, page: number, pageSize = 20) {
  return { items: [], total, page, pageSize, totalPages: Math.ceil(total / pageSize), pendingTotal: 0 };
}

function renderPage(entry = "/diagnostics?tab=proofs&page=1&pageSize=20") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ToastProvider>
        <DiagnosticsPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("DiagnosticsPage", () => {
  beforeEach(() => {
    getHistory.mockReset().mockResolvedValue(emptyPage);
    listDataReads.mockReset().mockResolvedValue(emptyListPage);
    listAutomationRuns.mockReset().mockResolvedValue(emptyListPage);
  });

  it("replaces failed history with a retryable error instead of an empty table", async () => {
    getHistory.mockRejectedValueOnce(new Error("history down")).mockResolvedValueOnce(emptyPage);
    renderPage();

    expect(await screen.findByText("Proof records aren't available")).toBeInTheDocument();
    expect(screen.getByText("history down")).toBeInTheDocument();
    expect(screen.queryByText("No proof history yet")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("UID, hash, or file name")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(getHistory).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No proof history yet")).toBeInTheDocument();
  });

  it("loads the matching source when a tab is selected", async () => {
    renderPage();
    await waitFor(() => expect(getHistory).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("tab", { name: "Devices" }));
    await waitFor(() => expect(listDataReads).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("tab", { name: "Workflow Logs" }));
    await waitFor(() => expect(listAutomationRuns).toHaveBeenCalledTimes(1));

    expect(getHistory).toHaveBeenCalledTimes(1);
  });

  it("resets to page 1 and drops a status the new tab does not allow when switching tabs", async () => {
    renderPage("/diagnostics?tab=proofs&page=3&pageSize=20&status=ready");
    await waitFor(() => expect(getHistory).toHaveBeenCalledTimes(1));
    expect(getHistory.mock.calls[0][0]).toMatchObject({ page: 3, status: "ready" });

    await userEvent.click(screen.getByRole("tab", { name: "Devices" }));

    await waitFor(() => expect(listDataReads).toHaveBeenCalledTimes(1));
    expect(listDataReads.mock.calls[0][0]).toMatchObject({ page: 1, status: "" });
  });

  it("requests the next page when the pager advances", async () => {
    getHistory.mockResolvedValue(pageOf(60, 1));
    renderPage();
    await waitFor(() => expect(getHistory).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => expect(getHistory).toHaveBeenCalledTimes(2));
    expect(getHistory.mock.calls[1][0]).toMatchObject({ page: 2, pageSize: 20 });
  });

  it("returns to page 1 when the page size changes", async () => {
    getHistory.mockResolvedValue(pageOf(60, 2));
    renderPage("/diagnostics?tab=proofs&page=2&pageSize=20");
    await waitFor(() => expect(getHistory).toHaveBeenCalledTimes(1));

    await userEvent.selectOptions(screen.getByLabelText("Rows"), "50");

    await waitFor(() => expect(getHistory).toHaveBeenCalledTimes(2));
    expect(getHistory.mock.calls[1][0]).toMatchObject({ page: 1, pageSize: 50 });
  });
});
