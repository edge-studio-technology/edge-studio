import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "../../src/components/Input";

describe("Input", () => {
  it("renders a text input by default", () => {
    render(<Input aria-label="Name" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveAttribute("type", "text");
  });

  it("renders the requested type", () => {
    render(<Input aria-label="Amount" type="number" />);
    expect(screen.getByRole("spinbutton", { name: "Amount" })).toBeInTheDocument();
  });

  it("forwards value changes via onChange", async () => {
    const onChange = vi.fn();
    render(<Input aria-label="Name" onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "abc");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("applies the sm size classes when requested", () => {
    render(<Input aria-label="Small" size="sm" />);
    expect(screen.getByRole("textbox", { name: "Small" })).toHaveClass("h-8");
  });

  it("merges an additional className", () => {
    render(<Input aria-label="Name" className="extra-class" />);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveClass("extra-class");
  });

  it("respects the disabled prop", () => {
    render(<Input aria-label="Name" disabled />);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeDisabled();
  });
});
