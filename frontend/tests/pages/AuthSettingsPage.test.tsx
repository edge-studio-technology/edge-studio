import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AuthSettingsPage } from "../../src/pages/AuthSettingsPage";
import type { AdminCredentialType } from "../../src/features/auth/adminCredentials";

const credentialType: AdminCredentialType = "pin";
const signOut = vi.fn();
vi.mock("../../src/features/auth/hooks", () => ({
  useAuth: () => ({ user: { credentialType }, credentialType: "pin", signOut }),
}));

afterEach(() => vi.unstubAllGlobals());

it("shows the change-credential panel in the credentials section", async () => {
  render(<MemoryRouter><AuthSettingsPage /></MemoryRouter>);
  await userEvent.click(screen.getByText("Credentials"));
  expect(screen.getByText("Change PIN or password")).toBeInTheDocument();
});
