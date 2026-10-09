import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MinimaResyncProgressPanel } from "../../../src/features/minima/MinimaResyncProgressPanel";
import { resyncOperation } from "../../helpers/minimaResync";

afterEach(() => vi.useRealTimers());
describe("resync progress panel", () => {
  for (const [phase, label] of [
    ["starting", "Resync starting"],
    ["in_progress", "Resync in progress"],
    ["recovering", "Checking node recovery"],
    ["completed", "Resync completed"],
    ["failed", "Resync failed"],
    ["unconfirmed", "Resync outcome unconfirmed"],
  ] as const) {
    it(`renders ${phase} from the backend, independently of node availability`, () => {
      render(
        <MinimaResyncProgressPanel
          operation={resyncOperation({ phase })}
          loading={false}
          error={null}
          onRetry={vi.fn()}
        />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Resync progress" })).toBeInTheDocument();
      expect(screen.getByText(/Last observation/)).toBeInTheDocument();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  }

  it("keeps warnings and event details visible after recovery without relabeling uncertainty as success", () => {
    render(
      <MinimaResyncProgressPanel
        operation={resyncOperation({
          phase: "unconfirmed",
          outcome: "unconfirmed",
          recovered: true,
          busy: false,
          events: [
            {
              at: "2026-10-09T10:01:00.000Z",
              phase: "recovering",
              message: "RPC response timed out; checking node progress.",
              errorDetails: { type: "timeout", message: "Response lost" },
            },
          ],
          errorDetails: { type: "timeout", message: "Response lost" },
        })}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("Node recovered")).toBeInTheDocument();
    expect(screen.getByText(/RPC response timed out/)).toBeInTheDocument();
    expect(screen.getByText("Resync outcome unconfirmed")).toBeInTheDocument();
    expect(screen.queryByText("Resync completed")).not.toBeInTheDocument();
    expect(screen.getByText("Recovery and error details").closest("details")).not.toHaveAttribute(
      "open",
    );
    fireEvent.click(screen.getByText("Recovery and error details"));
    expect(screen.getAllByText("Response lost").length).toBeGreaterThan(0);
  });

  it("renders loading, empty, and retryable read failures without inventing an operation", () => {
    const retry = vi.fn();
    const { rerender } = render(
      <MinimaResyncProgressPanel operation={null} loading error={null} onRetry={retry} />,
    );
    expect(screen.getByText("Loading resync progress")).toBeInTheDocument();
    rerender(
      <MinimaResyncProgressPanel operation={null} loading={false} error={null} onRetry={retry} />,
    );
    expect(screen.getByText("No resync recorded")).toBeInTheDocument();
    rerender(
      <MinimaResyncProgressPanel
        operation={null}
        loading={false}
        error="Backend unavailable"
        onRetry={retry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByText("Resync failed")).not.toBeInTheDocument();
  });

  it("retains events during a read failure and offers a progress retry", () => {
    const retry = vi.fn();
    render(
      <MinimaResyncProgressPanel
        operation={resyncOperation()}
        loading={false}
        error="Backend unavailable"
        onRetry={retry}
      />,
    );
    expect(screen.getByText("Resync starting")).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry progress" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("updates elapsed time while reserved and stops at the final timestamp after release", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:02:00.000Z"));
    const { rerender, unmount } = render(
      <MinimaResyncProgressPanel
        operation={resyncOperation()}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/Elapsed: 2m 0s/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByText(/Elapsed: 2m 3s/)).toBeInTheDocument();
    rerender(
      <MinimaResyncProgressPanel
        operation={resyncOperation({
          phase: "completed",
          busy: false,
          finishedAt: "2026-10-09T10:02:03.000Z",
        })}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByText(/Elapsed: 2m 3s/)).toBeInTheDocument();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
