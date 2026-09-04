import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let repo: typeof import("../../../src/features/integritas/integritas.repository.js");
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  repo = await import("../../../src/features/integritas/integritas.repository.js");
});

afterAll(() => {
  teardown();
});

afterEach(() => {
  vi.useRealTimers();
});

function createRecord(overrides: Partial<Parameters<typeof repo.createProofRecord>[0]> = {}) {
  return repo.createProofRecord({
    fileName: "file.txt",
    fileSize: 42,
    hash: "hash-value",
    proofUid: "uid-1",
    proofStatus: "pending",
    ...overrides
  });
}

describe("createProofRecord / getProofRecord", () => {
  it("creates a record with defaults for optional fields", () => {
    const record = repo.createProofRecord({ hash: "h1", proofUid: "u1", proofStatus: "pending" });

    assert.equal(record.file_name, null);
    assert.equal(record.file_size, null);
    assert.equal(record.hash, "h1");
    assert.equal(record.proof_uid, "u1");
    assert.equal(record.proof_status, "pending");
    assert.equal(record.proof_payload, null);
    assert.equal(record.status_response, null);
    assert.equal(record.verify_response, null);
    assert.equal(record.proof_error, null);
  });

  it("stores provided file name and size", () => {
    const record = createRecord({ fileName: "report.pdf", fileSize: 1024 });

    assert.equal(record.file_name, "report.pdf");
    assert.equal(record.file_size, 1024);
  });

  it("returns undefined for a missing id", () => {
    assert.equal(repo.getProofRecord("missing"), undefined);
  });
});

describe("countProofRecords", () => {
  it("counts all records with no filter", () => {
    const baseline = repo.countProofRecords();
    createRecord({ hash: "count-no-filter-a" });
    createRecord({ hash: "count-no-filter-b" });

    assert.equal(repo.countProofRecords(), baseline + 2);
  });

  it("filters by status", () => {
    const a = createRecord({ hash: "status-filter-a" });
    createRecord({ hash: "status-filter-b" });
    repo.updateProofStatus(a.id, { proofStatus: "ready" });

    assert.equal(repo.countProofRecords({ status: "ready", q: "status-filter" }), 1);
    assert.equal(repo.countProofRecords({ status: "pending", q: "status-filter" }), 1);
  });

  it("filters by q across id/hash/proof_uid/file_name", () => {
    createRecord({ hash: "findme-hash", fileName: "a.txt" });
    createRecord({ hash: "other", fileName: "findme.txt" });
    createRecord({ hash: "unrelated", fileName: "b.txt" });

    assert.equal(repo.countProofRecords({ q: "findme" }), 2);
  });
});

describe("countPollablePendingProofRecords", () => {
  it("only counts pending records with a non-null proof_uid", () => {
    const baseline = repo.countPollablePendingProofRecords();
    const withUid = createRecord({ hash: "pollable-a", proofUid: "uid-pollable-a" });
    const noUid = createRecord({ hash: "pollable-b", proofUid: "uid-pollable-b" });
    db.prepare("UPDATE integritas_proofs SET proof_uid = NULL WHERE id = ?").run(noUid.id);
    const ready = createRecord({ hash: "pollable-c", proofUid: "uid-pollable-c" });
    repo.updateProofStatus(ready.id, { proofStatus: "ready" });

    assert.equal(repo.countPollablePendingProofRecords(), baseline + 1);
    assert.equal(withUid.proof_status, "pending");
  });
});

describe("listProofRecords", () => {
  it("orders by created_at DESC and paginates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const first = createRecord({ hash: "order-page-first" });
    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    const second = createRecord({ hash: "order-page-second" });
    vi.setSystemTime(new Date("2026-01-01T00:00:02.000Z"));
    const third = createRecord({ hash: "order-page-third" });
    vi.useRealTimers();

    const page1 = repo.listProofRecords({ page: 1, pageSize: 2, q: "order-page" });
    assert.deepEqual(page1.map((r) => r.id), [third.id, second.id]);

    const page2 = repo.listProofRecords({ page: 2, pageSize: 2, q: "order-page" });
    assert.deepEqual(page2.map((r) => r.id), [first.id]);
  });

  it("applies status and q filters", () => {
    const target = createRecord({ hash: "special-hash" });
    createRecord({ hash: "plain" });

    const filtered = repo.listProofRecords({ page: 1, pageSize: 10, status: "pending", q: "special" });
    assert.deepEqual(filtered.map((r) => r.id), [target.id]);
  });
});

