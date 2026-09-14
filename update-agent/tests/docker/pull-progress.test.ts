import { describe, it, beforeEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import type { DockerProgressLine } from "../../src/docker/docker.client.js";

describe("pull-progress", () => {
  let getPullProgress: typeof import("../../src/docker/pull-progress.js").getPullProgress;
  let startPullProgress: typeof import("../../src/docker/pull-progress.js").startPullProgress;
  let clearPullProgress: typeof import("../../src/docker/pull-progress.js").clearPullProgress;
  let recordPullProgress: typeof import("../../src/docker/pull-progress.js").recordPullProgress;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../src/docker/pull-progress.js");
    getPullProgress = mod.getPullProgress;
    startPullProgress = mod.startPullProgress;
    clearPullProgress = mod.clearPullProgress;
    recordPullProgress = mod.recordPullProgress;
  });

  describe("getPullProgress", () => {
    it("returns null before any pull starts", () => {
      assert.equal(getPullProgress(), null);
    });
  });

  describe("startPullProgress", () => {
    it("initializes progress for a service at zero bytes", () => {
      startPullProgress("frontend");

      assert.deepEqual(getPullProgress(), { service: "frontend", bytesDownloaded: 0, bytesTotal: 0 });
    });

    it("resets accumulated layers from a previous pull", () => {
      startPullProgress("frontend");
      recordPullProgress(line("layer1", 50, 100));

      startPullProgress("backend");
      recordPullProgress(line("layer1", 10, 20));

      assert.deepEqual(getPullProgress(), { service: "backend", bytesDownloaded: 10, bytesTotal: 20 });
    });
  });

  describe("clearPullProgress", () => {
    it("clears current progress and layers", () => {
      startPullProgress("frontend");
      recordPullProgress(line("layer1", 50, 100));

      clearPullProgress();

      assert.equal(getPullProgress(), null);
    });

    it("does not resurrect cleared layers on a later record call", () => {
      startPullProgress("frontend");
      recordPullProgress(line("layer1", 50, 100));
      clearPullProgress();

      recordPullProgress(line("layer1", 10, 100));

      assert.equal(getPullProgress(), null);
    });
  });

  describe("recordPullProgress", () => {
    it("is a no-op when no pull has started", () => {
      recordPullProgress(line("layer1", 50, 100));

      assert.equal(getPullProgress(), null);
    });

    it("is a no-op when the line has no id", () => {
      startPullProgress("frontend");

      recordPullProgress({ progressDetail: { current: 50, total: 100 } });

      assert.deepEqual(getPullProgress(), { service: "frontend", bytesDownloaded: 0, bytesTotal: 0 });
    });

    it("is a no-op when the line has no progressDetail", () => {
      startPullProgress("frontend");

      recordPullProgress({ id: "layer1", status: "Downloading" });

      assert.deepEqual(getPullProgress(), { service: "frontend", bytesDownloaded: 0, bytesTotal: 0 });
    });

    it("is a no-op when progressDetail fields are not numbers", () => {
      startPullProgress("frontend");

      recordPullProgress({ id: "layer1", progressDetail: {} });

      assert.deepEqual(getPullProgress(), { service: "frontend", bytesDownloaded: 0, bytesTotal: 0 });
    });

    it("sums bytes for a single layer", () => {
      startPullProgress("frontend");

      recordPullProgress(line("layer1", 50, 100));

      assert.deepEqual(getPullProgress(), { service: "frontend", bytesDownloaded: 50, bytesTotal: 100 });
    });

    it("sums bytes across multiple concurrent layers", () => {
      startPullProgress("frontend");

      recordPullProgress(line("layer1", 50, 100));
      recordPullProgress(line("layer2", 20, 200));

      assert.deepEqual(getPullProgress(), { service: "frontend", bytesDownloaded: 70, bytesTotal: 300 });
    });

    it("replaces a layer's totals on repeated updates rather than double-counting", () => {
      startPullProgress("frontend");

      recordPullProgress(line("layer1", 50, 100));
      recordPullProgress(line("layer1", 90, 100));

      assert.deepEqual(getPullProgress(), { service: "frontend", bytesDownloaded: 90, bytesTotal: 100 });
    });

    it("preserves the service name across updates", () => {
      startPullProgress("backend");

      recordPullProgress(line("layer1", 50, 100));

      assert.equal(getPullProgress()?.service, "backend");
    });
  });
});

function line(id: string, current: number, total: number): DockerProgressLine {
  return { id, progressDetail: { current, total } };
}
