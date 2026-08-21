import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MinimaConsoleCatalogEntry } from "../../../src/app/types";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { MinimaConsoleWhitelistModal } from "../../../src/features/minima/MinimaConsoleWhitelistModal";

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
    getConsoleWhitelist.mockReset();
    updateConsoleWhitelist.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading state, then renders read/write sections once loaded", async () => {
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
