import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SelectField } from "../../../src/components/ui/SelectField";

const options = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B", disabled: true },
];

describe("SelectField", () => {
  it("associates the label and renders all options", () => {
    render(<SelectField label="Choice" options={options} />);
    const select = screen.getByLabelText("Choice");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Option A" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Option B" })).toBeDisabled();
  });

  it("renders a placeholder option when given", () => {
    render(<SelectField label="Choice" options={options} placeholder="Pick one" />);
    expect(screen.getByRole("option", { name: "Pick one" })).toBeInTheDocument();
  });

  it("calls onChange when a new option is selected", async () => {
    const onChange = vi.fn();
    render(<SelectField label="Choice" options={options} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText("Choice"), "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("renders an error message and marks the select invalid", () => {
    render(<SelectField label="Choice" options={options} error="Required" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
    expect(screen.getByLabelText("Choice")).toHaveAttribute("aria-invalid", "true");
  });

  it("is disabled when disabled is passed", () => {
    render(<SelectField label="Choice" options={options} disabled />);
    expect(screen.getByLabelText("Choice")).toBeDisabled();
  });
});
