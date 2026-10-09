import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const docker = await import("../../helpers/minimaDocker.js").then(({ createMinimaDockerMock }) => createMinimaDockerMock());
vi.mock("node:http", async () => {
  const real = await vi.importActual<typeof import("node:http")>("node:http");
  return { ...real, ...docker.module, default: { ...real, ...docker.module.default } };
});

let db: import("better-sqlite3").Database;
let teardown: () => void;
let service: typeof import("../../../src/features/minima/minima-resync.service.js");
let monitoring: typeof import("../../../src/features/minima/minima-monitoring.js");
const fetchMock = vi.fn();
const captured = JSON.parse(readFileSync(new URL("../../fixtures/minima/resync-lifecycle.json", import.meta.url), "utf8"));

beforeAll(async () => {
  ({ db, teardown } = await setupTestDatabase());
  service = await import("../../../src/features/minima/minima-resync.service.js");
  monitoring = await import("../../../src/features/minima/minima-monitoring.js");
});
beforeEach(() => {
  db.prepare("DELETE FROM settings WHERE key = 'minima_resync_operation'").run();
  service.stopMinimaResyncObserver();
  Object.assign(docker.state, { containerId: "resync-container", restartCount: 0, startedAt: "2026-01-01T00:00:00.000Z", running: true, status: "running", unavailable: false, startFails: false, paths: [] });
  monitoring.endMinimaOperation();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { service.stopMinimaResyncObserver(); vi.unstubAllGlobals(); vi.useRealTimers(); });
afterAll(() => { teardown(); });

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}
async function flush() { await new Promise<void>((resolve) => setImmediate(resolve)); }

describe("resync initiation and reservation", () => {
  it("reserves/persists before dispatch, returns immediately, and rejects duplicate commands", async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const accepted = service.startMinimaResync("megammr.minima.global:9001");
    assert.equal(accepted.phase, "starting");
    assert.equal(accepted.outcome, null);
    assert.equal(fetchMock.mock.calls.length, 0);
    assert.equal(service.getMinimaResyncOperation()?.id, accepted.id);
    assert.throws(() => service.startMinimaResync("other.host:9001"), /already active/);
    await flush();
    assert.equal(fetchMock.mock.calls.length, 1);
    finish(response(captured.completed));
    await flush();
    const operation = service.getMinimaResyncOperation()!;
    assert.equal(operation.phase, "recovering");
    assert.equal(operation.busy, true);
    assert.equal(operation.outcome, null);
    assert.equal(accepted.phase, "starting");
    assert.equal(accepted.events.length, 1);
  });

  for (const type of ["restart", "backup", "restore"] as const) {
    it(`refuses resync while legacy ${type} is active`, () => {
      monitoring.beginMinimaOperation(type);
      assert.throws(() => service.startMinimaResync("host:9001"), /already active/);
      assert.equal(fetchMock.mock.calls.length, 0);
      assert.equal(service.getMinimaResyncOperation(), null);
    });
  }

  it("keeps a pending mutation exclusive even if healthy status clears the display marker", () => {
    const release = service.reserveMinimaMutation();
    monitoring.beginMinimaOperation("restart");
    service.stopMinimaResyncObserver();
  Object.assign(docker.state, { containerId: "resync-container", restartCount: 0, startedAt: "2026-01-01T00:00:00.000Z", running: true, status: "running", unavailable: false, startFails: false, paths: [] });
  monitoring.endMinimaOperation();
    try {
      assert.throws(() => service.startMinimaResync("host:9001"), /already active/);
    } finally { release(); release(); }
    const other = service.reserveMinimaMutation();
    assert.throws(() => service.startMinimaResync("host:9001"), /already active/);
    other();
  });

  it("does not expire durable reservation with the legacy six-minute marker", async () => {
    fetchMock.mockResolvedValue(response(captured.completed));
    service.startMinimaResync("host:9001");
    await flush();
    vi.useFakeTimers();
    vi.advanceTimersByTime(7 * 60 * 1000);
    service.stopMinimaResyncObserver();
  Object.assign(docker.state, { containerId: "resync-container", restartCount: 0, startedAt: "2026-01-01T00:00:00.000Z", running: true, status: "running", unavailable: false, startFails: false, paths: [] });
  monitoring.endMinimaOperation();
    assert.throws(() => service.reserveMinimaMutation(), /already active/);
    assert.throws(() => service.startMinimaResync("host:9001"), /already active/);
    assert.equal(service.getMinimaResyncOperation()?.busy, true);
  });
});

