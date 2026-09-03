import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let dataDir: string;
let service: typeof import("../../../src/features/integritas/integritas.service.js");
let integritasRepo: typeof import("../../../src/features/integritas/integritas.repository.js");
let dataReadsRepo: typeof import("../../../src/features/data-reads/dataReads.repository.js");
let dataSourcesRepo: typeof import("../../../src/features/data-sources/dataSources.repository.js");
let crypto_: typeof import("../../../src/shared/crypto.js");

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "integritas-service-test-"));
  process.env.DATA_DIR = dataDir;

  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;

  service = await import("../../../src/features/integritas/integritas.service.js");
  integritasRepo = await import("../../../src/features/integritas/integritas.repository.js");
  dataReadsRepo = await import("../../../src/features/data-reads/dataReads.repository.js");
  dataSourcesRepo = await import("../../../src/features/data-sources/dataSources.repository.js");
  crypto_ = await import("../../../src/shared/crypto.js");
});

afterAll(() => {
  teardown();
  delete process.env.DATA_DIR;
  fs.rmSync(dataDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("hashCanonicalBytes", () => {
  it("returns the sha3-256 hex hash and a fixed canonicalization tag", () => {
    const result = service.hashCanonicalBytes("hello world");

    assert.equal(result.hash, crypto_.sha3HashHex("hello world"));
    assert.equal(result.canonicalization, "edge-studio-text-utf8-v1");
  });
});

describe("sha3HashFile", () => {
  it("streams a file and returns its sha3-256 hex hash", async () => {
    const filePath = path.join(dataDir, "sample.txt");
    const bytes = Buffer.from("file contents for hashing");
    fs.writeFileSync(filePath, bytes);

    const hash = await service.sha3HashFile(filePath);

    assert.equal(hash, crypto_.sha3HashHex(bytes));
  });
});

describe("proofPayloadFromStatusItem", () => {
  it("returns null when uid is missing", () => {
    assert.equal(service.proofPayloadFromStatusItem({}), null);
  });

  it("returns null when proof is the [ERROR] sentinel", () => {
    assert.equal(service.proofPayloadFromStatusItem({ uid: "u1", proof: "[ERROR]", onchain: true }), null);
  });

  it("returns null when status is false", () => {
    assert.equal(service.proofPayloadFromStatusItem({ uid: "u1", status: false, onchain: true }), null);
  });

  it("returns null when error is present", () => {
    assert.equal(service.proofPayloadFromStatusItem({ uid: "u1", error: "boom", onchain: true }), null);
  });

  it("returns null when not onchain", () => {
    assert.equal(service.proofPayloadFromStatusItem({ uid: "u1", onchain: false }), null);
    assert.equal(service.proofPayloadFromStatusItem({ uid: "u1" }), null);
  });

  it("accepts true, 'true', and 1 as onchain truthy encodings", () => {
    for (const onchain of [true, "true", 1] as unknown as boolean[]) {
      const payload = service.proofPayloadFromStatusItem({ uid: "u1", onchain, address: "addr", data: "d", proof: "p", root: "r" });
      assert.deepEqual(payload, [{ address: "addr", data: "d", proof: "p", root: "r" }]);
    }
  });

  it("falls back to empty strings for missing fields", () => {
    const payload = service.proofPayloadFromStatusItem({ uid: "u1", onchain: true });
    assert.deepEqual(payload, [{ address: "", data: "", proof: "", root: "" }]);
  });
});

describe("isTransientIntegritasErrorCode / isIntegritasUnauthorizedErrorCode", () => {
  it("classifies transient codes", () => {
    assert.equal(service.isTransientIntegritasErrorCode("upstream_unavailable"), true);
    assert.equal(service.isTransientIntegritasErrorCode("rate_limited"), true);
    assert.equal(service.isTransientIntegritasErrorCode("unauthorized"), false);
    assert.equal(service.isTransientIntegritasErrorCode("stamp_failed"), false);
  });

  it("classifies the unauthorized code", () => {
    assert.equal(service.isIntegritasUnauthorizedErrorCode("unauthorized"), true);
    assert.equal(service.isIntegritasUnauthorizedErrorCode("payment_required"), false);
  });
});

describe("parseProofPayload", () => {
  it("returns null for null input", () => {
    assert.equal(service.parseProofPayload(null), null);
  });

  it("returns null for invalid JSON", () => {
    assert.equal(service.parseProofPayload("not-json"), null);
  });

  it("returns null for valid JSON that is not an array", () => {
    assert.equal(service.parseProofPayload(JSON.stringify({ a: 1 })), null);
  });

  it("returns the parsed array for valid JSON arrays", () => {
    assert.deepEqual(service.parseProofPayload(JSON.stringify([1, 2, 3])), [1, 2, 3]);
  });
});

describe("isProofPollExpired", () => {
  it("is false right after creation and true once the timeout window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
    const createdAt = new Date().toISOString();

    assert.equal(service.isProofPollExpired(createdAt), false);

    vi.setSystemTime(new Date("2026-03-01T00:04:59.000Z"));
    assert.equal(service.isProofPollExpired(createdAt), false);

    vi.setSystemTime(new Date("2026-03-01T00:05:01.000Z"));
    assert.equal(service.isProofPollExpired(createdAt), true);
  });
});

describe("expirePendingProofIfTimedOut", () => {
  it("returns non-pending records unchanged", () => {
    const record = integritasRepo.createProofRecord({ hash: "h1", proofUid: "u1", proofStatus: "ready" });
    const result = service.expirePendingProofIfTimedOut(record);
    assert.equal(result.proof_status, "ready");
  });

  it("returns pending records unchanged when not yet expired", () => {
    const record = integritasRepo.createProofRecord({ hash: "h2", proofUid: "u2", proofStatus: "pending" });
    const result = service.expirePendingProofIfTimedOut(record);
    assert.equal(result.proof_status, "pending");
  });

  it("marks an expired pending record as failed with a timeout error", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
    const record = integritasRepo.createProofRecord({ hash: "h3", proofUid: "u3", proofStatus: "pending" });

    vi.setSystemTime(new Date("2026-03-01T00:10:00.000Z"));
    const result = service.expirePendingProofIfTimedOut(record);

    assert.equal(result.proof_status, "failed");
    assert.equal(result.proof_error, "On-chain confirmation timed out");
  });
});

describe("applyPollResultToRecord", () => {
  it("marks the record ready when a payload is produced", () => {
    const record = integritasRepo.createProofRecord({ hash: "h1", proofUid: "uid-ready", proofStatus: "pending" });
    const result = { ok: true as const, items: [{ uid: "uid-ready", onchain: true, address: "a", data: "d", proof: "p", root: "r" }], proofPayloads: [{ uid: "uid-ready", proofPayload: [{ address: "a", data: "d", proof: "p", root: "r" }] }] };

    const updated = service.applyPollResultToRecord(record.id, "uid-ready", result);

    assert.equal(updated.proof_status, "ready");
    assert.equal(updated.proof_payload, JSON.stringify([{ address: "a", data: "d", proof: "p", root: "r" }]));
    assert.equal(updated.proof_error, null);
  });

  it("marks the record failed when the matching status item reports an error", () => {
    const record = integritasRepo.createProofRecord({ hash: "h2", proofUid: "uid-failed", proofStatus: "pending" });
    const result = { ok: true as const, items: [{ uid: "uid-failed", error: "on-chain rejected" }], proofPayloads: [{ uid: "uid-failed", proofPayload: null }] };

    const updated = service.applyPollResultToRecord(record.id, "uid-failed", result);

    assert.equal(updated.proof_status, "failed");
    assert.equal(updated.proof_error, "on-chain rejected");
  });

  it("marks the record failed when status is explicitly false", () => {
    const record = integritasRepo.createProofRecord({ hash: "h3", proofUid: "uid-status-false", proofStatus: "pending" });
    const result = { ok: true as const, items: [{ uid: "uid-status-false", status: false }], proofPayloads: [{ uid: "uid-status-false", proofPayload: null }] };

    const updated = service.applyPollResultToRecord(record.id, "uid-status-false", result);
    assert.equal(updated.proof_status, "failed");
  });

  it("leaves the record pending when no status item matches", () => {
    const record = integritasRepo.createProofRecord({ hash: "h4", proofUid: "uid-none", proofStatus: "pending" });
    const result = { ok: true as const, items: [], proofPayloads: [] };

    const updated = service.applyPollResultToRecord(record.id, "uid-none", result);
    assert.equal(updated.proof_status, "pending");
    assert.equal(updated.proof_error, null);
  });

  it("normalizes proof_uid case/whitespace when matching", () => {
    const record = integritasRepo.createProofRecord({ hash: "h5", proofUid: "  Uid-Mixed  ", proofStatus: "pending" });
    const result = { ok: true as const, items: [{ uid: "uid-mixed", onchain: true }], proofPayloads: [{ uid: "uid-mixed", proofPayload: [{ address: "a", data: "d", proof: "p", root: "r" }] }] };

    const updated = service.applyPollResultToRecord(record.id, "  Uid-Mixed  ", result);
    assert.equal(updated.proof_status, "ready");
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockResponse(status: number, bodyText: string, headers: Record<string, string> = {}) {
  const bytes = Buffer.from(bodyText);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText,
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    headers: { get: (name: string) => headers[name] ?? null }
  };
}

describe("requestProofUid", () => {
  it("extracts the proof uid from a successful response", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ data: { uid: "uid-123" } })));

    const result = await service.requestProofUid({ apiKey: "key", hash: "h" });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.proofUid, "uid-123");
      assert.equal(result.proofStatus, "pending");
    }
    assert.equal(fetchMock.mock.calls.length, 1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    assert.ok(url.endsWith("/v1/timestamp/post"));
    assert.equal((init.headers as Record<string, string>)["x-api-key"], "key");
  });

  it("falls back to an empty proof uid when the response has none", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ data: {} })));
    const result = await service.requestProofUid({ apiKey: "key", hash: "h" });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.proofUid, "");
  });

  it("does not retry a non-transient failure and maps the error code", async () => {
    fetchMock.mockResolvedValue(mockResponse(401, JSON.stringify({ error: "bad key" })));

    const result = await service.requestProofUid({ apiKey: "key", hash: "h" });

    assert.equal(fetchMock.mock.calls.length, 1);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, "unauthorized");
  });
});

