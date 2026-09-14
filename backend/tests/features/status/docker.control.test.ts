import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

type Handler = (arg?: unknown) => void;

type Scenario =
  | { kind: "response"; statusCode: number; body: string }
  | { kind: "error"; error: Error };

let scenario: Scenario = { kind: "response", statusCode: 204, body: "" };
const requestedPaths: string[] = [];

const { requestMock, getComposeServiceContainerMock, inspectContainerMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  getComposeServiceContainerMock: vi.fn(),
  inspectContainerMock: vi.fn()
}));

vi.mock("node:http", () => ({
  default: { request: requestMock }
}));

vi.mock("../../../src/features/status/docker.service.js", () => ({
  getComposeServiceContainer: getComposeServiceContainerMock,
  inspectContainer: inspectContainerMock
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

const {
  restartComposeService,
  startComposeService,
  getContainerRestartBaseline,
  waitForContainerRestart
} = await import("../../../src/features/status/docker.control.js");

beforeEach(() => {
  requestedPaths.length = 0;
  scenario = { kind: "response", statusCode: 204, body: "" };
  getComposeServiceContainerMock.mockReset();
  inspectContainerMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("restartComposeService", () => {
  it("throws when the container is not found", async () => {
    getComposeServiceContainerMock.mockResolvedValue(null);
    await assert.rejects(() => restartComposeService("minima"), /Docker container not found for service "minima"/);
  });

  it("POSTs a restart and returns the restarting state", async () => {
    getComposeServiceContainerMock.mockResolvedValue({ Id: "abcdef123456789" });
    const result = await restartComposeService("minima");
    assert.deepEqual(result, { ok: true, state: "restarting", service: "minima", containerId: "abcdef123456" });
    assert.equal(requestedPaths[0], "/containers/abcdef123456789/restart?t=10");
  });

  it("rejects when the Docker API returns a non-2xx status", async () => {
    getComposeServiceContainerMock.mockResolvedValue({ Id: "abcdef123456789" });
    scenario = { kind: "response", statusCode: 500, body: "boom" };
    await assert.rejects(() => restartComposeService("minima"), /Docker API returned HTTP 500/);
  });
});

describe("startComposeService", () => {
  it("throws when the container is not found", async () => {
    getComposeServiceContainerMock.mockResolvedValue(null);
    await assert.rejects(() => startComposeService("minima"), /Docker container not found for service "minima"/);
  });

  it("POSTs a start and returns the running state", async () => {
    getComposeServiceContainerMock.mockResolvedValue({ Id: "abcdef123456789" });
    const result = await startComposeService("minima");
    assert.deepEqual(result, { ok: true, state: "running", service: "minima", containerId: "abcdef123456" });
    assert.equal(requestedPaths[0], "/containers/abcdef123456789/start");
  });

  it("treats HTTP 304 (already started) as success", async () => {
    getComposeServiceContainerMock.mockResolvedValue({ Id: "abcdef123456789" });
    scenario = { kind: "response", statusCode: 304, body: "" };
    const result = await startComposeService("minima");
    assert.equal(result.ok, true);
  });
});

describe("getContainerRestartBaseline", () => {
  it("returns restartCount/startedAt from the inspect result", async () => {
    inspectContainerMock.mockResolvedValue({
      Id: "abc",
      RestartCount: 3,
      State: { StartedAt: "2026-01-01T00:00:00.000Z", Running: true, Status: "running" }
    });
    const baseline = await getContainerRestartBaseline("abc");
    assert.deepEqual(baseline, { restartCount: 3, startedAt: "2026-01-01T00:00:00.000Z" });
  });
});

describe("waitForContainerRestart", () => {
  it("resolves true once RestartCount changes from the baseline", async () => {
    inspectContainerMock
      .mockResolvedValueOnce({ Id: "abc", RestartCount: 1, State: { StartedAt: "t0", Running: true, Status: "running" } })
      .mockResolvedValueOnce({ Id: "abc", RestartCount: 2, State: { StartedAt: "t0", Running: true, Status: "running" } });

    const result = await waitForContainerRestart("abc", { restartCount: 1, startedAt: "t0" }, 1000, 1);
    assert.equal(result, true);
  });

  it("resolves true once StartedAt changes from the baseline", async () => {
    inspectContainerMock.mockResolvedValueOnce({ Id: "abc", RestartCount: 1, State: { StartedAt: "t1", Running: true, Status: "running" } });

    const result = await waitForContainerRestart("abc", { restartCount: 1, startedAt: "t0" }, 1000, 1);
    assert.equal(result, true);
  });

  it("returns false once the timeout elapses without a change", async () => {
    inspectContainerMock.mockResolvedValue({ Id: "abc", RestartCount: 1, State: { StartedAt: "t0", Running: true, Status: "running" } });

    const result = await waitForContainerRestart("abc", { restartCount: 1, startedAt: "t0" }, 5, 2);
    assert.equal(result, false);
  });

  it("keeps polling past a transient inspect failure", async () => {
    inspectContainerMock
      .mockRejectedValueOnce(new Error("temporarily unavailable"))
      .mockResolvedValueOnce({ Id: "abc", RestartCount: 2, State: { StartedAt: "t0", Running: true, Status: "running" } });

    const result = await waitForContainerRestart("abc", { restartCount: 1, startedAt: "t0" }, 1000, 1);
    assert.equal(result, true);
  });
});
