import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Clock } from "../../../src/components/ui/Clock";

describe("Clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 5, 3, 7, 9)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders local and UTC pills", () => {
    render(<Clock />);
    expect(screen.getByLabelText("Current local and UTC time")).toBeInTheDocument();
    expect(screen.getByText(/^UTC 03:07:09$/)).toBeInTheDocument();
  });

  it("updates the UTC time after a second passes", () => {
    render(<Clock />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/^UTC 03:07:10$/)).toBeInTheDocument();
  });
});
