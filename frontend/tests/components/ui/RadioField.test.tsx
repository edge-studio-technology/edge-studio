import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RadioField } from "../../../src/components/ui/RadioField";

describe("RadioField", () => {
  it("renders a labeled radio input", () => {
    render(<RadioField label="Option A" name="opts" value="a" />);
    expect(screen.getByRole("radio", { name: "Option A" })).toBeInTheDocument();
  });

  it("renders a description", () => {
    render(<RadioField label="Option A" description="More detail" />);
    expect(screen.getByText("More detail")).toBeInTheDocument();
  });

  it("selects only one radio in a shared-name group", async () => {
    render(
      <>
        <RadioField label="Option A" name="opts" value="a" />
        <RadioField label="Option B" name="opts" value="b" />
      </>,
    );

    const optionA = screen.getByRole("radio", { name: "Option A" });
    const optionB = screen.getByRole("radio", { name: "Option B" });

    await userEvent.click(optionA);
    expect(optionA).toBeChecked();
    expect(optionB).not.toBeChecked();

    await userEvent.click(optionB);
    expect(optionA).not.toBeChecked();
    expect(optionB).toBeChecked();
  });

  it("calls onChange when clicked", async () => {
    const onChange = vi.fn();
    render(<RadioField label="Option A" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "Option A" }));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled is passed", () => {
    render(<RadioField label="Option A" disabled />);
    expect(screen.getByRole("radio", { name: "Option A" })).toBeDisabled();
  });
});
