import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/components/ToastProvider";
import { MinimaPage } from "../../src/pages/MinimaPage";
import type { MinimaNodeStatus } from "../../src/app/types";
import { resyncOperation } from "../helpers/minimaResync";

const statusRead = vi.fn();
const restartRequest = vi.fn();
const resyncRequest = vi.fn();
const progressRead = vi.fn();
const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  const handler = url === "/api/minima/status" ? statusRead : url === "/api/minima/restart" ? restartRequest : url === "/api/minima/resync" ? progressRead : url === "/api/minima/megammrsync/resync" ? resyncRequest : null;
  if (!handler) throw new Error(`Unexpected request: ${url}`);
  const payload = await handler();
  return { ok: true, status: url.endsWith("/resync") && url.includes("megammrsync") ? 202 : 200, json: async () => payload };
});

const refresh = vi.fn();
let statusRefreshEnabled: boolean | undefined;
let reportError: (message: string) => void;
let reportStatus: (status: MinimaNodeStatus) => void;

vi.mock("../../src/features/minima/useMinimaStatusRefresh", () => ({
  useMinimaStatusRefresh: (onStatus: typeof reportStatus, onError: (message: string) => void, options: { enabled: boolean }) => {
    statusRefreshEnabled = options.enabled;
    reportStatus = onStatus;
    reportError = onError;
    return { refresh };
  },
}));