describe("pollProofStatus", () => {
  it("maps successful status items to proof payloads", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ data: [{ uid: "u1", onchain: true, address: "a", data: "d", proof: "p", root: "r" }] })));

    const result = await service.pollProofStatus({ apiKey: "key", uids: ["u1"] });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.items.length, 1);
      assert.deepEqual(result.proofPayloads, [{ uid: "u1", proofPayload: [{ address: "a", data: "d", proof: "p", root: "r" }] }]);
    }
  });

  it("returns an empty items list when the response body has no data array", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({})));
    const result = await service.pollProofStatus({ apiKey: "key", uids: ["u1"] });
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.items, []);
  });

  it("retries a transient 503 and succeeds on the next attempt", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(mockResponse(503, "Service Unavailable"))
      .mockResolvedValueOnce(mockResponse(200, JSON.stringify({ data: [] })));

    const promise = service.pollProofStatus({ apiKey: "key", uids: ["u1"] });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    assert.equal(fetchMock.mock.calls.length, 2);
    assert.equal(result.ok, true);
  });

  it("gives up after exhausting all attempts on a persistent transient failure", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(mockResponse(429, "Too Many Requests", { "Retry-After": "2" }));

    const promise = service.pollProofStatus({ apiKey: "key", uids: ["u1"] });
    await vi.advanceTimersByTimeAsync(10000);
    const result = await promise;

    assert.equal(fetchMock.mock.calls.length, 3);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errorCode, "rate_limited");
      assert.equal(result.retryAfter, "2");
    }
  });

  it("treats an AbortError as transient and retries", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }))
      .mockResolvedValueOnce(mockResponse(200, JSON.stringify({ data: [] })));

    const promise = service.pollProofStatus({ apiKey: "key", uids: ["u1"] });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    assert.equal(fetchMock.mock.calls.length, 2);
    assert.equal(result.ok, true);
  });
});

