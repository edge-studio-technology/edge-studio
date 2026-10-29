import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MinimaConsoleCatalogEntry } from "../../../src/app/types";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { MinimaConsoleWhitelistModal } from "../../../src/features/minima/MinimaConsoleWhitelistModal";

import type { AdminCredentialType } from "../../../src/features/auth/adminCredentials";

let credentialType: AdminCredentialType | null = null;
vi.mock("../../../src/features/auth/hooks", () => ({
  useAuth: () => ({ user: credentialType ? { credentialType } : null, credentialType: "pin" }),
}));

const getConsoleWhitelist = vi.fn();
const updateConsoleWhitelist = vi.fn();

vi.mock("../../../src/features/minima/minimaConsoleApi", () => ({
  getConsoleWhitelist: (...args: unknown[]) => getConsoleWhitelist(...args),
  updateConsoleWhitelist: (...args: unknown[]) => updateConsoleWhitelist(...args),
}));

const catalog: MinimaConsoleCatalogEntry[] = [
  { key: "status", verb: "status", label: "Node status", kind: "read", defaultEnabled: true },
  { key: "peers", verb: "peers", label: "Peer list", kind: "read", defaultEnabled: true },
  { key: "send", verb: "send", label: "Send funds", kind: "write", defaultEnabled: false },
];

function renderModal(onClose = vi.fn()) {
  return render(<MinimaConsoleWhitelistModal onClose={onClose} />, { wrapper: ToastProvider });
}

