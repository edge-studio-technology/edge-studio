import { describe, it, beforeEach, afterEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import { getUpdateStatus } from "../../src/status/status.service.js";
import type { ServiceStatus } from "../../src/status/status.service.js";

const mockEnv = { manifestUrl: "https://primary.example.com/release/manifest.json", manifestPublicKey: "test-key", statusPollIntervalMs: 1000 };
vi.mock("../../src/config/env.js", () => ({ env: mockEnv }));
vi.mock("../../src/status/status.service.js", () => ({ getUpdateStatus: vi.fn() }));

let getCachedStatus: typeof import("../../src/status/status-poller.js").getCachedStatus;
let refreshCachedStatus: typeof import("../../src/status/status-poller.js").refreshCachedStatus;
let startStatusPoller: typeof import("../../src/status/status-poller.js").startStatusPoller;

const services: ServiceStatus[] = [{ service: "frontend", currentImage: "sha256:a", targetImage: "sha256:a", upToDate: true }];

describe("status-poller", () => {
  beforeEach(async () => {
    mockEnv.manifestUrl = "https://primary.example.com/release/manifest.json";
    mockEnv.manifestPublicKey = "test-key";
    mockEnv.statusPollIntervalMs = 1000;
    vi.resetModules();
    vi.resetAllMocks();
    (getUpdateStatus as any).mockResolvedValue({
      manifest: { frontend: "sha256:a", backend: "sha256:b", updateAgent: "sha256:c", version: "1.2.3", createdAt: "2026-08-01T00:00:00.000Z" },
      services,
      currentVersion: "1.0.0"
    });
    const mod = await import("../../src/status/status-poller.js");
    getCachedStatus = mod.getCachedStatus;
    refreshCachedStatus = mod.refreshCachedStatus;
    startStatusPoller = mod.startStatusPoller;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getCachedStatus", () => {
    it("starts null", () => {
      assert.equal(getCachedStatus(), null);
    });
  });

  describe("refreshCachedStatus", () => {
    it("populates the cached snapshot from getUpdateStatus", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

      await refreshCachedStatus();

      assert.deepEqual(getCachedStatus(), {
        checkedAt: "2026-08-21T12:00:00.000Z",
        services,
        currentVersion: "1.0.0",
        availableVersion: "1.2.3"
      });
    });

    it("logs and leaves the cache unchanged when getUpdateStatus rejects", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      (getUpdateStatus as any).mockRejectedValue(new Error("manifest fetch failed"));

      await refreshCachedStatus();

      assert.equal(getCachedStatus(), null);
      assert.match(String(errorSpy.mock.calls[0]?.[1]), /manifest fetch failed/);
    });

    it("overwrites a previous snapshot on the next successful refresh", async () => {
      await refreshCachedStatus();
      (getUpdateStatus as any).mockResolvedValue({
        manifest: { frontend: "sha256:x", backend: "sha256:b", updateAgent: "sha256:c", version: "1.3.0", createdAt: "2026-08-02T00:00:00.000Z" },
        services: [],
        currentVersion: "1.2.3"
      });

      await refreshCachedStatus();

      assert.equal(getCachedStatus()?.availableVersion, "1.3.0");
    });
  });

  describe("startStatusPoller", () => {
    it("skips polling and disables the poller when MANIFEST_URL is not configured", async () => {
      mockEnv.manifestUrl = "";

      await startStatusPoller();

      assert.equal((getUpdateStatus as any).mock.calls.length, 0);
      assert.equal(getCachedStatus(), null);
    });

    it("skips polling and disables the poller when the manifest public key is not configured", async () => {
      mockEnv.manifestPublicKey = "";

      await startStatusPoller();

      assert.equal((getUpdateStatus as any).mock.calls.length, 0);
    });

    it("awaits the first poll before returning, populating the cache", async () => {
      await startStatusPoller();

      assert.equal((getUpdateStatus as any).mock.calls.length, 1);
      assert.equal(getCachedStatus()?.availableVersion, "1.2.3");
    });

    it("re-polls on the configured interval", async () => {
      vi.useFakeTimers();

      await startStatusPoller();
      assert.equal((getUpdateStatus as any).mock.calls.length, 1);

      await vi.advanceTimersByTimeAsync(1000);
      assert.equal((getUpdateStatus as any).mock.calls.length, 2);

      await vi.advanceTimersByTimeAsync(1000);
      assert.equal((getUpdateStatus as any).mock.calls.length, 3);
    });
  });
});
