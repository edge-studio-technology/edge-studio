import { describe, expect, it, vi } from "vitest";

const getJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
}));

import { getDebugPing } from "../../../src/features/debug/debugApi";

describe("debugApi", () => {
  it("getDebugPing GETs the debug ping endpoint", async () => {
    const response = { message: "pong" };
    getJson.mockResolvedValue(response);

    const result = await getDebugPing();

    expect(getJson).toHaveBeenCalledWith("/api/debug/ping");
    expect(result).toBe(response);
  });
});
