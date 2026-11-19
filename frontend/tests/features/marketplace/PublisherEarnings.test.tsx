// The seller's sales and earnings screen in the Marketplace module (TC-FR12-19, Edge Studio Data Marketplace V1).
// The marketplace API is mocked: the figures shown must be exactly the ones the marketplace's ledger returns.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { PublisherEarnings } from "../../../src/features/marketplace/PublisherEarnings";

const api = vi.hoisted(() => ({ getEarnings: vi.fn() }));
vi.mock("../../../src/features/marketplace/marketplaceApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/features/marketplace/marketplaceApi")>()),
  ...api,
}));

const TX = "0x00000000000000000000000000000000000000000000000000000000000000A1";
const EARNINGS = {
  transactions: [
    {
      kind: "sale",
      entitlementId: "E1",
      listingId: "L1",
      listingTitle: "Weather station data",
      at: "2026-11-02T10:00:00.000Z",
      grossCents: 10_000,
      commissionCents: 1_500,
      netCents: 8_500,
      rateBps: 1_500,
      payoutState: "confirmed",
      payoutTxpowid: TX,
    },
    {
      kind: "renewal",
      entitlementId: "E2",
      listingId: "L2",
      listingTitle: "Live energy feed",
      at: "2026-11-03T10:00:00.000Z",
      grossCents: 4_000,
      commissionCents: 600,
      netCents: 3_400,
      rateBps: 1_500,
      payoutState: "captured",
      payoutTxpowid: null,
    },
    {
      kind: "refund",
      entitlementId: "E1",
      listingId: "L1",
      listingTitle: "Weather station data",
      at: "2026-11-04T10:00:00.000Z",
      grossCents: -2_500,
      commissionCents: -375,
      netCents: -2_125,
      rateBps: 1_500,
      payoutState: "confirmed",
      payoutTxpowid: TX,
    },
  ],
  // Deliberately not the sums of the rows above: the screen must show the marketplace's totals, never its own sums.
  totals: { grossCents: 50_000, refundedCents: 1_234, commissionCents: 777, netCents: 4_321 },
  payoutCredit: "0.0085",
};

const renderEarnings = () =>
  render(
    <ToastProvider>
      <PublisherEarnings />
    </ToastProvider>,
  );

beforeEach(() => api.getEarnings.mockReset());

describe("PublisherEarnings", () => {
  it("TC-FR12-19 Seller sales and earnings view: gross, commission, net, refunds and payout state per transaction match the ledger", async () => {
    api.getEarnings.mockResolvedValue(EARNINGS);
    renderEarnings();
    const table = await screen.findByRole("table", { name: "Sales and earnings" });
    const rows = within(table).getAllByRole("row").slice(1); // after the header row
    expect(
      rows.map((r) =>
        within(r)
          .getAllByRole("cell")
          .slice(1, 7)
          .map((c) => c.textContent),
      ),
    ).toEqual([
      [
        "Weather station data",
        "Sale",
        "$100.00",
        "$15.00",
        "$85.00",
        expect.stringContaining("Paid (confirmed)"),
      ],
      ["Live energy feed", "Renewal", "$40.00", "$6.00", "$34.00", "Not yet earned"],
      [
        "Weather station data",
        "Refund",
        "-$25.00",
        "-$3.75",
        "-$21.25",
        expect.stringContaining("Paid (confirmed)"),
      ],
    ]);
    // The payout transaction id is shown in full (never shortened), so it can be checked on chain.
    expect(within(rows[0]).getByText(TX)).toBeInTheDocument();
    expect(screen.getByText("Gross sales", { selector: "dt" }).nextSibling?.textContent).toBe(
      "$500.00",
    );
    expect(screen.getByText("Refunded", { selector: "dt" }).nextSibling?.textContent).toBe(
      "$12.34",
    );
    expect(screen.getByText("Commission", { selector: "dt" }).nextSibling?.textContent).toBe(
      "$7.77",
    );
    expect(screen.getByText("Net earnings", { selector: "dt" }).nextSibling?.textContent).toBe(
      "$43.21",
    );
    expect(screen.getByText(/0\.0085/)).toBeInTheDocument(); // the remainder added to the next payout
  });

  it("says when there are no sales yet", async () => {
    api.getEarnings.mockResolvedValue({
      transactions: [],
      totals: { grossCents: 0, refundedCents: 0, commissionCents: 0, netCents: 0 },
      payoutCredit: "0",
    });
    renderEarnings();
    expect(await screen.findByText("No sales yet")).toBeInTheDocument();
  });

  it("shows a failure with Retry", async () => {
    api.getEarnings
      .mockRejectedValueOnce(
        Object.assign(new Error("Marketplace service unavailable"), { status: 503 }),
      )
      .mockResolvedValue(EARNINGS);
    renderEarnings();
    expect(await screen.findByText("Marketplace service unavailable")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("table", { name: "Sales and earnings" })).toBeInTheDocument();
  });
});