vi.mock("../../src/features/minima/MinimaSettingsPanel", () => ({
  MinimaSettingsPanel: () => null,
}));
vi.mock("../../src/features/minima/MinimaBackupPanel", () => ({ MinimaBackupPanel: ({ operationBusy }: { operationBusy: boolean }) => <button disabled={operationBusy}>Backup</button> }));
vi.mock("../../src/features/minima/MinimaConsolePanel", () => ({ MinimaConsolePanel: ({ onCommandComplete }: { onCommandComplete: () => void }) => <button onClick={onCommandComplete}>Console response received</button> }));
vi.mock("../../src/features/minima/MinimaHealthCard", () => ({
  MinimaHealthCard: () => <div>Node health content</div>,
}));
vi.mock("../../src/features/minima/MinimaContainerCard", () => ({
  MinimaContainerCard: ({ busy, onRestart }: { busy: boolean; onRestart: () => void }) => (
    <button disabled={busy} onClick={onRestart}>Restart</button>
  ),
}));
vi.mock("../../src/features/minima/MinimaSummaryGrid", () => ({
  MinimaSummaryGrid: ({ busy, onResync }: { busy: boolean; onResync: () => void }) => <div>Summary content<button disabled={busy} onClick={onResync}>Resync</button></div>,
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
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
    progressRead.mockReset().mockResolvedValue(null);
    resyncRequest.mockReset();
    refresh.mockReset().mockResolvedValue(null);
    restartRequest.mockReset();
    statusRead.mockReset();
  });

  it("disables restart until the command and healthy status recovery settle", async () => {
    let resolveRestart!: () => void;
    let resolveStatus!: (status: MinimaNodeStatus) => void;
    restartRequest.mockReturnValue(new Promise((resolve) => {
      resolveRestart = () => resolve({ ok: true, state: "restarting", service: "minima", containerId: "minima-1" });
    }));
    statusRead.mockReturnValue(new Promise((resolve) => {
      resolveStatus = resolve;
    }));
    render(<MinimaPage />, { wrapper: ToastProvider });
    expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
    act(() => reportStatus(runningStatus()));
    await userEvent.click(screen.getByRole("button", { name: "Restart" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restart" }));

    expect(restartRequest).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
    expect(statusRead).not.toHaveBeenCalled();
    await act(async () => resolveRestart());
    expect(statusRead).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
    expect(screen.queryByText("Restart complete")).not.toBeInTheDocument();
    await act(async () => resolveStatus(runningStatus()));
    expect(screen.getByRole("button", { name: "Restart" })).toBeEnabled();
    expect(screen.getByText("Restart complete")).toBeInTheDocument();
  });

  it("shows one actionable failure toast and settles the direct restart rejection", async () => {
    let rejectRestart!: (error: Error) => void;
    restartRequest.mockReturnValue(new Promise((_resolve, reject) => {
      rejectRestart = reject;
    }));
    statusRead.mockResolvedValue(runningStatus());
    render(<MinimaPage />, { wrapper: ToastProvider });
    act(() => reportStatus(runningStatus()));
    await userEvent.click(screen.getByRole("button", { name: "Restart" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restart" }));
    await act(async () => rejectRestart(new Error("Docker restart unavailable")));
    expect(screen.getAllByText("Minima restart failed")).toHaveLength(1);
    expect(screen.getByText("Docker restart unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Restart complete")).not.toBeInTheDocument();
    expect(statusRead).toHaveBeenCalledOnce();
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

describe("backend-owned resync on MinimaPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    progressRead.mockReset().mockResolvedValue(null);
    resyncRequest.mockReset();
    restartRequest.mockReset();
    statusRead.mockReset();
    fetchMock.mockClear();
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  async function settle(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
  async function mount() {
    const rendered = render(<MinimaPage />, { wrapper: ToastProvider });
    act(() => reportStatus(runningStatus()));
    await settle();
    return rendered;
  }

  it("returns from acceptance, keeps ordinary status refresh available, and never restarts from the browser", async () => {
    let finish!: (value: ReturnType<typeof resyncOperation>) => void;
    resyncRequest.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Resync" }));
    fireEvent.click(screen.getByRole("button", { name: "Resync" }));
    expect(resyncRequest).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
    await act(async () => finish(resyncOperation()));
    expect(within(screen.getByRole("region", { name: "Resync progress" })).getByText("Resync starting")).toBeInTheDocument();
    expect(screen.queryByText("Resync completed")).not.toBeInTheDocument();
    act(() => reportStatus(runningStatus()));
    expect(screen.getByRole("button", { name: "Resync" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Backup", hidden: true })).toBeDisabled();
    progressRead.mockResolvedValue(resyncOperation({ phase: "recovering", updatedAt: "2026-10-09T10:00:06.000Z", message: "Resync connection interrupted; checking recovery." }));
    await settle(3000);
    expect(screen.getByText("Resync connection interrupted; checking recovery.")).toBeInTheDocument();
    expect(screen.queryByText("Resync failed")).not.toBeInTheDocument();
    progressRead.mockResolvedValue(resyncOperation({ phase: "completed", outcome: "completed", busy: false, recovered: true, updatedAt: "2026-10-09T10:00:09.000Z", message: "Resync completed; the node is back online." }));
    await settle(3000);
    expect(screen.getByRole("button", { name: "Resync" })).toBeEnabled();
    expect(statusRefreshEnabled).toBe(true);
    expect(restartRequest).not.toHaveBeenCalled();
    expect(statusRead).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("megammrsync")).length).toBe(1);
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit).credentials === "include")).toBe(true);
  });

  it("loads persisted events on navigation without reissuing resync or replaying an old completion toast", async () => {
    progressRead.mockResolvedValue(resyncOperation({ phase: "completed", outcome: "completed", busy: false, recovered: true }));
    const first = await mount();
    expect(screen.getAllByText("Resync completed")).toHaveLength(1);
    first.unmount();
    await mount();
    expect(screen.getAllByText("Resync completed")).toHaveLength(1);
    expect(screen.getAllByText(/Resync requested\./).length).toBeGreaterThan(0);
    expect(resyncRequest).not.toHaveBeenCalled();
  });

  it("deduplicates terminal notifications and keeps unconfirmed reservations blocking actions", async () => {
    progressRead.mockResolvedValue(resyncOperation());
    await mount();
    const unconfirmed = resyncOperation({ phase: "unconfirmed", outcome: "unconfirmed", updatedAt: "2026-10-09T10:00:06.000Z", message: "Could not confirm outcome; check the host." });
    progressRead.mockResolvedValue(unconfirmed);
    await settle(3000);
    expect(screen.getAllByText("Resync outcome unconfirmed")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
    await settle(3000);
    expect(screen.getAllByText("Resync outcome unconfirmed")).toHaveLength(2);
    expect(screen.queryByText("Resync completed")).not.toBeInTheDocument();
  });

  it("does not invent a resync failure if the POST connection is lost after acceptance", async () => {
    await mount();
    resyncRequest.mockRejectedValue(new Error("Failed to fetch"));
    progressRead.mockResolvedValue(resyncOperation({ phase: "recovering" }));
    fireEvent.click(screen.getByRole("button", { name: "Resync" }));
    await settle();
    expect(screen.getByText("Resync start not confirmed")).toBeInTheDocument();
    expect(screen.getByText("Checking node recovery")).toBeInTheDocument();
    expect(screen.queryByText("Resync failed")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resync" })).toBeDisabled();
  });

  it("keeps an open restart dialog cancellable if another caller reserves resync", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    progressRead.mockResolvedValue(resyncOperation());
    act(() => reportStatus({ ...runningStatus(), resync: resyncOperation() }));
    await settle();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Restart" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(restartRequest).not.toHaveBeenCalled();
  });

  it("treats an upstream HTTP 502 as uncertain initiation and reads the accepted operation", async () => {
    await mount();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: "Upstream connection closed" }) });
    progressRead.mockResolvedValue(resyncOperation({ phase: "recovering" }));
    fireEvent.click(screen.getByRole("button", { name: "Resync" }));
    await settle();
    expect(screen.getByText("Resync start not confirmed")).toBeInTheDocument();
    expect(screen.getByText("Checking node recovery")).toBeInTheDocument();
    expect(screen.queryByText("Could not start resync")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resync" })).toBeDisabled();
  });

  it("surfaces HTTP 409 as a conflict and loads the already reserved operation", async () => {
    await mount();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: "A Minima operation is already active", errorDetails: { type: "conflict", message: "Wait for the active operation" } }) });
    progressRead.mockResolvedValue(resyncOperation({ phase: "recovering" }));
    fireEvent.click(screen.getByRole("button", { name: "Resync" }));
    await settle();
    expect(screen.getByText("Node operation already active")).toBeInTheDocument();
    expect(screen.getByText("Checking node recovery")).toBeInTheDocument();
    expect(screen.queryByText("Resync failed")).not.toBeInTheDocument();
  });

  it("labels retained metrics after a node-status read fails while keeping progress available", async () => {
    await mount();
    act(() => reportError("Failed to fetch"));
    expect(screen.getByText("Node status update unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Showing metrics last observed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resync" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry node status" }));
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Resync progress" })).toBeInTheDocument();
  });

  it("preserves the operation during progress failure and retries without a terminal failure toast", async () => {
    progressRead.mockResolvedValue(resyncOperation());
    await mount();
    progressRead.mockRejectedValue(new Error("Failed to fetch"));
    await settle(3000);
    expect(screen.getByText("Progress update unavailable")).toBeInTheDocument();
    expect(screen.getByText("Resync starting")).toBeInTheDocument();
    expect(screen.queryByText("Resync failed")).not.toBeInTheDocument();
    progressRead.mockResolvedValue(resyncOperation({ phase: "recovering" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry progress" }));
    await settle();
    expect(screen.queryByText("Progress update unavailable")).not.toBeInTheDocument();
    expect(screen.getByText("Checking node recovery")).toBeInTheDocument();
  });

  it("refreshes progress after a console response and when status discovers another caller", async () => {
    await mount();
    progressRead.mockResolvedValue(resyncOperation());
    fireEvent.click(screen.getByRole("button", { name: "Console response received", hidden: true }));
    await settle();
    expect(screen.getByRole("button", { name: "Resync" })).toBeDisabled();
    progressRead.mockResolvedValue(resyncOperation({ phase: "recovering", updatedAt: "2026-10-09T10:00:06.000Z" }));
    act(() => reportStatus({ ...runningStatus(), resync: resyncOperation({ phase: "recovering", updatedAt: "2026-10-09T10:00:06.000Z" }) }));
    await settle();
    expect(screen.getByText("Checking node recovery")).toBeInTheDocument();
    expect(resyncRequest).not.toHaveBeenCalled();
  });
});
