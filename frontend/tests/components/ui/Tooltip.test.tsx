import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tooltip } from "../../../src/components/ui/Tooltip";

describe("Tooltip", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not render the bubble before interaction", () => {
    render(
      <Tooltip title="Hint">
        <button>Trigger</button>
      </Tooltip>,
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on hover after the open delay and shows the title/body", () => {
    vi.useFakeTimers();
    render(
      <Tooltip title="Hint" body="More detail">
        <button>Trigger</button>
      </Tooltip>,
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Trigger" }));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("Hint")).toBeInTheDocument();
    expect(screen.getByText("More detail")).toBeInTheDocument();
  });

  it("closes on unhover after the close delay", () => {
    vi.useFakeTimers();
    render(
      <Tooltip title="Hint">
        <button>Trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("renders as a toggletip (dialog role) when actions are given, toggled by click", async () => {
    render(
      <Tooltip title="Confirm" actions={<button>Yes</button>}>
        <button>Trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();

    await userEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes a toggletip on Escape", async () => {
    render(
      <Tooltip title="Confirm" actions={<button>Yes</button>}>
        <button>Trigger</button>
      </Tooltip>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Trigger" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("respects a controlled open prop", () => {
    const { rerender } = render(
      <Tooltip title="Hint" open={false}>
        <button>Trigger</button>
      </Tooltip>,
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    rerender(
      <Tooltip title="Hint" open={true}>
        <button>Trigger</button>
      </Tooltip>,
    );
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });
});
