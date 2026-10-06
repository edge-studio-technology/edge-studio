import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

const {
  getMinimaNodeStatusMock,
  resyncMegammrMock,
  canAutoResyncMock,
  detectStallMock,
  recordAutoResyncMock,
  recordPollerCheckMock,
  recordStallDetectedMock,
  initializeLocalAddressBookEntryMock
} = vi.hoisted(() => ({
  getMinimaNodeStatusMock: vi.fn(),
  resyncMegammrMock: vi.fn(),
  canAutoResyncMock: vi.fn(),
  detectStallMock: vi.fn(),
  recordAutoResyncMock: vi.fn(),
  recordPollerCheckMock: vi.fn(),
  recordStallDetectedMock: vi.fn(),
  initializeLocalAddressBookEntryMock: vi.fn()
}));

vi.mock("../../../src/features/address-book/address-book.service.js", () => ({
  initializeLocalAddressBookEntry: initializeLocalAddressBookEntryMock
}));

vi.mock("../../../src/features/minima/minima.service.js", () => ({
  getMinimaNodeStatus: getMinimaNodeStatusMock,
  resyncMegammr: resyncMegammrMock
}));

vi.mock("../../../src/features/minima/minima-monitoring.js", () => ({
  canAutoResync: canAutoResyncMock,
  detectStall: detectStallMock,
  recordAutoResync: recordAutoResyncMock,
  recordPollerCheck: recordPollerCheckMock,
  recordStallDetected: recordStallDetectedMock
}));

let pollMinimaHealth: typeof import("../../../src/features/minima/minima-poll.service.js").pollMinimaHealth;
let startMinimaHealthPoller: typeof import("../../../src/features/minima/minima-poll.service.js").startMinimaHealthPoller;
let stopMinimaHealthPoller: typeof import("../../../src/features/minima/minima-poll.service.js").stopMinimaHealthPoller;

async function loadModule() {
  vi.resetModules();
  ({ pollMinimaHealth, startMinimaHealthPoller, stopMinimaHealthPoller } = await import("../../../src/features/minima/minima-poll.service.js"));
}

beforeEach(async () => {
  delete process.env.MINIMA_AUTO_RESYNC;
  getMinimaNodeStatusMock.mockReset();
  resyncMegammrMock.mockReset();
  canAutoResyncMock.mockReset();
  detectStallMock.mockReset();
  recordAutoResyncMock.mockReset();
  recordPollerCheckMock.mockReset();
  recordStallDetectedMock.mockReset();
  initializeLocalAddressBookEntryMock.mockReset().mockResolvedValue(null);
  await loadModule();
});

afterEach(() => {
  stopMinimaHealthPoller();
  vi.useRealTimers();
  delete process.env.MINIMA_AUTO_RESYNC;
});

const baseStatus = {
  checkedAt: "2026-01-01T00:00:00.000Z",
  state: "running" as const,
  sync: { blockAgeSeconds: 400 }
};

