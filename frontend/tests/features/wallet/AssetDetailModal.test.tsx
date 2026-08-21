import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssetDetailModal } from "../../../src/features/wallet/AssetDetailModal";
import type { TokenBalance } from "../../../src/features/wallet/walletTypes";

function token(overrides: Partial<TokenBalance> = {}): TokenBalance {
  return {
    tokenId: "0x00",
    name: "Minima",
    confirmed: "10",
    unconfirmed: "0",
    sendable: "10",
    isNative: true,
    ...overrides,
  };
}

describe("AssetDetailModal", () => {
  it("shows the sendable, confirmed, and unconfirmed amounts", () => {
    render(<AssetDetailModal token={token()} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Minima" })).toBeInTheDocument();
    expect(screen.getByText("Sendable")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Unconfirmed")).toBeInTheDocument();
    // "10" appears for sendable/confirmed/unconfirmed=0.
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
  });

  it("flags a non-zero unconfirmed balance with a pending hint", () => {
    render(
      <AssetDetailModal token={token({ unconfirmed: "0.5" })} onClose={vi.fn()} />,
    );

    expect(screen.getByText("Pending network confirmation")).toBeInTheDocument();
  });

  it("does not show a pending hint when unconfirmed is zero", () => {
    render(<AssetDetailModal token={token({ unconfirmed: "0.000" })} onClose={vi.fn()} />);

    expect(screen.queryByText("Pending network confirmation")).not.toBeInTheDocument();
  });

  it("calls onClose from the modal close button", async () => {
    const onClose = vi.fn();
    render(<AssetDetailModal token={token()} onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });
});
