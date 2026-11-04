import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ container: vi.fn(), snapshot: vi.fn() }));
vi.mock("../../../src/features/status/docker.service.js", () => ({ getComposeServiceContainer: mocks.container, getDockerResourceSnapshot: mocks.snapshot }));
import { getMinimaContainerStats, getMinimaStorageInfo } from "../../../src/features/minima/minima.docker.js";
beforeEach(() => {
  mocks.container.mockReset().mockResolvedValue(null);
  mocks.snapshot.mockReset().mockReturnValue({ items: [], observedAt: null, pending: true });
});
describe("getMinimaContainerStats", () => {
  it("returns null when no current Minima container exists", async () => {
    assert.equal(await getMinimaContainerStats(), null);
    assert.equal(mocks.snapshot.mock.calls.length, 0);
  });
  it("returns current state immediately while telemetry is pending", async () => {
    mocks.container.mockResolvedValue({ Id: "current-id", State: "running", Status: "Up" });
    assert.deepEqual(await getMinimaContainerStats(), { state: "running", status: "Up", cpuPercent: null, memory: null, containerDisk: null, metricsPending: true, metricsObservedAt: null });
  });
  it("merges matching sampled telemetry without trusting its old lifecycle state", async () => {
    mocks.container.mockResolvedValue({ Id: "current-id", State: "running", Status: "Up now" });
    mocks.snapshot.mockReturnValue({ items: [{ containerId: "current-id", state: "exited", cpuPercent: 12.5, memory: { usage: "128 MB", limit: "512 MB" }, disk: { rootFs: "1 GB" } }], observedAt: "sample-time", pending: false });
    const result = await getMinimaContainerStats();
    assert.equal(result?.state, "running");
    assert.equal(result?.status, "Up now");
    assert.equal(result?.cpuPercent, 12.5);
    assert.deepEqual(result?.memory, { usage: "128 MB", limit: "512 MB" });
    assert.equal(result?.metricsObservedAt, "sample-time");
    mocks.container.mockResolvedValue({ Id: "replacement-id", State: "running", Status: "Up" });
    assert.equal((await getMinimaContainerStats())?.cpuPercent, null);
    mocks.container.mockResolvedValue({ Id: "current-id", State: "exited", Status: "Exited" });
    assert.equal((await getMinimaContainerStats())?.cpuPercent, null);
    assert.equal((await getMinimaContainerStats())?.memory, null);
  });
  it("handles missing sampled memory fields", async () => {
    mocks.container.mockResolvedValue({ Id: "current-id", State: "running", Status: "Up" });
    mocks.snapshot.mockReturnValue({ items: [{ containerId: "current-id", cpuPercent: 0, memory: {}, disk: {} }], observedAt: "sample-time", pending: false });
    assert.deepEqual((await getMinimaContainerStats())?.memory, { usage: null, limit: null });
  });
});
describe("getMinimaStorageInfo", () => {
  it("uses the default Minima data path when none is provided", () => {
    assert.deepEqual(getMinimaStorageInfo("1.2 GB"), {
      dataPath: "/home/minima/data",
      containerDisk: "1.2 GB",
      chainDataDisk: null
    });
  });

  it("uses a provided (trimmed) dataPath and chainDataDisk", () => {
    assert.deepEqual(getMinimaStorageInfo(null, { dataPath: " /custom/path ", chainDataDisk: "500 MB" }), {
      dataPath: "/custom/path",
      containerDisk: null,
      chainDataDisk: "500 MB"
    });
  });
});
