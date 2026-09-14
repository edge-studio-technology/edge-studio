import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TextareaField } from "../../../src/components/ui/TextareaField";

describe("TextareaField", () => {
  it("associates the label with the textarea", () => {
    render(<TextareaField label="Notes" />);
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
  });

  it("renders a description", () => {
    render(<TextareaField label="Notes" description="Optional detail" />);
    expect(screen.getByText("Optional detail")).toBeInTheDocument();
  });

  it("renders an error and marks the textarea invalid", () => {
    render(<TextareaField label="Notes" error="Too long" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Too long");
    expect(screen.getByLabelText("Notes")).toHaveAttribute("aria-invalid", "true");
  });

  it("calls onChange when typed into", async () => {
    const onChange = vi.fn();
    render(<TextareaField label="Notes" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText("Notes"), "hi");
    expect(onChange).toHaveBeenCalled();
  });

  it("is disabled when disabled is passed", () => {
    render(<TextareaField label="Notes" disabled />);
    expect(screen.getByLabelText("Notes")).toBeDisabled();
  });
});