describe("verifyProof", () => {
  it("returns the parsed response on success", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ verified: true })));
    const result = await service.verifyProof({ apiKey: "key", proofPayload: [{ a: 1 }] });
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.response, { verified: true });
  });

  it("passes through a failure", async () => {
    fetchMock.mockResolvedValue(mockResponse(500, "server error"));
    const result = await service.verifyProof({ apiKey: "key", proofPayload: [] });
    assert.equal(result.ok, false);
  });
});

describe("verification reports", () => {
  it("extracts the PDF download URL from the verify envelope", () => {
    const response = { data: { file: { download_url: "https://example.com/report.pdf" } } };

    assert.equal(service.verificationReportDownloadUrl(response), "https://example.com/report.pdf");
    assert.equal(service.verificationReportDownloadUrl([{ data: { file: { download_url: "https://example.com/a.pdf" } } }]), "https://example.com/a.pdf");
  });

  it("ignores missing and non-http report URLs", () => {
    assert.equal(service.verificationReportDownloadUrl({}), null);
    assert.equal(service.verificationReportDownloadUrl({ data: { file: { download_url: "file:///tmp/report.pdf" } } }), null);
  });

  it("saves a verification report under the reports directory", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, "pdf-bytes"));

    const fileName = await service.saveVerificationReport("proof-1", { data: { file: { download_url: "https://example.com/report.pdf" } } });

    assert.equal(fileName, "proof-1.pdf");
    assert.equal(fetchMock.mock.calls[0][0], "https://example.com/report.pdf");
    assert.equal(fs.readFileSync(service.verificationReportFilePath(fileName!), "utf8"), "pdf-bytes");
  });

  it("does not save a report when the verify response has no PDF link", async () => {
    const fileName = await service.saveVerificationReport("proof-2", { data: {} });

    assert.equal(fileName, null);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("throws when the report download fails", async () => {
    fetchMock.mockResolvedValue(mockResponse(404, "not found"));

    await assert.rejects(
      () => service.saveVerificationReport("proof-3", { data: { file: { download_url: "https://example.com/missing.pdf" } } }),
      /Verification report download failed with HTTP 404/,
    );
  });
});