describe("RPC outcomes", () => {
  for (const [label, body, httpStatus] of [
    ["RPC rejection in HTTP 200", captured.unreachableHost, 200],
    ["HTTP rejection", {}, 503]
  ] as const) {
    it(`records ${label} and releases only the matching reservation`, async () => {
      fetchMock.mockResolvedValue(response(body, httpStatus));
      const accepted = service.startMinimaResync("host:9001");
      await flush();
      const operation = service.getMinimaResyncOperation()!;
      assert.equal(operation.id, accepted.id);
      assert.equal(operation.phase, "failed");
      assert.equal(operation.busy, false);
      assert.equal(operation.outcome, "failed");
      assert.ok(operation.finishedAt);
      assert.equal(operation.errorDetails?.type, "minima_resync_rejected");
      assert.doesNotThrow(() => service.assertNoMinimaResync());
    });
  }

  it("retains uncertainty and ownership when the real request deadline aborts fetch", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("The operation was aborted", "AbortError")), { once: true });
    }));
    const accepted = service.startMinimaResync("host:9001");
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);
    assert.equal(service.getMinimaResyncOperation()?.errorDetails, null);
    await vi.advanceTimersByTimeAsync(270_000);
    const operation = service.getMinimaResyncOperation()!;
    assert.equal(operation.id, accepted.id);
    assert.equal(operation.phase, "recovering");
    assert.equal(operation.busy, true);
    assert.equal(operation.finishedAt, null);
    assert.equal(operation.errorDetails?.type, "minima_resync_transport_uncertain");
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("does not invent completion from an accepted or malformed envelope", async () => {
    fetchMock.mockResolvedValueOnce(response({ status: true, response: {} }));
    const first = service.startMinimaResync("host:9001");
    await flush();
    assert.equal(service.getMinimaResyncOperation()?.phase, "in_progress");
    assert.equal(service.getMinimaResyncOperation()?.outcome, null);
    service.updateMinimaResyncOperation(first.id, { phase: "unconfirmed", outcome: "unconfirmed", reserved: false, message: "Node reconciled." });
    fetchMock.mockResolvedValueOnce(response({}));
    service.startMinimaResync("host:9001");
    await flush();
    assert.equal(service.getMinimaResyncOperation()?.phase, "recovering");
    assert.equal(service.getMinimaResyncOperation()?.errorDetails?.type, "minima_resync_unconfirmed_response");
  });
});

