import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TabList } from "../../../src/components/ui/TabList";

const options = [
  { value: "a", label: "Tab A" },
  { value: "b", label: "Tab B", disabled: true },
] as const;

describe("TabList", () => {
  it("renders a tablist with a tab per option", () => {
    render(<TabList label="Sections" value="a" options={options} onChange={vi.fn()} />);
    expect(screen.getByRole("tablist", { name: "Sections" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("marks the active option as selected", () => {
    render(<TabList label="Sections" value="a" options={options} onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Tab A" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Tab B" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onChange with the clicked tab's value", async () => {
    const onChange = vi.fn();
    render(<TabList label="Sections" value="a" options={options} onChange={onChange} />);

    await userEvent.click(screen.getByRole("tab", { name: "Tab A" }));
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("disables a tab marked disabled", () => {
    render(<TabList label="Sections" value="a" options={options} onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Tab B" })).toBeDisabled();
  });
});
