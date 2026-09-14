import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiveAddressModal } from "../../../src/features/wallet/ReceiveAddressModal";
import { ToastProvider } from "../../../src/components/ToastProvider";

const getReceiveAddress = vi.fn();

vi.mock("../../../src/features/wallet/walletApi", () => ({
  getReceiveAddress: (...args: unknown[]) => getReceiveAddress(...args),
}));

function renderModal(actionsBlocked = false) {
  return render(<ReceiveAddressModal actionsBlocked={actionsBlocked} onClose={vi.fn()} />, {
    wrapper: ToastProvider,
  });
}

describe("ReceiveAddressModal", () => {
  beforeEach(() => {
    getReceiveAddress.mockReset();
  });

  it("shows a loading state, then the fetched receive address", async () => {
    getReceiveAddress.mockResolvedValue({
      miniAddress: "Mx1234567890",
      address: "0xabc",
      qrDataUrl: "data:image/png;base64,abc",
    });
    renderModal();

    expect(screen.getByRole("dialog", { name: "Receive" })).toBeInTheDocument();

    expect(await screen.findByText("Mx1234567890")).toBeInTheDocument();
    expect(getReceiveAddress).toHaveBeenCalled();
  });

  it("shows an error alert when the fetch fails", async () => {
    getReceiveAddress.mockRejectedValue(new Error("node unreachable"));
    renderModal();

    expect(await screen.findByText("Couldn't load address")).toBeInTheDocument();
    expect(screen.getByText("node unreachable")).toBeInTheDocument();
  });

  it("skips the fetch and shows an actions-blocked error when actionsBlocked is true", async () => {
    renderModal(true);

    expect(
      await screen.findByText("Wallet actions are unavailable while Minima isn't running."),
    ).toBeInTheDocument();
    expect(getReceiveAddress).not.toHaveBeenCalled();
  });
});
