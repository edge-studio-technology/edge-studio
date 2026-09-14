import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PinField } from "../../../src/components/ui/PinField";

function ControlledPinField({ initialValue = "", length }: { initialValue?: string; length?: number }) {
  const [value, setValue] = useState(initialValue);
  return <PinField label="PIN" value={value} onChange={setValue} length={length} />;
}

describe("PinField", () => {
  it("associates the label with the hidden input", () => {
    render(<PinField label="PIN" value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("PIN")).toBeInTheDocument();
  });

  it("calls onChange with digits only, stripping non-digit characters", async () => {
    render(<ControlledPinField />);

    await userEvent.type(screen.getByLabelText("PIN"), "1a2b");

    expect(screen.getByLabelText("PIN")).toHaveValue("12");
  });

  it("truncates to the configured length", async () => {
    render(<ControlledPinField initialValue="123" length={4} />);

    await userEvent.type(screen.getByLabelText("PIN"), "45");

    expect(screen.getByLabelText("PIN")).toHaveValue("1234");
  });

  it("renders a description and an error", () => {
    render(
      <PinField label="PIN" value="" onChange={vi.fn()} description="6 digits" error="Invalid PIN" />,
    );
    expect(screen.getByText("6 digits")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid PIN");
    expect(screen.getByLabelText("PIN")).toHaveAttribute("aria-invalid", "true");
  });

  it("is disabled when disabled is passed", () => {
    render(<PinField label="PIN" value="" onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText("PIN")).toBeDisabled();
  });
});
