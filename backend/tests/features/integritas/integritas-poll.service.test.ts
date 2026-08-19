import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

const {
  getIntegritasApiKeyMock,
  listPendingProofRecordsMock,
  expirePendingProofIfTimedOutMock,
  pollProofStatusMock,
  applyPollResultToRecordMock
} = vi.hoisted(() => ({
  getIntegritasApiKeyMock: vi.fn(),
  listPendingProofRecordsMock: vi.fn(),
  expirePendingProofIfTimedOutMock: vi.fn(),
  pollProofStatusMock: vi.fn(),
  applyPollResultToRecordMock: vi.fn()
}));

vi.mock("../../../src/features/settings/secrets.service.js", () => ({
  getIntegritasApiKey: getIntegritasApiKeyMock
}));

vi.mock("../../../src/features/integritas/integritas.repository.js", () => ({
  listPendingProofRecords: listPendingProofRecordsMock
}));

vi.mock("../../../src/features/integritas/integritas.service.js", () => ({
  expirePendingProofIfTimedOut: expirePendingProofIfTimedOutMock,
  pollProofStatus: pollProofStatusMock,
  applyPollResultToRecord: applyPollResultToRecordMock
}));

let poll: typeof import("../../../src/features/integritas/integritas-poll.service.js");

async function loadModule() {
  vi.resetModules();
  poll = await import("../../../src/features/integritas/integritas-poll.service.js");
}

function makeRecord(overrides: Partial<{ id: string; proof_uid: string | null; proof_status: string }> = {}) {
  return { id: "r1", proof_uid: "uid-1", proof_status: "pending", ...overrides };
}

beforeEach(async () => {
  delete process.env.INTEGRITAS_POLL_INTERVAL_SECONDS;
  getIntegritasApiKeyMock.mockReset();
  listPendingProofRecordsMock.mockReset();
  expirePendingProofIfTimedOutMock.mockReset();
  pollProofStatusMock.mockReset();
  applyPollResultToRecordMock.mockReset();

  expirePendingProofIfTimedOutMock.mockImplementation((record) => record);
  await loadModule();
});

afterEach(() => {
  poll.stopIntegritasProofPoller();
  delete process.env.INTEGRITAS_POLL_INTERVAL_SECONDS;
  vi.useRealTimers();
});

