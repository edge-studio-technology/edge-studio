import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { MinimaNodeStatus } from "../../../src/app/types";
import { MinimaHealthCard } from "../../../src/features/minima/MinimaHealthCard";

function status(overrides: Partial<MinimaNodeStatus> = {}): MinimaNodeStatus {
  return {
    checkedAt: "2026-08-20T00:00:00.000Z",
    state: "running",
    container: null,
    rpc: { ok: true },
    sync: { synced: true, status: "active", block: 100, blockTime: null, blockAgeSeconds: 65 },
    health: { peerCount: 4, peersKnown: 4 },
    node: { memoryRam: "512 MB", memoryDisk: "2 GB" },
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

describe("MinimaHealthCard", () => {
  it("renders node memory, peer count, block age, and current block", () => {
    render(<MinimaHealthCard status={status()} loading={false} refreshing={false} />);
    expect(screen.getByText("512 MB")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("1 minutes ago")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("falls back to formatted blockTime when blockAgeSeconds is null", () => {
    render(
      <MinimaHealthCard
        status={status({
          sync: { synced: true, status: "active", block: 100, blockTime: "2026-08-20T00:00:00.000Z", blockAgeSeconds: null },
        })}
        loading={false}
        refreshing={false}
      />,
    );
    expect(screen.queryByText(/minutes ago/)).not.toBeInTheDocument();
  });

  it("shows em dashes when status is null and not loading", () => {
    render(<MinimaHealthCard status={null} loading={false} refreshing={false} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows a stall-detected notice with auto-resync details", () => {
    render(
      <MinimaHealthCard
        status={status({
          monitoring: {
            stallDetected: true,
            stallThresholdSeconds: 600,
            autoResyncEnabled: true,
            lastPollerCheckAt: null,
            lastStallDetectedAt: null,
            lastAutoResyncAt: "2026-08-20T00:00:00.000Z",
            lastAutoResyncResult: "success",
          },
        })}
        loading={false}
        refreshing={false}
      />,
    );
    expect(screen.getByText(/Chain stall detected/)).toBeInTheDocument();
    expect(screen.getByText(/Last auto-resync/)).toBeInTheDocument();
  });

  it("shows a manual-resync suggestion when auto-resync is disabled during a stall", () => {
    render(
      <MinimaHealthCard
        status={status({
          monitoring: {
            stallDetected: true,
            stallThresholdSeconds: 600,
            autoResyncEnabled: false,
            lastPollerCheckAt: null,
            lastStallDetectedAt: null,
            lastAutoResyncAt: null,
            lastAutoResyncResult: null,
          },
        })}
        loading={false}
        refreshing={false}
      />,
    );
    expect(screen.getByText(/Consider a manual Megammr resync/)).toBeInTheDocument();
  });

  it("shows the rpc error text when shouldShowMinimaRpcError is true", () => {
    render(
      <MinimaHealthCard
        status={status({ rpc: { ok: false, error: "invalid credentials" } })}
        loading={false}
        refreshing={false}
      />,
    );
    expect(screen.getByText("invalid credentials")).toBeInTheDocument();
  });

  it("does not show rpc error text for a transient error with metrics present", () => {
    render(
      <MinimaHealthCard
        status={status({ rpc: { ok: false, error: "fetch failed" } })}
        loading={false}
        refreshing={false}
      />,
    );
    expect(screen.queryByText("fetch failed")).not.toBeInTheDocument();
  });

  it("disables the RPC debug view when rpc.raw is undefined, enables it when present", async () => {
    const user = userEvent.setup();
    render(<MinimaHealthCard status={status()} loading={false} refreshing={false} />);
    expect(screen.getByRole("button", { name: /view rpc debug/i })).toBeDisabled();

    render(
      <MinimaHealthCard
        status={status({ rpc: { ok: true, raw: { hello: "world" } } })}
        loading={false}
        refreshing={false}
      />,
    );
    const enabledButton = screen.getAllByRole("button", { name: /view rpc debug/i })[1];
    expect(enabledButton).toBeEnabled();
    await user.click(enabledButton);
  });
});
