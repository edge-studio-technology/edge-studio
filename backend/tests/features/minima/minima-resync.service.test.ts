import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

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
  monitoring.endMinimaOperation();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
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
    vi.resetModules();
    const reloaded = await import("../../../src/features/minima/minima-resync.service.js");
    const freshDatabase = await import("../../../src/db/database.js");
    try {
      assert.equal(reloaded.getMinimaResyncOperation()?.id, accepted.id);
      assert.throws(() => reloaded.startMinimaResync("host:9001"), /already active/);
      assert.equal(fetchMock.mock.calls.length, 1);
    } finally { freshDatabase.db.close(); }
  });

  it("fails closed for an unreadable persisted snapshot", () => {
    db.prepare("INSERT INTO settings(key,value) VALUES ('minima_resync_operation',?)").run("not-json");
    assert.throws(() => service.startMinimaResync("host:9001"), /persisted Minima resync state/);
    assert.throws(() => service.reserveMinimaMutation(), /persisted Minima resync state/);
    assert.equal(fetchMock.mock.calls.length, 0);
  });
});
