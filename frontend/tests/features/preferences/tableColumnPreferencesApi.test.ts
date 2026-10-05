import { describe, expect, it, vi } from "vitest";

const { getJsonMock, putJsonMock } = vi.hoisted(() => ({
  getJsonMock: vi.fn(),
  putJsonMock: vi.fn(),
}));

vi.mock("../../../src/lib/api", () => ({
  getJson: getJsonMock,
  putJson: putJsonMock,
}));

const { getTableColumnPreferences, saveTableColumnPreferences } = await import(
  "../../../src/features/preferences/tableColumnPreferencesApi"
);

describe("tableColumnPreferencesApi", () => {
  it("loads table column preferences", async () => {
    getJsonMock.mockResolvedValueOnce({ preferences: { devices: { name: true } } });

    await expect(getTableColumnPreferences()).resolves.toEqual({ devices: { name: true } });
    expect(getJsonMock).toHaveBeenCalledWith("/api/preferences/table-columns");
  });

  it("saves table column preferences", async () => {
    const preferences = { devices: { visibility: { name: true }, order: ["name"], filters: {} } };
    putJsonMock.mockResolvedValueOnce({ preferences });

    await expect(saveTableColumnPreferences(preferences)).resolves.toBe(preferences);
    expect(putJsonMock).toHaveBeenCalledWith("/api/preferences/table-columns", { preferences });
  });
});
