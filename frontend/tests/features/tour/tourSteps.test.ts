import { describe, expect, it } from "vitest";
import { nav } from "../../../src/app/nav";
import { tourSteps } from "../../../src/features/tour/tourSteps";

describe("tourSteps", () => {
  it("has unique ids and non-empty copy for every step", () => {
    expect(new Set(tourSteps.map((step) => step.id)).size).toBe(tourSteps.length);
    for (const step of tourSteps) {
      expect(step.title).not.toBe("");
      expect(step.body).not.toBe("");
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
    for (const step of tourSteps.filter((entry) => entry.image)) {
      expect(step.imageAlt).toBeTruthy();
    }
  });
});
