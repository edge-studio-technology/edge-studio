import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HistoryDetailModal } from "../../../src/features/wallet/HistoryDetailModal";
import { ToastProvider } from "../../../src/components/ToastProvider";
import type { WalletHistoryItem } from "../../../src/features/wallet/walletTypes";

function item(overrides: Partial<WalletHistoryItem> = {}): WalletHistoryItem {
  return {
    id: "0xabcdef:0x00",
    direction: "in",
    status: "confirmed",
    amount: "5",
    tokenId: "0x00",
    tokenName: "Minima",
    counterparty: "Mx1234567890",
    counterpartyLabel: null,
    time: "2026-08-01T12:00:00.000Z",
    txpowId: "0xabcdef",
    transactionId: "0x7777",
    block: 120,
    confirmations: 3,
    confirmedAt: "2026-08-01T12:01:00.000Z",
    origin: null,
    error: null,
    isPreviousWallet: false,
    ...overrides,
  };
}

function renderModal(props: Partial<Parameters<typeof HistoryDetailModal>[0]> = {}) {
  return render(
    <HistoryDetailModal item={item()} onClose={vi.fn()} {...props} />,
    { wrapper: ToastProvider },
  );
}

describe("HistoryDetailModal", () => {
  it("shows a received payment with sender, times, block, and IDs", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "History details" })).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Received" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Received" })).toHaveTextContent("Confirmed");
    expect(screen.getByRole("region", { name: "From" })).toHaveTextContent("Mx1234567890");
    expect(screen.getByRole("region", { name: "Date" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Confirmed" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Block" })).toHaveTextContent("120 · 3 confirmations");
    expect(screen.getByRole("region", { name: "TxPoW ID" })).toHaveTextContent("0xabcdef");
    expect(screen.getByRole("region", { name: "Transaction ID" })).toHaveTextContent("0x7777");
    expect(screen.getByText("0x00")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Origin" })).not.toBeInTheDocument();
  });

  it("shows a pending app send with recipient label, origin, and no chain fields", () => {
    renderModal({
      item: item({
        direction: "out",
        status: "pending",
        counterpartyLabel: "Warehouse",
        txpowId: null,
        block: null,
        confirmations: null,
        confirmedAt: null,
        origin: "automation",
        isPreviousWallet: true,
      }),
    });

    expect(screen.getByText("−5")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Sent" })).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Previous wallet")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "To" })).toHaveTextContent("Warehouse");
    expect(screen.getByRole("region", { name: "Date" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Origin" })).toHaveTextContent("Automation");
    expect(screen.queryByRole("region", { name: "Confirmed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Block" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "TxPoW ID" })).not.toBeInTheDocument();
  });

  it("shows the failure reason only for failed sends", () => {
    const { unmount } = renderModal({
      item: item({ direction: "out", status: "failed", error: "Insufficient funds.. you only have 1 require:5" }),
    });
    expect(screen.getByRole("region", { name: "Reason" })).toHaveTextContent("Insufficient funds.. you only have 1 require:5");
    unmount();

    const { unmount: unmountLegacy } = renderModal({ item: item({ direction: "out", status: "failed", error: null }) });
    expect(screen.getByRole("region", { name: "Reason" })).toHaveTextContent("No reason was recorded for this send.");
    unmountLegacy();

    renderModal();
    expect(screen.queryByRole("region", { name: "Reason" })).not.toBeInTheDocument();
  });

  it("omits the counterparty for a self-transfer and marks an unknown one", () => {
    const { unmount } = renderModal({ item: item({ direction: "self", amount: "0" }) });
    expect(screen.queryByRole("region", { name: "From" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "To" })).not.toBeInTheDocument();
    unmount();

    renderModal({ item: item({ counterparty: null }) });
    expect(screen.getByRole("region", { name: "From" })).toHaveTextContent("Unknown");
  });

  it("calls onClose from the modal close button", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });
});
