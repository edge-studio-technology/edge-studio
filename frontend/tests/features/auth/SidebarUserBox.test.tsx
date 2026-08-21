import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SidebarUserBox } from "../../../src/features/auth/SidebarUserBox";
import type { AuthUser } from "../../../src/features/auth/types";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return { displayName: "Admin", role: "admin", credentialType: "pin", ...overrides };
}

describe("SidebarUserBox", () => {
  it("shows the user's display name and account settings hint", () => {
    render(<SidebarUserBox user={user({ displayName: "Rowel" })} onSignOut={vi.fn()} onSettings={vi.fn()} />);

    expect(screen.getByText("Rowel")).toBeInTheDocument();
    expect(screen.getByText("Account settings")).toBeInTheDocument();
  });

  it("calls onSettings when the account button is clicked", async () => {
    const onSettings = vi.fn();
    render(<SidebarUserBox user={user()} onSignOut={vi.fn()} onSettings={onSettings} />);

    await userEvent.click(screen.getByText("Admin"));

    expect(onSettings).toHaveBeenCalled();
  });

  it("calls onSignOut when the sign-out button is clicked", async () => {
    const onSignOut = vi.fn();
    render(<SidebarUserBox user={user()} onSignOut={onSignOut} onSettings={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Sign out/ }));

    expect(onSignOut).toHaveBeenCalled();
  });

  it("does not show a 2FA badge since TOTP is currently disabled", () => {
    render(<SidebarUserBox user={user()} onSignOut={vi.fn()} onSettings={vi.fn()} />);

    expect(screen.queryByText("2FA protected")).not.toBeInTheDocument();
  });
});
