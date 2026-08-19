import assert from "node:assert/strict";
import os from "node:os";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

type Handler = (arg?: unknown) => void;

type Scenario =
  | { kind: "response"; statusCode: number; body: string }
  | { kind: "error"; error: Error };

let scenario: Scenario = { kind: "response", statusCode: 200, body: "[]" };
const requestedPaths: string[] = [];

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock("node:http", () => ({
  default: { request: requestMock }
}));

requestMock.mockImplementation((options: { path: string }, callback: (res: unknown) => void) => {
  requestedPaths.push(options.path);
  const handlers: Record<string, Handler> = {};
  const req = {
    on(event: string, handler: Handler) {
      handlers[event] = handler;
      return req;
    },
    setTimeout(_ms: number, handler: Handler) {
      handlers.timeout = handler;
      return req;
    },
    end() {
      const current = scenario;
      if (current.kind === "error") {
        handlers.error?.(current.error);
        return;
      }
      const res = {
        statusCode: current.statusCode,
        setEncoding() {},
        on(event: string, handler: Handler) {
          if (event === "data") handler(current.body);
          if (event === "end") handler();
          return res;
        }
      };
      callback(res);
    },
    destroy(err?: Error) {
      handlers.error?.(err);
    }
  };
  return req;
});

const { getComposeServiceContainer, inspectContainer, dockerServiceResources, diskUsage } = await import(
  "../../../src/features/status/docker.service.js"
);

beforeEach(() => {
  requestedPaths.length = 0;
  scenario = { kind: "response", statusCode: 200, body: "[]" };
});

afterEach(() => {
  vi.clearAllMocks();
});

function container(overrides: Record<string, unknown> = {}) {
  return {
    Id: "abc123def456",
    Names: ["/edge-studio-backend-1"],
    State: "running",
    Status: "Up 2 hours",
    Labels: { "com.docker.compose.project": "edge-studio", "com.docker.compose.service": "backend" },
    ...overrides
  };
}

describe("getComposeServiceContainer", () => {
  it("returns the matching compose service container", async () => {
    scenario = { kind: "response", statusCode: 200, body: JSON.stringify([container()]) };
    const result = await getComposeServiceContainer("backend");
    assert.equal(result?.Id, "abc123def456");
    assert.equal(requestedPaths[0], "/containers/json?all=1");
  });

  it("returns null when no container matches the service label", async () => {
    scenario = { kind: "response", statusCode: 200, body: JSON.stringify([container()]) };
    const result = await getComposeServiceContainer("minima");
    assert.equal(result, null);
  });

  it("ignores containers outside the compose project", async () => {
    scenario = {
      kind: "response",
      statusCode: 200,
      body: JSON.stringify([container({ Labels: { "com.docker.compose.project": "other", "com.docker.compose.service": "backend" } })])
    };
    const result = await getComposeServiceContainer("backend");
    assert.equal(result, null);
  });

  it("rejects on a non-2xx Docker API response", async () => {
    scenario = { kind: "response", statusCode: 500, body: "boom" };
    await assert.rejects(() => getComposeServiceContainer("backend"), /Docker API returned HTTP 500/);
  });

  it("rejects on a transport error", async () => {
    scenario = { kind: "error", error: new Error("socket hang up") };
    await assert.rejects(() => getComposeServiceContainer("backend"), /socket hang up/);
  });
});

describe("inspectContainer", () => {
  it("requests the full inspect endpoint and returns the parsed body", async () => {
    scenario = {
      kind: "response",
      statusCode: 200,
      body: JSON.stringify({ Id: "abc123", RestartCount: 2, State: { StartedAt: "2026-01-01T00:00:00.000Z", Running: true, Status: "running" } })
    };
    const result = await inspectContainer("abc123");
    assert.equal(result.RestartCount, 2);
    assert.equal(requestedPaths[0], "/containers/abc123/json");
  });
});

describe("dockerServiceResources", () => {
  it("skips stats requests for non-running containers and reports null memory/cpu", async () => {
    scenario = {
      kind: "response",
      statusCode: 200,
      body: JSON.stringify([container({ State: "exited", Status: "Exited (0)" })])
    };
    const result = await dockerServiceResources();
    assert.equal(result.length, 1);
    assert.equal(result[0]?.cpuPercent, null);
    assert.equal(result[0]?.memory, null);
    assert.equal(requestedPaths.length, 1);
  });

  it("filters out containers from other compose projects", async () => {
    scenario = {
      kind: "response",
      statusCode: 200,
      body: JSON.stringify([container({ Labels: { "com.docker.compose.project": "other" } })])
    };
    const result = await dockerServiceResources();
    assert.deepEqual(result, []);
  });
});

describe("diskUsage", () => {
  it("returns byte and formatted usage for a real path", async () => {
    const result = await diskUsage(os.tmpdir());
    assert.equal(result.path, os.tmpdir());
    assert.equal(typeof result.totalBytes, "number");
    assert.equal(result.usedBytes, result.totalBytes - result.freeBytes);
    assert.ok(result.used);
    assert.match(result.used, /[KMGT]?B$/);
    assert.ok(result.usedPercent >= 0 && result.usedPercent <= 100);
  });
});
