import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SendPaymentModal } from "../../../src/features/wallet/SendPaymentModal";
import { ToastProvider } from "../../../src/components/ToastProvider";
import type { WalletStatus } from "../../../src/features/wallet/walletTypes";

const listAddressBookEntries = vi.fn();
const sendPayment = vi.fn();

vi.mock("../../../src/features/address-book/addressBookApi", () => ({
  listAddressBookEntries: (...args: unknown[]) => listAddressBookEntries(...args),
}));

vi.mock("../../../src/features/wallet/walletApi", () => ({
  sendPayment: (...args: unknown[]) => sendPayment(...args),
}));

function walletStatus(): WalletStatus {
  return {
    checkedAt: "2026-08-01T00:00:00.000Z",
    tokens: [
      {
        tokenId: "0x00",
        name: "Minima",
        confirmed: "10",
        unconfirmed: "0",
        sendable: "10",
        isNative: true,
      },
      {
        tokenId: "0x01",
        name: "Widget",
        confirmed: "3",
        unconfirmed: "0",
        sendable: "3",
        isNative: false,
      },
    ],
  };
}

function renderModal(
  props: Partial<{
    walletStatus: WalletStatus | null;
    actionsBlocked: boolean;
    minimaConfirmedUnavailable: boolean;
    onClose: () => void;
  }> = {},
) {
  return render(
    <SendPaymentModal
      walletStatus={"walletStatus" in props ? (props.walletStatus ?? null) : walletStatus()}
      actionsBlocked={props.actionsBlocked ?? false}
      minimaConfirmedUnavailable={props.minimaConfirmedUnavailable ?? false}
      onClose={props.onClose ?? vi.fn()}
    />,
    { wrapper: ToastProvider },
  );
}

