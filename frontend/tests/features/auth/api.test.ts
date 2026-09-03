import { describe, expect, it, vi } from "vitest";

const getJson = vi.fn();
const postJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
}));

import {
  changePassword,
  getMe,
  getSetupStatus,
  initTotpReset,
  login,
  logout,
  verifyTotpReset,
} from "../../../src/features/auth/api";

describe("auth api", () => {
  it("getSetupStatus GETs setup status", async () => {
    const status = { localAdminCreated: true, setupComplete: true };
    getJson.mockResolvedValue(status);

    const result = await getSetupStatus();

    expect(getJson).toHaveBeenCalledWith("/api/setup/status");
    expect(result).toBe(status);
  });

  it("getMe GETs the current user", async () => {
    const user = { displayName: "Admin", role: "admin", credentialType: "pin" };
    getJson.mockResolvedValue(user);

    const result = await getMe();

    expect(getJson).toHaveBeenCalledWith("/api/auth/me");
    expect(result).toBe(user);
  });

  it("login POSTs credentials", async () => {
    const response = { success: true, user: { displayName: "Admin", role: "admin", credentialType: "pin" } };
    postJson.mockResolvedValue(response);

    const result = await login({ password: "123456" });

    expect(postJson).toHaveBeenCalledWith("/api/auth/login", { password: "123456" });
    expect(result).toBe(response);
  });

  it("login includes an optional totpToken", async () => {
    postJson.mockResolvedValue({ success: true, user: {} });

    await login({ password: "123456", totpToken: "000000" });

    expect(postJson).toHaveBeenCalledWith("/api/auth/login", {
      password: "123456",
      totpToken: "000000",
    });
  });

  it("logout POSTs with no body", async () => {
    postJson.mockResolvedValue({ success: true });

    const result = await logout();

    expect(postJson).toHaveBeenCalledWith("/api/auth/logout");
    expect(result).toEqual({ success: true });
  });

  it("changePassword POSTs current/new credentials", async () => {
    postJson.mockResolvedValue({ success: true });

    const result = await changePassword({ currentPassword: "old", newPassword: "new" });

    expect(postJson).toHaveBeenCalledWith("/api/auth/settings/password", {
      currentPassword: "old",
      newPassword: "new",
    });
    expect(result).toEqual({ success: true });
  });

  it("initTotpReset POSTs current password and totp token", async () => {
    const response = { qrCodePngBase64: "abc", secret: "s", expiresAt: "now" };
    postJson.mockResolvedValue(response);

    const result = await initTotpReset({ currentPassword: "old", totpToken: "000000" });

    expect(postJson).toHaveBeenCalledWith("/api/auth/settings/totp/init", {
      currentPassword: "old",
      totpToken: "000000",
    });
    expect(result).toBe(response);
  });

  it("verifyTotpReset POSTs the totp token", async () => {
    postJson.mockResolvedValue({ success: true });

    const result = await verifyTotpReset({ totpToken: "000000" });

    expect(postJson).toHaveBeenCalledWith("/api/auth/settings/totp/verify", { totpToken: "000000" });
    expect(result).toEqual({ success: true });
  });
});
