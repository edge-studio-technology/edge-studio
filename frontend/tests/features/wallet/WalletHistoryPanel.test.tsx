import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectRowActionsPinned } from "../../helpers/expectRowActionsPinned";
import { WalletHistoryPanel } from "../../../src/features/wallet/WalletHistoryPanel";
import { ToastProvider } from "../../../src/components/ToastProvider";
import {
  DEFAULT_WALLET_HISTORY_FILTERS,
  type WalletHistoryFilters,
} from "../../../src/features/wallet/walletHistory";
import type { WalletHistoryItem, WalletHistoryPage } from "../../../src/features/wallet/walletTypes";

vi.mock("../../../src/features/auth/hooks", () => ({
  useAuth: () => ({ user: { credentialType: "password" }, credentialType: "password" }),
}));

vi.mock("../../../src/features/preferences/tableColumnPreferencesApi", () => ({
  getTableColumnPreferences: async () => ({}),
  saveTableColumnPreferences: async (preferences: unknown) => preferences,
}));

const clearPreviousWalletHistory = vi.fn();
vi.mock("../../../src/features/wallet/walletApi", () => ({
  clearPreviousWalletHistory: (...args: unknown[]) => clearPreviousWalletHistory(...args),
  clearWalletHistoryForDebug: vi.fn(),
}));

function item(overrides: Partial<WalletHistoryItem> = {}): WalletHistoryItem {
  return {
    id: "1",
    direction: "out",
    status: "confirmed",
    amount: "5",
    tokenId: "0x00",
    tokenName: "Minima",
    counterparty: "Mx1234567890123456",
    counterpartyLabel: null,
    time: "2026-08-01T12:00:00.000Z",
    txpowId: "0xabc",
    transactionId: "0x777",
    block: 10,
    confirmations: 2,
    confirmedAt: "2026-08-01T12:01:00.000Z",
    origin: "manual",
    isPreviousWallet: false,
    ...overrides,
  };
}

function page(items: WalletHistoryItem[], extra: Partial<WalletHistoryPage> = {}): WalletHistoryPage {
  return { items, page: 1, pageSize: 10, total: items.length, totalPages: items.length ? 1 : 0, previousWalletItems: 0, ...extra };
}

function renderPanel(
  props: Partial<{
    history: WalletHistoryPage;
    filters: WalletHistoryFilters;
    loading: boolean;
    error: string | null;
    actionsBlocked: boolean;
    onFiltersChange: (patch: Partial<WalletHistoryFilters>) => void;
    onRefresh: () => Promise<void>;
  }> = {},
) {
  return render(
    <WalletHistoryPanel
      history={props.history ?? page([item()])}
      filters={props.filters ?? DEFAULT_WALLET_HISTORY_FILTERS}
      loading={props.loading ?? false}
      error={props.error ?? null}
      actionsBlocked={props.actionsBlocked ?? false}
      onFiltersChange={props.onFiltersChange ?? vi.fn()}
      onRefresh={props.onRefresh ?? vi.fn().mockResolvedValue(undefined)}
    />,
    { wrapper: ToastProvider },
  );
}

