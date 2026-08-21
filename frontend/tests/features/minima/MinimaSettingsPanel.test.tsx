import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { MinimaSettingsPanel } from "../../../src/features/minima/MinimaSettingsPanel";

const addMinimaPeers = vi.fn();
const getAutoRestartEnabled = vi.fn();
const getMinimaConfig = vi.fn();
const getMinimaPeers = vi.fn();
const saveMinimaConfig = vi.fn();
const setAutoRestartEnabled = vi.fn();

vi.mock("../../../src/features/minima/minimaApi", () => ({
  addMinimaPeers: (...args: unknown[]) => addMinimaPeers(...args),
  getAutoRestartEnabled: (...args: unknown[]) => getAutoRestartEnabled(...args),
  getMinimaConfig: (...args: unknown[]) => getMinimaConfig(...args),
  getMinimaPeers: (...args: unknown[]) => getMinimaPeers(...args),
  saveMinimaConfig: (...args: unknown[]) => saveMinimaConfig(...args),
  setAutoRestartEnabled: (...args: unknown[]) => setAutoRestartEnabled(...args),
}));

function renderPanel(minimaState: "running" | "stopped" | "error" | "restarting" | null = "running") {
  return render(<MinimaSettingsPanel minimaState={minimaState} />, { wrapper: ToastProvider });
}

describe("MinimaSettingsPanel", () => {
  beforeEach(() => {
    addMinimaPeers.mockReset();
    getAutoRestartEnabled.mockReset().mockResolvedValue({ autoRestartEnabled: false });
    getMinimaConfig.mockReset().mockResolvedValue({ megammrHost: "host:9001", megammrHostSource: "default" });
    getMinimaPeers.mockReset().mockResolvedValue({ ok: true, count: 0, peers: [] });
    saveMinimaConfig.mockReset();
    setAutoRestartEnabled.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads config and populates the host input while running, and loads peers", async () => {
    renderPanel("running");

    await waitFor(() => expect(getMinimaConfig).toHaveBeenCalled());
    expect(await screen.findByLabelText("Host")).toHaveValue("host:9001");
    await waitFor(() => expect(getMinimaPeers).toHaveBeenCalled());
  });

  it("does not fetch peers while the node isn't confirmed running", async () => {
    renderPanel("stopped");
    await waitFor(() => expect(getMinimaConfig).toHaveBeenCalled());
    expect(getMinimaPeers).not.toHaveBeenCalled();
  });

  it("shows a config error when the initial config fetch fails", async () => {
    getMinimaConfig.mockRejectedValue(new Error("config down"));
    renderPanel("running");
    expect(await screen.findByText("config down")).toBeInTheDocument();
  });

  it("saves the megammr host and refreshes the input from the response", async () => {
    const user = userEvent.setup();
    saveMinimaConfig.mockResolvedValue({ megammrHost: "new-host:9001", megammrHostSource: "database" });
    renderPanel("running");

    await screen.findByLabelText("Host");
    const input = screen.getByLabelText("Host");
    await user.clear(input);
    await user.type(input, "new-host:9001");
    await user.click(screen.getByRole("button", { name: /save configuration/i }));

    await waitFor(() => expect(saveMinimaConfig).toHaveBeenCalledWith("new-host:9001"));
    expect(await screen.findByText("database")).toBeInTheDocument();
  });

  it("shows a config error when saving fails", async () => {
    const user = userEvent.setup();
    saveMinimaConfig.mockRejectedValue(new Error("save failed"));
    renderPanel("running");

    await screen.findByLabelText("Host");
    await user.click(screen.getByRole("button", { name: /save configuration/i }));

    expect(await screen.findByText("save failed")).toBeInTheDocument();
  });

  it("adds peers and refreshes the peer list on success", async () => {
    const user = userEvent.setup();
    addMinimaPeers.mockResolvedValue({ ok: true, source: "minima" });
    getMinimaPeers.mockResolvedValueOnce({ ok: true, count: 0, peers: [] });
    getMinimaPeers.mockResolvedValueOnce({ ok: true, count: 1, peers: ["host1:9001"] });
    renderPanel("running");

    await waitFor(() => expect(getMinimaPeers).toHaveBeenCalledTimes(1));
    const peerInput = screen.getByLabelText("Peer address");
    await user.clear(peerInput);
    await user.type(peerInput, "host1:9001");
    await user.click(screen.getByRole("button", { name: /add peers/i }));

    await waitFor(() => expect(addMinimaPeers).toHaveBeenCalledWith("host1:9001"));
    expect(await screen.findByText("Peers added")).toBeInTheDocument();
    await waitFor(() => expect(getMinimaPeers).toHaveBeenCalledTimes(2));
  });

  it("shows a toast and inline error when add peers fails", async () => {
    const user = userEvent.setup();
    addMinimaPeers.mockRejectedValue(new Error("add failed"));
    renderPanel("running");

    await screen.findByLabelText("Peer address");
    await user.type(screen.getByLabelText("Peer address"), "host1:9001");
    await user.click(screen.getByRole("button", { name: /add peers/i }));

    expect(await screen.findByText("Add peers failed")).toBeInTheDocument();
  });

  it("shows a toast when the peer list fails to load", async () => {
    getMinimaPeers.mockRejectedValue(new Error("peers down"));
    renderPanel("running");
    expect(await screen.findByText("Failed to load peers")).toBeInTheDocument();
  });

  it("disables save/add actions while the node isn't running", async () => {
    renderPanel("stopped");
    await screen.findByLabelText("Host");
    expect(screen.getByRole("button", { name: /save configuration/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /add peers/i })).toBeDisabled();
  });

  it("renders bare content without the settings heading when bare is set", async () => {
    render(<MinimaSettingsPanel bare minimaState="running" />, { wrapper: ToastProvider });
    await waitFor(() => expect(getMinimaConfig).toHaveBeenCalled());
    expect(screen.queryByText("Minima node settings")).not.toBeInTheDocument();
  });

  it("renders the settings heading when not bare", async () => {
    renderPanel("running");
    expect(screen.getByText("Minima node settings")).toBeInTheDocument();
  });
});
