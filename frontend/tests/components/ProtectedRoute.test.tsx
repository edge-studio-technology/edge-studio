import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthContext, type AuthContextValue } from "../../src/features/auth/hooks";
import { ProtectedRoute } from "../../src/components/ProtectedRoute";

// AuthProvider does its own network calls on mount (getSetupStatus/getMe), so per the
// plan's provider-testing convention this test supplies a minimal AuthContext value
// directly rather than mocking that network boundary just to reach ProtectedRoute.
function renderWithAuth(user: AuthContextValue["user"]) {
  const value: AuthContextValue = {
    user,
    loading: false,
    showSetup: false,
    showLogin: false,
    signOut: async () => {},
    refreshSession: async () => {},
  };

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <p>Protected content</p>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("ProtectedRoute", () => {
  it("renders children when a user is present", () => {
    renderWithAuth({ displayName: "Admin", role: "admin", credentialType: "password" });
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("redirects to /login when there is no user", () => {
    renderWithAuth(null);
    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });
});
