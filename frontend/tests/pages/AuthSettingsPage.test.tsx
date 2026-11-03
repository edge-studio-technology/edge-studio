import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AuthSettingsPage } from "../../src/pages/AuthSettingsPage";
import { ToastProvider } from "../../src/components/ToastProvider";
import type { AdminCredentialType } from "../../src/features/auth/adminCredentials";

const credentialType: AdminCredentialType = "pin";
const signOut = vi.fn();
vi.mock("../../src/features/storage-history/RetentionSettingsPanel", () => ({ RetentionSettingsPanel: () => null }));
vi.mock("../../src/features/auth/hooks", () => ({
  useAuth: () => ({ user: { credentialType }, credentialType: "pin", signOut }),
}));

afterEach(() => vi.unstubAllGlobals());

it("loads the storage inventory only after opening the storage history section", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    totalBytes: 1024,
    database: { databaseBytes: 1024, walBytes: 0, sharedMemoryBytes: 0, tableAllocationAvailable: true },
    categories: [{
      id: "minima-history",
      label: "Minima history",
      description: "Synced wallet transactions.",
      lifecycle: "Kept until manually removed.",
      recordCount: 2,
      databaseBytes: 512,
      fileCount: null,
      fileBytes: null,
    }],
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  render(<MemoryRouter><AuthSettingsPage /></MemoryRouter>, { wrapper: ToastProvider });
  expect(fetchMock).not.toHaveBeenCalled();

  await userEvent.click(screen.getByText("Storage & history"));

  expect(await screen.findByText("Managed application storage")).toBeInTheDocument();
  expect(screen.getByText("Minima history")).toBeInTheDocument();
  expect(screen.getByText("2 records · 512 B in database")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith("/api/storage-history/inventory", { credentials: "include" });
});

it("shows the change-credential panel in the credentials section", async () => {
  render(<MemoryRouter><AuthSettingsPage /></MemoryRouter>, { wrapper: ToastProvider });
  await userEvent.click(screen.getByText("Credentials"));
  expect(screen.getByText("Change PIN or password")).toBeInTheDocument();
});

it("copies the selected uninstall mode and resets to the keep-data command when switched back", async () => {
  const user = userEvent.setup();
  const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  const command = "curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/uninstall.sh | sudo bash";
  render(<MemoryRouter><AuthSettingsPage /></MemoryRouter>, { wrapper: ToastProvider });

  expect(screen.getByRole("tab", { name: "Keep data" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText(command)).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Delete data" }));
  expect(screen.getByText(/Permanently delete configured data/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Copy to clipboard" }));
  expect(copy).toHaveBeenLastCalledWith(`${command} -s -- --delete-data`);

  await user.click(screen.getByRole("tab", { name: "Keep data" }));
  await user.click(screen.getByRole("button", { name: "Copy to clipboard" }));
  expect(copy).toHaveBeenLastCalledWith(command);
  copy.mockRestore();
});
