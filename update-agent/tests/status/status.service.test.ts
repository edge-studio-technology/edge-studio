import { describe, it, beforeEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import { fetchVerifiedManifest, type Manifest } from "../../src/manifest/manifest.service.js";
import { getLastAppliedManifest, recordAppliedManifest } from "../../src/manifest/manifest-state.js";
import { getComposeServiceContainer, inspectImage } from "../../src/docker/docker.service.js";
import { getUpdateStatus } from "../../src/status/status.service.js";
import type { DockerContainerSummary } from "../../src/docker/docker.types.js";

vi.mock("../../src/manifest/manifest.service.js", () => ({
  fetchVerifiedManifest: vi.fn(),
  MANIFEST_SERVICE_KEYS: ["frontend", "backend"]
}));
vi.mock("../../src/manifest/manifest-state.js", () => ({
  getLastAppliedManifest: vi.fn(),
  recordAppliedManifest: vi.fn()
}));
vi.mock("../../src/docker/docker.service.js", () => ({ getComposeServiceContainer: vi.fn(), inspectImage: vi.fn() }));

function manifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    frontend: "sha256:frontend-new",
    backend: "sha256:backend-new",
    updateAgent: "sha256:update-agent-new",
    hostRuntime: { url: "https://example.com/edge-studio-host-runtime.tar.gz", sha256: "a".repeat(64) },
    version: "1.2.3",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides
  };
}

function container(image: string, imageId = `id-${image}`): DockerContainerSummary {
  return {
    Id: "id",
    Names: ["/svc"],
    State: "running",
    Image: image,
    ImageID: imageId,
    Labels: {}
  };
}

function runningImages(images: { frontend?: string; backend?: string; updateAgent?: string }) {
  (getComposeServiceContainer as any).mockImplementation(async (service: string) => {
    if (service === "frontend" && images.frontend) return container(images.frontend);
    if (service === "backend" && images.backend) return container(images.backend);
    if (service === "update-agent" && images.updateAgent) return container(images.updateAgent);
    return null;
  });
}

const oldImages = { frontend: "sha256:frontend-old", backend: "sha256:backend-old" };
const newImages = { frontend: "sha256:frontend-new", backend: "sha256:backend-new" };

