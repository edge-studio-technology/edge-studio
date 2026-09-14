import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TokenGlyph } from "../../../src/features/wallet/TokenGlyph";

describe("TokenGlyph", () => {
  it("renders the Minima glyph for native tokens", () => {
    const { container } = render(<TokenGlyph isNative />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("viewBox", "0 0 37 33");
  });

  it("renders the hex token glyph for non-native tokens", () => {
    const { container } = render(<TokenGlyph isNative={false} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });
});
