import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MinimaNodeStatus } from "../../../src/app/types";
import { MinimaContainerCard } from "../../../src/features/minima/MinimaContainerCard";

function status(container: Partial<MinimaNodeStatus["container"]> | null): MinimaNodeStatus {
  return {
    checkedAt: "2026-08-20T00:00:00.000Z",
    state: "running",
    container: container as MinimaNodeStatus["container"],
    rpc: { ok: true },
    sync: { synced: true, status: "active", block: 1, blockTime: null, blockAgeSeconds: 1 },
    health: { peerCount: 1, peersKnown: 1 },
    node: { memoryRam: "1 GB", memoryDisk: "2 GB" },
    storage: { dataPath: "/data", containerDisk: "1 GB", chainDataDisk: "1 GB" },
    config: { megammrHost: "megammr.minima.global:9001", megammrHostSource: "default" },
    monitoring: {
      stallDetected: false,
      stallThresholdSeconds: 600,
      autoResyncEnabled: false,
      lastPollerCheckAt: null,
      lastStallDetectedAt: null,
      lastAutoResyncAt: null,
      lastAutoResyncResult: null,
    },
  };
}

describe("MinimaContainerCard", () => {
  it("renders CPU, memory, state, and runtime from container status", () => {
    render(
      <MinimaContainerCard
        status={status({
          state: "running",
          status: "Up 2 hours",
          cpuPercent: 3.5,
          memory: { usage: "150 MB", limit: "512 MB" },
        })}
        loading={false}
      />,
    );
    expect(screen.getByText("3.5%")).toBeInTheDocument();
    expect(screen.getByText("150 MB / 512 MB")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Up 2 hours")).toBeInTheDocument();
  });

  it("shows memory usage alone when there is no limit", () => {
    render(
      <MinimaContainerCard
        status={status({ state: "running", status: "Up", cpuPercent: 1, memory: { usage: "100 MB", limit: null } })}
        loading={false}
      />,
    );
    expect(screen.getByText("100 MB")).toBeInTheDocument();
  });

  it("shows em dashes when container is null and not loading", () => {
    render(<MinimaContainerCard status={status(null)} loading={false} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows a Restarting badge while refreshing", () => {
    render(<MinimaContainerCard status={status(null)} loading={false} refreshing />);
    expect(screen.getByText("Restarting")).toBeInTheDocument();
  });

  it("does not render a restart button when onRestart is not given", () => {
    render(<MinimaContainerCard status={status(null)} loading={false} />);
    expect(screen.queryByRole("button", { name: /restart/i })).not.toBeInTheDocument();
  });

  it("calls onRestart when the Restart button is clicked, and disables it while busy", async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    const { rerender } = render(
      <MinimaContainerCard status={status(null)} loading={false} onRestart={onRestart} />,
    );

    await user.click(screen.getByRole("button", { name: /restart/i }));
    expect(onRestart).toHaveBeenCalledTimes(1);

    rerender(<MinimaContainerCard status={status(null)} loading={false} busy onRestart={onRestart} />);
    expect(screen.getByRole("button", { name: /restart/i })).toBeDisabled();
  });
});