describe("status.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (fetchVerifiedManifest as any).mockResolvedValue(manifest());
    (getLastAppliedManifest as any).mockResolvedValue({ createdAt: "2026-07-01T00:00:00.000Z", version: "1.0.0", images: oldImages });
    (inspectImage as any).mockResolvedValue({ Id: "img", Config: { Labels: {} } });
    runningImages({ ...oldImages, updateAgent: "sha256:update-agent-new" });
  });

  describe("getUpdateStatus", () => {
    it("builds a service status entry for each manifest service key plus update-agent and host-runtime", async () => {
      const result = await getUpdateStatus();

      assert.deepEqual(result.services, [
        { service: "frontend", currentImage: "sha256:frontend-old", targetImage: "sha256:frontend-new", upToDate: false },
        { service: "backend", currentImage: "sha256:backend-old", targetImage: "sha256:backend-new", upToDate: false },
        { service: "update-agent", currentImage: "sha256:update-agent-new", targetImage: "sha256:update-agent-new", upToDate: true },
        { service: "host-runtime", currentImage: "version:1.0.0", targetImage: "version:1.2.3", upToDate: false }
      ]);
    });

    it("reports currentImage: null and upToDate: false when no container is running for a service", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(null);

      const result = await getUpdateStatus();

      for (const status of result.services.filter((service) => service.service !== "host-runtime")) {
        assert.equal(status.currentImage, null);
        assert.equal(status.upToDate, false);
      }
    });

    it("reports the recorded version when the running images match the recorded images", async () => {
      const result = await getUpdateStatus();

      assert.equal(result.currentVersion, "1.0.0");
      assert.equal((recordAppliedManifest as any).mock.calls.length, 0);
    });

    it("reports currentVersion: null when the running images differ from the recorded images", async () => {
      // The reported vX → vX case: the file names the new release while the old images still run.
      (getLastAppliedManifest as any).mockResolvedValue({ createdAt: "2026-08-01T00:00:00.000Z", version: "1.2.3", images: newImages });

      const result = await getUpdateStatus();

      assert.equal(result.currentVersion, null);
      assert.equal((recordAppliedManifest as any).mock.calls.length, 0);
      assert.equal(result.services.find((service) => service.service === "host-runtime")?.upToDate, true);
    });

    it("upgrades a legacy state file when the running images match the manifest it names", async () => {
      (getLastAppliedManifest as any).mockResolvedValue({ createdAt: "2026-08-01T00:00:00.000Z", version: "1.2.3", images: null });
      runningImages(newImages);
      const m = manifest();
      (fetchVerifiedManifest as any).mockResolvedValue(m);

      const result = await getUpdateStatus();

      assert.equal(result.currentVersion, "1.2.3");
      assert.deepEqual((recordAppliedManifest as any).mock.calls[0], [m.createdAt, m.version, newImages]);
    });

    it("leaves a legacy state file unverified when it names a different version than the manifest", async () => {
      (getLastAppliedManifest as any).mockResolvedValue({ createdAt: "2026-07-01T00:00:00.000Z", version: "1.0.0", images: null });
      runningImages(newImages);

      const result = await getUpdateStatus();

      assert.equal(result.currentVersion, null);
      assert.equal((recordAppliedManifest as any).mock.calls.length, 0);
      assert.equal(result.services.find((service) => service.service === "host-runtime")?.currentImage, "version:1.0.0");
    });

    it("leaves a legacy state file unverified when the running images are behind the manifest", async () => {
      (getLastAppliedManifest as any).mockResolvedValue({ createdAt: "2026-08-01T00:00:00.000Z", version: "1.2.3", images: null });

      const result = await getUpdateStatus();

      assert.equal(result.currentVersion, null);
      assert.equal((recordAppliedManifest as any).mock.calls.length, 0);
    });

    it("self-heals a missing state file when frontend and backend already match the manifest", async () => {
      (getLastAppliedManifest as any).mockResolvedValue(null);
      runningImages({ ...newImages, updateAgent: "sha256:update-agent-old" });
      const m = manifest();
      (fetchVerifiedManifest as any).mockResolvedValue(m);

      const result = await getUpdateStatus();

      assert.equal(result.currentVersion, "1.2.3");
      assert.deepEqual((recordAppliedManifest as any).mock.calls[0], [m.createdAt, m.version, newImages]);
      assert.deepEqual(result.services.find((service) => service.service === "host-runtime"), {
        service: "host-runtime",
        currentImage: "version:1.2.3",
        targetImage: "version:1.2.3",
        upToDate: true
      });
    });

    it("does not self-heal a missing state file when frontend or backend is behind the manifest", async () => {
      (getLastAppliedManifest as any).mockResolvedValue(null);
      runningImages({ frontend: "sha256:frontend-old", backend: "sha256:backend-new" });

      const result = await getUpdateStatus();

      assert.equal(result.currentVersion, null);
      assert.equal((recordAppliedManifest as any).mock.calls.length, 0);
    });

    it("reads installed builds from image labels by image ID", async () => {
      (inspectImage as any).mockImplementation(async (imageId: string) => ({
        Id: imageId,
        Config: { Labels: { "org.opencontainers.image.version": `v-${imageId}`, "org.opencontainers.image.revision": "abc123" } }
      }));

      const result = await getUpdateStatus();

      assert.deepEqual(result.installedBuilds, {
        frontend: { version: "v-id-sha256:frontend-old", revision: "abc123" },
        backend: { version: "v-id-sha256:backend-old", revision: "abc123" },
        "update-agent": { version: "v-id-sha256:update-agent-new", revision: "abc123" }
      });
    });

    it("reports a build as null when its image has no version label or an unknown one", async () => {
      (inspectImage as any).mockImplementation(async (imageId: string) => {
        if (imageId === "id-sha256:frontend-old") return { Id: imageId, Config: { Labels: { "org.opencontainers.image.version": "unknown" } } };
        if (imageId === "id-sha256:backend-old") return { Id: imageId, Config: null };
        return { Id: imageId, Config: { Labels: { "org.opencontainers.image.version": "v1.2.3" } } };
      });

      const result = await getUpdateStatus();

      assert.deepEqual(result.installedBuilds, {
        frontend: null,
        backend: null,
        "update-agent": { version: "v1.2.3", revision: "unknown" }
      });
    });

    it("reports a build as null when image inspect fails or no container runs", async () => {
      runningImages(oldImages);
      (inspectImage as any).mockRejectedValue(new Error("no such image"));

      const result = await getUpdateStatus();

      assert.deepEqual(result.installedBuilds, { frontend: null, backend: null, "update-agent": null });
      assert.equal((inspectImage as any).mock.calls.length, 2);
    });
  });
});