describe("MinimaConsoleWhitelistModal", () => {
  beforeEach(() => {
    credentialType = null;
    getConsoleWhitelist.mockReset();
    updateConsoleWhitelist.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("replaces the command list with a retryable error state when the fetch fails", async () => {
    getConsoleWhitelist
      .mockRejectedValueOnce(new Error("whitelist down"))
      .mockResolvedValueOnce({ catalog, enabledKeys: ["status"] });
    renderModal();

    expect(await screen.findByText("Command list isn't available")).toBeInTheDocument();
    expect(screen.getByText("whitelist down")).toBeInTheDocument();
    expect(screen.queryByText("Read")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Read")).toBeInTheDocument();
    expect(screen.queryByText("Command list isn't available")).not.toBeInTheDocument();
  });

  it("shows a loading state while the catalog request is in flight", () => {
    getConsoleWhitelist.mockReturnValue(new Promise(() => {}));
    renderModal();

    expect(screen.getByText("Fetching the command list")).toBeInTheDocument();
    expect(screen.queryByText("Read")).not.toBeInTheDocument();
  });

  it("renders read/write sections once loaded", async () => {
    getConsoleWhitelist.mockResolvedValue({ catalog, enabledKeys: ["status", "peers"] });
    renderModal();

    expect(await screen.findByText("Read")).toBeInTheDocument();
    expect(screen.getByText("Write")).toBeInTheDocument();
    expect(screen.getByText("status")).toBeInTheDocument();
    expect(screen.getByText("send")).toBeInTheDocument();
  });

  it("shows a load error when the whitelist fetch fails", async () => {
    getConsoleWhitelist.mockRejectedValue(new Error("whitelist down"));
    renderModal();
    expect(await screen.findByText("whitelist down")).toBeInTheDocument();
  });

  it("shows checked count and toggles a command", async () => {
    const user = userEvent.setup();
    getConsoleWhitelist.mockResolvedValue({ catalog, enabledKeys: ["status"] });
    renderModal();

    await screen.findByText("Write");
    expect(screen.getByText("1 of 2 enabled")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "peers" }));
    expect(screen.getByText("2 of 2 enabled")).toBeInTheDocument();
  });

  it("select-all toggles every command in a section", async () => {
    const user = userEvent.setup();
    getConsoleWhitelist.mockResolvedValue({ catalog, enabledKeys: [] });
    renderModal();

    await screen.findByText("Write");
    const readSelectAll = screen.getAllByRole("checkbox", { name: "Select all" })[0];
    await user.click(readSelectAll);
    expect(screen.getByText("2 of 2 enabled")).toBeInTheDocument();

    await user.click(readSelectAll);
    expect(screen.getByText("0 of 2 enabled")).toBeInTheDocument();
  });

  it("opens the confirm modal and saves the whitelist with the entered password", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    getConsoleWhitelist.mockResolvedValue({ catalog, enabledKeys: ["status"] });
    updateConsoleWhitelist.mockResolvedValue({ catalog, enabledKeys: ["status", "peers"] });
    renderModal(onClose);

    await screen.findByText("Write");
    await user.click(screen.getByRole("checkbox", { name: "peers" }));
    await user.click(screen.getByRole("button", { name: /save whitelist/i }));

    const passwordInput = screen.getByLabelText(/enter your pin or password/i);
    await user.type(passwordInput, "pin1234");
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() =>
      expect(updateConsoleWhitelist).toHaveBeenCalledWith(["status", "peers"], "pin1234"),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a save error and keeps the confirm modal open on failure", async () => {
    const user = userEvent.setup();
    getConsoleWhitelist.mockResolvedValue({ catalog, enabledKeys: ["status"] });
    updateConsoleWhitelist.mockRejectedValue(new Error("bad credential"));
    renderModal();

    await screen.findByText("Write");
    await user.click(screen.getByRole("button", { name: /save whitelist/i }));
    await user.type(screen.getByLabelText(/enter your pin or password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    expect(await screen.findByText("bad credential")).toBeInTheDocument();
  });

  it("disables Confirm until a password is entered", async () => {
    const user = userEvent.setup();
    getConsoleWhitelist.mockResolvedValue({ catalog, enabledKeys: ["status"] });
    renderModal();

    await screen.findByText("Write");
    await user.click(screen.getByRole("button", { name: /save whitelist/i }));
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeDisabled();
  });

  it.each(["pin", "password"] as const)("confirms with a %s using the existing HTTP payload and footer form", async (type) => {
    credentialType = type;
    const api = await vi.importActual<typeof import("../../../src/features/minima/minimaConsoleApi")>("../../../src/features/minima/minimaConsoleApi");
    updateConsoleWhitelist.mockImplementation(api.updateConsoleWhitelist);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ catalog, enabledKeys: ["status"] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    getConsoleWhitelist.mockResolvedValue({ catalog, enabledKeys: ["status"] });
    const onClose = vi.fn();
    renderModal(onClose);
    await screen.findByText("Write");
    await userEvent.click(screen.getByRole("button", { name: /save whitelist/i }));
    const label = type === "pin" ? "PIN" : "password";
    const input = screen.getByLabelText(`Enter your ${label}`);
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByText(`Enter your ${label} to save console command permissions.`)).toBeInTheDocument();
    if (type === "pin") {
      await userEvent.type(input, "00123");
      expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
      fireEvent.submit(input.closest("form")!);
      expect(fetchMock).not.toHaveBeenCalled();
      await userEvent.type(input, "4");
    } else await userEvent.type(input, "weak");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveAttribute("form", "minima-console-whitelist-confirm");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/minima/console/whitelist", expect.objectContaining({ method: "POST", credentials: "include",
      body: JSON.stringify({ enabledKeys: ["status"], currentPassword: type === "pin" ? "001234" : "weak" }),
    }));
  });

  it.each(["pin", "password"] as const)("keeps a rejected %s confirmation open and clears the error on edit", async (type) => {
    credentialType = type;
    getConsoleWhitelist.mockResolvedValue({ catalog, enabledKeys: ["status"] });
    updateConsoleWhitelist.mockRejectedValue(new Error("Invalid credential"));
    const onClose = vi.fn();
    renderModal(onClose);
    await screen.findByText("Write");
    await userEvent.click(screen.getByRole("button", { name: /save whitelist/i }));
    const input = screen.getByLabelText(type === "pin" ? "Enter your PIN" : "Enter your password");
    const value = type === "pin" ? "001234" : "weak";
    await userEvent.type(input, value);
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credential");
    expect(input).toHaveValue(value);
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.clear(input);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls onClose from the Cancel button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    getConsoleWhitelist.mockResolvedValue({ catalog, enabledKeys: ["status"] });
    renderModal(onClose);

    await screen.findByText("Write");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
