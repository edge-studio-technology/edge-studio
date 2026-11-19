import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListingWizard } from "../../../src/features/marketplace/ListingWizard";
import type { PublisherSource } from "../../../src/features/marketplace/marketplaceApi";

const createListing = vi.fn();
vi.mock("../../../src/features/marketplace/marketplaceApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/features/marketplace/marketplaceApi")>()),
  createListing: (...args: unknown[]) => createListing(...args),
}));

const sources: PublisherSource[] = [
  { id: "SRC-1", name: "Greenhouse", attestations: 3, selectable: true },
  { id: "SRC-2", name: "Unverified pump", attestations: 0, selectable: false, reason: "not verified" },
];

function renderWizard() {
  const onCreated = vi.fn();
  render(<ListingWizard sources={sources} onClose={vi.fn()} onCreated={onCreated} />);
  return { onCreated };
}

async function fillRequired() {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText(/Source/), "SRC-1");
  await user.type(screen.getByLabelText(/Title/), "Greenhouse climate");
  await user.selectOptions(screen.getByLabelText(/Category/), "Agriculture and growing conditions");
  await user.type(screen.getByLabelText(/Description/), "Hourly climate");
  await user.selectOptions(screen.getByLabelText(/Format/), "CSV");
  await user.selectOptions(screen.getByLabelText(/^Licence/), "CC-BY-4.0");
  await user.type(screen.getByLabelText(/Price/), "25.00");
  await user.type(screen.getByLabelText(/Availability/), "2025 season");
  return user;
}

beforeEach(() => {
  createListing.mockReset();
});

describe("ListingWizard", () => {
  it("TC-FR03-06 Only two product types offered: exactly Dataset/File and Live Stream", () => {
    renderWizard();
    const group = screen.getByRole("group", { name: "Product type" });
    expect(within(group).getAllByRole("radio").map((radio) => radio.closest("div")?.textContent)).toEqual([
      expect.stringContaining("Dataset/File"),
      expect.stringContaining("Live Stream"),
    ]);
    expect(screen.queryByText(/usage|pooled|auction/i)).not.toBeInTheDocument();
  });

  it("TC-FR03-03 Switching type clears incompatible fields: File -> Live Stream -> File saves only file fields", async () => {
    createListing.mockResolvedValue({ id: "L-1" });
    const { onCreated } = renderWizard();
    const user = await fillRequired();

    await user.click(screen.getByRole("radio", { name: /Live Stream/ }));
    expect(screen.getByLabelText(/Price per month/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Dataset\/File/ }));
    expect(screen.queryByLabelText(/Price per month/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(createListing).toHaveBeenCalledOnce();
    const { listingPayload } = await import("../../../src/features/marketplace/marketplaceApi");
    const saved = listingPayload(createListing.mock.calls[0][0]);
    expect(saved).toMatchObject({ type: "file", billing: "one_off", deliveryMethod: "Seller-hosted download" });
    expect(JSON.stringify(saved)).not.toMatch(/monthly|stream/i);
    expect(onCreated).toHaveBeenCalledOnce();
  });

  it("a custom licence asks for its text and sends it; the other licences have none", async () => {
    createListing.mockResolvedValue({ id: "L-2" });
    renderWizard();
    const user = await fillRequired();
    expect(screen.queryByLabelText(/Licence text/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^Licence/), "Custom");
    await user.type(screen.getByLabelText(/Licence text/), "Research use only.");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    const { listingPayload } = await import("../../../src/features/marketplace/marketplaceApi");
    expect(listingPayload(createListing.mock.calls[0][0])).toMatchObject({ licence: "Custom", licenceText: "Research use only." });
  });

  it("TC-FR01-04 offers only the seller's own sources, disables ineligible ones and never a payout wallet", () => {
    renderWizard();
    const options = within(screen.getByLabelText(/Source/)).getAllByRole("option").filter((option) => option.getAttribute("value"));
    expect(options.map((option) => [option.textContent, (option as HTMLOptionElement).disabled])).toEqual([
      ["Greenhouse", false],
      ["Unverified pump (not verified)", true],
    ]);
    expect(screen.queryByText(/wallet/i)).not.toBeInTheDocument();
  });

  it("shows a marketplace field error next to its field", async () => {
    createListing.mockRejectedValue(Object.assign(new Error("The marketplace rejected the price field."), { details: { context: { field: "price" } } }));
    renderWizard();
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("The marketplace rejected the price field.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Price/)).toHaveAttribute("aria-invalid", "true");
  });

  it("shows an error without a field under the form", async () => {
    createListing.mockRejectedValue(new Error("Marketplace service unavailable"));
    renderWizard();
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Marketplace service unavailable")).toBeInTheDocument();
  });
});
