import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

type Handler = (arg?: unknown) => void;

type Scenario =
  | { kind: "response"; statusCode: number; body: string }
  | { kind: "error"; error: Error }
  | { kind: "timeout" };

let scenario: Scenario = { kind: "response", statusCode: 200, body: "[]" };
let queuedScenarios: Scenario[] = [];
const requestedPaths: string[] = [];

const { requestMock, statfsMock } = vi.hoisted(() => ({ requestMock: vi.fn(), statfsMock: vi.fn() }));

vi.mock("node:http", () => ({
  default: { request: requestMock }
}));

vi.mock("node:fs/promises", () => ({
  default: { statfs: statfsMock }
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
      const current = queuedScenarios.shift() ?? scenario;
      if (current.kind === "error") {
        handlers.error?.(current.error);
        return;
      }
      if (current.kind === "timeout") {
        handlers.timeout?.();
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
  queuedScenarios = [];
  scenario = { kind: "response", statusCode: 200, body: "[]" };
  statfsMock.mockReset();
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

  it("rejects malformed Docker API JSON", async () => {
    scenario = { kind: "response", statusCode: 200, body: "not-json" };
    await assert.rejects(() => getComposeServiceContainer("backend"), SyntaxError);
  });

  it("destroys and rejects a timed-out Docker API request", async () => {
    scenario = { kind: "timeout" };
    await assert.rejects(() => getComposeServiceContainer("backend"), /Docker API request timed out/);
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
  it("reports CPU, working-set memory, and disk usage for a running container", async () => {
    queuedScenarios = [
      { kind: "response", statusCode: 200, body: JSON.stringify([container({ SizeRootFs: 4096 })]) },
      {
        kind: "response",
        statusCode: 200,
        body: JSON.stringify({
          cpu_stats: { cpu_usage: { total_usage: 300 }, system_cpu_usage: 1000, online_cpus: 2 },
          precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 500 },
          memory_stats: { usage: 1024, limit: 4096, stats: { cache: 256 } }
        })
      }
    ];

    const result = await dockerServiceResources();

    assert.equal(result[0]?.cpuPercent, 80);
    assert.deepEqual(result[0]?.memory, {
      usageBytes: 768,
      usage: "768 B",
      limitBytes: 4096,
      limit: "4.0 KB"
    });
    assert.deepEqual(result[0]?.disk, { rootFsBytes: 4096, rootFs: "4.0 KB" });
    assert.deepEqual(requestedPaths, [
      "/containers/json?all=1&size=1",
      "/containers/abc123def456/stats?stream=false"
    ]);
  });

  it("uses CPU and service-name fallbacks when Docker omits optional fields", async () => {
    queuedScenarios = [
      { kind: "response", statusCode: 200, body: JSON.stringify([container({ Names: [], Labels: { "com.docker.compose.project": "edge-studio" } })]) },
      {
        kind: "response",
        statusCode: 200,
        body: JSON.stringify({
          cpu_stats: { cpu_usage: { total_usage: 10, percpu_usage: [1, 2, 3, 4] }, system_cpu_usage: 100 },
          precpu_stats: { cpu_usage: { total_usage: 10 }, system_cpu_usage: 50 },
          memory_stats: { usage: 10, stats: { cache: 20 } }
        })
      }
    ];

    const result = await dockerServiceResources();
    assert.equal(result[0]?.service, "abc123def456");
    assert.equal(result[0]?.cpuPercent, 0);
    assert.equal(result[0]?.memory?.usageBytes, 0);
  });

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
  it("returns byte and formatted usage", async () => {
    statfsMock.mockResolvedValue({ blocks: 100, bsize: 1024, bavail: 25 });
    const result = await diskUsage("/data");
    assert.equal(result.path, "/data");
    assert.equal(result.totalBytes, 102400);
    assert.equal(result.usedBytes, result.totalBytes - result.freeBytes);
    assert.equal(result.usedPercent, 75);
  });

  it("reports zero percent when the filesystem reports zero total bytes", async () => {
    statfsMock.mockResolvedValue({ blocks: 0, bsize: 4096, bavail: 0 });
    const result = await diskUsage("/empty");
    assert.equal(result.usedPercent, 0);
  });
});
