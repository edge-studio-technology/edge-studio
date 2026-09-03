import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Label } from "../../../src/components/ui/Label";

describe("Label", () => {
  it("renders children", () => {
    render(<Label htmlFor="field">Name</Label>);
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("associates with a form field via htmlFor", () => {
    render(
      <>
        <Label htmlFor="field">Name</Label>
        <input id="field" />
      </>,
    );
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("applies disabled styling", () => {
    render(
      <Label htmlFor="field" disabled>
        Name
      </Label>,
    );
    expect(screen.getByText("Name")).toHaveClass("text-text-tertiary");
  });

  it("applies primary text styling when not disabled", () => {
    render(<Label htmlFor="field">Name</Label>);
    expect(screen.getByText("Name")).toHaveClass("text-text-primary");
  });
});
