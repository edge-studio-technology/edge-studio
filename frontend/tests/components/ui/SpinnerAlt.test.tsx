import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpinnerAlt } from "../../../src/components/ui/SpinnerAlt";

describe("SpinnerAlt", () => {
  it("renders an svg with 8 pin paths", () => {
    const { container } = render(<SpinnerAlt />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelectorAll("path")).toHaveLength(8);
  });

  it("applies the size class", () => {
    const { container } = render(<SpinnerAlt size="lg" />);
    expect(container.querySelector("svg")).toHaveClass("size-16");
  });

  it("applies the tone class", () => {
    const { container } = render(<SpinnerAlt tone="secondary" />);
    expect(container.querySelector("svg")).toHaveClass("text-icon-secondary");
  });

  it("is hidden from assistive tech", () => {
    const { container } = render(<SpinnerAlt />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden");
  });
});
