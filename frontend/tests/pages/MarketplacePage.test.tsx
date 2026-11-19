import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/components/ToastProvider";
import { MarketplacePage } from "../../src/pages/MarketplacePage";

const api = vi.hoisted(() => ({
  getMarketplaceStatus: vi.fn(),
  getPublisherListings: vi.fn(),
  getPublisherSources: vi.fn(),
  searchCatalogue: vi.fn(),
  getEarnings: vi.fn(),
}));
vi.mock("../../src/features/marketplace/marketplaceApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/marketplace/marketplaceApi")>()),
  ...api,
}));

function renderPage() {
  return render(
    <ToastProvider>
      <MarketplacePage />
    </ToastProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getPublisherSources.mockResolvedValue([]);
});

describe("MarketplacePage", () => {
  it("says the marketplace is configured and where, and shows the seller's listings", async () => {
    api.getMarketplaceStatus.mockResolvedValue({ configured: true, url: "https://market.example", role: "owner" });
    api.getPublisherListings.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Marketplace configured: https://market.example.")).toBeInTheDocument();
    expect(await screen.findByText("No listings yet")).toBeInTheDocument();
  });

  it("says the marketplace is not configured and how to configure it", async () => {
    api.getMarketplaceStatus.mockResolvedValue({ configured: false, url: null, role: "owner" });
    renderPage();
    expect(await screen.findByText("Marketplace not configured")).toBeInTheDocument();
    expect(screen.getByText(/MARKETPLACE_INSTALLATION_KEY/)).toBeInTheDocument();
    expect(api.getPublisherListings).not.toHaveBeenCalled();
  });

  it("TC-FR01-06 Module loads when the marketplace backend is unreachable: Marketplace service unavailable with Retry", async () => {
    api.getMarketplaceStatus.mockResolvedValue({ configured: true, url: "https://market.example", role: "owner" });
    api.getPublisherListings.mockRejectedValueOnce(Object.assign(new Error("Marketplace service unavailable"), { status: 503 })).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Marketplace service unavailable")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Marketplace" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No listings yet")).toBeInTheDocument();
  });

  it("switches to the catalogue", async () => {
    api.getMarketplaceStatus.mockResolvedValue({ configured: true, url: "https://market.example", role: "owner" });
    api.getPublisherListings.mockResolvedValue([]);
    api.searchCatalogue.mockResolvedValue([]);
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Catalogue" }));
    expect(await screen.findByText("No listings found")).toBeInTheDocument();
  });

  it("TC-FR12-19 the publisher opens their earnings from the Marketplace page", async () => {
    api.getMarketplaceStatus.mockResolvedValue({ configured: true, url: "https://market.example", role: "owner" });
    api.getPublisherListings.mockResolvedValue([]);
    api.getEarnings.mockResolvedValue({ transactions: [], totals: { grossCents: 0, refundedCents: 0, commissionCents: 0, netCents: 0 }, payoutCredit: "0" });
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Earnings" }));
    expect(await screen.findByText("No sales yet")).toBeInTheDocument();
  });

  it("offers a retry when the status itself cannot be loaded", async () => {
    api.getMarketplaceStatus.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue({ configured: false, url: null, role: "owner" });
    renderPage();
    expect(await screen.findByText("Marketplace status unavailable")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Marketplace not configured")).toBeInTheDocument();
  });
});
