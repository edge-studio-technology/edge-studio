import { describe, expect, it, vi } from "vitest";

const getJson = vi.fn();
const postJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
}));

import { getUpdateStatus, getUpdateStatusSummary, startUpdateApply } from "../../../src/features/update/updateApi";

describe("updateApi", () => {
  it("getUpdateStatusSummary GETs the cached status-summary endpoint", async () => {
    const response = { checkedAt: "2026-08-20T00:00:00.000Z", services: [], currentVersion: "1.0.0", availableVersion: "1.1.0" };
    getJson.mockResolvedValue(response);

    const result = await getUpdateStatusSummary();

    expect(getJson).toHaveBeenCalledWith("/update/status/summary");
    expect(result).toBe(response);
  });

  it("getUpdateStatus GETs the live status endpoint", async () => {
    const response = {
      manifest: { frontend: "sha256:a", backend: "sha256:b", updateAgent: "sha256:c", version: "1.1.0", createdAt: "2026-08-20T00:00:00.000Z" },
      services: [],
      currentVersion: "1.0.0",
    };
    getJson.mockResolvedValue(response);

    const result = await getUpdateStatus();

    expect(getJson).toHaveBeenCalledWith("/update/status");
    expect(result).toBe(response);
  });

  it("startUpdateApply POSTs the apply endpoint", async () => {
    const response = { status: "running" as const };
    postJson.mockResolvedValue(response);

    const result = await startUpdateApply();

    expect(postJson).toHaveBeenCalledWith("/update/apply");
    expect(result).toBe(response);
  });
});
