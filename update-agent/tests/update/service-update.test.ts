import { describe, it, beforeEach, afterEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import {
  getComposeServiceContainer,
  inspectContainer,
  pullImageByDigest,
  createContainer,
  createBodyFromInspect,
  startContainer,
  stopContainer,
  removeContainer,
  removeContainerByName,
  renameContainer,
  waitForHealthy,
  pruneOldImages
} from "../../src/docker/docker.service.js";
import { startPullProgress, recordPullProgress, clearPullProgress } from "../../src/docker/pull-progress.js";
import { updateService } from "../../src/update/service-update.js";
import type { DockerContainerInspect, DockerContainerSummary } from "../../src/docker/docker.types.js";

vi.mock("../../src/docker/docker.service.js", () => ({
  getComposeServiceContainer: vi.fn(),
  inspectContainer: vi.fn(),
  pullImageByDigest: vi.fn(),
  createContainer: vi.fn(),
  createBodyFromInspect: vi.fn(),
  startContainer: vi.fn(),
  stopContainer: vi.fn(),
  removeContainer: vi.fn(),
  removeContainerByName: vi.fn(),
  renameContainer: vi.fn(),
  waitForHealthy: vi.fn(),
  pruneOldImages: vi.fn()
}));

vi.mock("../../src/docker/pull-progress.js", () => ({
  startPullProgress: vi.fn(),
  recordPullProgress: vi.fn(),
  clearPullProgress: vi.fn()
}));

function runningContainer(overrides: Partial<DockerContainerSummary> = {}): DockerContainerSummary {
  return {
    Id: "running-id",
    Names: ["/frontend"],
    State: "running",
    Image: "edge-studio/frontend:old",
    ImageID: "sha256:old",
    Labels: { "com.docker.compose.project": "edge-studio", "com.docker.compose.service": "frontend" },
    ...overrides
  };
}

function inspectFixture(overrides: Partial<DockerContainerInspect> = {}): DockerContainerInspect {
  return {
    Id: "running-id",
    Name: "/frontend",
    Image: "edge-studio/frontend:old",
    State: { Running: true },
    Config: { Env: [], Labels: {}, ExposedPorts: {} },
    HostConfig: { Binds: [], GroupAdd: [], ExtraHosts: [] },
    NetworkSettings: { Networks: {} },
    ...overrides
  };
}

const NEW_IMAGE = "ghcr.io/edge-studio/frontend@sha256:newdigest";

describe("service-update", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (createBodyFromInspect as any).mockReturnValue({ Image: NEW_IMAGE });
    (createContainer as any).mockResolvedValue({ Id: "candidate-id" });
    (waitForHealthy as any).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("updateService", () => {
    it("returns updated: false when no running container is found for the service", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(null);

      const result = await updateService("frontend", NEW_IMAGE);

      assert.deepEqual(result, { service: "frontend", updated: false, reason: 'no running container found for service "frontend"' });
      assert.equal((inspectContainer as any).mock.calls.length, 0);
    });

    it("returns updated: false when the running container already has the target image", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(runningContainer({ Image: NEW_IMAGE }));

      const result = await updateService("frontend", NEW_IMAGE);

      assert.deepEqual(result, { service: "frontend", updated: false, reason: "already up to date" });
      assert.equal((pullImageByDigest as any).mock.calls.length, 0);
    });

    it("propagates a pull failure and still clears pull progress", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(runningContainer());
      (inspectContainer as any).mockResolvedValue(inspectFixture());
      (pullImageByDigest as any).mockRejectedValue(new Error("pull failed"));

      await assert.rejects(updateService("frontend", NEW_IMAGE), /pull failed/);

      assert.equal((startPullProgress as any).mock.calls[0][0], "frontend");
      assert.equal((clearPullProgress as any).mock.calls.length, 1);
      assert.equal((createContainer as any).mock.calls.length, 0);
    });

    it("removes any stale update-candidate container left from a crashed previous run", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(runningContainer());
      (inspectContainer as any).mockResolvedValue(inspectFixture());
      (pullImageByDigest as any).mockResolvedValue(undefined);

      await updateService("frontend", NEW_IMAGE);

      assert.deepEqual((removeContainerByName as any).mock.calls[0], ["frontend-update-candidate"]);
    });

    it("stops, removes, and best-effort cleans up the candidate when the health check fails", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(runningContainer());
      (inspectContainer as any).mockResolvedValue(inspectFixture());
      (pullImageByDigest as any).mockResolvedValue(undefined);
      (waitForHealthy as any).mockResolvedValue(false);
      (stopContainer as any).mockRejectedValue(new Error("already stopped"));
      (removeContainer as any).mockRejectedValue(new Error("already removed"));

      const result = await updateService("frontend", NEW_IMAGE);

      assert.deepEqual(result, {
        service: "frontend",
        updated: false,
        reason: "new container failed health check; old container left running"
      });
      assert.deepEqual((stopContainer as any).mock.calls[0], ["candidate-id"]);
      assert.deepEqual((removeContainer as any).mock.calls[0], ["candidate-id"]);
      assert.equal((renameContainer as any).mock.calls.length, 0);
    });

    it("swaps in the healthy candidate when the service has no host port bindings", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(runningContainer());
      (inspectContainer as any).mockResolvedValue(inspectFixture({ HostConfig: { Binds: [], GroupAdd: [], ExtraHosts: [] } }));
      (pullImageByDigest as any).mockResolvedValue(undefined);

      const result = await updateService("frontend", NEW_IMAGE);

      assert.deepEqual((stopContainer as any).mock.calls[0], ["running-id"]);
      assert.deepEqual((removeContainer as any).mock.calls[0], ["running-id"]);
      assert.deepEqual((renameContainer as any).mock.calls[0], ["candidate-id", "frontend"]);
      assert.deepEqual((pruneOldImages as any).mock.calls[0], ["ghcr.io/edge-studio/frontend", 2]);
      assert.deepEqual(result, { service: "frontend", updated: true, reason: "updated and healthy" });
    });

    it("recreates the candidate with port bindings after freeing the port from the old container", async () => {
      const inspected = inspectFixture({
        HostConfig: { Binds: [], GroupAdd: [], ExtraHosts: [], PortBindings: { "80/tcp": [{ HostPort: "8080" }] } }
      });
      (getComposeServiceContainer as any).mockResolvedValue(runningContainer());
      (inspectContainer as any).mockResolvedValue(inspected);
      (pullImageByDigest as any).mockResolvedValue(undefined);
      (createContainer as any)
        .mockResolvedValueOnce({ Id: "candidate-id" })
        .mockResolvedValueOnce({ Id: "candidate-id-2" });

      const result = await updateService("frontend", NEW_IMAGE);

      assert.deepEqual((stopContainer as any).mock.calls[0], ["running-id"]);
      assert.deepEqual((removeContainer as any).mock.calls[0], ["running-id"]);
      assert.deepEqual((stopContainer as any).mock.calls[1], ["candidate-id"]);
      assert.deepEqual((removeContainer as any).mock.calls[1], ["candidate-id"]);
      assert.deepEqual((createBodyFromInspect as any).mock.calls[1], [inspected, NEW_IMAGE, true]);
      assert.deepEqual((startContainer as any).mock.calls[1], ["candidate-id-2"]);
      assert.deepEqual((renameContainer as any).mock.calls[0], ["candidate-id-2", "frontend"]);
      assert.deepEqual(result, { service: "frontend", updated: true, reason: "updated and healthy" });
    });

    it("restores the previous container when recreating with port bindings fails", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(runningContainer());
      (inspectContainer as any).mockResolvedValue(
        inspectFixture({ HostConfig: { Binds: [], GroupAdd: [], ExtraHosts: [], PortBindings: { "80/tcp": [{ HostPort: "8080" }] } } })
      );
      (pullImageByDigest as any).mockResolvedValue(undefined);
      (createContainer as any)
        .mockResolvedValueOnce({ Id: "candidate-id" })
        .mockRejectedValueOnce(new Error("port already in use"))
        .mockResolvedValueOnce({ Id: "restored-id" });
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const result = await updateService("frontend", NEW_IMAGE);

      assert.deepEqual((createContainer as any).mock.calls[2], ["frontend", { Image: NEW_IMAGE }]);
      assert.deepEqual((startContainer as any).mock.calls.at(-1), ["restored-id"]);
      assert.deepEqual(result, {
        service: "frontend",
        updated: false,
        reason: "failed to bind port on updated container; restored previous container — check update-agent's logs for details"
      });
    });

    it("best-effort cleans up the candidate and rethrows on an unexpected failure", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(runningContainer());
      (inspectContainer as any).mockResolvedValue(inspectFixture());
      (pullImageByDigest as any).mockResolvedValue(undefined);
      (startContainer as any).mockRejectedValue(new Error("start failed"));
      (stopContainer as any).mockRejectedValue(new Error("cleanup stop failed"));
      (removeContainer as any).mockRejectedValue(new Error("cleanup remove failed"));

      await assert.rejects(updateService("frontend", NEW_IMAGE), /start failed/);

      assert.deepEqual((stopContainer as any).mock.calls[0], ["candidate-id"]);
      assert.deepEqual((removeContainer as any).mock.calls[0], ["candidate-id"]);
    });
  });
});