describe("listPendingProofRecords", () => {
  it("returns only pending records with a proof_uid, ASC order", async () => {
    const baselineIds = new Set(repo.listPendingProofRecords().map((r) => r.id));

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
    const first = createRecord({ hash: "pending-order-a", proofUid: "u-order-a" });
    vi.setSystemTime(new Date("2026-02-01T00:00:01.000Z"));
    const second = createRecord({ hash: "pending-order-b", proofUid: "u-order-b" });
    vi.useRealTimers();
    const noUidRecord = createRecord({ hash: "pending-order-no-uid", proofUid: "u-order-placeholder" });
    db.prepare("UPDATE integritas_proofs SET proof_uid = NULL WHERE id = ?").run(noUidRecord.id);
    const readyRecord = createRecord({ hash: "pending-order-c", proofUid: "u-order-c" });
    repo.updateProofStatus(readyRecord.id, { proofStatus: "ready" });

    const newOnes = repo.listPendingProofRecords().filter((r) => !baselineIds.has(r.id));
    assert.deepEqual(newOnes.map((r) => r.id), [first.id, second.id]);
  });

  it("respects an optional limit", () => {
    createRecord({ hash: "limit-a", proofUid: "u-limit-a" });
    createRecord({ hash: "limit-b", proofUid: "u-limit-b" });

    const limited = repo.listPendingProofRecords(1);
    assert.equal(limited.length, 1);
  });
});

describe("updateProofStatus", () => {
  it("COALESCEs proof_payload when omitted but overwrites when provided", () => {
    const record = createRecord({ hash: "a" });
    repo.updateProofStatus(record.id, { proofStatus: "pending", proofPayload: [{ a: 1 }] });

    const withPayload = repo.getProofRecord(record.id)!;
    assert.equal(withPayload.proof_payload, JSON.stringify([{ a: 1 }]));

    repo.updateProofStatus(record.id, { proofStatus: "ready" });
    const afterOmitted = repo.getProofRecord(record.id)!;
    assert.equal(afterOmitted.proof_payload, JSON.stringify([{ a: 1 }]));
    assert.equal(afterOmitted.proof_status, "ready");
  });

  it("resets status_response to null when omitted, regardless of prior value", () => {
    const record = createRecord({ hash: "a" });
    repo.updateProofStatus(record.id, { proofStatus: "pending", statusResponse: { ok: true } });
    assert.equal(repo.getProofRecord(record.id)!.status_response, JSON.stringify({ ok: true }));

    repo.updateProofStatus(record.id, { proofStatus: "pending" });
    assert.equal(repo.getProofRecord(record.id)!.status_response, null);
  });

  it("sets proof_error, defaulting to null when omitted", () => {
    const record = createRecord({ hash: "a" });
    repo.updateProofStatus(record.id, { proofStatus: "failed", proofError: "boom" });
    assert.equal(repo.getProofRecord(record.id)!.proof_error, "boom");

    repo.updateProofStatus(record.id, { proofStatus: "failed" });
    assert.equal(repo.getProofRecord(record.id)!.proof_error, null);
  });
});

describe("updateVerifyResponse", () => {
  it("stores the serialized verify response", () => {
    const record = createRecord({ hash: "a" });
    const updated = repo.updateVerifyResponse(record.id, { verified: true }, "report.pdf");

    assert.equal(updated.verify_response, JSON.stringify({ verified: true }));
    assert.equal(updated.verification_report_file, "report.pdf");
  });

  it("clears the verification report file when omitted", () => {
    const record = createRecord({ hash: "a" });
    repo.updateVerifyResponse(record.id, { verified: true }, "report.pdf");

    const updated = repo.updateVerifyResponse(record.id, { verified: false }, null);

    assert.equal(updated.verify_response, JSON.stringify({ verified: false }));
    assert.equal(updated.verification_report_file, null);
  });
});

describe("deleteProofRecords", () => {
  it("deletes only the given ids", () => {
    const a = createRecord({ hash: "a" });
    const b = createRecord({ hash: "b" });
    const c = createRecord({ hash: "c" });

    repo.deleteProofRecords([a.id, b.id]);

    assert.equal(repo.getProofRecord(a.id), undefined);
    assert.equal(repo.getProofRecord(b.id), undefined);
    assert.notEqual(repo.getProofRecord(c.id), undefined);
  });
});
