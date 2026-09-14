import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MinimaIcon } from "../../src/components/MinimaIcon";

describe("MinimaIcon", () => {
  it("defaults to size 24 with a proportional height", () => {
    const { container } = render(<MinimaIcon />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", String(Math.round(24 * (33 / 37))));
  });

  it("scales height proportionally with a custom size", () => {
    const { container } = render(<MinimaIcon size={37} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "37");
    expect(svg).toHaveAttribute("height", "33");
  });

  it("applies a custom className and stays decorative", () => {
    const { container } = render(<MinimaIcon className="text-blue-500" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveClass("text-blue-500");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
