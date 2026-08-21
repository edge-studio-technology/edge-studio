import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MinimaMegammrHostSection } from "../../../src/features/minima/MinimaMegammrHostSection";

describe("MinimaMegammrHostSection", () => {
  it("renders the input value and config detail rows", () => {
    render(
      <MinimaMegammrHostSection
        config={{ megammrHost: "megammr.minima.global:9001", megammrHostSource: "default" }}
        megammrHostInput="megammr.minima.global:9001"
        setMegammrHostInput={vi.fn()}
        busy={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Host")).toHaveValue("megammr.minima.global:9001");
    expect(screen.getByText("default")).toBeInTheDocument();
  });

  it("shows 'loading...' detail rows when config is null", () => {
    render(
      <MinimaMegammrHostSection
        config={null}
        megammrHostInput=""
        setMegammrHostInput={vi.fn()}
        busy={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getAllByText("loading...").length).toBe(2);
  });

  it("calls setMegammrHostInput as the input changes", async () => {
    const user = userEvent.setup();
    const setMegammrHostInput = vi.fn();
    render(
      <MinimaMegammrHostSection
        config={null}
        megammrHostInput=""
        setMegammrHostInput={setMegammrHostInput}
        busy={false}
        onSave={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Host"), "x");
    expect(setMegammrHostInput).toHaveBeenCalledWith("x");
  });

  it("disables Save configuration when the input is blank, and calls onSave when clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(
      <MinimaMegammrHostSection
        config={null}
        megammrHostInput=""
        setMegammrHostInput={vi.fn()}
        busy={false}
        onSave={onSave}
      />,
    );
    expect(screen.getByRole("button", { name: /save configuration/i })).toBeDisabled();

    rerender(
      <MinimaMegammrHostSection
        config={null}
        megammrHostInput="host:9001"
        setMegammrHostInput={vi.fn()}
        busy={false}
        onSave={onSave}
      />,
    );
    await user.click(screen.getByRole("button", { name: /save configuration/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("disables Save configuration while busy", () => {
    render(
      <MinimaMegammrHostSection
        config={null}
        megammrHostInput="host:9001"
        setMegammrHostInput={vi.fn()}
        busy
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /save configuration/i })).toBeDisabled();
  });
});
