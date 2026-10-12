import { EventEmitter } from "node:events";
import { vi } from "vitest";

export function createMinimaDockerMock() {
  const state = {
    containerId: "resync-container",
    restartCount: 0,
    startedAt: "2026-01-01T00:00:00.000Z",
    running: true,
    status: "running",
    unavailable: false,
    startFails: false,
    paths: [] as string[]
  };
  const request = vi.fn((options: { path: string; method: string }, callback: (response: EventEmitter & { statusCode: number; setEncoding: () => void }) => void) => {
    const req = new EventEmitter() as EventEmitter & { setTimeout: () => void; end: () => void; destroy: (error: Error) => void };
    req.setTimeout = () => {};
    req.destroy = (error) => { req.emit("error", error); };
    req.end = () => {
      state.paths.push(options.path);
      queueMicrotask(() => {
        if (state.unavailable) { req.emit("error", new Error("Docker unavailable password:docker-canary")); return; }
        const res = new EventEmitter() as EventEmitter & { statusCode: number; setEncoding: () => void };
        res.statusCode = options.method === "POST" && state.startFails ? 500 : 200;
        res.setEncoding = () => {};
        callback(res);
        const body = options.path === "/containers/json?all=1"
          ? [{ Id: state.containerId, Labels: { "com.docker.compose.project": "edge-studio", "com.docker.compose.service": "minima" } }]
          : { Id: state.containerId, RestartCount: state.restartCount, State: { Running: state.running, StartedAt: state.startedAt, Status: state.status } };
        res.emit("data", JSON.stringify(body));
        res.emit("end");
      });
    };
    return req;
  });
  return { state, module: { default: { request }, request } };
}
