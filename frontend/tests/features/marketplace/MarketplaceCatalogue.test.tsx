import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceCatalogue } from "../../../src/features/marketplace/MarketplaceCatalogue";
import type { CatalogueListing } from "../../../src/features/marketplace/marketplaceApi";

const api = vi.hoisted(() => ({ searchCatalogue: vi.fn(), getCatalogueListing: vi.fn() }));
vi.mock("../../../src/features/marketplace/marketplaceApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/features/marketplace/marketplaceApi")>()),
  ...api,
}));

const MARKET = "https://market.example";
const listing: CatalogueListing = {
  id: "L/1",
  type: "stream",
  state: "published",
  title: "Live climate",
  category: "Environment and weather",
  price: { cents: 500, currency: "USD" },
  verified: true,
  description: "Readings every minute",
  format: "NDJSON",
  licence: "CC-BY-4.0",
  availability: "24/7",
  deliveryMethod: "Seller-hosted stream",
};

beforeEach(() => {
  api.searchCatalogue.mockReset();
  api.getCatalogueListing.mockReset();
});

describe("MarketplaceCatalogue", () => {
  it("TC-FR07-05 In-app purchase uses the same checkout and entitlements: Buy opens the marketplace listing page in a new tab", async () => {
    api.searchCatalogue.mockResolvedValue([listing]);
    render(<MarketplaceCatalogue marketplaceUrl={MARKET} />);
    const buy = await screen.findByRole("link", { name: "Buy on marketplace" });
    expect(buy).toHaveAttribute("href", "https://market.example/listing/L%2F1");
    expect(buy).toHaveAttribute("target", "_blank");
    expect(buy).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Integritas verified")).toBeInTheDocument();
  });

  it("TC-FR07-06 Offline Edge Studio internet: clear offline message and earlier results are not shown as live", async () => {
    api.searchCatalogue.mockResolvedValueOnce([listing]).mockRejectedValueOnce(new Error("Marketplace service unavailable")).mockResolvedValue([]);
    render(<MarketplaceCatalogue marketplaceUrl={MARKET} />);
    expect(await screen.findByText("Live climate")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Marketplace unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Check this device's internet connection/)).toBeInTheDocument();
    expect(screen.queryByText("Live climate")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Buy on marketplace" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No listings found")).toBeInTheDocument();
  });

  it("sends the chosen filters", async () => {
    api.searchCatalogue.mockResolvedValue([]);
    render(<MarketplaceCatalogue marketplaceUrl={MARKET} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search"), "soil");
    await user.selectOptions(screen.getByLabelText("Category"), "Energy consumption");
    await user.selectOptions(screen.getByLabelText("Type"), "file");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(api.searchCatalogue).toHaveBeenLastCalledWith({ q: "soil", category: "Energy consumption", type: "file" });
  });

  it("TC-FR07-06 details show the seller's live state only from a fresh answer", async () => {
    api.searchCatalogue.mockResolvedValue([listing]);
    api.getCatalogueListing.mockResolvedValueOnce({ ...listing, live: { delivery: "online", lastContactAt: "2026-11-18T10:00:00.000Z", data: "fresh", lastDataAt: "2026-11-18T10:00:00.000Z" } });
    render(<MarketplaceCatalogue marketplaceUrl={MARKET} />);
    await userEvent.click(await screen.findByRole("button", { name: "Details" }));
    expect(await screen.findByText(/Seller online \(last contact .*\) · data up to date/)).toBeInTheDocument();
    expect(screen.getByText("Readings every minute")).toBeInTheDocument();
    expect(api.getCatalogueListing).toHaveBeenCalledWith("L/1");

    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    api.getCatalogueListing.mockRejectedValueOnce(new Error("Marketplace service unavailable"));
    await userEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(await screen.findByText("Marketplace unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/Seller online/)).not.toBeInTheDocument();
  });

  it("describes an offline seller that was never seen", async () => {
    api.searchCatalogue.mockResolvedValue([{ ...listing, verified: false }]);
    api.getCatalogueListing.mockResolvedValue({ ...listing, live: { delivery: "offline", lastContactAt: null, data: null, lastDataAt: null } });
    render(<MarketplaceCatalogue marketplaceUrl={MARKET} />);
    await userEvent.click(await screen.findByRole("button", { name: "Details" }));
    expect(await screen.findByText("Seller offline (never seen online)")).toBeInTheDocument();
    expect(screen.queryByText("Integritas verified")).not.toBeInTheDocument();
  });
});
