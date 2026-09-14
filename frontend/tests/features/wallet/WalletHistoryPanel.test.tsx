import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WalletHistoryPanel } from "../../../src/features/wallet/WalletHistoryPanel";
import { ToastProvider } from "../../../src/components/ToastProvider";
import type { WalletSendHistoryItem } from "../../../src/features/wallet/walletTypes";

function item(overrides: Partial<WalletSendHistoryItem> = {}): WalletSendHistoryItem {
  return {
    id: "1",
    createdAt: "2026-08-01T12:00:00.000Z",
    toAddress: "Mx1234567890123456",
    tokenId: "0x00",
    tokenName: "Minima",
    amount: "5",
    txpowId: "0xabc",
    status: "submitted",
    ...overrides,
  };
}

function renderPanel(
  props: Partial<{
    items: WalletSendHistoryItem[];
    loading: boolean;
    error: string | null;
    actionsBlocked: boolean;
    onRefresh: () => Promise<void>;
  }> = {},
) {
  return render(
    <WalletHistoryPanel
      items={props.items ?? [item()]}
      loading={props.loading ?? false}
      error={props.error ?? null}
      actionsBlocked={props.actionsBlocked ?? false}
      onRefresh={props.onRefresh ?? vi.fn().mockResolvedValue(undefined)}
    />,
    { wrapper: ToastProvider },
  );
}

describe("WalletHistoryPanel", () => {
  it("shows a loading state", () => {
    renderPanel({ loading: true });

    expect(screen.getByText("Fetching your send history")).toBeInTheDocument();
  });

  it("shows a loading state while actionsBlocked", () => {
    renderPanel({ actionsBlocked: true });

    expect(screen.getByText("Fetching your send history")).toBeInTheDocument();
  });

  it("shows an empty state when there is no history", () => {
    renderPanel({ items: [] });

    expect(screen.getByText("No send activity yet")).toBeInTheDocument();
  });

  it("shows an error alert alongside existing content", () => {
    renderPanel({ error: "could not load history" });

    expect(screen.getByText("Couldn't load history")).toBeInTheDocument();
    expect(screen.getByText("could not load history")).toBeInTheDocument();
  });

  it("renders history rows with status pill and truncated address", () => {
    renderPanel({
      items: [item({ status: "failed" }), item({ id: "2", status: "submitted", toAddress: "Mx2222222222222222" })],
    });

    const table = screen.getByRole("table", { name: "Send history" });
    expect(within(table).getByText("Failed")).toBeInTheDocument();
    expect(within(table).getByText("Submitted")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    renderPanel({
      items: [item({ id: "1", status: "failed" }), item({ id: "2", status: "submitted" })],
    });
    const table = screen.getByRole("table", { name: "Send history" });
    expect(within(table).getByText("Failed")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Filter"), "submitted");

    expect(within(screen.getByRole("table")).queryByText("Failed")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Submitted")).toBeInTheDocument();
  });

  it("filters by search across address, token, and txpow ID, clearing from the empty state", async () => {
    renderPanel({ items: [item()] });

    await userEvent.type(screen.getByLabelText("Search"), "nomatch");
    expect(await screen.findByText("No matching sends")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    expect(screen.getByLabelText("Search")).toHaveValue("");
  });

  it("opens the history detail modal for a row", async () => {
    renderPanel({ items: [item()] });

    await userEvent.click(screen.getByRole("button", { name: /View send of/ }));

    expect(screen.getByRole("dialog", { name: "History details" })).toBeInTheDocument();
  });
});
