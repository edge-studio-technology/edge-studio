import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark } from "../../src/components/BrandMark";

describe("BrandMark", () => {
  it("defaults to the purple variant at size 24", () => {
    const { container } = render(<BrandMark />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "/es_logo/svg/es-logo-purple.svg");
    expect(img).toHaveAttribute("width", "24");
    expect(img).toHaveAttribute("height", "24");
  });

  it("renders the requested variant", () => {
    const { container } = render(<BrandMark variant="white" />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/es_logo/svg/es-logo-white.svg",
    );
  });

  it("applies a custom size", () => {
    const { container } = render(<BrandMark size={32} />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("width", "32");
    expect(img).toHaveAttribute("height", "32");
  });

  it("is decorative (empty alt, aria-hidden)", () => {
    const { container } = render(<BrandMark />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");
  });
});
