import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionSettingsPanel } from "../../../src/features/auth/SessionSettingsPanel";
import { ToastProvider } from "../../../src/components/ToastProvider";
import type { AdminCredentialType } from "../../../src/features/auth/adminCredentials";

let credentialType: AdminCredentialType = "pin";
const refreshSession = vi.fn();
vi.mock("../../../src/features/auth/hooks", () => ({
  useAuth: () => ({ user: { credentialType }, refreshSession }),
}));
const initial = {
  settings: { maxAgeDays: 7, idleHours: 24 },
  limits: { maxAgeDays: { min: 1, max: 30 }, idleHours: { min: 1, max: 168 } },
};
const fetchMock = vi.fn();
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
beforeEach(() => {
  credentialType = "pin";
  refreshSession.mockReset().mockResolvedValue(undefined);
  fetchMock.mockReset().mockResolvedValue(response(initial));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
function renderPanel() {
  render(<SessionSettingsPanel />, { wrapper: ToastProvider });
}

it.each([
  ["pin", "012345", "PIN"],
  ["password", "Legacypassword", "password"],
] as const)(
  "confirms with the current %s and saves numeric settings",
  async (type, credential, label) => {
    credentialType = type;
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(
        response({
          settings: { maxAgeDays: 3, idleHours: 24 },
          currentSessionExpired: false,
          revokedSessions: 0,
        }),
      );
    renderPanel();
    const days = await screen.findByLabelText("Maximum session lifetime (days)");
    expect(days).toHaveValue(7);
    expect(screen.getByText(/background polling counts as activity/)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Confirm and save session settings" });
    expect(button).toBeDisabled();
    await user.clear(days);
    await user.type(days, "3");
    const password = screen.getByLabelText(`Confirm current ${label}`);
    expect(password).toHaveAttribute("autocomplete", "current-password");
    await user.type(password, credential);
    await user.click(button);
    await screen.findByText("Session settings saved");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      settings: { maxAgeDays: 3, idleHours: 24 },
      currentPassword: credential,
    });
    expect(password).toHaveValue("");
    expect(refreshSession).not.toHaveBeenCalled();
  },
);

it("rejects invalid limits without a request", async () => {
  const user = userEvent.setup();
  renderPanel();
  const days = await screen.findByLabelText("Maximum session lifetime (days)");
  await user.clear(days);
  await user.type(days, "31");
  await user.type(screen.getByLabelText("Confirm current PIN"), "012345");
  await user.click(screen.getByRole("button", { name: "Confirm and save session settings" }));
  expect(screen.getByText("Enter a whole number from 1 to 30.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("keeps edited limits and clears the credential after a rejected confirmation", async () => {
  const user = userEvent.setup();
  fetchMock
    .mockResolvedValueOnce(response(initial))
    .mockResolvedValueOnce(response({ error: "Invalid current PIN or password." }, 403));
  renderPanel();
  await screen.findByLabelText("Maximum session lifetime (days)");
  const idle = screen.getByLabelText("Session inactivity timeout (hours)");
  await user.clear(idle);
  await user.type(idle, "2");
  await user.type(screen.getByLabelText("Confirm current PIN"), "999999");
  await user.click(screen.getByRole("button", { name: "Confirm and save session settings" }));
  await screen.findByText("Invalid current PIN or password.");
  expect(idle).toHaveValue(2);
  expect(screen.getByLabelText("Confirm current PIN")).toHaveValue("");
  expect(refreshSession).not.toHaveBeenCalled();
});

it("refreshes authentication when a successful change expires the caller", async () => {
  const user = userEvent.setup();
  fetchMock
    .mockResolvedValueOnce(response(initial))
    .mockResolvedValueOnce(
      response({ settings: initial.settings, revokedSessions: 1, currentSessionExpired: true }),
    );
  renderPanel();
  await screen.findByLabelText("Maximum session lifetime (days)");
  await user.type(screen.getByLabelText("Confirm current PIN"), "012345");
  await user.click(screen.getByRole("button", { name: "Confirm and save session settings" }));
  await screen.findByText("Your session has expired under the new limits. Log in again.");
  expect(refreshSession).toHaveBeenCalledTimes(1);
});

it("offers retry when settings cannot be loaded", async () => {
  const user = userEvent.setup();
  fetchMock.mockRejectedValueOnce(new Error("Settings unavailable"));
  renderPanel();
  await screen.findByText("Settings unavailable");
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByLabelText("Maximum session lifetime (days)")).toHaveValue(7);
});
