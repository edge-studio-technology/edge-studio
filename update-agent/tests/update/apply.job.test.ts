import { describe, it, beforeEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import { getPullProgress } from "../../src/docker/pull-progress.js";
import { refreshCachedStatus } from "../../src/status/status-poller.js";
import { applyUpdates } from "../../src/update/apply.service.js";
import type { ServiceUpdateResult } from "../../src/update/update.types.js";

vi.mock("../../src/docker/pull-progress.js", () => ({ getPullProgress: vi.fn() }));
vi.mock("../../src/status/status-poller.js", () => ({ refreshCachedStatus: vi.fn() }));
vi.mock("../../src/update/apply.service.js", () => ({ applyUpdates: vi.fn() }));

let getApplyJobStatus: typeof import("../../src/update/apply.job.js").getApplyJobStatus;
let startApplyJob: typeof import("../../src/update/apply.job.js").startApplyJob;

describe("apply.job", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    (refreshCachedStatus as any).mockResolvedValue(undefined);
    const mod = await import("../../src/update/apply.job.js");
    getApplyJobStatus = mod.getApplyJobStatus;
    startApplyJob = mod.startApplyJob;
  });

  describe("getApplyJobStatus", () => {
    it("starts idle", () => {
      assert.deepEqual(getApplyJobStatus(), { state: "idle" });
    });
  });

  describe("startApplyJob", () => {
    it("transitions to running immediately and reports live pull progress", async () => {
      let resolveApply: (results: ServiceUpdateResult[]) => void;
      (applyUpdates as any).mockReturnValue(new Promise<ServiceUpdateResult[]>((resolve) => (resolveApply = resolve)));
      (getPullProgress as any).mockReturnValue({ service: "frontend", bytesDownloaded: 10, bytesTotal: 100 });

      const started = startApplyJob();

      assert.deepEqual(started, { started: true });
      assert.deepEqual(getApplyJobStatus(), {
        state: "running",
        progress: { service: "frontend", bytesDownloaded: 10, bytesTotal: 100 }
      });
      resolveApply!([]);
    });

    it("refuses to start a second run while one is already in progress", () => {
      (applyUpdates as any).mockReturnValue(new Promise(() => undefined));

      startApplyJob();
      const second = startApplyJob();

      assert.deepEqual(second, { started: false });
      assert.equal((applyUpdates as any).mock.calls.length, 1);
    });

    it("moves to succeeded with the results once applyUpdates resolves, and refreshes the cached status", async () => {
      const results: ServiceUpdateResult[] = [{ service: "frontend", updated: true, reason: "updated and healthy" }];
      (applyUpdates as any).mockResolvedValue(results);

      startApplyJob();
      await vi.waitFor(() => assert.deepEqual(getApplyJobStatus(), { state: "succeeded", results }));

      assert.equal((refreshCachedStatus as any).mock.calls.length, 1);
    });

    it("moves to failed with a generic message once applyUpdates rejects, logging the real error", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      (applyUpdates as any).mockRejectedValue(new Error("manifest fetch failed"));

      startApplyJob();
      await vi.waitFor(() =>
        assert.deepEqual(getApplyJobStatus(), {
          state: "failed",
          error: "Update failed unexpectedly — check update-agent's logs for details"
        })
      );

      assert.equal((refreshCachedStatus as any).mock.calls.length, 1);
      assert.match(String(errorSpy.mock.calls[0]?.[1]), /manifest fetch failed/);
    });

    it("allows starting a new run once the previous one has finished", async () => {
      (applyUpdates as any).mockResolvedValueOnce([]).mockReturnValueOnce(new Promise(() => undefined));

      startApplyJob();
      await vi.waitFor(() => assert.deepEqual(getApplyJobStatus(), { state: "succeeded", results: [] }));

      const second = startApplyJob();

      assert.deepEqual(second, { started: true });
      assert.equal((applyUpdates as any).mock.calls.length, 2);
    });
  });
});
