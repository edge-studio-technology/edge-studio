import { describe, it, beforeEach, afterEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import {
  createBodyFromInspect,
  createContainer,
  inspectContainer,
  removeContainer,
  removeContainerByName,
  renameContainer,
  startContainer,
  stopContainer,
  waitForHealthy
} from "../../src/docker/docker.service.js";
import type { DockerContainerInspect } from "../../src/docker/docker.types.js";

vi.mock("../../src/config/env.js", () => ({ env: { healthCheckTimeoutMs: 30000, healthCheckIntervalMs: 1000 } }));
vi.mock("../../src/docker/docker.service.js", () => ({
  createBodyFromInspect: vi.fn(),
  createContainer: vi.fn(),
  inspectContainer: vi.fn(),
  removeContainer: vi.fn(),
  removeContainerByName: vi.fn(),
  renameContainer: vi.fn(),
  startContainer: vi.fn(),
  stopContainer: vi.fn(),
  waitForHealthy: vi.fn()
}));

function inspectFixture(overrides: Partial<DockerContainerInspect> = {}): DockerContainerInspect {
  return {
    Id: "old-id",
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
const CANDIDATE_NAME = "update-agent-self-update-candidate";

describe("self-update orchestrator", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    (inspectContainer as any).mockResolvedValue(inspectFixture());
    (createBodyFromInspect as any).mockReturnValue({ Image: NEW_IMAGE });
    (createContainer as any).mockResolvedValue({ Id: "candidate-id" });
    (waitForHealthy as any).mockResolvedValue(true);
    (stopContainer as any).mockResolvedValue(undefined);
    (removeContainer as any).mockResolvedValue(undefined);
    process.env.SELF_UPDATE_TARGET_IMAGE = NEW_IMAGE;
    process.env.OLD_CONTAINER_ID = "old-id";
  });

  afterEach(() => {
    delete process.env.SELF_UPDATE_TARGET_IMAGE;
    delete process.env.OLD_CONTAINER_ID;
  });

  it("exits with code 1 when SELF_UPDATE_TARGET_IMAGE is missing", async () => {
    delete process.env.SELF_UPDATE_TARGET_IMAGE;

    await import("../../src/self-update/orchestrator.js");
    await vi.waitFor(() => assert.equal(exitSpy.mock.calls.length, 1));

    assert.deepEqual(exitSpy.mock.calls[0], [1]);
    assert.match(String(errorSpy.mock.calls[0]?.[1]), /SELF_UPDATE_TARGET_IMAGE is required/);
  });

  it("exits with code 1 when OLD_CONTAINER_ID is missing", async () => {
    delete process.env.OLD_CONTAINER_ID;

    await import("../../src/self-update/orchestrator.js");
    await vi.waitFor(() => assert.equal(exitSpy.mock.calls.length, 1));

    assert.deepEqual(exitSpy.mock.calls[0], [1]);
    assert.match(String(errorSpy.mock.calls[0]?.[1]), /OLD_CONTAINER_ID is required/);
  });

  it("exits with code 0 and does nothing when the old container already has the target image", async () => {
    (inspectContainer as any).mockResolvedValue(inspectFixture({ Image: NEW_IMAGE }));

    await import("../../src/self-update/orchestrator.js");
    await vi.waitFor(() => assert.equal(exitSpy.mock.calls.length, 1));

    assert.deepEqual(exitSpy.mock.calls[0], [0]);
    assert.equal((createContainer as any).mock.calls.length, 0);
  });

  it("clears a stale candidate, creates/starts/health-checks it, then swaps in and exits 0", async () => {
    await import("../../src/self-update/orchestrator.js");
    await vi.waitFor(() => assert.equal(exitSpy.mock.calls.length, 1));

    assert.deepEqual((removeContainerByName as any).mock.calls[0], [CANDIDATE_NAME]);
    assert.deepEqual((createBodyFromInspect as any).mock.calls[0], [inspectFixture(), NEW_IMAGE]);
    assert.deepEqual((createContainer as any).mock.calls[0], [CANDIDATE_NAME, { Image: NEW_IMAGE }]);
    assert.deepEqual((startContainer as any).mock.calls[0], ["candidate-id"]);
    assert.deepEqual((waitForHealthy as any).mock.calls[0], ["candidate-id", 30000, 1000]);
    assert.deepEqual((stopContainer as any).mock.calls[0], ["old-id"]);
    assert.deepEqual((removeContainer as any).mock.calls[0], ["old-id"]);
    assert.deepEqual((renameContainer as any).mock.calls[0], ["candidate-id", "update-agent"]);
    assert.deepEqual(exitSpy.mock.calls[0], [0]);
  });

  it("leaves the old container untouched and exits 1 when the candidate fails its health check", async () => {
    (waitForHealthy as any).mockResolvedValue(false);

    await import("../../src/self-update/orchestrator.js");
    await vi.waitFor(() => assert.equal(exitSpy.mock.calls.length, 1));

    assert.deepEqual((stopContainer as any).mock.calls[0], ["candidate-id"]);
    assert.deepEqual((removeContainer as any).mock.calls[0], ["candidate-id"]);
    assert.equal((renameContainer as any).mock.calls.length, 0);
    assert.deepEqual(exitSpy.mock.calls[0], [1]);
    assert.match(
      String(errorSpy.mock.calls[0]?.[1]),
      /new update-agent container failed health check; old container left running/
    );
  });

  it("best-effort cleans up the candidate, leaves the old container untouched, and exits 1 on an unexpected failure", async () => {
    (startContainer as any).mockRejectedValue(new Error("start failed"));
    (stopContainer as any).mockRejectedValue(new Error("cleanup stop failed"));
    (removeContainer as any).mockRejectedValue(new Error("cleanup remove failed"));

    await import("../../src/self-update/orchestrator.js");
    await vi.waitFor(() => assert.equal(exitSpy.mock.calls.length, 1));

    assert.deepEqual((stopContainer as any).mock.calls[0], ["candidate-id"]);
    assert.deepEqual((removeContainer as any).mock.calls[0], ["candidate-id"]);
    assert.deepEqual(exitSpy.mock.calls[0], [1]);
    assert.match(String(errorSpy.mock.calls[0]?.[1]), /start failed/);
  });
});
