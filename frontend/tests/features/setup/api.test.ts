import { describe, expect, it, vi } from "vitest";

const postJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  postJson: (...args: unknown[]) => postJson(...args),
}));

import { completeSetup } from "../../../src/features/setup/api";

describe("setup api", () => {
  it("completeSetup POSTs the password", async () => {
    const response = { success: true, user: { displayName: "Admin" } };
    postJson.mockResolvedValue(response);

    const result = await completeSetup({ password: "s3cret!23" });

    expect(postJson).toHaveBeenCalledWith("/api/setup/complete", { password: "s3cret!23" });
    expect(result).toBe(response);
  });
});
