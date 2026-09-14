import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MinimaNodeStatus } from "../../../src/app/types";
import { MinimaSummaryGrid } from "../../../src/features/minima/MinimaSummaryGrid";

function status(overrides: Partial<MinimaNodeStatus> = {}): MinimaNodeStatus {
  return {
    checkedAt: "2026-08-20T00:00:00.000Z",
    state: "running",
    container: null,
    rpc: { ok: true },
    sync: { synced: true, status: "active", block: 100, blockTime: null, blockAgeSeconds: 5 },
    health: { peerCount: 4, peersKnown: 4 },
    node: { memoryRam: "1 GB", memoryDisk: "2 GB" },
    storage: { dataPath: "/data", containerDisk: "1 GB", chainDataDisk: "3 GB" },
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
    ...overrides,
  };
}

describe("MinimaSummaryGrid", () => {
  it("renders node state, sync status, and storage from status", () => {
    render(
      <MinimaSummaryGrid
        status={status()}
        loading={false}
        busy={false}
        resyncing={false}
        refreshing={false}
        onResync={vi.fn()}
      />,
    );

    expect(screen.getByText("Minima")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("3 GB chain data")).toBeInTheDocument();
    expect(screen.getByText("1 GB Docker container")).toBeInTheDocument();
  });

  it("falls back to node.memoryDisk for chain data when storage.chainDataDisk is absent", () => {
    render(
      <MinimaSummaryGrid
        status={status({ storage: { dataPath: "/data", containerDisk: null, chainDataDisk: null } })}
        loading={false}
        busy={false}
        resyncing={false}
        refreshing={false}
        onResync={vi.fn()}
      />,
    );
    expect(screen.getByText("2 GB chain data")).toBeInTheDocument();
  });

  it("shows Unavailable when there is neither chainDataDisk nor node.memoryDisk", () => {
    render(
      <MinimaSummaryGrid
        status={status({
          storage: { dataPath: "/data", containerDisk: null, chainDataDisk: null },
          node: { memoryRam: null, memoryDisk: null },
        })}
        loading={false}
        busy={false}
        resyncing={false}
        refreshing={false}
        onResync={vi.fn()}
      />,
    );
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("treats status as unavailable while refreshing, showing loading indicators", () => {
    render(
      <MinimaSummaryGrid
        status={status()}
        loading={false}
        busy={false}
        resyncing={false}
        refreshing
        onResync={vi.fn()}
      />,
    );
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("shows a Resyncing badge when resyncing", () => {
    render(
      <MinimaSummaryGrid
        status={status()}
        loading={false}
        busy={false}
        resyncing
        refreshing={false}
        onResync={vi.fn()}
      />,
    );
    expect(screen.getByText("Resyncing")).toBeInTheDocument();
  });

  it("calls onResync when the Resync button is clicked, and disables it while busy", async () => {
    const user = userEvent.setup();
    const onResync = vi.fn();
    const { rerender } = render(
      <MinimaSummaryGrid
        status={status()}
        loading={false}
        busy={false}
        resyncing={false}
        refreshing={false}
        onResync={onResync}
      />,
    );

    await user.click(screen.getByRole("button", { name: /resync/i }));
    expect(onResync).toHaveBeenCalledTimes(1);

    rerender(
      <MinimaSummaryGrid
        status={status()}
        loading={false}
        busy
        resyncing={false}
        refreshing={false}
        onResync={onResync}
      />,
    );
    expect(screen.getByRole("button", { name: /resync/i })).toBeDisabled();
  });

  it("shows the checked timestamp when checkedAt is present", () => {
    render(
      <MinimaSummaryGrid
        status={status()}
        loading={false}
        busy={false}
        resyncing={false}
        refreshing={false}
        onResync={vi.fn()}
      />,
    );
    expect(screen.getByText(/Checked/)).toBeInTheDocument();
  });
});
