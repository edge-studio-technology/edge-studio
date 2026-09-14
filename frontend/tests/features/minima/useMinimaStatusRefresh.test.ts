import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MinimaNodeStatus } from "../../../src/app/types";

const getMinimaNodeStatus = vi.fn();

vi.mock("../../../src/features/minima/minimaApi", () => ({
  getMinimaNodeStatus: (...args: unknown[]) => getMinimaNodeStatus(...args),
}));

import { useMinimaStatusRefresh } from "../../../src/features/minima/useMinimaStatusRefresh";

function status(overrides: Partial<MinimaNodeStatus> = {}): MinimaNodeStatus {
  return {
    checkedAt: "2026-08-20T00:00:00.000Z",
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
    ...overrides,
  };
}

describe("useMinimaStatusRefresh", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("fetches immediately and calls onStatus on mount", async () => {
    const running = status();
    getMinimaNodeStatus.mockResolvedValue(running);
    const onStatus = vi.fn();

    renderHook(() => useMinimaStatusRefresh(onStatus, vi.fn()));

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith(running));
  });

  it("does not fetch when enabled is false", async () => {
    getMinimaNodeStatus.mockResolvedValue(status());
    renderHook(() => useMinimaStatusRefresh(vi.fn(), vi.fn(), { enabled: false }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getMinimaNodeStatus).not.toHaveBeenCalled();
  });

  it("calls onError with the error message for a non-transient failure", async () => {
    getMinimaNodeStatus.mockRejectedValue(new Error("Unauthorized"));
    const onError = vi.fn();

    renderHook(() => useMinimaStatusRefresh(vi.fn(), onError));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Unauthorized"));
  });

  it("suppresses onError for transient network errors", async () => {
    getMinimaNodeStatus.mockRejectedValue(new Error("fetch failed"));
    const onError = vi.fn();

    renderHook(() => useMinimaStatusRefresh(vi.fn(), onError));

    await waitFor(() => expect(getMinimaNodeStatus).toHaveBeenCalled());
    expect(onError).not.toHaveBeenCalled();
  });

  it("suppresses onError for AbortError", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    getMinimaNodeStatus.mockRejectedValue(abortError);
    const onError = vi.fn();

    renderHook(() => useMinimaStatusRefresh(vi.fn(), onError));

    await waitFor(() => expect(getMinimaNodeStatus).toHaveBeenCalled());
    expect(onError).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    getMinimaNodeStatus.mockRejectedValue("boom");
    const onError = vi.fn();

    renderHook(() => useMinimaStatusRefresh(vi.fn(), onError));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Could not load Minima status"));
  });

  it("re-polls at the default interval, and at the shorter interval while restarting", async () => {
    vi.useFakeTimers();
    const onStatus = vi.fn();
    getMinimaNodeStatus.mockResolvedValueOnce(status({ state: "restarting" }));
    getMinimaNodeStatus.mockResolvedValueOnce(status({ state: "restarting" }));
    getMinimaNodeStatus.mockResolvedValueOnce(status({ state: "running" }));

    renderHook(() => useMinimaStatusRefresh(onStatus, vi.fn()));

    await vi.waitFor(() => expect(getMinimaNodeStatus).toHaveBeenCalledTimes(1));

    // restarting -> next poll after the short 3s interval, not the default 30s.
    await vi.advanceTimersByTimeAsync(3_000);
    expect(getMinimaNodeStatus).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(getMinimaNodeStatus).toHaveBeenCalledTimes(3);

    // now running -> next poll waits for the full 30s default interval.
    await vi.advanceTimersByTimeAsync(3_000);
    expect(getMinimaNodeStatus).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(27_000);
    expect(getMinimaNodeStatus).toHaveBeenCalledTimes(4);
  });

  it("stops scheduling further polls after unmount", async () => {
    vi.useFakeTimers();
    getMinimaNodeStatus.mockResolvedValue(status());

    const { unmount } = renderHook(() => useMinimaStatusRefresh(vi.fn(), vi.fn()));
    await vi.waitFor(() => expect(getMinimaNodeStatus).toHaveBeenCalledTimes(1));

    unmount();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(getMinimaNodeStatus).toHaveBeenCalledTimes(1);
  });

  it("exposes a manual refresh function that returns the fetched status", async () => {
    const running = status();
    getMinimaNodeStatus.mockResolvedValue(running);
    const { result } = renderHook(() => useMinimaStatusRefresh(vi.fn(), vi.fn(), { enabled: false }));

    await expect(result.current.refresh()).resolves.toEqual(running);
  });
});
