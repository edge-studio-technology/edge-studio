import { describe, it, beforeEach, afterEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import { recordAppliedManifest } from "../../src/manifest/manifest-state.js";
import { getUpdateStatus } from "../../src/status/status.service.js";
import { launchSelfUpdate } from "../../src/self-update/self-update.service.js";
import { updateService } from "../../src/update/service-update.js";
import type { Manifest } from "../../src/manifest/manifest.service.js";
import type { ServiceStatus } from "../../src/status/status.service.js";

const mockEnv = { dryRun: false };
vi.mock("../../src/config/env.js", () => ({ env: mockEnv }));

vi.mock("../../src/manifest/manifest-state.js", () => ({ recordAppliedManifest: vi.fn() }));
vi.mock("../../src/status/status.service.js", () => ({ getUpdateStatus: vi.fn() }));
vi.mock("../../src/self-update/self-update.service.js", () => ({ launchSelfUpdate: vi.fn() }));
vi.mock("../../src/update/service-update.js", () => ({ updateService: vi.fn() }));

const { applyUpdates } = await import("../../src/update/apply.service.js");

function manifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    frontend: "sha256:frontend-new",
    backend: "sha256:backend-new",
    updateAgent: "sha256:update-agent-new",
    version: "1.2.3",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides
  };
}

describe("apply.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEnv.dryRun = false;
    (launchSelfUpdate as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("applyUpdates", () => {
    it("simulates the apply without touching containers or recording the manifest in dry-run mode", async () => {
      mockEnv.dryRun = true;
      vi.useFakeTimers();
      const services: ServiceStatus[] = [
        { service: "frontend", currentImage: "old", targetImage: "sha256:frontend-new", upToDate: false },
        { service: "backend", currentImage: "sha256:backend-new", targetImage: "sha256:backend-new", upToDate: true },
        { service: "update-agent", currentImage: "old", targetImage: "sha256:update-agent-new", upToDate: false }
      ];
      (getUpdateStatus as any).mockResolvedValue({ manifest: manifest(), services, currentVersion: "1.0.0" });

      const promise = applyUpdates();
      await vi.advanceTimersByTimeAsync(4000);
      const result = await promise;

      assert.deepEqual(result, [
        { service: "frontend", updated: true, reason: "dry run — no changes applied" },
        { service: "backend", updated: false, reason: "already up to date" }
      ]);
      assert.equal((updateService as any).mock.calls.length, 0);
      assert.equal((recordAppliedManifest as any).mock.calls.length, 0);
      assert.equal((launchSelfUpdate as any).mock.calls.length, 0);
    });

    it("skips already up-to-date services and updates the rest via updateService", async () => {
      const services: ServiceStatus[] = [
        { service: "frontend", currentImage: "old", targetImage: "sha256:frontend-new", upToDate: false },
        { service: "backend", currentImage: "sha256:backend-new", targetImage: "sha256:backend-new", upToDate: true },
        { service: "update-agent", currentImage: "sha256:update-agent-new", targetImage: "sha256:update-agent-new", upToDate: true }
      ];
      (getUpdateStatus as any).mockResolvedValue({ manifest: manifest(), services, currentVersion: "1.0.0" });
      (updateService as any).mockResolvedValue({ service: "frontend", updated: true, reason: "updated and healthy" });

      const result = await applyUpdates();

      assert.deepEqual((updateService as any).mock.calls, [["frontend", "sha256:frontend-new"]]);
      assert.deepEqual(result, [
        { service: "frontend", updated: true, reason: "updated and healthy" },
        { service: "backend", updated: false, reason: "already up to date" }
      ]);
    });

    it("never routes update-agent through updateService, even when not up to date", async () => {
      const services: ServiceStatus[] = [
        { service: "update-agent", currentImage: "old", targetImage: "sha256:update-agent-new", upToDate: false }
      ];
      (getUpdateStatus as any).mockResolvedValue({ manifest: manifest(), services, currentVersion: "1.0.0" });

      const result = await applyUpdates();

      assert.equal((updateService as any).mock.calls.length, 0);
      assert.deepEqual(result, []);
    });

    it("records the manifest as applied and launches self-update when nothing failed", async () => {
      const services: ServiceStatus[] = [{ service: "frontend", currentImage: "old", targetImage: "sha256:frontend-new", upToDate: false }];
      const m = manifest();
      (getUpdateStatus as any).mockResolvedValue({ manifest: m, services, currentVersion: "1.0.0" });
      (updateService as any).mockResolvedValue({ service: "frontend", updated: true, reason: "updated and healthy" });
      (launchSelfUpdate as any).mockResolvedValue(undefined);

      await applyUpdates();

      assert.deepEqual((recordAppliedManifest as any).mock.calls[0], [m.createdAt, m.version]);
      assert.deepEqual((launchSelfUpdate as any).mock.calls[0], [m.updateAgent]);
    });

    it("does not record the manifest or launch self-update when a service update fails", async () => {
      const services: ServiceStatus[] = [{ service: "frontend", currentImage: "old", targetImage: "sha256:frontend-new", upToDate: false }];
      (getUpdateStatus as any).mockResolvedValue({ manifest: manifest(), services, currentVersion: "1.0.0" });
      (updateService as any).mockResolvedValue({
        service: "frontend",
        updated: false,
        reason: "new container failed health check; old container left running"
      });

      await applyUpdates();

      assert.equal((recordAppliedManifest as any).mock.calls.length, 0);
      assert.equal((launchSelfUpdate as any).mock.calls.length, 0);
    });

    it("logs but does not throw when the fire-and-forget self-update launch fails", async () => {
      const services: ServiceStatus[] = [{ service: "frontend", currentImage: "old", targetImage: "sha256:frontend-new", upToDate: false }];
      (getUpdateStatus as any).mockResolvedValue({ manifest: manifest(), services, currentVersion: "1.0.0" });
      (updateService as any).mockResolvedValue({ service: "frontend", updated: true, reason: "updated and healthy" });
      (launchSelfUpdate as any).mockRejectedValue(new Error("launch failed"));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const result = await applyUpdates();
      await vi.waitFor(() => assert.equal(errorSpy.mock.calls.length, 1));

      assert.deepEqual(result, [{ service: "frontend", updated: true, reason: "updated and healthy" }]);
      assert.match(errorSpy.mock.calls[0][0] as string, /self-update launch failed/);
    });
  });
});
