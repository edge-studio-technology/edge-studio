import { describe, it, beforeEach, afterEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import { dockerRequest, dockerRequestStream } from "../../src/docker/docker.client.js";
import * as dockerService from "../../src/docker/docker.service.js";
import type { DockerContainerInspect, DockerContainerSummary, DockerImageSummary } from "../../src/docker/docker.types.js";

vi.mock("../../src/docker/docker.client.js", () => ({
  dockerRequest: vi.fn(),
  dockerRequestStream: vi.fn()
}));

function composeContainer(overrides: Partial<DockerContainerSummary> = {}): DockerContainerSummary {
  return {
    Id: "container-id",
    Names: ["/frontend"],
    State: "running",
    Image: "edge-studio/frontend:latest",
    ImageID: "sha256:abc",
    Labels: { "com.docker.compose.project": "edge-studio", "com.docker.compose.service": "frontend" },
    ...overrides
  };
}

function baseInspect(overrides: Partial<DockerContainerInspect> = {}): DockerContainerInspect {
  return {
    Id: "container-id",
    Name: "/frontend",
    Image: "edge-studio/frontend:latest",
    State: { Running: true },
    Config: {
      Env: ["FOO=bar"],
      Labels: { "com.docker.compose.service": "frontend" },
      ExposedPorts: { "80/tcp": {} }
    },
    HostConfig: {
      Binds: ["/data:/data"],
      GroupAdd: ["999"],
      RestartPolicy: { Name: "unless-stopped" },
      ExtraHosts: ["host.docker.internal:host-gateway"],
      PortBindings: { "80/tcp": [{ HostPort: "8080" }] }
    },
    NetworkSettings: {
      Networks: { "edge-studio_default": { Aliases: ["frontend"] } }
    },
    ...overrides
  };
}

describe("docker.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getComposeServiceContainer", () => {
    it("returns the container matching the compose project and service labels", async () => {
      (dockerRequest as any).mockResolvedValue([
        composeContainer({ Labels: { "com.docker.compose.project": "other", "com.docker.compose.service": "frontend" } }),
        composeContainer()
      ]);

      const result = await dockerService.getComposeServiceContainer("frontend");

      assert.equal(result?.Id, "container-id");
      assert.deepEqual((dockerRequest as any).mock.calls[0], ["GET", "/containers/json?all=1"]);
    });

    it("returns null when no container matches", async () => {
      (dockerRequest as any).mockResolvedValue([composeContainer({ Labels: { "com.docker.compose.project": "edge-studio", "com.docker.compose.service": "backend" } })]);

      const result = await dockerService.getComposeServiceContainer("frontend");

      assert.equal(result, null);
    });
  });

  describe("inspectContainer", () => {
    it("requests the container's inspect endpoint", async () => {
      (dockerRequest as any).mockResolvedValue(baseInspect());

      await dockerService.inspectContainer("abc123");

      assert.deepEqual((dockerRequest as any).mock.calls[0], ["GET", "/containers/abc123/json"]);
    });
  });

  describe("pullImageByDigest", () => {
    it("streams the pull with the image ref URL-encoded and the configured timeout", async () => {
      (dockerRequestStream as any).mockResolvedValue(undefined);
      const onProgress = vi.fn();

      await dockerService.pullImageByDigest("edge-studio/frontend@sha256:abc", onProgress);

      const [path, timeoutMs, progressCb] = (dockerRequestStream as any).mock.calls[0];
      assert.equal(path, "/images/create?fromImage=edge-studio%2Ffrontend%40sha256%3Aabc");
      assert.equal(typeof timeoutMs, "number");
      assert.equal(progressCb, onProgress);
    });
  });

  describe("createContainer", () => {
    it("posts to the create endpoint with the URL-encoded name and config body", async () => {
      (dockerRequest as any).mockResolvedValue({ Id: "new-id" });
      const config = { Image: "edge-studio/frontend:latest" };

      const result = await dockerService.createContainer("frontend update-candidate", config);

      assert.deepEqual((dockerRequest as any).mock.calls[0], [
        "POST",
        "/containers/create?name=frontend%20update-candidate",
        config
      ]);
      assert.deepEqual(result, { Id: "new-id" });
    });
  });

  describe("createBodyFromInspect", () => {
    it("builds a create body from inspect output, omitting port bindings by default", () => {
      const body = dockerService.createBodyFromInspect(baseInspect(), "edge-studio/frontend@sha256:new");

      assert.equal(body.Image, "edge-studio/frontend@sha256:new");
      assert.deepEqual(body.Env, ["FOO=bar"]);
      assert.equal(body.Cmd, undefined);
      assert.deepEqual(body.Labels, { "com.docker.compose.service": "frontend" });
      assert.deepEqual(body.ExposedPorts, { "80/tcp": {} });
      assert.deepEqual(body.HostConfig.Binds, ["/data:/data"]);
      assert.deepEqual(body.HostConfig.RestartPolicy, { Name: "unless-stopped" });
      assert.equal(body.HostConfig.AutoRemove, undefined);
      assert.equal(body.HostConfig.PortBindings, undefined);
      assert.deepEqual(body.NetworkingConfig.EndpointsConfig, {
        "edge-studio_default": { Aliases: ["frontend"] }
      });
    });

    it("includes port bindings when includePortBindings is true", () => {
      const body = dockerService.createBodyFromInspect(baseInspect(), "edge-studio/frontend@sha256:new", true);

      assert.deepEqual(body.HostConfig.PortBindings, { "80/tcp": [{ HostPort: "8080" }] });
    });

    it("appends extraEnv and overrides Cmd when provided", () => {
      const body = dockerService.createBodyFromInspect(baseInspect(), "edge-studio/frontend@sha256:new", false, {
        extraEnv: ["SELF_UPDATE=true"],
        cmd: ["node", "self-update.js"]
      });

      assert.deepEqual(body.Env, ["FOO=bar", "SELF_UPDATE=true"]);
      assert.deepEqual(body.Cmd, ["node", "self-update.js"]);
    });

    it("forces a one-shot restart policy and auto-remove when oneShot is set", () => {
      const body = dockerService.createBodyFromInspect(baseInspect(), "edge-studio/frontend@sha256:new", false, {
        oneShot: true
      });

      assert.deepEqual(body.HostConfig.RestartPolicy, { Name: "no" });
      assert.equal(body.HostConfig.AutoRemove, true);
    });

    it("strips the compose service label when stripComposeServiceLabel is set", () => {
      const body = dockerService.createBodyFromInspect(baseInspect(), "edge-studio/frontend@sha256:new", false, {
        stripComposeServiceLabel: true
      });

      assert.deepEqual(body.Labels, {});
    });

    it("defaults network aliases to an empty array when none are set", () => {
      const inspected = baseInspect({ NetworkSettings: { Networks: { "edge-studio_default": { Aliases: null } } } });

      const body = dockerService.createBodyFromInspect(inspected, "edge-studio/frontend@sha256:new");

      assert.deepEqual(body.NetworkingConfig.EndpointsConfig, { "edge-studio_default": { Aliases: [] } });
    });
  });

  describe("startContainer / stopContainer / removeContainer / renameContainer", () => {
    it("starts a container", async () => {
      (dockerRequest as any).mockResolvedValue(undefined);
      await dockerService.startContainer("abc");
      assert.deepEqual((dockerRequest as any).mock.calls[0], ["POST", "/containers/abc/start"]);
    });

    it("stops a container with the default timeout", async () => {
      (dockerRequest as any).mockResolvedValue(undefined);
      await dockerService.stopContainer("abc");
      assert.deepEqual((dockerRequest as any).mock.calls[0], ["POST", "/containers/abc/stop?t=10"]);
    });

    it("stops a container with a custom timeout", async () => {
      (dockerRequest as any).mockResolvedValue(undefined);
      await dockerService.stopContainer("abc", 30);
      assert.deepEqual((dockerRequest as any).mock.calls[0], ["POST", "/containers/abc/stop?t=30"]);
    });

    it("force-removes a container", async () => {
      (dockerRequest as any).mockResolvedValue(undefined);
      await dockerService.removeContainer("abc");
      assert.deepEqual((dockerRequest as any).mock.calls[0], ["DELETE", "/containers/abc?force=1"]);
    });

    it("renames a container with the URL-encoded new name", async () => {
      (dockerRequest as any).mockResolvedValue(undefined);
      await dockerService.renameContainer("abc", "frontend old");
      assert.deepEqual((dockerRequest as any).mock.calls[0], ["POST", "/containers/abc/rename?name=frontend%20old"]);
    });
  });

  describe("removeContainerByName", () => {
    it("removes the container whose name matches", async () => {
      (dockerRequest as any)
        .mockResolvedValueOnce([composeContainer({ Id: "match-id", Names: ["/frontend-update-candidate"] })])
        .mockResolvedValueOnce(undefined);

      await dockerService.removeContainerByName("frontend-update-candidate");

      assert.deepEqual((dockerRequest as any).mock.calls[1], ["DELETE", "/containers/match-id?force=1"]);
    });

    it("is a no-op when no container matches the name", async () => {
      (dockerRequest as any).mockResolvedValueOnce([composeContainer({ Names: ["/frontend"] })]);

      await dockerService.removeContainerByName("frontend-update-candidate");

      assert.equal((dockerRequest as any).mock.calls.length, 1);
    });
  });

  describe("isContainerHealthy", () => {
    it("returns false when the container is not running", async () => {
      (dockerRequest as any).mockResolvedValue(baseInspect({ State: { Running: false } }));

      assert.equal(await dockerService.isContainerHealthy("abc"), false);
    });

    it("returns running state when there is no health check configured", async () => {
      (dockerRequest as any).mockResolvedValue(baseInspect({ State: { Running: true } }));

      assert.equal(await dockerService.isContainerHealthy("abc"), true);
    });

    it("returns true when health status is healthy", async () => {
      (dockerRequest as any).mockResolvedValue(baseInspect({ State: { Running: true, Health: { Status: "healthy" } } }));

      assert.equal(await dockerService.isContainerHealthy("abc"), true);
    });

    it("returns false when health status is not healthy", async () => {
      (dockerRequest as any).mockResolvedValue(baseInspect({ State: { Running: true, Health: { Status: "starting" } } }));

      assert.equal(await dockerService.isContainerHealthy("abc"), false);
    });
  });

  describe("waitForHealthy", () => {
    it("resolves true immediately when the container is already healthy", async () => {
      (dockerRequest as any).mockResolvedValue(baseInspect({ State: { Running: true } }));

      const result = await dockerService.waitForHealthy("abc", 5000, 100);

      assert.equal(result, true);
    });

    it("retries until healthy within the timeout", async () => {
      vi.useFakeTimers();
      (dockerRequest as any)
        .mockResolvedValueOnce(baseInspect({ State: { Running: true, Health: { Status: "starting" } } }))
        .mockResolvedValueOnce(baseInspect({ State: { Running: true, Health: { Status: "healthy" } } }));

      const promise = dockerService.waitForHealthy("abc", 5000, 100);
      await vi.advanceTimersByTimeAsync(100);

      assert.equal(await promise, true);
    });

    it("keeps polling past a transient inspect error", async () => {
      vi.useFakeTimers();
      (dockerRequest as any)
        .mockRejectedValueOnce(new Error("not found"))
        .mockResolvedValueOnce(baseInspect({ State: { Running: true } }));

      const promise = dockerService.waitForHealthy("abc", 5000, 100);
      await vi.advanceTimersByTimeAsync(100);

      assert.equal(await promise, true);
    });

    it("returns false once the deadline passes without becoming healthy", async () => {
      vi.useFakeTimers();
      (dockerRequest as any).mockResolvedValue(baseInspect({ State: { Running: true, Health: { Status: "starting" } } }));

      const promise = dockerService.waitForHealthy("abc", 250, 100);
      await vi.advanceTimersByTimeAsync(300);

      assert.equal(await promise, false);
    });
  });

  describe("listImagesForRepo", () => {
    function image(overrides: Partial<DockerImageSummary> = {}): DockerImageSummary {
      return { Id: "sha256:img", RepoDigests: ["edge-studio/frontend@sha256:img"], Created: 100, ...overrides };
    }

    it("filters images by repo digest prefix", async () => {
      (dockerRequest as any).mockResolvedValue([
        image({ Id: "match", RepoDigests: ["edge-studio/frontend@sha256:match"] }),
        image({ Id: "other", RepoDigests: ["edge-studio/backend@sha256:other"] })
      ]);

      const result = await dockerService.listImagesForRepo("edge-studio/frontend");

      assert.deepEqual(result.map((i) => i.Id), ["match"]);
    });

    it("sorts results by Created descending", async () => {
      (dockerRequest as any).mockResolvedValue([
        image({ Id: "older", Created: 100 }),
        image({ Id: "newer", Created: 200 })
      ]);

      const result = await dockerService.listImagesForRepo("edge-studio/frontend");

      assert.deepEqual(result.map((i) => i.Id), ["newer", "older"]);
    });

    it("excludes images with no RepoDigests", async () => {
      (dockerRequest as any).mockResolvedValue([image({ Id: "untagged", RepoDigests: undefined })]);

      const result = await dockerService.listImagesForRepo("edge-studio/frontend");

      assert.deepEqual(result, []);
    });
  });

  describe("removeImage", () => {
    it("deletes the image without forcing", async () => {
      (dockerRequest as any).mockResolvedValue(undefined);
      await dockerService.removeImage("sha256:img");
      assert.deepEqual((dockerRequest as any).mock.calls[0], ["DELETE", "/images/sha256:img?force=0"]);
    });
  });

  describe("pruneOldImages", () => {
    function image(id: string, created: number) {
      return { Id: id, RepoDigests: [`edge-studio/frontend@${id}`], Created: created };
    }

    it("removes images beyond the keep count, newest first preserved", async () => {
      (dockerRequest as any)
        .mockResolvedValueOnce([image("a", 300), image("b", 200), image("c", 100)])
        .mockResolvedValueOnce(undefined);

      await dockerService.pruneOldImages("edge-studio/frontend", 2);

      assert.deepEqual((dockerRequest as any).mock.calls[1], ["DELETE", "/images/c?force=0"]);
      assert.equal((dockerRequest as any).mock.calls.length, 2);
    });

    it("continues pruning even if one removal fails", async () => {
      (dockerRequest as any)
        .mockResolvedValueOnce([image("a", 300), image("b", 200), image("c", 100)])
        .mockRejectedValueOnce(new Error("in use"))
        .mockResolvedValueOnce(undefined);

      await dockerService.pruneOldImages("edge-studio/frontend", 1);

      assert.equal((dockerRequest as any).mock.calls.length, 3);
    });
  });
});
