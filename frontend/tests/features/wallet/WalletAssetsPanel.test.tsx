import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { WalletAssetsPanel } from "../../../src/features/wallet/WalletAssetsPanel";
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

describe("WalletAssetsPanel", () => {
  it("shows a loading state", () => {
    render(<WalletAssetsPanel tokens={[]} loading actionsBlocked={false} />);

    expect(screen.getByText("Fetching your assets")).toBeInTheDocument();
  });

  it("shows a loading state while actionsBlocked, even if not loading", () => {
    render(<WalletAssetsPanel tokens={[token()]} loading={false} actionsBlocked />);

    expect(screen.getByText("Fetching your assets")).toBeInTheDocument();
  });

  it("shows an empty state when there are no tokens", () => {
    render(<WalletAssetsPanel tokens={[]} loading={false} actionsBlocked={false} />);

    expect(screen.getByText("No assets yet")).toBeInTheDocument();
  });

  it("renders tokens in a table with formatted amounts", () => {
    render(
      <WalletAssetsPanel
        tokens={[token(), token({ tokenId: "0x01", name: "Widget", sendable: "3.500000000000" })]}
        loading={false}
        actionsBlocked={false}
      />,
    );

    const table = screen.getByRole("table");
    expect(within(table).getByText("Minima")).toBeInTheDocument();
    expect(within(table).getByText("Widget")).toBeInTheDocument();
    expect(within(table).getByText("3.5")).toBeInTheDocument();
  });

  it("filters by asset kind", async () => {
    render(
      <WalletAssetsPanel
        tokens={[token(), token({ tokenId: "0x01", name: "Widget", isNative: false })]}
        loading={false}
        actionsBlocked={false}
      />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("Widget")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Filter"), "minima");

    expect(within(screen.getByRole("table")).queryByText("Widget")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Minima")).toBeInTheDocument();
  });

  it("filters by name or coin ID search, and clears filters from the empty state", async () => {
    render(
      <WalletAssetsPanel
        tokens={[token(), token({ tokenId: "0x01", name: "Widget", isNative: false })]}
        loading={false}
        actionsBlocked={false}
      />,
    );

    await userEvent.type(screen.getByLabelText("Search"), "nomatch");
    expect(await screen.findByText("No matching assets")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    expect(screen.getByLabelText("Search")).toHaveValue("");
  });

  it("opens the asset detail modal for a token", async () => {
    render(<WalletAssetsPanel tokens={[token()]} loading={false} actionsBlocked={false} />);

    await userEvent.click(screen.getByRole("button", { name: "View Minima" }));

    expect(screen.getByRole("dialog", { name: "Minima" })).toBeInTheDocument();
  });
});
