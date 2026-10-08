import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthSettingsPage } from "../../src/pages/AuthSettingsPage";
import type { AdminCredentialType } from "../../src/features/auth/adminCredentials";

let credentialType: AdminCredentialType = "pin";
const signOut = vi.fn();
vi.mock("../../src/features/auth/hooks", () => ({
  useAuth: () => ({ user: { credentialType }, credentialType: "pin", signOut }),
}));

afterEach(() => vi.unstubAllGlobals());

it("keeps authenticator reset behind the existing disabled gate", async () => {
  render(<MemoryRouter><AuthSettingsPage /></MemoryRouter>);
  await userEvent.click(screen.getByText("Credentials"));
  expect(screen.queryByText("Reset two-factor authentication")).not.toBeInTheDocument();
});

describe("AuthSettingsPage with authenticator reset enabled", () => {
  let TotpSettingsPage: typeof AuthSettingsPage;
  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("../../src/features/auth/totpEnabled", () => ({ TOTP_ENABLED: true }));
    ({ AuthSettingsPage: TotpSettingsPage } = await import("../../src/pages/AuthSettingsPage"));
  });
  afterAll(() => {
    vi.doUnmock("../../src/features/auth/totpEnabled");
    vi.resetModules();
  });

  it.each((["pin", "password"] as const).flatMap((type) => [false, true].map((reject) => ({ type, reject }))))(
    "resets using $type (rejected=$reject) with a separate authenticator code",
    async ({ type, reject }) => {
      credentialType = type;
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(reject
        ? { error: "Invalid credential", errorCode: "AUTH_BAD_PASSWORD" }
        : { qrCodePngBase64: "data:image/png;base64,AAAA", secret: "secret", expiresAt: "later" }),
      { status: reject ? 401 : 200 }));
      vi.stubGlobal("fetch", fetchMock);
      render(<MemoryRouter><TotpSettingsPage /></MemoryRouter>);
      await userEvent.click(screen.getByText("Credentials"));
      const reset = within(screen.getByRole("heading", { name: "Reset two-factor authentication" }).parentElement!);
      const current = reset.getByLabelText(type === "pin" ? "Current PIN" : "Current password");
      expect(current).toHaveAttribute("type", "password");
      expect(current).toHaveAttribute("autocomplete", "current-password");
      const code = reset.getByLabelText("Current 2FA code");
      expect(code).toHaveAttribute("type", "text");
      expect(code).toHaveAttribute("autocomplete", "one-time-code");
      const submit = reset.getByRole("button", { name: "Start 2FA reset" });
      if (type === "pin") {
        await userEvent.type(current, "00123");
        await userEvent.type(code, "000000");
        expect(submit).toBeDisabled();
        fireEvent.submit(current.closest("form")!);
        expect(fetchMock).not.toHaveBeenCalled();
        await userEvent.type(current, "4");
      } else {
        await userEvent.type(current, "weak");
        await userEvent.type(code, "00000");
        expect(submit).toBeDisabled();
        await userEvent.type(code, "0");
      }
      expect(fetchMock).not.toHaveBeenCalled();
      await userEvent.click(submit);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/settings/totp/init", expect.objectContaining({
        method: "POST", credentials: "include", body: JSON.stringify({ currentPassword: type === "pin" ? "001234" : "weak", totpToken: "000000" }),
      }));
      if (reject) {
        expect(await reset.findByText("Invalid credential")).toBeInTheDocument();
        expect(current).toHaveValue(type === "pin" ? "001234" : "weak");
        expect(code).toHaveValue("000000");
      } else expect(await screen.findByAltText("TOTP QR code")).toBeInTheDocument();
    },
  );
});