describe("persistence and progress", () => {
  it("caps meaningful events, ignores identical observations, redacts writes and hides internal metadata", async () => {
    fetchMock.mockRejectedValue(new Error('socket closed password:"private-canary"'));
    const accepted = service.startMinimaResync("host:9001 password:host-canary", "console");
    await flush();
    let operation = service.getMinimaResyncOperation()!;
    const warning = operation.errorDetails;
    const eventCount = operation.events.length;
    service.updateMinimaResyncOperation(accepted.id, { phase: operation.phase, message: operation.message });
    assert.equal(service.getMinimaResyncOperation()?.events.length, eventCount);
    for (let i = 0; i < 110; i++) {
      service.updateMinimaResyncOperation(accepted.id, { phase: "recovering", message: `Observation ${i} password:event-canary` });
    }
    operation = service.getMinimaResyncOperation()!;
    assert.equal(operation.events.length, 100);
    assert.deepEqual(operation.errorDetails, warning);
    const stored = db.prepare("SELECT value FROM settings WHERE key = 'minima_resync_operation'").get() as { value: string };
    for (const secret of ["private-canary", "host-canary", "event-canary"]) assert.equal(stored.value.includes(secret), false);
    assert.equal("host" in operation, false);
    assert.equal("trigger" in operation, false);
    assert.equal("dispatchedAt" in operation, false);
    assert.equal("reserved" in operation, false);
    assert.equal("events" in service.getMinimaResyncSummary()!, false);
    assert.equal("errorDetails" in service.getMinimaResyncSummary()!, false);
    assert.equal(JSON.parse(stored.value).trigger, "console");
  });

  it("ignores old/finished owner callbacks and preserves an uncertain reservation", async () => {
    fetchMock.mockResolvedValue(response(captured.unreachableHost));
    const first = service.startMinimaResync("host:9001");
    await flush();
    assert.equal(service.updateMinimaResyncOperation(first.id, { phase: "completed", message: "late completion" }), false);
    fetchMock.mockResolvedValue(response(captured.completed));
    const second = service.startMinimaResync("host:9001");
    await flush();
    assert.equal(service.updateMinimaResyncOperation(first.id, { phase: "failed", reserved: false, message: "old failure" }), false);
    service.updateMinimaResyncOperation(second.id, { phase: "unconfirmed", outcome: "unconfirmed", message: "Still uncertain." });
    assert.equal(service.getMinimaResyncOperation()?.busy, true);
    assert.throws(() => service.startMinimaResync("host:9001"), /already active/);
  });

  it("reads persisted ownership after a module restart without replaying the command", async () => {
    fetchMock.mockResolvedValue(response(captured.completed));
    const accepted = service.startMinimaResync("host:9001", "auto");
    await flush();
    service.stopMinimaResyncObserver();
    vi.resetModules();
    const reloaded = await import("../../../src/features/minima/minima-resync.service.js");
    const freshDatabase = await import("../../../src/db/database.js");
    try {
      assert.equal(reloaded.getMinimaResyncOperation()?.id, accepted.id);
      assert.throws(() => reloaded.startMinimaResync("host:9001"), /already active/);
      assert.equal(fetchMock.mock.calls.length, 1);
      vi.useFakeTimers();
      cycle();
      fetchMock.mockResolvedValue(ready());
      reloaded.reconcileMinimaResync();
      await vi.advanceTimersByTimeAsync(3000);
      assert.equal(reloaded.getMinimaResyncOperation()?.outcome, "completed");
      assert.equal(fetchMock.mock.calls.filter(([url]) => decodeURIComponent(url).includes("action:resync")).length, 1);
    } finally { reloaded.stopMinimaResyncObserver(); freshDatabase.db.close(); }
  });

  it("fails closed for an unreadable persisted snapshot", () => {
    db.prepare("INSERT INTO settings(key,value) VALUES ('minima_resync_operation',?)").run("not-json");
    assert.throws(() => service.startMinimaResync("host:9001"), /persisted Minima resync state/);
    assert.throws(() => service.reserveMinimaMutation(), /persisted Minima resync state/);
    assert.equal(fetchMock.mock.calls.length, 0);
  });
});

function cycle() {
  docker.state.restartCount++;
  docker.state.startedAt = new Date().toISOString();
}
function ready(blockAgeSeconds = 5) {
  return response({ status: true, response: { chain: { block: 2357080, timemilli: Date.now() - blockAgeSeconds * 1000 } } });
}
async function initiate(body: unknown = captured.completed) {
  vi.useFakeTimers();
  fetchMock.mockResolvedValue(response(body));
  const operation = service.startMinimaResync("host:9001");
  await vi.advanceTimersByTimeAsync(0);
  return operation;
}

