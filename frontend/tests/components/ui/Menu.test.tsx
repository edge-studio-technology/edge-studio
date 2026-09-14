import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Menu } from "../../../src/components/ui/Menu";

describe("Menu", () => {
  it("renders a menu item for each entry", () => {
    render(<Menu items={[{ label: "One" }, { label: "Two" }]} />);
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
    expect(screen.getByRole("menuitem", { name: /One/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Two/ })).toBeInTheDocument();
  });

  it("calls the item's onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Menu items={[{ label: "One", onClick }]} />);

    await userEvent.click(screen.getByRole("menuitem", { name: /One/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disables an item when disabled is set", () => {
    render(<Menu items={[{ label: "One", disabled: true }]} />);
    expect(screen.getByRole("menuitem", { name: /One/ })).toBeDisabled();
  });

  it("renders an empty menu for an empty items list", () => {
    render(<Menu items={[]} />);
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });
});
