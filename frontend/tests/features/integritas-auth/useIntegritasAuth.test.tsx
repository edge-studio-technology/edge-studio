import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getIntegritasAuthStatus = vi.fn();
const getIntegritasUserProfile = vi.fn();
const startIntegritasConnect = vi.fn();

vi.mock("../../../src/features/integritas-auth/integritasAuthApi", () => ({
  getIntegritasAuthStatus: (...args: unknown[]) => getIntegritasAuthStatus(...args),
  getIntegritasUserProfile: (...args: unknown[]) => getIntegritasUserProfile(...args),
  startIntegritasConnect: (...args: unknown[]) => startIntegritasConnect(...args),
}));

import { useIntegritasAuth } from "../../../src/features/integritas-auth/useIntegritasAuth";

function fakePopup() {
  return {
    closed: false,
    focus: vi.fn(),
    close: vi.fn(),
    location: { href: "" },
  };
}

describe("useIntegritasAuth", () => {
  beforeEach(() => {
    getIntegritasAuthStatus.mockReset();
    getIntegritasUserProfile.mockReset();
    startIntegritasConnect.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("loads status on mount when enabled", async () => {
    getIntegritasAuthStatus.mockResolvedValue({ status: "unauthenticated" });

    const { result } = renderHook(() => useIntegritasAuth());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toEqual({ status: "unauthenticated" });
    expect(getIntegritasAuthStatus).toHaveBeenCalledTimes(1);
  });

  it("does not load status when disabled", async () => {
    const { result } = renderHook(() => useIntegritasAuth({ enabled: false }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(getIntegritasAuthStatus).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });

  it("polls status every 5s while pending", async () => {
    vi.useFakeTimers();
    getIntegritasAuthStatus.mockResolvedValue({
      status: "pending",
      userCode: "ABC-123",
      verificationUrl: "https://connect/verify",
      expiresAt: "2026-01-01",
    });

    const { result } = renderHook(() => useIntegritasAuth());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status?.status).toBe("pending");
    expect(getIntegritasAuthStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(getIntegritasAuthStatus).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(getIntegritasAuthStatus).toHaveBeenCalledTimes(3);
  });

  it("does not poll once status is a terminal state", async () => {
    vi.useFakeTimers();
    getIntegritasAuthStatus.mockResolvedValue({ status: "connected" });

    renderHook(() => useIntegritasAuth());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getIntegritasAuthStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(getIntegritasAuthStatus).toHaveBeenCalledTimes(1);
  });

  it("sets an error message when the status fetch fails", async () => {
    getIntegritasAuthStatus.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useIntegritasAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("boom");
    expect(result.current.status).toBeNull();
  });

  it("clears status and shows the reconnect message when the status fetch hits a token decrypt failure", async () => {
    const decryptError = Object.assign(new Error("bad token"), { errorCode: "TOKEN_DECRYPT_FAILED" });
    getIntegritasAuthStatus.mockRejectedValueOnce(decryptError).mockResolvedValueOnce({ status: "unauthenticated" });

    const { result } = renderHook(() => useIntegritasAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.status).toEqual({ status: "unauthenticated" });
    expect(result.current.error).toBe("bad token");
    expect(getIntegritasAuthStatus).toHaveBeenCalledTimes(2);
  });

  it("falls back to unauthenticated when the post-decrypt-failure status re-fetch also fails", async () => {
    const decryptError = Object.assign(new Error("bad token"), { errorCode: "TOKEN_DECRYPT_FAILED" });
    getIntegritasAuthStatus.mockRejectedValueOnce(decryptError).mockRejectedValueOnce(new Error("still down"));

    const { result } = renderHook(() => useIntegritasAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.status).toEqual({ status: "unauthenticated" });
  });

  describe("refreshProfileOnConnected", () => {
    it("enriches a connected status with profile data", async () => {
      getIntegritasAuthStatus.mockResolvedValue({ status: "connected" });
      getIntegritasUserProfile.mockResolvedValue({
        user: { name: "Ada", email: "ada@example.com" },
        plan: { name: "Pro", status: "active" },
        usage: { remaining: 10 },
        devices: [],
        fetchedAt: "2026-01-01",
      });

      const { result } = renderHook(() => useIntegritasAuth({ refreshProfileOnConnected: true }));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.status).toEqual({
        status: "connected",
        user: { name: "Ada", email: "ada@example.com" },
        plan: { name: "Pro", status: "active" },
        usage: { remaining: 10 },
        fetchedAt: "2026-01-01",
      });
      expect(getIntegritasUserProfile).toHaveBeenCalledWith({ refresh: true });
      expect(result.current.notice).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("shows a stale-cache notice without an error when the profile is stale", async () => {
      getIntegritasAuthStatus.mockResolvedValue({ status: "connected" });
      getIntegritasUserProfile.mockResolvedValue({
        user: { name: "Ada", email: "ada@example.com" },
        plan: { name: "Pro", status: "active" },
        usage: { remaining: 10 },
        devices: [],
        fetchedAt: "2026-01-01",
        stale: true,
      });

      const { result } = renderHook(() => useIntegritasAuth({ refreshProfileOnConnected: true }));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.notice).toBe(
        "Showing last saved profile — Integritas Connect is unreachable right now.",
      );
      expect(result.current.error).toBeNull();
      expect(result.current.status).toMatchObject({ status: "connected", user: { name: "Ada", email: "ada@example.com" } });
    });

    it("clears connect status and surfaces an error when the profile fetch hits a token decrypt failure", async () => {
      getIntegritasAuthStatus
        .mockResolvedValueOnce({ status: "connected" })
        .mockResolvedValueOnce({ status: "unauthenticated" });
      const decryptError = Object.assign(new Error("decrypt failed"), { errorCode: "TOKEN_DECRYPT_FAILED" });
      getIntegritasUserProfile.mockRejectedValue(decryptError);

      const { result } = renderHook(() => useIntegritasAuth({ refreshProfileOnConnected: true }));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.status).toEqual({ status: "unauthenticated" });
      expect(result.current.error).toBe("decrypt failed");
      expect(result.current.notice).toBeNull();
    });

    it("re-reads status when the profile fetch fails for a non-token-decrypt reason", async () => {
      getIntegritasAuthStatus
        .mockResolvedValueOnce({ status: "connected" })
        .mockResolvedValueOnce({ status: "connected" });
      getIntegritasUserProfile.mockRejectedValue(new Error("network down"));

      const { result } = renderHook(() => useIntegritasAuth({ refreshProfileOnConnected: true }));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(getIntegritasAuthStatus).toHaveBeenCalledTimes(2);
      expect(result.current.status).toEqual({ status: "connected" });
      expect(result.current.error).toBeNull();
    });
  });

  describe("start", () => {
    it("starts activation and sets pending status without opening a popup by default", async () => {
      getIntegritasAuthStatus.mockResolvedValue({ status: "unauthenticated" });
      startIntegritasConnect.mockResolvedValue({
        userCode: "ABC-123",
        verificationUrl: "https://connect/verify",
        expiresAt: "2026-01-01",
        status: "pending",
      });
      const openSpy = vi.fn();
      vi.stubGlobal("open", openSpy);

      const { result } = renderHook(() => useIntegritasAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.start();
      });

      expect(openSpy).not.toHaveBeenCalled();
      expect(result.current.status).toEqual({
        status: "pending",
        userCode: "ABC-123",
        verificationUrl: "https://connect/verify",
        expiresAt: "2026-01-01",
      });
      expect(result.current.starting).toBe(false);
    });

    it("opens a placeholder popup and navigates it to the verification url when openPopup is requested", async () => {
      getIntegritasAuthStatus.mockResolvedValue({ status: "unauthenticated" });
      startIntegritasConnect.mockResolvedValue({
        userCode: "ABC-123",
        verificationUrl: "https://connect/verify",
        expiresAt: "2026-01-01",
        status: "pending",
      });
      const popup = fakePopup();
      const openSpy = vi.fn().mockReturnValue(popup);
      vi.stubGlobal("open", openSpy);

      const { result } = renderHook(() => useIntegritasAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.start({ openPopup: true });
      });

      expect(openSpy).toHaveBeenCalledWith("about:blank", "integritas-device-activate", expect.any(String));
      expect(popup.location.href).toBe("https://connect/verify");
      expect(popup.focus).toHaveBeenCalled();
    });

    it("opens the verification url directly when the placeholder popup was blocked", async () => {
      getIntegritasAuthStatus.mockResolvedValue({ status: "unauthenticated" });
      startIntegritasConnect.mockResolvedValue({
        userCode: "ABC-123",
        verificationUrl: "https://connect/verify",
        expiresAt: "2026-01-01",
        status: "pending",
      });
      const openSpy = vi.fn().mockReturnValue(null);
      vi.stubGlobal("open", openSpy);

      const { result } = renderHook(() => useIntegritasAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.start({ openPopup: true });
      });

      expect(openSpy).toHaveBeenCalledTimes(2);
      expect(openSpy).toHaveBeenNthCalledWith(
        2,
        "https://connect/verify",
        "integritas-device-activate",
        expect.any(String),
      );
    });

    it("closes the placeholder popup and sets an error when starting fails", async () => {
      getIntegritasAuthStatus.mockResolvedValue({ status: "unauthenticated" });
      startIntegritasConnect.mockRejectedValue(new Error("start failed"));
      const popup = fakePopup();
      vi.stubGlobal("open", vi.fn().mockReturnValue(popup));

      const { result } = renderHook(() => useIntegritasAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.start({ openPopup: true });
      });

      expect(popup.close).toHaveBeenCalled();
      expect(result.current.error).toBe("start failed");
      expect(result.current.starting).toBe(false);
    });

    it("sets an error without touching any popup when starting fails without openPopup", async () => {
      getIntegritasAuthStatus.mockResolvedValue({ status: "unauthenticated" });
      startIntegritasConnect.mockRejectedValue(new Error("start failed"));
      const openSpy = vi.fn();
      vi.stubGlobal("open", openSpy);

      const { result } = renderHook(() => useIntegritasAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.start();
      });

      expect(openSpy).not.toHaveBeenCalled();
      expect(result.current.error).toBe("start failed");
    });
  });

  describe("openVerification", () => {
    it("returns false and does not open a window when status is not pending", async () => {
      getIntegritasAuthStatus.mockResolvedValue({ status: "unauthenticated" });
      const openSpy = vi.fn();
      vi.stubGlobal("open", openSpy);

      const { result } = renderHook(() => useIntegritasAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let opened: boolean | undefined;
      act(() => {
        opened = result.current.openVerification();
      });

      expect(opened).toBe(false);
      expect(openSpy).not.toHaveBeenCalled();
    });

    it("opens the verification url and returns true when status is pending", async () => {
      getIntegritasAuthStatus.mockResolvedValue({
        status: "pending",
        userCode: "ABC-123",
        verificationUrl: "https://connect/verify",
        expiresAt: "2026-01-01",
      });
      const popup = fakePopup();
      const openSpy = vi.fn().mockReturnValue(popup);
      vi.stubGlobal("open", openSpy);

      const { result } = renderHook(() => useIntegritasAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let opened: boolean | undefined;
      act(() => {
        opened = result.current.openVerification();
      });

      expect(opened).toBe(true);
      expect(openSpy).toHaveBeenCalledWith("https://connect/verify", "integritas-device-activate", expect.any(String));
    });
  });

  it("closes a remembered popup once the status becomes connected", async () => {
    getIntegritasAuthStatus
      .mockResolvedValueOnce({
        status: "pending",
        userCode: "ABC-123",
        verificationUrl: "https://connect/verify",
        expiresAt: "2026-01-01",
      })
      .mockResolvedValueOnce({ status: "connected" });
    const popup = fakePopup();
    vi.stubGlobal("open", vi.fn().mockReturnValue(popup));

    const { result } = renderHook(() => useIntegritasAuth());
    await waitFor(() => expect(result.current.status?.status).toBe("pending"));

    act(() => {
      result.current.openVerification();
    });
    expect(popup.close).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status).toEqual({ status: "connected" });
    expect(popup.close).toHaveBeenCalled();
  });
});
