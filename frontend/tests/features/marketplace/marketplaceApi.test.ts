import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canPublish,
  LICENCES,
  getCatalogueListing,
  listingPayload,
  nextTransitions,
  priceText,
  PRODUCT_TYPES,
  searchCatalogue,
  transitionListing,
  type ListingDraft,
} from "../../../src/features/marketplace/marketplaceApi";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));
});
afterEach(() => vi.unstubAllGlobals());

const draft: ListingDraft = {
  sourceId: "SRC-1",
  type: "file",
  title: "  Soil moisture  ",
  category: "Agriculture and growing conditions",
  description: "Hourly readings",
  format: "CSV",
  licence: "CC-BY-4.0",
  licenceText: "",
  price: " 25.00 ",
  availability: " 2025 ",
};

describe("TC-FR01-04 role visibility", () => {
  it("TC-FR01-04 owner and publisher may publish; viewer is read-only", () => {
    expect(canPublish("owner")).toBe(true);
    expect(canPublish("publisher")).toBe(true);
    expect(canPublish("viewer")).toBe(false);
  });
});

describe("TC-FR03-06 product types", () => {
  it("TC-FR03-06 Only two product types offered: Dataset/File and Live Stream", () => {
    expect(PRODUCT_TYPES).toEqual([
      { value: "file", label: "Dataset/File" },
      { value: "stream", label: "Live Stream" },
    ]);
  });
});

describe("TC-FR03-03 listingPayload", () => {
  it("TC-FR03-03 billing and delivery method follow the final type only", () => {
    expect(listingPayload(draft)).toEqual({
      sourceId: "SRC-1",
      type: "file",
      billing: "one_off",
      deliveryMethod: "Seller-hosted download",
      title: "Soil moisture",
      category: "Agriculture and growing conditions",
      description: "Hourly readings",
      format: "CSV",
      licence: "CC-BY-4.0",
      price: { amount: "25.00", currency: "USD" },
      availability: "2025",
    });
    expect(listingPayload({ ...draft, type: "stream" })).toMatchObject({ billing: "monthly", deliveryMethod: "Seller-hosted stream" });
  });
});

// The marketplace's fixed licence list (docs/IMPLEMENTATION-RULES-FINAL.md §2 in the marketplace repository).
describe("licence", () => {
  it("offers exactly the marketplace's four licences; a custom licence sends its own text", () => {
    expect(LICENCES.map((l) => l.value)).toEqual(["CC-BY-4.0", "CC-BY-NC-4.0", "Commercial-Single-Organisation", "Custom"]);
    expect(listingPayload({ ...draft, licence: "Custom", licenceText: "Research use only." })).toMatchObject({ licence: "Custom", licenceText: "Research use only." });
    expect(listingPayload({ ...draft, licenceText: "ignored" })).not.toHaveProperty("licenceText");
  });
});

describe("listing helpers", () => {
  it("offers only the seller lifecycle moves", () => {
    expect(nextTransitions("draft")).toEqual(["published"]);
    expect(nextTransitions("published")).toEqual(["paused", "unpublished"]);
    expect(nextTransitions("paused")).toEqual(["published", "unpublished"]);
    expect(nextTransitions("unpublished")).toEqual([]);
    expect(nextTransitions("suspended")).toEqual([]);
  });

  it("formats prices per type", () => {
    expect(priceText({ type: "file", price: null })).toBe("No price");
    expect(priceText({ type: "file", price: { cents: 0, currency: "USD" } })).toBe("Free");
    expect(priceText({ type: "file", price: { cents: 2500, currency: "USD" } })).toBe("$25.00");
    expect(priceText({ type: "stream", price: { cents: 500, currency: "USD" } })).toBe("$5.00 per month");
  });
});

describe("requests", () => {
  it("sends only non-empty catalogue filters and encodes ids", async () => {
    await searchCatalogue({ q: "soil", category: "", type: "file" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/marketplace/catalogue?q=soil&type=file");
    await searchCatalogue({ q: "", category: "", type: "" });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/marketplace/catalogue");
    await getCatalogueListing("a/b");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/marketplace/catalogue/a%2Fb");
    await transitionListing("a/b", "paused");
    expect(fetchMock.mock.calls[3][0]).toBe("/api/marketplace/publisher/listings/a%2Fb/transitions");
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ to: "paused" });
  });
});
