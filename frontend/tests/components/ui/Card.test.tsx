import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "../../../src/components/ui/Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Content</Card>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("applies compact padding for size=Compact", () => {
    render(<Card size="Compact">Content</Card>);
    expect(screen.getByText("Content")).toHaveClass("p-pad-tight");
  });

  it("applies default padding when size is unset", () => {
    render(<Card>Content</Card>);
    expect(screen.getByText("Content")).toHaveClass("p-pad-relaxed");
  });

  it("merges a custom className", () => {
    render(<Card className="custom-class">Content</Card>);
    expect(screen.getByText("Content")).toHaveClass("custom-class");
  });
});
