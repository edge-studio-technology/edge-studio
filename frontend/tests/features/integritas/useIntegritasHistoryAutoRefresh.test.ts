import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IntegritasProofRecord } from "../../../src/features/integritas/integritasTypes";

const getHistory = vi.fn();

vi.mock("../../../src/features/integritas/integritasApi", () => ({
  getHistory: (...args: unknown[]) => getHistory(...args),
}));

import {
  hasPendingProofs,
  useIntegritasHistoryAutoRefresh,
} from "../../../src/features/integritas/useIntegritasHistoryAutoRefresh";

function record(overrides: Partial<IntegritasProofRecord> = {}): IntegritasProofRecord {
  return {
    id: "r1",
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
    file_name: "file.txt",
    file_size: 10,
    hash: "abc123",
    proof_uid: null,
    proof_status: "pending",
    proof_payload: null,
    status_response: null,
    verify_response: null,
    proof_error: null,
    ...overrides,
  };
}

describe("hasPendingProofs", () => {
  it("is true when a record is pending with a proof_uid", () => {
    expect(hasPendingProofs([record({ proof_status: "pending", proof_uid: "uid-1" })])).toBe(true);
  });

  it("is false when a pending record has no proof_uid", () => {
    expect(hasPendingProofs([record({ proof_status: "pending", proof_uid: null })])).toBe(false);
  });

  it("is false when no record is pending", () => {
    expect(hasPendingProofs([record({ proof_status: "ready", proof_uid: "uid-1" })])).toBe(false);
  });

  it("is false for an empty list", () => {
    expect(hasPendingProofs([])).toBe(false);
  });
});

describe("useIntegritasHistoryAutoRefresh", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("does not fetch when there are no pending records and pendingTotal is 0", () => {
    renderHook(() =>
      useIntegritasHistoryAutoRefresh([record({ proof_status: "ready", proof_uid: "uid-1" })], vi.fn()),
    );
    expect(getHistory).not.toHaveBeenCalled();
  });

  it("does not fetch when disabled even with pending records", () => {
    renderHook(() =>
      useIntegritasHistoryAutoRefresh(
        [record({ proof_status: "pending", proof_uid: "uid-1" })],
        vi.fn(),
        { enabled: false },
      ),
    );
    expect(getHistory).not.toHaveBeenCalled();
  });

  it("fetches immediately and calls onRecords when there are pending records", async () => {
    const response = { items: [record({ proof_status: "ready" })], page: 1, pageSize: 50, total: 1, totalPages: 1, pendingTotal: 0 };
    getHistory.mockResolvedValue(response);
    const onRecords = vi.fn();

    renderHook(() =>
      useIntegritasHistoryAutoRefresh(
        [record({ proof_status: "pending", proof_uid: "uid-1" })],
        onRecords,
      ),
    );

    await waitFor(() => expect(onRecords).toHaveBeenCalledWith(response.items));
  });

  it("fetches when pendingTotal > 0 even with no pending records in the current page", async () => {
    const response = { items: [], page: 1, pageSize: 50, total: 0, totalPages: 0, pendingTotal: 3 };
    getHistory.mockResolvedValue(response);
    const onRecords = vi.fn();

    renderHook(() =>
      useIntegritasHistoryAutoRefresh([record({ proof_status: "ready" })], onRecords, {
        pendingTotal: 3,
      }),
    );

    await waitFor(() => expect(getHistory).toHaveBeenCalled());
  });

  it("calls onPage instead of onRecords when onPage is provided", async () => {
    const response = { items: [record()], page: 1, pageSize: 50, total: 1, totalPages: 1, pendingTotal: 1 };
    getHistory.mockResolvedValue(response);
    const onRecords = vi.fn();
    const onPage = vi.fn();

    renderHook(() =>
      useIntegritasHistoryAutoRefresh([record({ proof_status: "pending", proof_uid: "uid-1" })], onRecords, {
        onPage,
      }),
    );

    await waitFor(() => expect(onPage).toHaveBeenCalledWith(response));
    expect(onRecords).not.toHaveBeenCalled();
  });

  it("passes the query params through to getHistory", async () => {
    getHistory.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0, pendingTotal: 0 });

    renderHook(() =>
      useIntegritasHistoryAutoRefresh(
        [record({ proof_status: "pending", proof_uid: "uid-1" })],
        vi.fn(),
        { query: { page: 2, pageSize: 10, status: "pending" } },
      ),
    );

    await waitFor(() =>
      expect(getHistory).toHaveBeenCalledWith({ page: 2, pageSize: 10, status: "pending" }),
    );
  });

  it("polls again after the configured interval", async () => {
    vi.useFakeTimers();
    getHistory.mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 0, pendingTotal: 0 });

    renderHook(() =>
      useIntegritasHistoryAutoRefresh(
        [record({ proof_status: "pending", proof_uid: "uid-1" })],
        vi.fn(),
        { intervalMs: 1000 },
      ),
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(getHistory).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(getHistory).toHaveBeenCalledTimes(2);
  });

  it("does not call onRecords after unmount", async () => {
    let resolveFn: (value: unknown) => void = () => {};
    getHistory.mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );
    const onRecords = vi.fn();

    const { unmount } = renderHook(() =>
      useIntegritasHistoryAutoRefresh(
        [record({ proof_status: "pending", proof_uid: "uid-1" })],
        onRecords,
      ),
    );

    unmount();
    resolveFn({ items: [record()], page: 1, pageSize: 50, total: 1, totalPages: 1, pendingTotal: 0 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onRecords).not.toHaveBeenCalled();
  });
});