describe("SendPaymentModal", () => {
  beforeEach(() => {
    listAddressBookEntries.mockReset();
    sendPayment.mockReset();
    listAddressBookEntries.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders token options from the wallet status", async () => {
    renderModal();

    expect(screen.getByRole("option", { name: "Minima (native)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Widget" })).toBeInTheDocument();
  });

  it("falls back to a native-only token option when there is no wallet status", async () => {
    renderModal({ walletStatus: null });

    expect(screen.getByRole("option", { name: "Minima (native)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Widget" })).not.toBeInTheDocument();
  });

  it("validates that an address is required", async () => {
    renderModal();

    await userEvent.type(screen.getByLabelText("Amount"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Send payment" }));

    expect(await screen.findByText("Address is required.")).toBeInTheDocument();
    expect(sendPayment).not.toHaveBeenCalled();
  });

  it("validates that amount must be a positive number", async () => {
    renderModal();

    await userEvent.type(screen.getByLabelText("Recipient address"), "Mx1");
    await userEvent.type(screen.getByLabelText("Amount"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Send payment" }));

    expect(await screen.findByText("Amount must be a positive number.")).toBeInTheDocument();
    expect(sendPayment).not.toHaveBeenCalled();
  });

  it("shows a balance-exceeded error and disables submit when the amount is too high", async () => {
    renderModal();

    await userEvent.type(screen.getByLabelText("Recipient address"), "Mx1");
    await userEvent.type(screen.getByLabelText("Amount"), "999");

    expect(await screen.findByText(/Amount exceeds available balance/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send payment" })).toBeDisabled();
  });

  it("submits a valid payment, shows a success toast, and closes", async () => {
    sendPayment.mockResolvedValue({ ok: true, txpowId: "0xabcdef1234567890", status: "sent" });
    const onClose = vi.fn();
    renderModal({ onClose });

    await userEvent.type(screen.getByLabelText("Recipient address"), "Mx1");
    await userEvent.type(screen.getByLabelText("Amount"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Send payment" }));

    await waitFor(() => {
      expect(sendPayment).toHaveBeenCalledWith({
        address: "Mx1",
        amount: "1",
        tokenId: "0x00",
        tokenName: "Minima",
      });
    });
    expect(await screen.findByText("Payment sent")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it("submits the selected non-native token at its exact sendable balance", async () => {
    sendPayment.mockResolvedValue({ ok: true, txpowId: "0xwidget", status: "sent" });
    renderModal();

    await userEvent.type(screen.getByLabelText("Recipient address"), "MxWidgetRecipient");
    await userEvent.selectOptions(screen.getByLabelText("Token"), "0x01");
    await userEvent.type(screen.getByLabelText("Amount"), "3");

    expect(screen.getByRole("button", { name: "Send payment" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Send payment" }));

    await waitFor(() => {
      expect(sendPayment).toHaveBeenCalledWith({
        address: "MxWidgetRecipient",
        amount: "3",
        tokenId: "0x01",
        tokenName: "Widget",
      });
    });
  });

  it("submits the address selected from the address book", async () => {
    listAddressBookEntries.mockResolvedValue([
      { id: "1", label: "Alice", address: "MxAlice", notes: null, created_at: "2026-08-01T00:00:00.000Z" },
    ]);
    sendPayment.mockResolvedValue({ ok: true, txpowId: "0xcontact", status: "sent" });
    renderModal();
    await waitFor(() => expect(listAddressBookEntries).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("tab", { name: "Address book" }));
    await userEvent.selectOptions(screen.getByLabelText("Recipient address"), "MxAlice");
    await userEvent.type(screen.getByLabelText("Amount"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Send payment" }));

    await waitFor(() => {
      expect(sendPayment).toHaveBeenCalledWith({
        address: "MxAlice",
        amount: "1",
        tokenId: "0x00",
        tokenName: "Minima",
      });
    });
  });

  it("uses the selected token's sendable balance", async () => {
    renderModal();

    await userEvent.type(screen.getByLabelText("Recipient address"), "MxRecipient");
    await userEvent.type(screen.getByLabelText("Amount"), "4");
    expect(screen.getByRole("button", { name: "Send payment" })).toBeEnabled();

    await userEvent.selectOptions(screen.getByLabelText("Token"), "0x01");
    expect(screen.getByRole("button", { name: "Send payment" })).toBeDisabled();
    expect(screen.getByText("Amount exceeds available balance (3 Widget).")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Token"), "0x00");
    expect(screen.getByRole("button", { name: "Send payment" })).toBeEnabled();
  });

  it("disables sending while wallet actions are blocked", () => {
    renderModal({ actionsBlocked: true });

    expect(screen.getByRole("button", { name: "Send payment" })).toBeDisabled();
  });

  it("shows a form error and keeps the modal open when the result reports failure", async () => {
    sendPayment.mockResolvedValue({ ok: true, txpowId: null, status: "failed", message: "Node rejected transaction" });
    const onClose = vi.fn();
    renderModal({ onClose });

    await userEvent.type(screen.getByLabelText("Recipient address"), "Mx1");
    await userEvent.type(screen.getByLabelText("Amount"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Send payment" }));

    expect(await screen.findByText("Node rejected transaction")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a form error when the send request throws", async () => {
    sendPayment.mockRejectedValue(new Error("network down"));
    renderModal();

    await userEvent.type(screen.getByLabelText("Recipient address"), "Mx1");
    await userEvent.type(screen.getByLabelText("Amount"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Send payment" }));

    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("switches to the address book and shows saved contacts, or a no-contacts message", async () => {
    listAddressBookEntries.mockResolvedValue([
      { id: "1", label: "Alice", address: "Mx1", notes: null, created_at: "2026-08-01T00:00:00.000Z" },
    ]);
    renderModal();
    await waitFor(() => expect(listAddressBookEntries).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("tab", { name: "Address book" }));

    expect(screen.getByRole("option", { name: "Alice" })).toBeInTheDocument();
  });

  it("shows a no-contacts message when the address book is empty", async () => {
    renderModal();
    await waitFor(() => expect(listAddressBookEntries).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("tab", { name: "Address book" }));

    expect(screen.getByText("No contacts saved in address book.")).toBeInTheDocument();
  });

  it("shows a warning when Minima isn't running", async () => {
    renderModal({ minimaConfirmedUnavailable: true });

    expect(
      screen.getByText("Minima isn't running — sending is unavailable right now."),
    ).toBeInTheDocument();
  });

  it("calls onClose from Cancel", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });
});
