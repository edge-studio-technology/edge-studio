import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/components/ToastProvider";
import { DiagnosticsPage } from "../../src/pages/DiagnosticsPage";

const getHistory = vi.fn();

vi.mock("../../src/features/integritas/integritasApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/integritas/integritasApi")>()),
  getHistory: (...args: unknown[]) => getHistory(...args),
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/diagnostics?tab=proofs&page=1&pageSize=20"]}>
      <ToastProvider>
        <DiagnosticsPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("DiagnosticsPage", () => {
  beforeEach(() => getHistory.mockReset());

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
});
