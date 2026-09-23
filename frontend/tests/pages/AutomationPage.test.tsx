import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/components/ToastProvider";
import { AutomationPage } from "../../src/pages/AutomationPage";

const listDataSources = vi.fn();
const listAutomationWorkflows = vi.fn();
const listAutomationInbox = vi.fn();

vi.mock("../../src/features/data-sources/dataSourcesApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/data-sources/dataSourcesApi")>()),
  listDataSources: (...args: unknown[]) => listDataSources(...args),
}));

vi.mock("../../src/features/automation/automationApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/automation/automationApi")>()),
  listAutomationWorkflows: (...args: unknown[]) => listAutomationWorkflows(...args),
  listAutomationInbox: (...args: unknown[]) => listAutomationInbox(...args),
}));

vi.mock("../../src/features/address-book/addressBookApi", () => ({
  listAddressBookEntries: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/features/wallet/walletApi", () => ({
  getWalletStatus: vi.fn().mockResolvedValue(null),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/workflows"]}>
      <ToastProvider>
        <Routes>
          <Route path="/workflows" element={<AutomationPage />} />
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
});
