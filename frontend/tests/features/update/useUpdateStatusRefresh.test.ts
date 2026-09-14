import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UpdateStatusSummary } from "../../../src/app/types";

const getUpdateStatusSummary = vi.fn();

vi.mock("../../../src/features/update/updateApi", () => ({
  getUpdateStatusSummary: (...args: unknown[]) => getUpdateStatusSummary(...args),
}));

import { useUpdateStatusRefresh } from "../../../src/features/update/useUpdateStatusRefresh";

function summary(overrides: Partial<NonNullable<UpdateStatusSummary>> = {}): UpdateStatusSummary {
  return {
    checkedAt: "2026-08-20T00:00:00.000Z",
    services: [],
    currentVersion: "1.0.0",
    availableVersion: "1.1.0",
    ...overrides,
  };
}

describe("useUpdateStatusRefresh", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("fetches immediately on mount and calls onStatus", async () => {
    const result = summary();
    getUpdateStatusSummary.mockResolvedValue(result);
    const onStatus = vi.fn();

    renderHook(() => useUpdateStatusRefresh(onStatus));

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith(result));
  });

  it("does not fetch when enabled is false", async () => {
    getUpdateStatusSummary.mockResolvedValue(summary());

    renderHook(() => useUpdateStatusRefresh(vi.fn(), { enabled: false }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getUpdateStatusSummary).not.toHaveBeenCalled();
  });

  it("silently swallows a failed check without calling onStatus", async () => {
    getUpdateStatusSummary.mockRejectedValue(new Error("boom"));
    const onStatus = vi.fn();

    renderHook(() => useUpdateStatusRefresh(onStatus));

    await waitFor(() => expect(getUpdateStatusSummary).toHaveBeenCalledTimes(1));
    expect(onStatus).not.toHaveBeenCalled();
  });

  it("re-polls at the default 60s interval", async () => {
    vi.useFakeTimers();
    getUpdateStatusSummary.mockResolvedValue(summary());

    renderHook(() => useUpdateStatusRefresh(vi.fn()));

    await vi.waitFor(() => expect(getUpdateStatusSummary).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getUpdateStatusSummary).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getUpdateStatusSummary).toHaveBeenCalledTimes(3);
  });

  it("re-polls at a custom interval when provided", async () => {
    vi.useFakeTimers();
    getUpdateStatusSummary.mockResolvedValue(summary());

    renderHook(() => useUpdateStatusRefresh(vi.fn(), { intervalMs: 5_000 }));

    await vi.waitFor(() => expect(getUpdateStatusSummary).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(5_000);
    expect(getUpdateStatusSummary).toHaveBeenCalledTimes(2);
  });

  it("stops polling after unmount", async () => {
    vi.useFakeTimers();
    getUpdateStatusSummary.mockResolvedValue(summary());

    const { unmount } = renderHook(() => useUpdateStatusRefresh(vi.fn()));
    await vi.waitFor(() => expect(getUpdateStatusSummary).toHaveBeenCalledTimes(1));

    unmount();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(getUpdateStatusSummary).toHaveBeenCalledTimes(1);
  });

  it("always calls the latest onStatus callback even though refresh is stable", async () => {
    vi.useFakeTimers();
    getUpdateStatusSummary.mockResolvedValue(summary());
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(({ onStatus }) => useUpdateStatusRefresh(onStatus), {
      initialProps: { onStatus: first },
    });
    await vi.waitFor(() => expect(first).toHaveBeenCalledTimes(1));

    rerender({ onStatus: second });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });
});
