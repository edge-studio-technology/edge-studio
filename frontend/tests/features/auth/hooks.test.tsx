import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, useAuth } from "../../../src/features/auth/hooks";
import type { AuthUser } from "../../../src/features/auth/types";

describe("useAuth", () => {
  it("throws when used outside an AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow("useAuth must be used within AuthProvider");
  });

  it("returns the provided context value", () => {
    const user: AuthUser = {
      displayName: "Admin",
      role: "admin",
      credentialType: "pin",
    };
    const value = {
      user,
      loading: false,
      showSetup: false,
      showLogin: false,
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    };

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthContext.Provider value={value}>{children}</AuthContext.Provider>,
    });

    expect(result.current).toBe(value);
  });
});
