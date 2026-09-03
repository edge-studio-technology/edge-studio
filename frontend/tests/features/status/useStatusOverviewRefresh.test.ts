import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StatusOverview } from "../../../src/app/types";

const getStatusOverview = vi.fn();

vi.mock("../../../src/features/status/statusApi", () => ({
  getStatusOverview: (...args: unknown[]) => getStatusOverview(...args),
}));

import { useStatusOverviewRefresh } from "../../../src/features/status/useStatusOverviewRefresh";

function overview(overrides: Partial<StatusOverview> = {}): StatusOverview {
  return {
    generatedAt: "2026-08-20T00:00:00.000Z",
    services: [],
    ...overrides,
  };
}

describe("useStatusOverviewRefresh", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("fetches on mount and returns the overview", async () => {
    const result1 = overview();
    getStatusOverview.mockResolvedValue(result1);

    const { result } = renderHook(() => useStatusOverviewRefresh());

    await waitFor(() => expect(result.current.overview).toEqual(result1));
    expect(result.current.error).toBeNull();
  });

  it("sets an error message on failure and keeps overview null when no prior data", async () => {
    getStatusOverview.mockRejectedValue(new Error("Could not reach backend"));

    const { result } = renderHook(() => useStatusOverviewRefresh());

    await waitFor(() => expect(result.current.error).toBe("Could not reach backend"));
    expect(result.current.overview).toBeNull();
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    getStatusOverview.mockRejectedValue("boom");

    const { result } = renderHook(() => useStatusOverviewRefresh());

    await waitFor(() => expect(result.current.error).toBe("Could not refresh status"));
  });

  it("keeps the last known-good overview on screen and flags it stale after a later failure", async () => {
    const result1 = overview();
    getStatusOverview.mockResolvedValueOnce(result1);
    getStatusOverview.mockRejectedValueOnce(new Error("timeout"));

    vi.useFakeTimers();
    const { result } = renderHook(() => useStatusOverviewRefresh());

    await vi.waitFor(() => expect(result.current.overview).toEqual(result1));

    await vi.advanceTimersByTimeAsync(30_000);
    await vi.waitFor(() => expect(result.current.error).toBe("timeout"));
    expect(result.current.overview).toEqual(result1);
  });

  it("re-polls at the 30s interval", async () => {
    vi.useFakeTimers();
    getStatusOverview.mockResolvedValue(overview());

    renderHook(() => useStatusOverviewRefresh());

    await vi.waitFor(() => expect(getStatusOverview).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(30_000);
    expect(getStatusOverview).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(getStatusOverview).toHaveBeenCalledTimes(3);
  });

  it("stops polling after unmount", async () => {
    vi.useFakeTimers();
    getStatusOverview.mockResolvedValue(overview());

    const { unmount } = renderHook(() => useStatusOverviewRefresh());
    await vi.waitFor(() => expect(getStatusOverview).toHaveBeenCalledTimes(1));

    unmount();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(getStatusOverview).toHaveBeenCalledTimes(1);
  });
});
