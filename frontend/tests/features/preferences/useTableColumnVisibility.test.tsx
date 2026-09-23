import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TableColumnDefinition } from "../../../src/components/patterns/TableColumnVisibility";

const { getTableColumnPreferencesMock, saveTableColumnPreferencesMock } = vi.hoisted(() => ({
  getTableColumnPreferencesMock: vi.fn(),
  saveTableColumnPreferencesMock: vi.fn(),
}));

vi.mock("../../../src/features/preferences/tableColumnPreferencesApi", () => ({
  getTableColumnPreferences: getTableColumnPreferencesMock,
  saveTableColumnPreferences: saveTableColumnPreferencesMock,
}));

const columns = [
  { id: "name", label: "Name" },
  { id: "status", label: "Status", defaultVisible: false, filterable: true },
  { id: "actions", label: "Actions", dataColumn: false },
] as const satisfies readonly TableColumnDefinition[];

async function importHook() {
  return (await import("../../../src/features/preferences/useTableColumnVisibility"))
    .useTableColumnVisibility;
}

describe("useTableColumnVisibility", () => {
  beforeEach(() => {
    vi.resetModules();
    getTableColumnPreferencesMock.mockReset();
    saveTableColumnPreferencesMock.mockReset();
    saveTableColumnPreferencesMock.mockImplementation(async (preferences) => preferences);
  });

  it("loads saved visibility, order, and filters and resolves unknown values", async () => {
    getTableColumnPreferencesMock.mockResolvedValue({
      devices: {
        visibility: { name: false, missing: true },
        order: ["status", "missing", "name"],
        filters: { status: { operator: "contains", value: "ok" }, missing: { operator: "contains", value: "x" } },
      },
    });
    const useTableColumnVisibility = await importHook();

    const { result } = renderHook(() => useTableColumnVisibility("devices", columns));

    expect(result.current.visibility).toEqual({ name: true, status: false, actions: true });
    await waitFor(() => expect(result.current.visibility.name).toBe(false));
    expect(result.current.columnOrder).toEqual(["status", "name", "actions"]);
    expect(result.current.filters).toEqual({ status: { operator: "contains", value: "ok" } });
  });

  it("supports legacy visibility-only preferences", async () => {
    getTableColumnPreferencesMock.mockResolvedValue({ devices: { name: false, status: true } });
    const useTableColumnVisibility = await importHook();

    const { result } = renderHook(() => useTableColumnVisibility("devices", columns));

    await waitFor(() => expect(result.current.visibility).toEqual({ name: false, status: true, actions: true }));
    expect(result.current.columnOrder).toEqual(["name", "status", "actions"]);
    expect(result.current.filters).toEqual({});
  });

  it("ignores malformed structured preferences", async () => {
    getTableColumnPreferencesMock.mockResolvedValue({
      devices: {
        visibility: [],
        order: "status",
        filters: [],
      },
    });
    const useTableColumnVisibility = await importHook();

    const { result } = renderHook(() => useTableColumnVisibility("devices", columns));

    await waitFor(() => expect(result.current.visibility).toEqual({ name: true, status: false, actions: true }));
    expect(result.current.columnOrder).toEqual(["name", "status", "actions"]);
    expect(result.current.filters).toEqual({});
  });

  it("ignores non-object and array preferences", async () => {
    getTableColumnPreferencesMock.mockResolvedValue({
      devices: ["name"],
      runs: null,
    });
    const useTableColumnVisibility = await importHook();

    const { result, rerender } = renderHook(
      ({ tableId }) => useTableColumnVisibility(tableId, columns),
      { initialProps: { tableId: "devices" } },
    );

    await waitFor(() => expect(result.current.visibility).toEqual({ name: true, status: false, actions: true }));
    rerender({ tableId: "runs" });
    expect(result.current.columnOrder).toEqual(["name", "status", "actions"]);
  });

  it("shares a pending preferences load between hook instances", async () => {
    let resolvePreferences: (preferences: Record<string, unknown>) => void = () => undefined;
    getTableColumnPreferencesMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePreferences = resolve;
      }),
    );
    const useTableColumnVisibility = await importHook();

    const first = renderHook(() => useTableColumnVisibility("devices", columns));
    const second = renderHook(() => useTableColumnVisibility("devices", columns));
    resolvePreferences({ devices: { visibility: { name: false } } });

    await waitFor(() => expect(first.result.current.visibility.name).toBe(false));
    expect(second.result.current.visibility.name).toBe(false);
    expect(getTableColumnPreferencesMock).toHaveBeenCalledTimes(1);
  });

  it("uses cached preferences for later hook instances", async () => {
    getTableColumnPreferencesMock.mockResolvedValue({ devices: { visibility: { name: false } } });
    const useTableColumnVisibility = await importHook();

    const first = renderHook(() => useTableColumnVisibility("devices", columns));
    await waitFor(() => expect(first.result.current.visibility.name).toBe(false));

    const second = renderHook(() => useTableColumnVisibility("devices", columns));
    expect(second.result.current.visibility.name).toBe(false);
    expect(getTableColumnPreferencesMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to defaults when loading preferences fails", async () => {
    getTableColumnPreferencesMock.mockRejectedValue(new Error("offline"));
    const useTableColumnVisibility = await importHook();

    const { result } = renderHook(() => useTableColumnVisibility("devices", columns));

    await waitFor(() => expect(result.current.visibility).toEqual({ name: true, status: false, actions: true }));
    expect(result.current.columnOrder).toEqual(["name", "status", "actions"]);
    expect(result.current.filters).toEqual({});
  });

  it("saves visibility, order, and filters updates", async () => {
    getTableColumnPreferencesMock.mockResolvedValue({});
    const useTableColumnVisibility = await importHook();
    const { result } = renderHook(() => useTableColumnVisibility("devices", columns));
    await waitFor(() => expect(getTableColumnPreferencesMock).toHaveBeenCalled());

    act(() => result.current.setVisibility({ name: false, status: true, actions: true }));
    expect(saveTableColumnPreferencesMock).toHaveBeenLastCalledWith({
      devices: {
        visibility: { name: false, status: true, actions: true },
        order: ["name", "status", "actions"],
        filters: {},
      },
    });

    act(() => result.current.setColumnOrder(["status", "name", "actions"]));
    expect(saveTableColumnPreferencesMock).toHaveBeenLastCalledWith({
      devices: {
        visibility: { name: false, status: true, actions: true },
        order: ["status", "name", "actions"],
        filters: {},
      },
    });

    act(() => result.current.setFilters({ status: { operator: "not_contains", value: "bad" }, missing: { operator: "contains", value: "x" } }));
    expect(saveTableColumnPreferencesMock).toHaveBeenLastCalledWith({
      devices: {
        visibility: { name: false, status: true, actions: true },
        order: ["status", "name", "actions"],
        filters: { status: { operator: "not_contains", value: "bad" } },
      },
    });
  });
});
