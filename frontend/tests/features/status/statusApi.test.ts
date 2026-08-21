import { describe, expect, it, vi } from "vitest";

const getJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
}));

import { getDeviceStatus, getStatusOverview } from "../../../src/features/status/statusApi";

describe("statusApi", () => {
  it("getDeviceStatus GETs the device status endpoint", async () => {
    const response = { checkedAt: "2026-08-20T00:00:00.000Z" };
    getJson.mockResolvedValue(response);

    const result = await getDeviceStatus();

    expect(getJson).toHaveBeenCalledWith("/api/status");
    expect(result).toBe(response);
  });

  it("getStatusOverview GETs the status overview endpoint", async () => {
    const response = { generatedAt: "2026-08-20T00:00:00.000Z", services: [] };
    getJson.mockResolvedValue(response);

    const result = await getStatusOverview();

    expect(getJson).toHaveBeenCalledWith("/api/status/overview");
    expect(result).toBe(response);
  });
});
