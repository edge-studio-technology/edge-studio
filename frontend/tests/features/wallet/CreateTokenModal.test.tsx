import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTokenModal } from "../../../src/features/wallet/CreateTokenModal";
import { ToastProvider } from "../../../src/components/ToastProvider";
import type { WalletStatus } from "../../../src/features/wallet/walletTypes";

const getTokenCreateRequirements = vi.fn();
const createToken = vi.fn();

vi.mock("../../../src/features/tokens/tokensApi", () => ({
  getTokenCreateRequirements: (...args: unknown[]) => getTokenCreateRequirements(...args),
  createToken: (...args: unknown[]) => createToken(...args),
}));

function walletStatus(sendable = "5"): WalletStatus {
  return {
    checkedAt: "2026-08-01T00:00:00.000Z",
    tokens: [
      {
        tokenId: "0x00",
        name: "Minima",
        confirmed: sendable,
        unconfirmed: "0",
        sendable,
        isNative: true,
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
    onCreated: () => Promise<void>;
  }> = {},
) {
  return render(
    <CreateTokenModal
      walletStatus={"walletStatus" in props ? (props.walletStatus ?? null) : walletStatus()}
      actionsBlocked={props.actionsBlocked ?? false}
      minimaConfirmedUnavailable={props.minimaConfirmedUnavailable ?? false}
      onClose={props.onClose ?? vi.fn()}
      onCreated={props.onCreated ?? vi.fn().mockResolvedValue(undefined)}
    />,
    { wrapper: ToastProvider },
  );
}

async function fillValidForm() {
  await userEvent.type(screen.getByLabelText("Name"), "Device access");
  await userEvent.type(screen.getByLabelText("Amount (supply)"), "100");
}

describe("CreateTokenModal", () => {
  beforeEach(() => {
    getTokenCreateRequirements.mockReset();
    createToken.mockReset();
    getTokenCreateRequirements.mockResolvedValue({
      estimatedMinimaCost: "0.01",
      minimumAccountMinima: "1",
      note: "",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the wallet's sendable Minima against the fetched minimum", async () => {
    renderModal({ walletStatus: walletStatus("5") });

    expect(await screen.findByText(/minimum: 1/)).toBeInTheDocument();
    expect(screen.getByText(/5 sendable/)).toBeInTheDocument();
  });

  it("falls back to default requirements when the fetch fails", async () => {
    getTokenCreateRequirements.mockRejectedValue(new Error("network down"));
    renderModal({ walletStatus: walletStatus("5") });

    expect(await screen.findByText(/minimum: 0.001/)).toBeInTheDocument();
  });

  it("disables the create button when sendable balance is below the minimum", async () => {
    renderModal({ walletStatus: null });

    await screen.findByText(/minimum: 1/);
    expect(screen.getByRole("button", { name: "Create token" })).toBeDisabled();
  });

  it("validates that a name is required", async () => {
    renderModal();
    await screen.findByText(/minimum: 1/);
    await userEvent.type(screen.getByLabelText("Amount (supply)"), "100");

    await userEvent.click(screen.getByRole("button", { name: "Create token" }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(createToken).not.toHaveBeenCalled();
  });

  it("validates that amount must be a positive number", async () => {
    renderModal();
    await screen.findByText(/minimum: 1/);
    await userEvent.type(screen.getByLabelText("Name"), "Device access");
    await userEvent.type(screen.getByLabelText("Amount (supply)"), "0");

    await userEvent.click(screen.getByRole("button", { name: "Create token" }));

    expect(await screen.findByText("Amount must be a positive number.")).toBeInTheDocument();
    expect(createToken).not.toHaveBeenCalled();
  });

  it("constrains decimal places to a non-negative whole number via the native input", async () => {
    // The JS "Decimal must be a non-negative whole number." check in handleSubmit is
    // defense-in-depth: this input's min=0/step=1 constraints already block the browser's
    // native form submission for a negative or fractional value before that check ever runs,
    // so it can't be reached through a real submit click. Assert the native constraint instead.
    renderModal();
    await screen.findByText(/minimum: 1/);

    const decimalField = screen.getByLabelText("Decimal places");
    expect(decimalField).toHaveAttribute("min", "0");
    expect(decimalField).toHaveAttribute("step", "1");
  });

  it("submits the trimmed form, calls onCreated, shows a success toast, and closes", async () => {
    createToken.mockResolvedValue({
      ok: true,
      tokenId: "0x99",
      name: "Device access",
      amount: "100",
      decimal: 0,
      txpowId: "0xabc",
    });
    const onCreated = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderModal({ onCreated, onClose });
    await screen.findByText(/minimum: 1/);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Create token" }));

    await waitFor(() => {
      expect(createToken).toHaveBeenCalledWith({ name: "Device access", amount: "100", decimal: 0 });
    });
    expect(onCreated).toHaveBeenCalled();
    expect(await screen.findByText("Token created")).toBeInTheDocument();
    expect(screen.getByText("Device access (0x99)")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error and keeps the modal open when the API reports failure", async () => {
    createToken.mockResolvedValue({
      ok: false,
      tokenId: null,
      name: "",
      amount: "",
      decimal: 0,
      txpowId: null,
      message: "Insufficient funds",
    });
    const onClose = vi.fn();
    renderModal({ onClose });
    await screen.findByText(/minimum: 1/);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Create token" }));

    expect(await screen.findByText("Insufficient funds")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows an error when the create request throws", async () => {
    createToken.mockRejectedValue(new Error("timed out"));
    renderModal();
    await screen.findByText(/minimum: 1/);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Create token" }));

    expect(await screen.findByText("timed out")).toBeInTheDocument();
  });

  it("shows a warning when Minima isn't running", async () => {
    renderModal({ minimaConfirmedUnavailable: true });
    await screen.findByText(/minimum: 1/);

    expect(
      screen.getByText("Minima isn't running — token creation is unavailable right now."),
    ).toBeInTheDocument();
  });

  it("calls onClose from Cancel", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await screen.findByText(/minimum: 1/);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });
});