describe("refreshProofRecord", () => {
  it("reports not found when the record does not exist", async () => {
    const result = await service.refreshProofRecord("key", "missing-id");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.notFound, true);
  });

  it("reports not found when the record has no proof uid", async () => {
    const record = integritasRepo.createProofRecord({ hash: "h1", proofUid: "", proofStatus: "pending" });
    const result = await service.refreshProofRecord("key", record.id);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.notFound, true);
  });

  it("short-circuits without calling fetch when already timed out", async () => {
    const record = integritasRepo.createProofRecord({ hash: "h2", proofUid: "u2", proofStatus: "failed" });
    integritasRepo.updateProofStatus(record.id, { proofStatus: "failed", proofError: "On-chain confirmation timed out" });

    const result = await service.refreshProofRecord("key", record.id);

    assert.equal(fetchMock.mock.calls.length, 0);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.timedOut, true);
  });

  it("returns the upstream failure when polling fails", async () => {
    const record = integritasRepo.createProofRecord({ hash: "h3", proofUid: "u3", proofStatus: "pending" });
    fetchMock.mockResolvedValue(mockResponse(401, JSON.stringify({ error: "bad" })));

    const result = await service.refreshProofRecord("key", record.id);

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.notFound, false);
  });

  it("applies a successful poll result and returns the updated record", async () => {
    const record = integritasRepo.createProofRecord({ hash: "h4", proofUid: "u4", proofStatus: "pending" });
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ data: [{ uid: "u4", onchain: true, address: "a", data: "d", proof: "p", root: "r" }] })));

    const result = await service.refreshProofRecord("key", record.id);

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.record.proof_status, "ready");
  });
});

describe("writeProofExport", () => {
  it("writes the proof payload as pretty JSON under dataDir/exports", async () => {
    const payload = [{ a: 1 }];
    const filePath = await service.writeProofExport(payload);

    assert.ok(filePath.startsWith(path.join(dataDir, "exports")));
    const written = fs.readFileSync(filePath, "utf8");
    assert.equal(written, `${JSON.stringify(payload, null, 2)}\n`);
  });
});

