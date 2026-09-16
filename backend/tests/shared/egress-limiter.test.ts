import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { EgressQueueFullError, egressLimiter } from "../../src/shared/egress-limiter.js";
import { env } from "../../src/config/env.js";

/** A promise plus the handles to settle it, so a task can be held open on purpose. */
function deferred() {
  let resolve: () => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res as () => void;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("egressLimiter", () => {
  it("runs a task and returns its value", async () => {
    assert.equal(await egressLimiter.run(async () => "done"), "done");
    assert.deepEqual(egressLimiter.stats, { active: 0, queued: 0 });
  });

  it("releases the slot when the task throws", async () => {
    await assert.rejects(() => egressLimiter.run(async () => {
      throw new Error("upstream down");
    }), /upstream down/);

    assert.deepEqual(egressLimiter.stats, { active: 0, queued: 0 });
  });

  it("holds requests past the concurrency limit until a slot frees, then runs them", async () => {
    const gates = Array.from({ length: env.egressMaxConcurrent }, () => deferred());
    const inFlight = gates.map((gate) => egressLimiter.run(() => gate.promise));

    let queuedRan = false;
    const queued = egressLimiter.run(async () => {
      queuedRan = true;
    });

    await Promise.resolve();
    assert.equal(queuedRan, false, "the queued task must not start while every slot is taken");
    assert.equal(egressLimiter.stats.active, env.egressMaxConcurrent);
    assert.equal(egressLimiter.stats.queued, 1);

    gates[0].resolve();
    await inFlight[0];
    await queued;
    assert.equal(queuedRan, true);

    for (const gate of gates) gate.resolve();
    await Promise.all(inFlight);
    assert.deepEqual(egressLimiter.stats, { active: 0, queued: 0 });
  });

  it("rejects immediately once the queue is full instead of growing an unbounded backlog", async () => {
    const gates = Array.from({ length: env.egressMaxConcurrent }, () => deferred());
    const inFlight = gates.map((gate) => egressLimiter.run(() => gate.promise));
    const queued = Array.from({ length: env.egressQueueLimit }, () => egressLimiter.run(async () => {}));

    await assert.rejects(() => egressLimiter.run(async () => "never runs"), EgressQueueFullError);
    assert.equal(egressLimiter.stats.queued, env.egressQueueLimit);

    for (const gate of gates) gate.resolve();
    await Promise.all([...inFlight, ...queued]);
    assert.deepEqual(egressLimiter.stats, { active: 0, queued: 0 });
  });
});
