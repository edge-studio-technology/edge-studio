import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InputField } from "../../../src/components/ui/InputField";

describe("InputField", () => {
  it("associates the label with the input", () => {
    render(<InputField label="Name" />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("renders a description", () => {
    render(<InputField label="Name" description="Full legal name" />);
    expect(screen.getByText("Full legal name")).toBeInTheDocument();
  });

  it("renders an error message with role=alert and marks the input invalid", () => {
    render(<InputField label="Name" error="Required" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  });

  it("calls onChange when typed into", async () => {
    const onChange = vi.fn();
    render(<InputField label="Name" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText("Name"), "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("is disabled when disabled is passed", () => {
    render(<InputField label="Name" disabled />);
    expect(screen.getByLabelText("Name")).toBeDisabled();
  });
});
