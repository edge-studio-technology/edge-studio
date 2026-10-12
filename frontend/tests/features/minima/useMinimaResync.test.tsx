import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMinimaResync } from "../../../src/features/minima/useMinimaResync";
import { resyncOperation } from "../../helpers/minimaResync";

const fetchMock = vi.fn();
function response(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}
async function advance(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("persisted resync polling", () => {
  it("loads an existing operation and polls busy terminal reservations every three seconds", async () => {
    const operation = resyncOperation({ phase: "unconfirmed", outcome: "unconfirmed" });
    fetchMock.mockResolvedValue(response(operation));
    const { result } = renderHook(() => useMinimaResync());
    await advance();
    expect(result.current.operation).toEqual(operation);
    expect(result.current.loading).toBe(false);
    await advance(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.every(
        ([url, init]) =>
          url === "/api/minima/resync" && init.credentials === "include" && !init.method,
      ),
    ).toBe(true);
  });

  it("discovers another caller at the idle cadence and switches to fast polling", async () => {
    fetchMock.mockResolvedValueOnce(response(null)).mockResolvedValue(response(resyncOperation()));
    renderHook(() => useMinimaResync());
    await advance();
    await advance(29_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(3000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("never overlaps polls, including retry while a read is pending", async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useMinimaResync());
    await advance(60_000);
    void result.current.refresh();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => finish(response(resyncOperation())));
    await advance(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("preserves progress on read failure and recovers through retry", async () => {
    const operation = resyncOperation();
    fetchMock
      .mockResolvedValueOnce(response(operation))
      .mockRejectedValueOnce(new Error("Failed to fetch"));
    const { result } = renderHook(() => useMinimaResync());
    await advance();
    await advance(3000);
    expect(result.current.operation).toEqual(operation);
    expect(result.current.error).toBeTruthy();
    fetchMock.mockResolvedValue(response(resyncOperation({ phase: "recovering" })));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.operation?.phase).toBe("recovering");
  });

  it("ignores a read started before POST acceptance and immediately switches to the active cadence", async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useMinimaResync());
    act(() => result.current.accept(resyncOperation()));
    await act(async () => finish(response(null)));
    expect(result.current.operation?.id).toBe("resync-536");
    fetchMock.mockResolvedValue(response(resyncOperation({ phase: "recovering" })));
    await advance(3000);
    expect(result.current.operation?.phase).toBe("recovering");
  });

  it("rejects obsolete operation IDs and older observations", async () => {
    fetchMock.mockResolvedValue(
      response(resyncOperation({ updatedAt: "2026-10-09T10:01:00.000Z" })),
    );
    const { result } = renderHook(() => useMinimaResync());
    await advance();
    fetchMock
      .mockResolvedValueOnce(
        response(resyncOperation({ id: "old", startedAt: "2026-10-08T10:00:00.000Z" })),
      )
      .mockResolvedValueOnce(response(resyncOperation()));
    await advance(6000);
    expect(result.current.operation?.id).toBe("resync-536");
    expect(result.current.operation?.updatedAt).toBe("2026-10-09T10:01:00.000Z");
  });

  it("switches released terminal snapshots to the idle cadence", async () => {
    fetchMock
      .mockResolvedValueOnce(response(resyncOperation()))
      .mockResolvedValue(
        response(resyncOperation({ phase: "completed", outcome: "completed", busy: false })),
      );
    renderHook(() => useMinimaResync());
    await advance();
    await advance(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(27_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("handles StrictMode effect remount without accepting a stale callback or waiting thirty seconds", async () => {
    fetchMock.mockResolvedValue(response(resyncOperation()));
    const { result } = renderHook(() => useMinimaResync(), { wrapper: StrictMode });
    await advance();
    expect(result.current.loading).toBe(false);
    expect(result.current.operation?.id).toBe("resync-536");
  });

  it("ignores late reads and stops scheduling after unmount", async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => useMinimaResync());
    unmount();
    await act(async () => finish(response(resyncOperation())));
    await advance(60_000);
    expect(result.current.operation).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
