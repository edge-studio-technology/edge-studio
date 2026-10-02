import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/components/ToastProvider";
import { MinimaPage } from "../../src/pages/MinimaPage";
import type { MinimaNodeStatus } from "../../src/app/types";
import { getMinimaNodeStatus, restartMinimaContainer } from "../../src/features/minima/minimaApi";

vi.mock("../../src/features/minima/minimaApi", () => ({
  getMinimaNodeStatus: vi.fn(),
  restartMinimaContainer: vi.fn(),
  resyncMegammr: vi.fn(),
}));

const refresh = vi.fn();
let reportError: (message: string) => void;
let reportStatus: (status: MinimaNodeStatus) => void;

vi.mock("../../src/features/minima/useMinimaStatusRefresh", () => ({
  useMinimaStatusRefresh: (onStatus: typeof reportStatus, onError: (message: string) => void) => {
    reportStatus = onStatus;
    reportError = onError;
    return { refresh };
  },
}));

vi.mock("../../src/features/minima/MinimaSettingsPanel", () => ({
  MinimaSettingsPanel: () => null,
}));
vi.mock("../../src/features/minima/MinimaBackupPanel", () => ({ MinimaBackupPanel: () => null }));
vi.mock("../../src/features/minima/MinimaConsolePanel", () => ({ MinimaConsolePanel: () => null }));
vi.mock("../../src/features/minima/MinimaHealthCard", () => ({
  MinimaHealthCard: () => <div>Node health content</div>,
}));
vi.mock("../../src/features/minima/MinimaContainerCard", () => ({
  MinimaContainerCard: ({ busy, onRestart }: { busy: boolean; onRestart: () => void }) => (
    <button disabled={busy} onClick={onRestart}>Restart</button>
  ),
}));
vi.mock("../../src/features/minima/MinimaSummaryGrid", () => ({
  MinimaSummaryGrid: () => <div>Summary content</div>,
}));

function runningStatus(): MinimaNodeStatus {
  return {
    checkedAt: "2026-09-28T00:00:00.000Z",
    state: "running",
    container: null,
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

describe("MinimaPage", () => {
  beforeEach(() => {
    refresh.mockReset().mockResolvedValue(null);
    vi.mocked(restartMinimaContainer).mockReset();
    vi.mocked(getMinimaNodeStatus).mockReset();
  });

  it("disables restart until the command and healthy status recovery settle", async () => {
    let resolveRestart!: () => void;
    let resolveStatus!: (status: MinimaNodeStatus) => void;
    vi.mocked(restartMinimaContainer).mockReturnValue(new Promise((resolve) => {
      resolveRestart = () => resolve({ ok: true, state: "restarting", service: "minima", containerId: "minima-1" });
    }));
    vi.mocked(getMinimaNodeStatus).mockReturnValue(new Promise((resolve) => {
      resolveStatus = resolve;
    }));
    render(<MinimaPage />, { wrapper: ToastProvider });
    expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
    act(() => reportStatus(runningStatus()));
    await userEvent.click(screen.getByRole("button", { name: "Restart" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restart" }));

    expect(restartMinimaContainer).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
    expect(getMinimaNodeStatus).not.toHaveBeenCalled();
    await act(async () => resolveRestart());
    expect(getMinimaNodeStatus).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
    expect(screen.queryByText("Restart complete")).not.toBeInTheDocument();
    await act(async () => resolveStatus(runningStatus()));
    expect(screen.getByRole("button", { name: "Restart" })).toBeEnabled();
    expect(screen.getByText("Restart complete")).toBeInTheDocument();
  });

  it("shows one actionable failure toast and settles the direct restart rejection", async () => {
    let rejectRestart!: (error: Error) => void;
    vi.mocked(restartMinimaContainer).mockReturnValue(new Promise((_resolve, reject) => {
      rejectRestart = reject;
    }));
    vi.mocked(getMinimaNodeStatus).mockResolvedValue(runningStatus());
    render(<MinimaPage />, { wrapper: ToastProvider });
    act(() => reportStatus(runningStatus()));
    await userEvent.click(screen.getByRole("button", { name: "Restart" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restart" }));
    await act(async () => rejectRestart(new Error("Docker restart unavailable")));
    expect(screen.getAllByText("Minima restart failed")).toHaveLength(1);
    expect(screen.getByText("Docker restart unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Restart complete")).not.toBeInTheDocument();
    expect(getMinimaNodeStatus).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Restart" })).toBeEnabled();
  });

  it("settles first-load failure into a retryable error without unavailable status cards", async () => {
    render(<MinimaPage />, { wrapper: ToastProvider });

    act(() => reportError("status down"));

    expect(screen.getByText("Minima status isn't available")).toBeInTheDocument();
    expect(screen.getByText("status down")).toBeInTheDocument();
    expect(screen.queryByText("Node health content")).not.toBeInTheDocument();
    expect(screen.queryByText("Summary content")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