describe("WalletHistoryPanel", () => {
  it("shows a loading state", () => {
    renderPanel({ loading: true });

    expect(screen.getByText("Fetching your wallet history")).toBeInTheDocument();
  });

  it("keeps loaded history visible while actions are blocked", () => {
    renderPanel({ actionsBlocked: true });

    const table = screen.getByRole("table", { name: "Wallet history" });
    expect(within(table).getByText("Confirmed")).toBeInTheDocument();
  });

  it("shows an empty state when there is no history", () => {
    renderPanel({ history: page([]) });

    expect(screen.getByText("No wallet activity yet")).toBeInTheDocument();
  });

  it("replaces the table and its chrome with a retryable error state", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    renderPanel({ history: page([]), error: "could not load history", onRefresh });

    expect(screen.getByText("Wallet history isn't available")).toBeInTheDocument();
    expect(screen.getByText("could not load history")).toBeInTheDocument();
    expect(screen.queryByLabelText("Search")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("renders signed amounts, counterparties, statuses, and the previous-wallet pill", () => {
    renderPanel({
      history: page([
        item({ id: "a", direction: "in", status: "pending", counterpartyLabel: "Warehouse" }),
        item({ id: "b", direction: "out", status: "failed", isPreviousWallet: true }),
        item({ id: "c", direction: "self", amount: "0", counterparty: null }),
      ]),
    });

    const rows = within(screen.getByRole("table", { name: "Wallet history" })).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Received");
    expect(rows[0]).toHaveTextContent("+5");
    expect(rows[0]).toHaveTextContent("Warehouse");
    expect(rows[0]).toHaveTextContent("Pending");
    expect(rows[1]).toHaveTextContent("−5");
    expect(rows[1]).toHaveTextContent("Failed");
    expect(rows[1]).toHaveTextContent("Previous wallet");
    expect(rows[2]).toHaveTextContent("This wallet");
    expectRowActionsPinned(screen.getByRole("table"));
  });

  it("reports status, type, and date filter changes", async () => {
    const onFiltersChange = vi.fn();
    renderPanel({ onFiltersChange });

    await userEvent.selectOptions(screen.getByLabelText("Filter"), "pending");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "in");
    await userEvent.selectOptions(screen.getByLabelText("Date"), "7d");

    expect(onFiltersChange).toHaveBeenCalledWith({ status: "pending" });
    expect(onFiltersChange).toHaveBeenCalledWith({ direction: "in" });
    expect(onFiltersChange).toHaveBeenCalledWith({ datePreset: "7d" });
  });

  it("reports search changes after typing stops", async () => {
    const onFiltersChange = vi.fn();
    renderPanel({ onFiltersChange });

    await userEvent.type(screen.getByLabelText("Search"), "Mx9");

    await waitFor(() => expect(onFiltersChange).toHaveBeenCalledWith({ q: "Mx9" }));
  });

  it("shows custom date fields and flags an end date before the start", async () => {
    const onFiltersChange = vi.fn();
    renderPanel({
      onFiltersChange,
      filters: { ...DEFAULT_WALLET_HISTORY_FILTERS, datePreset: "custom", customFrom: "2026-08-05", customTo: "2026-08-01" },
    });

    expect(screen.getByText("Pick a date on or after From.")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("To"));
    expect(onFiltersChange).toHaveBeenCalledWith({ customTo: "" });
    await userEvent.clear(screen.getByLabelText("From"));
    expect(onFiltersChange).toHaveBeenCalledWith({ customFrom: "" });
  });

  it("clears every filter from the empty state", async () => {
    const onFiltersChange = vi.fn();
    renderPanel({
      onFiltersChange,
      history: page([]),
      filters: { ...DEFAULT_WALLET_HISTORY_FILTERS, direction: "in", datePreset: "today" },
    });

    expect(screen.getByText("No matching history")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onFiltersChange).toHaveBeenCalledWith({
      status: "",
      direction: "",
      q: "",
      datePreset: "",
      customFrom: "",
      customTo: "",
    });
  });

  it("reports page changes", async () => {
    const onFiltersChange = vi.fn();
    renderPanel({ onFiltersChange, history: page([item()], { total: 25, totalPages: 3 }) });

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(onFiltersChange).toHaveBeenCalledWith({ page: 2 });
  });

  it("opens the history detail modal for a row", async () => {
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /View sent/ }));

    expect(screen.getByRole("dialog", { name: "History details" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "History details" })).not.toBeInTheDocument();
  });

  it("offers clearing previous-wallet history only when there is some", () => {
    const { unmount } = renderPanel();
    expect(screen.queryByText("History from a previous wallet")).not.toBeInTheDocument();
    unmount();

    renderPanel({ history: page([item()], { previousWalletItems: 2 }), actionsBlocked: true });
    expect(screen.getByText("2 items were recorded under a wallet this node no longer uses.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("closes the clear dialog on cancel", async () => {
    renderPanel({ history: page([item()], { previousWalletItems: 1 }) });

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText(/1 item recorded under a wallet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog", { name: "Clear previous wallet history" })).not.toBeInTheDocument();
  });

  it("clears previous-wallet history after re-authentication and reloads", async () => {
    clearPreviousWalletHistory.mockResolvedValue({ deleted: 2 });
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    renderPanel({ history: page([item()], { previousWalletItems: 2 }), onRefresh });

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    const dialog = screen.getByRole("dialog", { name: "Clear previous wallet history" });
    await userEvent.type(within(dialog).getByLabelText("Current password"), "secret");
    await userEvent.click(within(dialog).getByRole("button", { name: "Clear history" }));

    expect(clearPreviousWalletHistory).toHaveBeenCalledWith("secret");
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: "Clear previous wallet history" })).not.toBeInTheDocument();
    expect(await screen.findByText("Deleted 2 items.")).toBeInTheDocument();
  });

  // Last: column preferences are cached for the rest of this file.
  it("shows optional columns and filters the page by column", async () => {
    renderPanel({
      history: page([
        item({ id: "a", counterpartyLabel: "Warehouse", tokenName: "Minima", origin: "automation" }),
        item({ id: "b", direction: "in", txpowId: null, origin: null }),
      ]),
    });

    await userEvent.click(screen.getByRole("button", { name: "Choose columns for Wallet history" }));
    for (const column of ["Token", "TxPoW ID", "Origin"]) {
      await userEvent.click(screen.getByRole("switch", { name: column }));
    }
    await userEvent.click(screen.getByRole("button", { name: "Filter From / To" }));
    await userEvent.type(screen.getByPlaceholderText("Filter From / To"), "warehouse");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    const table = screen.getByRole("table", { name: "Wallet history" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Automation");
    expect(rows[0]).toHaveTextContent("0xabc");

    await userEvent.click(screen.getByRole("button", { name: "Remove From / To filter" }));
    const unfiltered = within(screen.getByRole("table", { name: "Wallet history" })).getAllByRole("row").slice(1);
    expect(unfiltered[1]).toHaveTextContent("None");
  });
});
