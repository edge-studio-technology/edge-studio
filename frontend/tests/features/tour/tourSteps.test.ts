import { describe, expect, it } from "vitest";
import { nav } from "../../../src/app/nav";
import { tourSteps } from "../../../src/features/tour/tourSteps";

describe("tourSteps", () => {
  it("has unique ids, a lead, and points for every step", () => {
    expect(new Set(tourSteps.map((step) => step.id)).size).toBe(tourSteps.length);
    for (const step of tourSteps) {
      expect(step.title).not.toBe("");
      expect(step.lead).not.toBe("");
      expect(step.points.length).toBeGreaterThan(0);
    }
  });

  it("takes titles and icons for nav steps from the sidebar", () => {
    for (const step of tourSteps) {
      const item = nav.find((entry) => entry.id === step.id);
      if (!item) continue;
      expect(step.title).toBe(item.label);
      expect(step.icon).toBe(item.icon);
    }
  });

  it("gives every screenshot alt text", () => {
    for (const image of tourSteps.flatMap((step) => step.images ?? [])) {
      expect(image.alt).toBeTruthy();
    }
  });
});
