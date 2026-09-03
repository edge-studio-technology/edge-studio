import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusRow } from "../../src/components/StatusRow";

describe("StatusRow", () => {
  it("renders its children", () => {
    render(
      <StatusRow>
        <span>Left</span>
        <span>Right</span>
      </StatusRow>,
    );
    expect(screen.getByText("Left")).toBeInTheDocument();
    expect(screen.getByText("Right")).toBeInTheDocument();
  });

  it("applies the layout classes and an additional className", () => {
    const { container } = render(<StatusRow className="extra-class">Content</StatusRow>);
    const row = container.firstElementChild!;
    expect(row).toHaveClass("flex", "flex-col", "extra-class");
  });
});
