import { describe, it, beforeEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import { fetchVerifiedManifest, type Manifest } from "../../src/manifest/manifest.service.js";
import { getLastAppliedVersion, recordAppliedManifest } from "../../src/manifest/manifest-state.js";
import { getComposeServiceContainer } from "../../src/docker/docker.service.js";
import { getUpdateStatus } from "../../src/status/status.service.js";
import type { DockerContainerSummary } from "../../src/docker/docker.types.js";

vi.mock("../../src/manifest/manifest.service.js", () => ({
  fetchVerifiedManifest: vi.fn(),
  MANIFEST_SERVICE_KEYS: ["frontend", "backend"]
}));
vi.mock("../../src/manifest/manifest-state.js", () => ({
  getLastAppliedVersion: vi.fn(),
  recordAppliedManifest: vi.fn()
}));
vi.mock("../../src/docker/docker.service.js", () => ({ getComposeServiceContainer: vi.fn() }));

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

function container(image: string): DockerContainerSummary {
  return {
    Id: "id",
    Names: ["/svc"],
    State: "running",
    Image: image,
    ImageID: "sha256:x",
    Labels: {}
  };
}

describe("status.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (fetchVerifiedManifest as any).mockResolvedValue(manifest());
    (getLastAppliedVersion as any).mockResolvedValue("1.0.0");
    (getComposeServiceContainer as any).mockImplementation(async (service: string) => {
      if (service === "frontend") return container("sha256:frontend-new");
      if (service === "backend") return container("sha256:backend-new");
      if (service === "update-agent") return container("sha256:update-agent-new");
      return null;
    });
  });

  describe("getUpdateStatus", () => {
    it("builds a service status entry for each manifest service key plus update-agent", async () => {
      const result = await getUpdateStatus();

      assert.deepEqual(result.services, [
        { service: "frontend", currentImage: "sha256:frontend-new", targetImage: "sha256:frontend-new", upToDate: true },
        { service: "backend", currentImage: "sha256:backend-new", targetImage: "sha256:backend-new", upToDate: true },
        { service: "update-agent", currentImage: "sha256:update-agent-new", targetImage: "sha256:update-agent-new", upToDate: true }
      ]);
    });

    it("reports upToDate: false and the running image when a service is behind the manifest", async () => {
      (getComposeServiceContainer as any).mockImplementation(async (service: string) =>
        service === "frontend" ? container("sha256:frontend-old") : container("sha256:backend-new")
      );

      const result = await getUpdateStatus();

      assert.deepEqual(result.services[0], {
        service: "frontend",
        currentImage: "sha256:frontend-old",
        targetImage: "sha256:frontend-new",
        upToDate: false
      });
    });

    it("reports currentImage: null and upToDate: false when no container is running for a service", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(null);

      const result = await getUpdateStatus();

      for (const status of result.services) {
        assert.equal(status.currentImage, null);
        assert.equal(status.upToDate, false);
      }
    });

    it("returns the last applied version without self-healing when one is already recorded", async () => {
      const result = await getUpdateStatus();

      assert.equal(result.currentVersion, "1.0.0");
      assert.equal((recordAppliedManifest as any).mock.calls.length, 0);
    });

    it("self-heals a missing recorded version when frontend and backend are already up to date", async () => {
      (getLastAppliedVersion as any).mockResolvedValue(null);
      const m = manifest();
      (fetchVerifiedManifest as any).mockResolvedValue(m);

      const result = await getUpdateStatus();

      assert.equal(result.currentVersion, "1.2.3");
      assert.deepEqual((recordAppliedManifest as any).mock.calls[0], [m.createdAt, m.version]);
    });

    it("does not self-heal when frontend or backend is behind the manifest", async () => {
      (getLastAppliedVersion as any).mockResolvedValue(null);
      (getComposeServiceContainer as any).mockImplementation(async (service: string) =>
        service === "frontend" ? container("sha256:frontend-old") : container("sha256:backend-new")
      );

      const result = await getUpdateStatus();

      assert.equal(result.currentVersion, null);
      assert.equal((recordAppliedManifest as any).mock.calls.length, 0);
    });

    it("self-heals even when update-agent itself is behind the manifest", async () => {
      (getLastAppliedVersion as any).mockResolvedValue(null);
      (getComposeServiceContainer as any).mockImplementation(async (service: string) => {
        if (service === "frontend") return container("sha256:frontend-new");
        if (service === "backend") return container("sha256:backend-new");
        return container("sha256:update-agent-old");
      });

      const result = await getUpdateStatus();

      assert.equal(result.currentVersion, "1.2.3");
      assert.equal((recordAppliedManifest as any).mock.calls.length, 1);
    });
  });
});
