import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SwitchField } from "../../../src/components/ui/SwitchField";

describe("SwitchField", () => {
  it("renders a labeled switch", () => {
    render(<SwitchField label="Enabled" />);
    expect(screen.getByRole("switch", { name: "Enabled" })).toBeInTheDocument();
  });

  it("renders without a label", () => {
    render(<SwitchField aria-label="Toggle" />);
    expect(screen.getByRole("switch", { name: "Toggle" })).toBeInTheDocument();
  });

  it("renders a description", () => {
    render(<SwitchField label="Enabled" description="Turns the feature on" />);
    expect(screen.getByText("Turns the feature on")).toBeInTheDocument();
  });

  it("toggles on click and calls onChange", async () => {
    const onChange = vi.fn();
    render(<SwitchField label="Enabled" onChange={onChange} />);

    const toggle = screen.getByRole("switch", { name: "Enabled" });
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled is passed", () => {
    render(<SwitchField label="Enabled" disabled />);
    expect(screen.getByRole("switch", { name: "Enabled" })).toBeDisabled();
  });
});