describe("pollPendingProofRecords", () => {
  it("does nothing when there is no API key", async () => {
    getIntegritasApiKeyMock.mockReturnValue("");

    await poll.pollPendingProofRecords();

    assert.equal(listPendingProofRecordsMock.mock.calls.length, 0);
  });

  it("does nothing when there are no pending records", async () => {
    getIntegritasApiKeyMock.mockReturnValue("api-key");
    listPendingProofRecordsMock.mockReturnValue([]);

    await poll.pollPendingProofRecords();

    assert.equal(pollProofStatusMock.mock.calls.length, 0);
  });

  it("polls a batch and applies the result to each active record", async () => {
    getIntegritasApiKeyMock.mockReturnValue("api-key");
    const records = [makeRecord({ id: "a", proof_uid: "uid-a" }), makeRecord({ id: "b", proof_uid: "uid-b" })];
    listPendingProofRecordsMock.mockReturnValue(records);
    pollProofStatusMock.mockResolvedValue({ ok: true, items: [], proofPayloads: [] });

    await poll.pollPendingProofRecords();

    assert.equal(pollProofStatusMock.mock.calls.length, 1);
    assert.deepEqual(pollProofStatusMock.mock.calls[0][0].uids, ["uid-a", "uid-b"]);
    assert.equal(applyPollResultToRecordMock.mock.calls.length, 2);
    assert.deepEqual(applyPollResultToRecordMock.mock.calls[0], ["a", "uid-a", { ok: true, items: [], proofPayloads: [] }]);
  });

  it("excludes records that expirePendingProofIfTimedOut marks non-pending", async () => {
    getIntegritasApiKeyMock.mockReturnValue("api-key");
    const records = [makeRecord({ id: "a", proof_uid: "uid-a" }), makeRecord({ id: "b", proof_uid: "uid-b" })];
    listPendingProofRecordsMock.mockReturnValue(records);
    expirePendingProofIfTimedOutMock.mockImplementation((record) =>
      record.id === "b" ? { ...record, proof_status: "failed" } : record
    );
    pollProofStatusMock.mockResolvedValue({ ok: true, items: [], proofPayloads: [] });

    await poll.pollPendingProofRecords();

    assert.deepEqual(pollProofStatusMock.mock.calls[0][0].uids, ["uid-a"]);
  });

  it("skips polling entirely when every record in the batch lacks a proof_uid", async () => {
    getIntegritasApiKeyMock.mockReturnValue("api-key");
    listPendingProofRecordsMock.mockReturnValue([makeRecord({ id: "a", proof_uid: null })]);

    await poll.pollPendingProofRecords();

    assert.equal(pollProofStatusMock.mock.calls.length, 0);
  });

  it("continues to the next record when applyPollResultToRecord throws for one of them", async () => {
    getIntegritasApiKeyMock.mockReturnValue("api-key");
    const records = [makeRecord({ id: "a", proof_uid: "uid-a" }), makeRecord({ id: "b", proof_uid: "uid-b" })];
    listPendingProofRecordsMock.mockReturnValue(records);
    pollProofStatusMock.mockResolvedValue({ ok: true, items: [], proofPayloads: [] });
    applyPollResultToRecordMock.mockImplementationOnce(() => {
      throw new Error("db write failed");
    });

    await assert.doesNotReject(() => poll.pollPendingProofRecords());

    assert.equal(applyPollResultToRecordMock.mock.calls.length, 2);
  });

  it("logs and continues when pollProofStatus itself fails", async () => {
    getIntegritasApiKeyMock.mockReturnValue("api-key");
    listPendingProofRecordsMock.mockReturnValue([makeRecord({ id: "a", proof_uid: "uid-a" })]);
    pollProofStatusMock.mockResolvedValue({ ok: false, status: 500, error: "boom", errorCode: "status_failed", responseBody: null });

    await assert.doesNotReject(() => poll.pollPendingProofRecords());

    assert.equal(applyPollResultToRecordMock.mock.calls.length, 0);
  });

  it("does not run two polls concurrently", async () => {
    getIntegritasApiKeyMock.mockReturnValue("api-key");
    listPendingProofRecordsMock.mockReturnValue([makeRecord({ id: "a", proof_uid: "uid-a" })]);
    let resolveStatus: (value: { ok: true; items: never[]; proofPayloads: never[] }) => void = () => {};
    pollProofStatusMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        })
    );

    const first = poll.pollPendingProofRecords();
    const second = poll.pollPendingProofRecords();
    resolveStatus({ ok: true, items: [], proofPayloads: [] });
    await Promise.all([first, second]);

    assert.equal(listPendingProofRecordsMock.mock.calls.length, 1);
  });
});

describe("startIntegritasProofPoller / stopIntegritasProofPoller", () => {
  it("polls immediately, then on each interval tick, and stops when requested", async () => {
    process.env.INTEGRITAS_POLL_INTERVAL_SECONDS = "1";
    await loadModule();
    getIntegritasApiKeyMock.mockReturnValue("");
    vi.useFakeTimers();

    poll.startIntegritasProofPoller();
    assert.equal(getIntegritasApiKeyMock.mock.calls.length, 1);

    await vi.advanceTimersByTimeAsync(1000);
    assert.equal(getIntegritasApiKeyMock.mock.calls.length, 2);

    poll.stopIntegritasProofPoller();
    await vi.advanceTimersByTimeAsync(5000);
    assert.equal(getIntegritasApiKeyMock.mock.calls.length, 2);
  });

  it("is idempotent when started twice", async () => {
    process.env.INTEGRITAS_POLL_INTERVAL_SECONDS = "1";
    await loadModule();
    getIntegritasApiKeyMock.mockReturnValue("");
    vi.useFakeTimers();

    poll.startIntegritasProofPoller();
    poll.startIntegritasProofPoller();
    assert.equal(getIntegritasApiKeyMock.mock.calls.length, 1);

    await vi.advanceTimersByTimeAsync(1000);
    assert.equal(getIntegritasApiKeyMock.mock.calls.length, 2);
  });
});
