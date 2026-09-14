import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WalletHero } from "../../../src/features/wallet/WalletHero";

describe("WalletHero", () => {
  it("shows a loading indicator instead of the balance while loading", () => {
    render(
      <WalletHero
        loading
        totalMinima="10"
        disabled={false}
        onSend={vi.fn()}
        onReceive={vi.fn()}
        onInfo={vi.fn()}
      />,
    );

    expect(screen.queryByText("10")).not.toBeInTheDocument();
    expect(screen.getByText("Wallet balance")).toBeInTheDocument();
  });

  it("shows the formatted balance when not loading", () => {
    render(
      <WalletHero
        loading={false}
        totalMinima="10.500000000000"
        disabled={false}
        onSend={vi.fn()}
        onReceive={vi.fn()}
        onInfo={vi.fn()}
      />,
    );

    expect(screen.getByText("10.5")).toBeInTheDocument();
  });

  it("disables the action buttons when disabled", () => {
    render(
      <WalletHero
        loading={false}
        totalMinima="10"
        disabled
        onSend={vi.fn()}
        onReceive={vi.fn()}
        onInfo={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Receive" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Wallet balance details" })).toBeDisabled();
  });

  it("calls onSend, onReceive, and onInfo when clicked", async () => {
    const onSend = vi.fn();
    const onReceive = vi.fn();
    const onInfo = vi.fn();
    render(
      <WalletHero
        loading={false}
        totalMinima="10"
        disabled={false}
        onSend={onSend}
        onReceive={onReceive}
        onInfo={onInfo}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await userEvent.click(screen.getByRole("button", { name: "Receive" }));
    await userEvent.click(screen.getByRole("button", { name: "Wallet balance details" }));

    expect(onSend).toHaveBeenCalled();
    expect(onReceive).toHaveBeenCalled();
    expect(onInfo).toHaveBeenCalled();
  });
});