describe("writeProofSourceZip", () => {
  function makeSource() {
    return dataSourcesRepo.createDataSource({ name: "Source", type: "json-api", config: { url: "https://example.com" } });
  }

  it("throws when the record has no parseable proof payload", async () => {
    const record = integritasRepo.createProofRecord({ hash: "h1", proofUid: "u1", proofStatus: "ready" });
    await assert.rejects(() => service.writeProofSourceZip(record), /Proof ZIP is unavailable/);
  });

  it("throws when there is no linked data source read", async () => {
    const record = integritasRepo.createProofRecord({ hash: "h2", proofUid: "u2", proofStatus: "ready" });
    integritasRepo.updateProofStatus(record.id, { proofStatus: "ready", proofPayload: [{ a: 1 }] });
    const updated = integritasRepo.getProofRecord(record.id)!;

    await assert.rejects(() => service.writeProofSourceZip(updated), /Proof ZIP is unavailable/);
  });

  it("throws when the linked read failed or has no preview", async () => {
    const record = integritasRepo.createProofRecord({ hash: "h3", proofUid: "u3", proofStatus: "ready" });
    integritasRepo.updateProofStatus(record.id, { proofStatus: "ready", proofPayload: [{ a: 1 }] });
    const updated = integritasRepo.getProofRecord(record.id)!;
    const source = makeSource();
    const read = dataReadsRepo.createDataSourceRead({ dataSourceId: source.id, sourceName: source.name, sourceUrl: "https://example.com", triggerType: "manual", status: "failed", error: "boom" });
    dataReadsRepo.linkDataSourceReadProof(read.id, updated.id);

    await assert.rejects(() => service.writeProofSourceZip(updated), /Proof ZIP is unavailable/);
  });

  it("throws when the recomputed source hash does not match the stamped hash", async () => {
    const record = integritasRepo.createProofRecord({ hash: "mismatched-hash", proofUid: "u4", proofStatus: "ready" });
    integritasRepo.updateProofStatus(record.id, { proofStatus: "ready", proofPayload: [{ a: 1 }] });
    const updated = integritasRepo.getProofRecord(record.id)!;
    const source = makeSource();
    const preview = { hello: "world" };
    const read = dataReadsRepo.createDataSourceRead({ dataSourceId: source.id, sourceName: source.name, sourceUrl: "https://example.com", triggerType: "manual", status: "success", preview });
    dataReadsRepo.linkDataSourceReadProof(read.id, updated.id);

    await assert.rejects(() => service.writeProofSourceZip(updated), /Proof ZIP is unavailable/);
  });

  it("writes a zip for a JSON preview whose hash matches the stamped hash", async () => {
    const preview = { hello: "world" };
    const sourceBytes = `${JSON.stringify(preview, null, 2)}\n`;
    const hash = crypto_.sha3HashHex(sourceBytes);
    const record = integritasRepo.createProofRecord({ hash, proofUid: "u5", proofStatus: "ready" });
    integritasRepo.updateProofStatus(record.id, { proofStatus: "ready", proofPayload: [{ a: 1 }] });
    const updated = integritasRepo.getProofRecord(record.id)!;
    const source = makeSource();
    const read = dataReadsRepo.createDataSourceRead({ dataSourceId: source.id, sourceName: source.name, sourceUrl: "https://example.com", triggerType: "manual", status: "success", preview });
    dataReadsRepo.linkDataSourceReadProof(read.id, updated.id);

    const filePath = await service.writeProofSourceZip(updated);

    const fileBytes = fs.readFileSync(filePath);
    assert.equal(fileBytes.readUInt32LE(0), 0x04034b50);
    assert.ok(fileBytes.length > 0);
  });

  it("hashes captured camera media bytes, not just the metadata preview", async () => {
    const mediaPath = path.join(dataDir, `${crypto.randomUUID()}.jpg`);
    const mediaBytes = Buffer.from("fake-jpeg-bytes");
    await fsPromises.writeFile(mediaPath, mediaBytes);
    const hash = crypto_.sha3HashHex(mediaBytes);

    const record = integritasRepo.createProofRecord({ hash, proofUid: "u6", proofStatus: "ready" });
    integritasRepo.updateProofStatus(record.id, { proofStatus: "ready", proofPayload: [{ a: 1 }] });
    const updated = integritasRepo.getProofRecord(record.id)!;
    const source = makeSource();
    const preview = { source: "pi-camera-helper", path: mediaPath, fileName: "photo.jpg", mediaType: "image/jpeg" };
    const read = dataReadsRepo.createDataSourceRead({ dataSourceId: source.id, sourceName: source.name, sourceUrl: "https://example.com", triggerType: "manual", status: "success", preview });
    dataReadsRepo.linkDataSourceReadProof(read.id, updated.id);

    const filePath = await service.writeProofSourceZip(updated);
    const fileBytes = fs.readFileSync(filePath);
    assert.equal(fileBytes.readUInt32LE(0), 0x04034b50);
  });

  it("throws when the referenced camera media file is missing on disk", async () => {
    const mediaPath = path.join(dataDir, `${crypto.randomUUID()}-missing.jpg`);
    const record = integritasRepo.createProofRecord({ hash: "some-hash", proofUid: "u7", proofStatus: "ready" });
    integritasRepo.updateProofStatus(record.id, { proofStatus: "ready", proofPayload: [{ a: 1 }] });
    const updated = integritasRepo.getProofRecord(record.id)!;
    const source = makeSource();
    const preview = { source: "pi-camera-helper", path: mediaPath, fileName: "photo.jpg", mediaType: "image/jpeg" };
    const read = dataReadsRepo.createDataSourceRead({ dataSourceId: source.id, sourceName: source.name, sourceUrl: "https://example.com", triggerType: "manual", status: "success", preview });
    dataReadsRepo.linkDataSourceReadProof(read.id, updated.id);

    await assert.rejects(() => service.writeProofSourceZip(updated), /Proof ZIP is unavailable/);
  });
});
