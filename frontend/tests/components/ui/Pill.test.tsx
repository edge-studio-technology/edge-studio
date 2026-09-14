import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pill } from "../../../src/components/ui/Pill";

describe("Pill", () => {
  it("renders children text", () => {
    render(<Pill>Active</Pill>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders an indicator dot when indicator is true", () => {
    const { container } = render(<Pill indicator>Live</Pill>);
    expect(container.querySelectorAll("[aria-hidden]").length).toBeGreaterThan(0);
  });

  it("applies an additional className", () => {
    const { container } = render(<Pill className="extra-class">Tagged</Pill>);
    expect(container.firstElementChild).toHaveClass("extra-class");
  });
});
