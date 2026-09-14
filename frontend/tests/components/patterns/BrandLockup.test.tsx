import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLockup } from "../../../src/components/patterns/BrandLockup";

describe("BrandLockup", () => {
  it("renders the light lockup image by default", () => {
    render(<BrandLockup />);
    const img = screen.getByRole("img", { name: "Edge Studio" });
    expect(img).toHaveAttribute("src", "/es_logo/svg/es-lockup.svg");
  });

  it("renders the dark lockup image for on-dark tone", () => {
    render(<BrandLockup tone="on-dark" />);
    const img = screen.getByRole("img", { name: "Edge Studio" });
    expect(img).toHaveAttribute("src", "/es_logo/svg/es-lockup-white.svg");
  });

  it("applies the given size as height", () => {
    render(<BrandLockup size={64} />);
    expect(screen.getByRole("img", { name: "Edge Studio" })).toHaveStyle({ height: "64px" });
  });
});
