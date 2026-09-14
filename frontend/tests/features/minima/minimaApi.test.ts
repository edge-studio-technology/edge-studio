import { afterEach, describe, expect, it, vi } from "vitest";

const getJson = vi.fn();
const postJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
}));

import {
  addMinimaPeers,
  getAutoRestartEnabled,
  getMinimaConfig,
  getMinimaNodeStatus,
  getMinimaPeers,
  resyncMegammr,
  restartMinimaContainer,
  saveMinimaConfig,
  setAutoRestartEnabled,
} from "../../../src/features/minima/minimaApi";

describe("minimaApi", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("getMinimaNodeStatus GETs /api/minima/status", async () => {
    getJson.mockResolvedValue({ state: "running" });
    const result = await getMinimaNodeStatus();
    expect(getJson).toHaveBeenCalledWith("/api/minima/status");
    expect(result).toEqual({ state: "running" });
  });

  it("getMinimaConfig GETs /api/minima/config", async () => {
    getJson.mockResolvedValue({ megammrHost: "host:9001" });
    await getMinimaConfig();
    expect(getJson).toHaveBeenCalledWith("/api/minima/config");
  });

  it("saveMinimaConfig POSTs the megammrHost", async () => {
    postJson.mockResolvedValue({ megammrHost: "host:9001" });
    await saveMinimaConfig("host:9001");
    expect(postJson).toHaveBeenCalledWith("/api/minima/config", { megammrHost: "host:9001" });
  });

  it("resyncMegammr POSTs to /api/minima/megammrsync/resync with no body", async () => {
    postJson.mockResolvedValue({ ok: true });
    await resyncMegammr();
    expect(postJson).toHaveBeenCalledWith("/api/minima/megammrsync/resync");
  });

  it("getMinimaPeers GETs /api/minima/peers", async () => {
    getJson.mockResolvedValue({ peers: [] });
    await getMinimaPeers();
    expect(getJson).toHaveBeenCalledWith("/api/minima/peers");
  });

  it("addMinimaPeers POSTs the peerslist", async () => {
    postJson.mockResolvedValue({ ok: true });
    await addMinimaPeers("host:port");
    expect(postJson).toHaveBeenCalledWith("/api/minima/peers/add", { peerslist: "host:port" });
  });

  it("restartMinimaContainer POSTs to /api/minima/restart", async () => {
    postJson.mockResolvedValue({ ok: true, state: "restarting" });
    await restartMinimaContainer();
    expect(postJson).toHaveBeenCalledWith("/api/minima/restart");
  });

  it("getAutoRestartEnabled GETs /api/minima/restart/auto", async () => {
    getJson.mockResolvedValue({ autoRestartEnabled: false });
    await getAutoRestartEnabled();
    expect(getJson).toHaveBeenCalledWith("/api/minima/restart/auto");
  });

  it("setAutoRestartEnabled POSTs the enabled flag", async () => {
    postJson.mockResolvedValue({ autoRestartEnabled: true });
    await setAutoRestartEnabled(true);
    expect(postJson).toHaveBeenCalledWith("/api/minima/restart/auto", { enabled: true });
  });
});
