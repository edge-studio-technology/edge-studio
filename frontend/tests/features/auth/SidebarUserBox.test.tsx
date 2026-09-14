import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

/** `TOTP_ENABLED` ships as `false`, so the 2FA badge only renders with the module mocked. */
describe("SidebarUserBox with TOTP enabled", () => {
  let TotpSidebarUserBox: typeof SidebarUserBox;

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("../../../src/features/auth/totpEnabled", () => ({ TOTP_ENABLED: true }));
    ({ SidebarUserBox: TotpSidebarUserBox } = await import(
      "../../../src/features/auth/SidebarUserBox"
    ));
  });

  afterAll(() => {
    vi.doUnmock("../../../src/features/auth/totpEnabled");
    vi.resetModules();
  });

  it("shows the 2FA protected badge", () => {
    render(<TotpSidebarUserBox user={user()} onSignOut={vi.fn()} onSettings={vi.fn()} />);

    expect(screen.getByText("2FA protected")).toBeInTheDocument();
  });
});
