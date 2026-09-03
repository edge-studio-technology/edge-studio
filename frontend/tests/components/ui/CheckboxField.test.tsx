import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CheckboxField } from "../../../src/components/ui/CheckboxField";

describe("CheckboxField", () => {
  it("renders a labeled checkbox", () => {
    render(<CheckboxField label="Enable feature" />);
    expect(screen.getByRole("checkbox", { name: "Enable feature" })).toBeInTheDocument();
  });

  it("renders without a label when label is null", () => {
    render(<CheckboxField label={null} aria-label="Select row" />);
    expect(screen.getByRole("checkbox", { name: "Select row" })).toBeInTheDocument();
  });

  it("renders a description", () => {
    render(<CheckboxField label="Enable" description="Extra detail" />);
    expect(screen.getByText("Extra detail")).toBeInTheDocument();
  });

  it("toggles uncontrolled state on click", async () => {
    render(<CheckboxField label="Enable" />);
    const checkbox = screen.getByRole("checkbox", { name: "Enable" }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    await userEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it("calls onChange with the change event", async () => {
    const onChange = vi.fn();
    render(<CheckboxField label="Enable" onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Enable" }));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("respects a controlled checked value", () => {
    render(<CheckboxField label="Enable" checked readOnly />);
    expect(screen.getByRole("checkbox", { name: "Enable" })).toBeChecked();
  });

  it("marks aria-checked as mixed when indeterminate", () => {
    render(<CheckboxField label="Enable" indeterminate />);
    expect(screen.getByRole("checkbox", { name: "Enable" })).toHaveAttribute(
      "aria-checked",
      "mixed",
    );
  });

  it("is disabled when disabled is passed", () => {
    render(<CheckboxField label="Enable" disabled />);
    expect(screen.getByRole("checkbox", { name: "Enable" })).toBeDisabled();
  });
});