describe("pollMinimaHealth", () => {
  it("starts immediately without blocking startup and retries initialization on the health interval", async () => {
    vi.useFakeTimers();
    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(false);
    initializeLocalAddressBookEntryMock.mockRejectedValueOnce(new Error("database unavailable")).mockResolvedValueOnce(null);
    startMinimaHealthPoller();
    assert.equal(getMinimaNodeStatusMock.mock.calls.length, 1);
    await vi.advanceTimersByTimeAsync(0);
    assert.equal(initializeLocalAddressBookEntryMock.mock.calls.length, 1);
    await vi.advanceTimersByTimeAsync(60_000);
    assert.equal(initializeLocalAddressBookEntryMock.mock.calls.length, 2);
    assert.equal(recordPollerCheckMock.mock.calls.length, 2);
  });

  it("initializes a local contact without visiting Wallet on a running-node health poll", async () => {
    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(false);

    await pollMinimaHealth();

    assert.equal(recordPollerCheckMock.mock.calls[0][0], baseStatus.checkedAt);
    assert.equal(recordPollerCheckMock.mock.calls[0][1], baseStatus.state);
    assert.equal(recordStallDetectedMock.mock.calls.length, 0);
    assert.equal(resyncMegammrMock.mock.calls.length, 0);
    assert.equal(initializeLocalAddressBookEntryMock.mock.calls.length, 1);
  });

  for (const state of ["stopped", "error", "restarting"] as const) {
    it(`skips initialization while the node is ${state} and retries when running`, async () => {
      getMinimaNodeStatusMock.mockResolvedValueOnce({ ...baseStatus, state }).mockResolvedValueOnce(baseStatus);
      detectStallMock.mockReturnValue(false);
      await pollMinimaHealth();
      assert.equal(initializeLocalAddressBookEntryMock.mock.calls.length, 0);
      await pollMinimaHealth();
      assert.equal(initializeLocalAddressBookEntryMock.mock.calls.length, 1);
    });
  }

  it("retries initialization on later polls after a failure", async () => {
    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(false);
    initializeLocalAddressBookEntryMock.mockRejectedValueOnce(new Error("database unavailable")).mockResolvedValueOnce(null);
    await assert.doesNotReject(pollMinimaHealth());
    await pollMinimaHealth();
    assert.equal(initializeLocalAddressBookEntryMock.mock.calls.length, 2);
    assert.equal(recordPollerCheckMock.mock.calls.length, 2);
  });

  it("records a stall but does not auto-resync while MINIMA_AUTO_RESYNC is unset", async () => {
    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(true);

    await pollMinimaHealth();

    assert.equal(recordStallDetectedMock.mock.calls.length, 1);
    assert.equal(resyncMegammrMock.mock.calls.length, 0);
  });

  it("does not run two polls concurrently", async () => {
    let resolveStatus: (value: typeof baseStatus) => void = () => {};
    getMinimaNodeStatusMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        })
    );
    detectStallMock.mockReturnValue(false);

    const first = pollMinimaHealth();
    const second = pollMinimaHealth();
    resolveStatus(baseStatus);
    await Promise.all([first, second]);

    assert.equal(getMinimaNodeStatusMock.mock.calls.length, 1);
  });

  it("does not throw when getMinimaNodeStatus rejects, and allows a later poll to run", async () => {
    getMinimaNodeStatusMock.mockRejectedValueOnce(new Error("boom"));
    await assert.doesNotReject(() => pollMinimaHealth());

    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(false);
    await pollMinimaHealth();
    assert.equal(getMinimaNodeStatusMock.mock.calls.length, 2);
  });
});

describe("pollMinimaHealth with auto-resync enabled", () => {
  beforeEach(async () => {
    process.env.MINIMA_AUTO_RESYNC = "true";
    await loadModule();
  });

  it("skips resync while the cooldown is active", async () => {
    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(true);
    canAutoResyncMock.mockReturnValue(false);

    await pollMinimaHealth();

    assert.equal(resyncMegammrMock.mock.calls.length, 0);
  });

  it("resyncs and records the result when the cooldown has elapsed", async () => {
    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(true);
    canAutoResyncMock.mockReturnValue(true);
    resyncMegammrMock.mockResolvedValue({
      ok: true,
      body: { status: true, response: { message: "MegaMMR sync fininshed.. please restart" } }
    });

    await pollMinimaHealth();

    assert.equal(resyncMegammrMock.mock.calls.length, 1);
    assert.equal(recordAutoResyncMock.mock.calls[0][0], "MegaMMR sync fininshed.. please restart");
  });

  it("still detects stalls and performs auto-resync after contact initialization fails", async () => {
    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(true);
    canAutoResyncMock.mockReturnValue(true);
    initializeLocalAddressBookEntryMock.mockRejectedValue(new Error("local contact failed"));
    resyncMegammrMock.mockResolvedValue({ ok: true, body: { status: true, response: { message: "resync completed" } } });
    await pollMinimaHealth();
    assert.equal(recordStallDetectedMock.mock.calls.length, 1);
    assert.equal(resyncMegammrMock.mock.calls.length, 1);
    assert.equal(recordAutoResyncMock.mock.calls[0][0], "resync completed");
  });

  it("records the failure when resync throws", async () => {
    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(true);
    canAutoResyncMock.mockReturnValue(true);
    resyncMegammrMock.mockRejectedValue(new Error("resync failed: timeout"));

    await pollMinimaHealth();

    assert.equal(recordAutoResyncMock.mock.calls[0][0], "resync failed: timeout");
  });
});
