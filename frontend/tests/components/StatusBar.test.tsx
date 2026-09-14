import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusBar } from "../../src/components/StatusBar";

describe("StatusBar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a status region with pill labels and the clock", () => {
    render(
      <StatusBar
        items={[
          { id: "node", label: "Node online", tone: "good" },
          { id: "integritas", label: "Integritas connected", tone: "good" },
        ]}
      />,
    );

    expect(screen.getByRole("status", { name: "System status" })).toBeInTheDocument();
    expect(screen.getByText("Node online")).toBeInTheDocument();
    expect(screen.getByText("Integritas connected")).toBeInTheDocument();
    expect(screen.getByLabelText("Current local and UTC time")).toBeInTheDocument();
  });

  it("shows detail title/body in a tooltip on hover when provided", () => {
    vi.useFakeTimers();
    render(
      <StatusBar
        items={[
          {
            id: "node",
            label: "Node offline",
            tone: "warn",
            detailTitle: "Node offline",
            detailBody: "Something went wrong.",
          },
        ]}
      />,
    );

    fireEvent.mouseEnter(screen.getByText("Node offline"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
  });

  it("does not wrap items without a detail title in a tooltip", () => {
    render(<StatusBar items={[{ id: "node", label: "Node online", tone: "good" }]} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
