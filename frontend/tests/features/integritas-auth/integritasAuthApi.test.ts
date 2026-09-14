import { describe, expect, it, vi } from "vitest";

const getJson = vi.fn();
const postJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
}));

import {
  getIntegritasAuthStatus,
  getIntegritasUserProfile,
  hasConnectedProfile,
  startIntegritasConnect,
  type IntegritasAuthStatus,
} from "../../../src/features/integritas-auth/integritasAuthApi";

describe("hasConnectedProfile", () => {
  it("returns true when user/plan/usage/fetchedAt are all present", () => {
    const status: Extract<IntegritasAuthStatus, { status: "connected" }> = {
      status: "connected",
      user: { name: "Ada", email: "ada@example.com" },
      plan: { name: "Pro", status: "active" },
      usage: { remaining: 10 },
      fetchedAt: "2026-01-01",
    };
    expect(hasConnectedProfile(status)).toBe(true);
  });

  it("returns false when profile fields are missing", () => {
    const status: Extract<IntegritasAuthStatus, { status: "connected" }> = { status: "connected" };
    expect(hasConnectedProfile(status)).toBe(false);
  });

  it("returns false when only some profile fields are present", () => {
    const status: Extract<IntegritasAuthStatus, { status: "connected" }> = {
      status: "connected",
      user: { name: "Ada", email: "ada@example.com" },
    };
    expect(hasConnectedProfile(status)).toBe(false);
  });
});

describe("getIntegritasAuthStatus", () => {
  it("GETs the connect status and returns its data", async () => {
    const data: IntegritasAuthStatus = { status: "unauthenticated" };
    getJson.mockResolvedValue({ success: true, data });

    const result = await getIntegritasAuthStatus();

    expect(getJson).toHaveBeenCalledWith("/api/auth/connect/status");
    expect(result).toBe(data);
  });
});

describe("startIntegritasConnect", () => {
  it("POSTs with no body when no device name is given", async () => {
    const data = { userCode: "ABC-123", verificationUrl: "https://x", expiresAt: "t", status: "pending" as const };
    postJson.mockResolvedValue({ success: true, data });

    const result = await startIntegritasConnect();

    expect(postJson).toHaveBeenCalledWith("/api/auth/connect/start", {});
    expect(result).toBe(data);
  });

  it("POSTs the device name when given", async () => {
    postJson.mockResolvedValue({
      success: true,
      data: { userCode: "ABC-123", verificationUrl: "https://x", expiresAt: "t", status: "pending" as const },
    });

    await startIntegritasConnect("Edge Studio Pi");

    expect(postJson).toHaveBeenCalledWith("/api/auth/connect/start", { deviceName: "Edge Studio Pi" });
  });
});

describe("getIntegritasUserProfile", () => {
  it("GETs the profile with no query string by default", async () => {
    const data = {
      user: { name: "Ada", email: "ada@example.com" },
      plan: { name: "Pro", status: "active" },
      usage: { remaining: 10 },
      devices: [],
      fetchedAt: "2026-01-01",
    };
    getJson.mockResolvedValue({ success: true, data });

    const result = await getIntegritasUserProfile();

    expect(getJson).toHaveBeenCalledWith("/api/user/profile");
    expect(result).toBe(data);
  });

  it("appends ?refresh=1 when refresh is requested", async () => {
    getJson.mockResolvedValue({
      success: true,
      data: {
        user: { name: "Ada", email: "ada@example.com" },
        plan: { name: "Pro", status: "active" },
        usage: { remaining: 10 },
        devices: [],
        fetchedAt: "2026-01-01",
      },
    });

    await getIntegritasUserProfile({ refresh: true });

    expect(getJson).toHaveBeenCalledWith("/api/user/profile?refresh=1");
  });

  it("omits the query string when refresh is explicitly false", async () => {
    getJson.mockResolvedValue({
      success: true,
      data: {
        user: { name: "Ada", email: "ada@example.com" },
        plan: { name: "Pro", status: "active" },
        usage: { remaining: 10 },
        devices: [],
        fetchedAt: "2026-01-01",
      },
    });

    await getIntegritasUserProfile({ refresh: false });

    expect(getJson).toHaveBeenCalledWith("/api/user/profile");
  });
});
