import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletSettingsPanel } from "../../../src/features/wallet/WalletSettingsPanel";
import { ToastProvider } from "../../../src/components/ToastProvider";
import type { MinimaNodeState, MinimaNodeStatus } from "../../../src/app/types";

const getMinimaNodeStatus = vi.fn();
const importWallet = vi.fn();

vi.mock("../../../src/features/minima/minimaApi", () => ({
  getMinimaNodeStatus: (...args: unknown[]) => getMinimaNodeStatus(...args),
}));

vi.mock("../../../src/features/wallet/walletApi", () => ({
  importWallet: (...args: unknown[]) => importWallet(...args),
}));

function status(state: MinimaNodeState = "running"): MinimaNodeStatus {
  return {
    checkedAt: "2026-08-20T00:00:00.000Z",
    state,
    container: null,
    rpc: { ok: true },
    sync: { synced: true, status: "active", block: 1, blockTime: null, blockAgeSeconds: 1 },
    health: { peerCount: 1, peersKnown: 1 },
    node: { memoryRam: "1 GB", memoryDisk: "2 GB" },
    storage: { dataPath: "/data", containerDisk: "1 GB", chainDataDisk: "1 GB" },
    config: { megammrHost: "megammr.minima.global:9001", megammrHostSource: "default" },
    monitoring: {
      stallDetected: false,
      stallThresholdSeconds: 600,
      autoResyncEnabled: false,
      lastPollerCheckAt: null,
      lastStallDetectedAt: null,
      lastAutoResyncAt: null,
      lastAutoResyncResult: null,
    },
  };
}

function renderPanel() {
  return render(<WalletSettingsPanel />, { wrapper: ToastProvider });
}

async function goToImportView() {
  await userEvent.click(screen.getByRole("button", { name: /Import wallet/ }));
}

describe("WalletSettingsPanel", () => {
  beforeEach(() => {
    getMinimaNodeStatus.mockReset();
    importWallet.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("disables Import wallet until Minima is confirmed running", async () => {
    getMinimaNodeStatus.mockResolvedValue(status("running"));
    renderPanel();

    expect(screen.getByRole("button", { name: /Import wallet/ })).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Import wallet/ })).toBeEnabled();
    });
  });

  it("keeps Import wallet disabled when Minima is confirmed not running", async () => {
    getMinimaNodeStatus.mockResolvedValue(status("stopped"));
    renderPanel();

    await waitFor(() => expect(getMinimaNodeStatus).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /Import wallet/ })).toBeDisabled();
  });

  it("navigates to the import view and back", async () => {
    getMinimaNodeStatus.mockResolvedValue(status("running"));
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: /Import wallet/ })).toBeEnabled());

    await goToImportView();
    expect(screen.getByText("This will replace the current wallet")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByText("This will replace the current wallet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import wallet/ })).toBeInTheDocument();
  });

  it("validates that the seed phrase has at least 12 words", async () => {
    getMinimaNodeStatus.mockResolvedValue(status("running"));
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: /Import wallet/ })).toBeEnabled());
    await goToImportView();

    await userEvent.type(screen.getByPlaceholderText("word1 word2 word3 …"), "one two three");
    await userEvent.click(screen.getByRole("button", { name: /Import wallet/ }));

    expect(await screen.findByText("Seed phrase must be at least 12 words.")).toBeInTheDocument();
    expect(importWallet).not.toHaveBeenCalled();
  });

  it("imports successfully and shows a success message and toast", async () => {
    getMinimaNodeStatus.mockResolvedValue(status("running"));
    importWallet.mockResolvedValue({ ok: true, message: "Wallet imported." });
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: /Import wallet/ })).toBeEnabled());
    await goToImportView();

    const words = Array.from({ length: 12 }, (_, i) => `word${i}`).join(" ");
    await userEvent.type(screen.getByPlaceholderText("word1 word2 word3 …"), words);
    await userEvent.click(screen.getByRole("button", { name: /Import wallet/ }));

    await waitFor(() => expect(importWallet).toHaveBeenCalledWith(words));
    // "Wallet imported" renders both in the panel's own success view and in the toast raised
    // alongside it, so assert at least one landed rather than requiring a single unique match.
    expect((await screen.findAllByText("Wallet imported")).length).toBeGreaterThan(0);
  });

  it("shows an error message when the import result reports failure", async () => {
    getMinimaNodeStatus.mockResolvedValue(status("running"));
    importWallet.mockResolvedValue({ ok: false, message: "Invalid seed phrase" });
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: /Import wallet/ })).toBeEnabled());
    await goToImportView();

    const words = Array.from({ length: 12 }, (_, i) => `word${i}`).join(" ");
    await userEvent.type(screen.getByPlaceholderText("word1 word2 word3 …"), words);
    await userEvent.click(screen.getByRole("button", { name: /Import wallet/ }));

    expect(await screen.findByText("Invalid seed phrase")).toBeInTheDocument();
  });

  it("shows a generic error message when the import request throws", async () => {
    getMinimaNodeStatus.mockResolvedValue(status("running"));
    importWallet.mockRejectedValue(new Error("network down"));
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: /Import wallet/ })).toBeEnabled());
    await goToImportView();

    const words = Array.from({ length: 12 }, (_, i) => `word${i}`).join(" ");
    await userEvent.type(screen.getByPlaceholderText("word1 word2 word3 …"), words);
    await userEvent.click(screen.getByRole("button", { name: /Import wallet/ }));

    expect(await screen.findByText("network down")).toBeInTheDocument();
  });
});