describe("backend resync recovery", () => {
  it("requires completion evidence, an actual process cycle, and usable chain RPC", async () => {
    const accepted = await initiate();
    fetchMock.mockResolvedValue(ready());
    await vi.advanceTimersByTimeAsync(3000);
    assert.equal(service.getMinimaResyncOperation()?.phase, "recovering");
    assert.equal(fetchMock.mock.calls.length, 1, "healthy RPC is not probed before a cycle");
    cycle();
    fetchMock.mockResolvedValue(response({ status: true, response: {} }));
    await vi.advanceTimersByTimeAsync(3000);
    assert.equal(service.getMinimaResyncOperation()?.busy, true, "RPC without a chain block is not usable");
    fetchMock.mockResolvedValue(ready());
    await vi.advanceTimersByTimeAsync(3000);
    const operation = service.getMinimaResyncOperation()!;
    assert.equal(operation.id, accepted.id);
    assert.equal(operation.phase, "completed");
    assert.equal(operation.recovered, true);
    assert.equal(operation.busy, false);
    assert.ok(operation.finishedAt);
    assert.equal(docker.state.paths.some((path) => /\/start|\/restart/.test(path)), false);
    const rows = db.prepare("SELECT action,detail FROM audit_events WHERE action LIKE 'minima.resync.%'").all() as { action: string; detail: string }[];
    const ownedRows = rows.filter((row) => JSON.parse(row.detail).id === accepted.id);
    assert.deepEqual(ownedRows.map((row) => row.action), ["minima.resync.started", "minima.resync.result"]);
    await vi.advanceTimersByTimeAsync(60_000);
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE detail LIKE ?").get(`%${accepted.id}%`) as { count: number }).count, 2);
  });

  it("observes a natural cycle while the response remains pending without losing later completion evidence", async () => {
    vi.useFakeTimers();
    let finish!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    service.startMinimaResync("host:9001");
    await vi.advanceTimersByTimeAsync(0);
    cycle();
    await vi.advanceTimersByTimeAsync(3000);
    assert.equal(service.getMinimaResyncOperation()?.phase, "recovering");
    assert.equal(service.getMinimaResyncOperation()?.outcome, null);
    finish(response(captured.completed));
    await vi.advanceTimersByTimeAsync(0);
    fetchMock.mockResolvedValue(ready());
    await vi.advanceTimersByTimeAsync(3000);
    assert.equal(service.getMinimaResyncOperation()?.outcome, "completed");
  });

  it("retains an interrupted-connection warning and reports recovered but unconfirmed", async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new Error("socket closed password:transport-canary"));
    service.startMinimaResync("host:9001");
    await vi.advanceTimersByTimeAsync(0);
    cycle();
    fetchMock.mockResolvedValue(ready());
    await vi.advanceTimersByTimeAsync(3000);
    const operation = service.getMinimaResyncOperation()!;
    assert.equal(operation.outcome, "unconfirmed");
    assert.equal(operation.recovered, true);
    assert.equal(operation.busy, false);
    assert.equal(operation.errorDetails?.type, "minima_resync_transport_uncertain");
    assert.equal(JSON.stringify(operation).includes("transport-canary"), false);
    assert.equal(fetchMock.mock.calls.filter(([url]) => decodeURIComponent(url).includes("action:resync")).length, 1);
  });

  it("expires cycle observation without forcing restart or releasing ownership, then reconciles a late cycle", async () => {
    await initiate();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    assert.equal(service.getMinimaResyncOperation()?.outcome, "unconfirmed");
    assert.equal(service.getMinimaResyncOperation()?.busy, true);
    assert.throws(() => service.reserveMinimaMutation(), /already active/);
    assert.equal(docker.state.paths.some((path) => /\/start|\/restart/.test(path)), false);
    cycle();
    fetchMock.mockResolvedValue(ready());
    await vi.advanceTimersByTimeAsync(30_000);
    assert.equal(service.getMinimaResyncOperation()?.outcome, "completed");
    assert.equal(service.getMinimaResyncOperation()?.busy, false);
    assert.equal(service.getMinimaResyncOperation()?.errorDetails?.type, "minima_resync_observation_expired");
  });

  it("bounds readiness separately and retains reservation on failed RPC", async () => {
    await initiate();
    cycle();
    fetchMock.mockResolvedValue(response({ status: false }));
    await vi.advanceTimersByTimeAsync(3000 + 2 * 60 * 1000);
    assert.equal(service.getMinimaResyncOperation()?.outcome, "unconfirmed");
    assert.equal(service.getMinimaResyncOperation()?.busy, true);
    assert.match(service.getMinimaResyncOperation()!.message, /usable RPC/);
  });

  it("starts an exited container only after confirmed completion and then waits for a cycle", async () => {
    await initiate();
    docker.state.running = false;
    docker.state.status = "exited";
    await vi.advanceTimersByTimeAsync(3000);
    assert.equal(docker.state.paths.filter((path) => path.endsWith("/start")).length, 1);
    await vi.advanceTimersByTimeAsync(3000);
    assert.equal(docker.state.paths.filter((path) => path.endsWith("/start")).length, 1);
    docker.state.running = true;
    docker.state.status = "running";
    cycle();
    fetchMock.mockResolvedValue(ready());
    await vi.advanceTimersByTimeAsync(3000);
    assert.equal(service.getMinimaResyncOperation()?.outcome, "completed");
  });

  it("does not start a stopped node after an uncertain response", async () => {
    await initiate({});
    docker.state.running = false;
    docker.state.status = "exited";
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    assert.equal(service.getMinimaResyncOperation()?.outcome, "unconfirmed");
    assert.equal(service.getMinimaResyncOperation()?.busy, true);
    assert.equal(docker.state.paths.some((path) => path.endsWith("/start")), false);
  });

  it("records start failure once and keeps the reservation until host recovery", async () => {
    await initiate();
    docker.state.running = false;
    docker.state.status = "exited";
    docker.state.startFails = true;
    await vi.advanceTimersByTimeAsync(30_000);
    assert.equal(service.getMinimaResyncOperation()?.phase, "failed");
    assert.equal(service.getMinimaResyncOperation()?.busy, true);
    assert.equal(service.getMinimaResyncOperation()?.errorDetails?.type, "minima_resync_start_failed");
    assert.equal(docker.state.paths.filter((path) => path.endsWith("/start")).length, 1);
    docker.state.running = true;
    cycle();
    fetchMock.mockResolvedValue(ready());
    await vi.advanceTimersByTimeAsync(3000);
    assert.equal(service.getMinimaResyncOperation()?.outcome, "completed");
  });

  it("reports stale or unavailable chain freshness without losing completion or transport warnings", async () => {
    await initiate();
    cycle();
    fetchMock.mockResolvedValue(ready(20_000));
    await vi.advanceTimersByTimeAsync(3000);
    assert.equal(service.getMinimaResyncOperation()?.outcome, "completed");
    assert.match(service.getMinimaResyncOperation()!.message, /catching up or stale/);
  });

  it("does not dispatch if baseline inspection fails", async () => {
    docker.state.unavailable = true;
    await initiate();
    assert.equal(fetchMock.mock.calls.length, 0);
    assert.equal(service.getMinimaResyncOperation()?.phase, "failed");
    assert.equal(service.getMinimaResyncOperation()?.busy, false);
    assert.equal(service.getMinimaResyncOperation()?.errorDetails?.type, "minima_resync_preflight_failed");
    assert.equal(JSON.stringify(service.getMinimaResyncOperation()).includes("docker-canary"), false);
  });

  it("resumes persisted observation without replay, including a replacement container", async () => {
    await initiate();
    service.stopMinimaResyncObserver();
    docker.state.containerId = "replacement-container";
    fetchMock.mockResolvedValue(ready());
    service.reconcileMinimaResync();
    await vi.advanceTimersByTimeAsync(3000);
    assert.equal(service.getMinimaResyncOperation()?.outcome, "completed");
    assert.equal(fetchMock.mock.calls.filter(([url]) => decodeURIComponent(url).includes("action:resync")).length, 1);
  });

  it("never replays a starting operation not yet dispatched", async () => {
    vi.useFakeTimers();
    service.startMinimaResync("host:9001");
    service.reconcileMinimaResync();
    await vi.advanceTimersByTimeAsync(0);
    assert.equal(service.getMinimaResyncOperation()?.busy, false);
    assert.equal(service.getMinimaResyncOperation()?.outcome, "unconfirmed");
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("fails closed for a legacy persisted operation lacking its baseline", async () => {
    const accepted = await initiate();
    service.stopMinimaResyncObserver();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'minima_resync_operation'").get() as { value: string };
    const stored = JSON.parse(row.value);
    delete stored.baseline;
    db.prepare("UPDATE settings SET value=? WHERE key='minima_resync_operation'").run(JSON.stringify(stored));
    service.reconcileMinimaResync();
    assert.equal(service.getMinimaResyncOperation()?.id, accepted.id);
    assert.equal(service.getMinimaResyncOperation()?.outcome, "unconfirmed");
    assert.equal(service.getMinimaResyncOperation()?.busy, true);
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("stops timers and ignores a pending callback after shutdown", async () => {
    vi.useFakeTimers();
    let finish!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    service.startMinimaResync("host:9001");
    await vi.advanceTimersByTimeAsync(0);
    service.stopMinimaResyncObserver();
    const before = service.getMinimaResyncOperation();
    finish(response(captured.completed));
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    assert.deepEqual(service.getMinimaResyncOperation(), before);
    assert.equal(fetchMock.mock.calls.length, 1);
  });
});

describe("recovery diagnostics and caller results", () => {
  it("uses a read-only block fallback and reports unavailable freshness", async () => {
    await initiate();
    cycle();
    fetchMock.mockResolvedValue(response({ status: true, response: { chain: { block: 2357080 } } }));
    await vi.advanceTimersByTimeAsync(3000);
    assert.equal(service.getMinimaResyncOperation()?.outcome, "completed");
    assert.match(service.getMinimaResyncOperation()!.message, /freshness is unavailable/);
    assert.ok(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === "/block"));
  });

  it("records the automatic terminal result without moving the initiation cooldown", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(response(captured.completed));
    const accepted = service.startMinimaResync("host:9001", "auto");
    monitoring.recordAutoResync(accepted.message, accepted.startedAt);
    await vi.advanceTimersByTimeAsync(0);
    service.stopMinimaResyncObserver();
    service.reconcileMinimaResync();
    assert.equal(monitoring.getMinimaMonitoringSnapshot().lastAutoResyncAt, accepted.startedAt);
    cycle();
    fetchMock.mockResolvedValue(ready());
    await vi.advanceTimersByTimeAsync(3000);
    assert.equal(monitoring.getMinimaMonitoringSnapshot().lastAutoResyncAt, accepted.startedAt);
    assert.match(monitoring.getMinimaMonitoringSnapshot().lastAutoResyncResult!, /Resync completed/);
  });

  it("expires even when Docker becomes unavailable, keeping the reservation", async () => {
    await initiate();
    docker.state.unavailable = true;
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    assert.equal(service.getMinimaResyncOperation()?.outcome, "unconfirmed");
    assert.equal(service.getMinimaResyncOperation()?.busy, true);
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("never starts a container in Docker's restarting state", async () => {
    await initiate();
    docker.state.running = false;
    docker.state.status = "restarting";
    await vi.advanceTimersByTimeAsync(3000);
    assert.equal(docker.state.paths.some((path) => path.endsWith("/start")), false);
  });

  it("cancels a queued dispatch when shutdown occurs before preflight", async () => {
    vi.useFakeTimers();
    service.startMinimaResync("host:9001");
    service.stopMinimaResyncObserver();
    await vi.advanceTimersByTimeAsync(0);
    assert.equal(fetchMock.mock.calls.length, 0);
    assert.equal(docker.state.paths.length, 0);
  });
});

describe("safe observer boundaries", () => {
  it("ignores pending observation results after shutdown", async () => {
    await initiate();
    cycle();
    let finish!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await vi.advanceTimersByTimeAsync(3000);
    service.stopMinimaResyncObserver();
    const before = service.getMinimaResyncOperation();
    finish(ready());
    await vi.advanceTimersByTimeAsync(0);
    assert.deepEqual(service.getMinimaResyncOperation(), before);
  });

  it("preserves ownership and handles a corrupt snapshot without an unhandled poll rejection", async () => {
    await initiate();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      db.prepare("UPDATE settings SET value='not-json' WHERE key='minima_resync_operation'").run();
      await vi.advanceTimersByTimeAsync(3000);
      assert.equal(log.mock.calls.length, 1);
      assert.throws(() => service.reserveMinimaMutation(), /persisted Minima resync state/);
      await vi.advanceTimersByTimeAsync(3000);
      assert.equal(log.mock.calls.length, 1);
    } finally { log.mockRestore(); }
  });

  it("rejects a corrupt process baseline rather than treating it as a cycle", async () => {
    await initiate();
    const row = db.prepare("SELECT value FROM settings WHERE key='minima_resync_operation'").get() as { value: string };
    const stored = JSON.parse(row.value);
    stored.baseline.startedAt = "invalid";
    db.prepare("UPDATE settings SET value=? WHERE key='minima_resync_operation'").run(JSON.stringify(stored));
    assert.throws(() => service.reconcileMinimaResync(), /persisted Minima resync state/);
    assert.throws(() => service.reserveMinimaMutation(), /persisted Minima resync state/);
  });
});
