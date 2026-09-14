import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HistoryDetailModal } from "../../../src/features/wallet/HistoryDetailModal";
import { ToastProvider } from "../../../src/components/ToastProvider";
import type { WalletSendHistoryItem } from "../../../src/features/wallet/walletTypes";

function item(overrides: Partial<WalletSendHistoryItem> = {}): WalletSendHistoryItem {
  return {
    id: "1",
    createdAt: "2026-08-01T12:00:00.000Z",
    toAddress: "Mx1234567890",
    tokenId: "0x00",
    tokenName: "Minima",
    amount: "5",
    txpowId: "0xabcdef",
    status: "submitted",
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
  it("shows the amount, token name, recipient, token id, and created date", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "History details" })).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Minima")).toBeInTheDocument();
    expect(screen.getByText("Mx1234567890")).toBeInTheDocument();
    expect(screen.getByText("0x00")).toBeInTheDocument();
  });

  it("shows a TxPow ID section when txpowId is present", () => {
    renderModal({ item: item({ txpowId: "0xabcdef" }) });

    expect(screen.getByText("TxPow ID")).toBeInTheDocument();
    expect(screen.getByText("0xabcdef")).toBeInTheDocument();
  });

  it("omits the TxPow ID section when txpowId is null", () => {
    renderModal({ item: item({ txpowId: null }) });

    expect(screen.queryByText("TxPow ID")).not.toBeInTheDocument();
  });

  it("calls onClose from the modal close button", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });
});
