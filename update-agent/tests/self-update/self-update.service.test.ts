import { describe, it, beforeEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import {
  getComposeServiceContainer,
  inspectContainer,
  pullImageByDigest,
  removeContainerByName,
  createBodyFromInspect,
  createContainer,
  startContainer
} from "../../src/docker/docker.service.js";
import { launchSelfUpdate } from "../../src/self-update/self-update.service.js";
import type { DockerContainerInspect, DockerContainerSummary } from "../../src/docker/docker.types.js";

vi.mock("../../src/docker/docker.service.js", () => ({
  getComposeServiceContainer: vi.fn(),
  inspectContainer: vi.fn(),
  pullImageByDigest: vi.fn(),
  removeContainerByName: vi.fn(),
  createBodyFromInspect: vi.fn(),
  createContainer: vi.fn(),
  startContainer: vi.fn()
}));

function runningContainer(overrides: Partial<DockerContainerSummary> = {}): DockerContainerSummary {
  return {
    Id: "running-id",
    Names: ["/update-agent"],
    State: "running",
    Image: "edge-studio/update-agent:old",
    ImageID: "sha256:old",
    Labels: { "com.docker.compose.project": "edge-studio", "com.docker.compose.service": "update-agent" },
    ...overrides
  };
}

function inspectFixture(overrides: Partial<DockerContainerInspect> = {}): DockerContainerInspect {
  return {
    Id: "running-id",
    Name: "/update-agent",
    Image: "edge-studio/update-agent:old",
    State: { Running: true },
    Config: { Env: [], Labels: {}, ExposedPorts: {} },
    HostConfig: { Binds: [], GroupAdd: [], ExtraHosts: [] },
    NetworkSettings: { Networks: {} },
    ...overrides
  };
}

const NEW_IMAGE = "ghcr.io/edge-studio/update-agent@sha256:newdigest";

describe("self-update.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (inspectContainer as any).mockResolvedValue(inspectFixture());
    (createBodyFromInspect as any).mockReturnValue({ Image: NEW_IMAGE });
    (createContainer as any).mockResolvedValue({ Id: "orchestrator-id" });
  });

  describe("launchSelfUpdate", () => {
    it("throws when no running container is found for update-agent", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(null);

      await assert.rejects(launchSelfUpdate(NEW_IMAGE), /no running container found for service "update-agent"/);
      assert.equal((pullImageByDigest as any).mock.calls.length, 0);
    });

    it("no-ops when the running container already has the target image", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(runningContainer({ Image: NEW_IMAGE }));

      await launchSelfUpdate(NEW_IMAGE);

      assert.equal((pullImageByDigest as any).mock.calls.length, 0);
      assert.equal((createContainer as any).mock.calls.length, 0);
    });

    it("pulls the image, clears a stale orchestrator, and starts a new one-shot orchestrator container", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(runningContainer());

      await launchSelfUpdate(NEW_IMAGE);

      assert.deepEqual((pullImageByDigest as any).mock.calls[0], [NEW_IMAGE]);
      assert.deepEqual((removeContainerByName as any).mock.calls[0], ["update-agent-self-update-orchestrator"]);
      assert.deepEqual((createBodyFromInspect as any).mock.calls[0], [
        inspectFixture(),
        NEW_IMAGE,
        false,
        {
          extraEnv: [`SELF_UPDATE_TARGET_IMAGE=${NEW_IMAGE}`, "OLD_CONTAINER_ID=running-id"],
          cmd: ["node", "dist/self-update/orchestrator.js"],
          oneShot: true,
          stripComposeServiceLabel: true
        }
      ]);
      assert.deepEqual((createContainer as any).mock.calls[0], [
        "update-agent-self-update-orchestrator",
        { Image: NEW_IMAGE }
      ]);
      assert.deepEqual((startContainer as any).mock.calls[0], ["orchestrator-id"]);
    });

    it("propagates a pull failure without creating a container", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(runningContainer());
      (pullImageByDigest as any).mockRejectedValue(new Error("pull failed"));

      await assert.rejects(launchSelfUpdate(NEW_IMAGE), /pull failed/);

      assert.equal((removeContainerByName as any).mock.calls.length, 0);
      assert.equal((createContainer as any).mock.calls.length, 0);
    });

    it("propagates a container-create failure", async () => {
      (getComposeServiceContainer as any).mockResolvedValue(runningContainer());
      (createContainer as any).mockRejectedValue(new Error("name conflict"));

      await assert.rejects(launchSelfUpdate(NEW_IMAGE), /name conflict/);

      assert.equal((startContainer as any).mock.calls.length, 0);
    });
  });
});
