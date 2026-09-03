import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToggleTabs } from "../../../src/components/ui/ToggleTabs";

const options = [
  { value: "list", label: "List" },
  { value: "grid", label: "Grid", disabled: true },
] as const;

describe("ToggleTabs", () => {
  it("renders a tablist with a tab per option", () => {
    render(<ToggleTabs label="View" value="list" options={options} onChange={vi.fn()} />);
    expect(screen.getByRole("tablist", { name: "View" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("marks the active option as selected", () => {
    render(<ToggleTabs label="View" value="list" options={options} onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "List" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Grid" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onChange with the clicked tab's value", async () => {
    const onChange = vi.fn();
    render(<ToggleTabs label="View" value="list" options={options} onChange={onChange} />);

    await userEvent.click(screen.getByRole("tab", { name: "List" }));
    expect(onChange).toHaveBeenCalledWith("list");
  });

  it("disables a tab marked disabled", () => {
    render(<ToggleTabs label="View" value="list" options={options} onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Grid" })).toBeDisabled();
  });
});
