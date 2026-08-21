import { describe, expect, it, vi } from "vitest";

const postJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  postJson: (...args: unknown[]) => postJson(...args),
}));

import { completeSetup, initTotp, verifyTotp } from "../../../src/features/setup/api";

describe("setup api", () => {
  it("initTotp POSTs to the totp init endpoint with no body", async () => {
    const response = { qrCodePngBase64: "data:image/png;base64,abc", expiresAt: "2026-01-01T00:00:00Z", secret: "SECRET" };
    postJson.mockResolvedValue(response);

    const result = await initTotp();

    expect(postJson).toHaveBeenCalledWith("/api/setup/totp/init");
    expect(result).toBe(response);
  });

  it("verifyTotp POSTs the totp token", async () => {
    postJson.mockResolvedValue({ valid: true });

    const result = await verifyTotp("123456");

    expect(postJson).toHaveBeenCalledWith("/api/setup/totp/verify", { totpToken: "123456" });
    expect(result).toEqual({ valid: true });
  });

  it("completeSetup POSTs the password", async () => {
    const response = { success: true, user: { displayName: "Admin" } };
    postJson.mockResolvedValue(response);

    const result = await completeSetup({ password: "s3cret!23" });

    expect(postJson).toHaveBeenCalledWith("/api/setup/complete", { password: "s3cret!23" });
    expect(result).toBe(response);
  });
});
