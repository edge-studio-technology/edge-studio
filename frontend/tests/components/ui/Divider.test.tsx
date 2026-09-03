import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Divider } from "../../../src/components/ui/Divider";

describe("Divider", () => {
  it("renders a horizontal separator by default", () => {
    render(<Divider />);
    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("aria-orientation", "horizontal");
    expect(separator).toHaveClass("h-px", "w-full");
  });

  it("renders a vertical separator", () => {
    render(<Divider orientation="vertical" />);
    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator).toHaveClass("w-px", "self-stretch");
  });

  it("merges a custom className", () => {
    render(<Divider className="my-4" />);
    expect(screen.getByRole("separator")).toHaveClass("my-4");
  });
});
