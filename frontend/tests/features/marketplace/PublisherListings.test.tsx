import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { PublisherListings } from "../../../src/features/marketplace/PublisherListings";
import type { Listing, MarketplaceRole } from "../../../src/features/marketplace/marketplaceApi";

const api = vi.hoisted(() => ({
  getPublisherListings: vi.fn(),
  getPublisherSources: vi.fn(),
  transitionListing: vi.fn(),
  createListing: vi.fn(),
  getRightsDeclaration: vi.fn(),
}));
vi.mock("../../../src/features/marketplace/marketplaceApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/features/marketplace/marketplaceApi")>()),
  ...api,
}));

const draft: Listing = { id: "L-1", type: "file", state: "draft", title: "Soil moisture", category: "Agriculture and growing conditions", price: { cents: 2500, currency: "USD" }, verified: false };
const live: Listing = { ...draft, id: "L-2", type: "stream", state: "published", title: "Live climate", price: { cents: 500, currency: "USD" } };

function renderListings(role: MarketplaceRole = "owner") {
  return render(
    <ToastProvider>
      <PublisherListings role={role} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getPublisherSources.mockResolvedValue([{ id: "SRC-1", name: "Greenhouse", attestations: 2, selectable: true }]);
  api.getRightsDeclaration.mockResolvedValue({ version: 2, text: "I have the right to sell this data." });
});

// Publishing asks for the marketplace's rights declaration first (X-05 in the marketplace repository).
async function publishWithDeclaration(row: HTMLElement) {
  await userEvent.click(within(row).getByRole("button", { name: "Publish" }));
  const dialog = await screen.findByRole("dialog", { name: "Rights declaration" });
  await userEvent.click(within(dialog).getByRole("checkbox", { name: /I accept this declaration/ }));
  await userEvent.click(within(dialog).getByRole("button", { name: "Publish" }));
}

describe("PublisherListings", () => {
  it("TC-FR01-02 Empty state for a publisher with no listings explains how to create the first listing and opens the wizard", async () => {
    api.getPublisherListings.mockResolvedValue([]);
    renderListings();
    expect(await screen.findByText("No listings yet")).toBeInTheDocument();
    expect(screen.getByText(/Create your first listing: choose one of your Integritas-verified devices/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create your first listing" }));
    expect(screen.getByRole("dialog", { name: "New listing" })).toBeInTheDocument();
  });

  it("TC-FR01-04 Role without publish permission: a viewer sees listings but no create or publish actions", async () => {
    api.getPublisherListings.mockResolvedValue([draft, live]);
    renderListings("viewer");
    expect(await screen.findByText("Soil moisture")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New listing|Publish|Pause|Unpublish/ })).not.toBeInTheDocument();
  });

  it("TC-FR01-04 a viewer's empty state offers no wizard", async () => {
    api.getPublisherListings.mockResolvedValue([]);
    renderListings("viewer");
    expect(await screen.findByText(/can view listings but not create or publish them/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("TC-FR01-04 an owner gets the lifecycle actions for each listing and can publish", async () => {
    api.getPublisherListings.mockResolvedValue([draft, live]);
    api.transitionListing.mockResolvedValue({ ...draft, state: "published" });
    renderListings("owner");

    const draftRow = (await screen.findByText("Soil moisture")).closest("li")!;
    const liveRow = screen.getByText("Live climate").closest("li")!;
    expect(within(draftRow).getAllByRole("button").map((b) => b.textContent)).toEqual(["Publish"]);
    expect(within(liveRow).getAllByRole("button").map((b) => b.textContent)).toEqual(["Pause", "Unpublish"]);
    expect(within(liveRow).getByText(/Live Stream · .* · \$5\.00 per month/)).toBeInTheDocument();

    await publishWithDeclaration(draftRow);
    expect(api.transitionListing).toHaveBeenCalledWith("L-1", "published", 2);
    expect(api.getPublisherListings).toHaveBeenCalledTimes(2);
  });

  it("X-05 publishing shows the rights declaration; nothing is sent until it is accepted; pausing needs none", async () => {
    api.getPublisherListings.mockResolvedValue([draft, live]);
    api.transitionListing.mockResolvedValue({ ...draft, state: "published" });
    renderListings("owner");
    const draftRow = (await screen.findByText("Soil moisture")).closest("li")!;
    await userEvent.click(within(draftRow).getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("dialog", { name: "Rights declaration" });
    expect(within(dialog).getByText("I have the right to sell this data.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(api.transitionListing).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await userEvent.click(within(screen.getByText("Live climate").closest("li")!).getByRole("button", { name: "Pause" }));
    expect(api.transitionListing).toHaveBeenCalledWith("L-2", "paused", undefined);
  });

  it("shows a refused transition as a toast", async () => {
    api.getPublisherListings.mockResolvedValue([draft]);
    api.transitionListing.mockRejectedValue(new Error("This source is not Integritas-verified."));
    renderListings();
    await publishWithDeclaration((await screen.findByText("Soil moisture")).closest("li")!);
    expect(await screen.findByText("This source is not Integritas-verified.")).toBeInTheDocument();
  });

  it("TC-FR01-06 Module loads when the marketplace backend is unreachable: message with a working Retry", async () => {
    api.getPublisherListings.mockRejectedValueOnce(Object.assign(new Error("Marketplace service unavailable"), { status: 503 })).mockResolvedValue([]);
    renderListings();
    expect(await screen.findByText("Marketplace service unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Everything else in Edge Studio keeps working/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No listings yet")).toBeInTheDocument();
  });

  it("names a marketplace refusal, such as a revoked key, without calling it an outage", async () => {
    api.getPublisherListings.mockRejectedValue(Object.assign(new Error("The marketplace refused the request (unauthenticated)."), { status: 401 }));
    renderListings();
    expect(await screen.findByText("Could not load your listings")).toBeInTheDocument();
    expect(screen.getByText("The marketplace refused the request (unauthenticated).")).toBeInTheDocument();
  });

  it("refreshes after a draft is saved from the wizard", async () => {
    api.getPublisherListings.mockResolvedValueOnce([draft]).mockResolvedValue([draft, live]);
    api.createListing.mockResolvedValue(live);
    renderListings();
    await userEvent.click(await screen.findByRole("button", { name: "New listing" }));
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/Source/), "SRC-1");
    await user.type(screen.getByLabelText(/Title/), "Live climate");
    await user.selectOptions(screen.getByLabelText(/Category/), "Energy consumption");
    await user.type(screen.getByLabelText(/Description/), "D");
    await user.selectOptions(screen.getByLabelText(/Format/), "JSON");
    await user.selectOptions(screen.getByLabelText(/^Licence/), "Commercial-Single-Organisation");
    await user.type(screen.getByLabelText(/Price/), "5");
    await user.type(screen.getByLabelText(/Availability/), "Always");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("Draft listing saved")).toBeInTheDocument();
    expect(await screen.findByText("Live climate")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "New listing" })).not.toBeInTheDocument();
  });
});
