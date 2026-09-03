import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let repo: typeof import("../../../src/features/data-reads/dataReads.repository.js");
let dataSourcesRepo: typeof import("../../../src/features/data-sources/dataSources.repository.js");
let integritasRepo: typeof import("../../../src/features/integritas/integritas.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  repo = await import("../../../src/features/data-reads/dataReads.repository.js");
  dataSourcesRepo = await import("../../../src/features/data-sources/dataSources.repository.js");
  integritasRepo = await import("../../../src/features/integritas/integritas.repository.js");
});

afterAll(() => {
  teardown();
});

function makeSource(name = "Source") {
  return dataSourcesRepo.createDataSource({ name, type: "json-api", config: { url: "https://example.com" } });
}

function makeRead(overrides: Partial<Parameters<typeof repo.createDataSourceRead>[0]> = {}) {
  const source = overrides.dataSourceId ? undefined : makeSource();
  return repo.createDataSourceRead({
    dataSourceId: source?.id ?? overrides.dataSourceId!,
    sourceName: source?.name ?? "Source",
    sourceUrl: "https://example.com",
    triggerType: "manual",
    status: "success",
    ...overrides
  });
}

describe("dataReads.repository — create/get", () => {
  it("creates a read with defaults for optional fields", () => {
    const read = makeRead();
    assert.equal(read.hash, null);
    assert.equal(read.preview_json, null);
    assert.equal(read.error, null);
    assert.equal(read.integritas_proof_id, null);
    assert.equal(read.trigger_source_id, null);
    assert.equal(read.trigger_payload_json, null);
    assert.equal(read.block_id, null);
    assert.ok(read.id);
    assert.ok(read.created_at);
  });

  it("serializes preview and trigger payload as JSON", () => {
    const read = makeRead({ preview: { a: 1 }, triggerPayload: { b: 2 } });
    assert.equal(read.preview_json, JSON.stringify({ a: 1 }));
    assert.equal(read.trigger_payload_json, JSON.stringify({ b: 2 }));
  });

  it("stores a structured error", () => {
    const read = makeRead({ status: "failed", error: { domain: "data_source", type: "fetch_failed", message: "boom", occurredAt: new Date().toISOString() } });
    assert.ok(read.error);
    const parsed = JSON.parse(read.error!) as { message: string };
    assert.equal(parsed.message, "boom");
  });

  it("stores a plain string error", () => {
    const read = makeRead({ status: "failed", error: "plain failure" });
    assert.equal(read.error, "plain failure");
  });

  it("getDataSourceRead returns undefined for a missing id", () => {
    assert.equal(repo.getDataSourceRead("missing"), undefined);
  });

  it("getDataSourceRead returns the read after creation", () => {
    const read = makeRead();
    assert.equal(repo.getDataSourceRead(read.id)?.id, read.id);
  });
});

describe("dataReads.repository — proof linking", () => {
  it("getDataSourceReadByProofId returns undefined when unlinked", () => {
    assert.equal(repo.getDataSourceReadByProofId("missing"), undefined);
  });

  it("linkDataSourceReadProof sets the integritas_proof_id and is queryable by it", () => {
    const proof = integritasRepo.createProofRecord({ hash: "h1", proofUid: "uid1", proofStatus: "pending" });
    const read = makeRead();

    const linked = repo.linkDataSourceReadProof(read.id, proof.id);
    assert.equal(linked.integritas_proof_id, proof.id);

    const found = repo.getDataSourceReadByProofId(proof.id);
    assert.equal(found?.id, read.id);
  });
});

describe("dataReads.repository — listing/filtering", () => {
  it("filters by status", () => {
    makeRead({ status: "success" });
    makeRead({ status: "failed", error: "err" });

    const successOnly = repo.listDataSourceReads({ page: 1, pageSize: 50, status: "success" });
    assert.ok(successOnly.every((r) => r.status === "success"));
    assert.equal(repo.countDataSourceReads({ status: "success" }), successOnly.length);
  });

  it("filters by q across source_name/source_url/hash/id/proof id", () => {
    const read = makeRead({ sourceName: "UniqueSearchTargetName" });

    const results = repo.listDataSourceReads({ page: 1, pageSize: 50, q: "UniqueSearchTargetName" });
    assert.ok(results.some((r) => r.id === read.id));
  });

  it("paginates with page/pageSize", () => {
    const source = makeSource("PagedSource");
    for (let i = 0; i < 5; i += 1) {
      repo.createDataSourceRead({
        dataSourceId: source.id,
        sourceName: "PagedSource",
        sourceUrl: "https://example.com",
        triggerType: "manual",
        status: "success"
      });
    }

    const total = repo.countDataSourceReads({ q: "PagedSource" });
    const page1 = repo.listDataSourceReads({ page: 1, pageSize: 2, q: "PagedSource" });
    const page2 = repo.listDataSourceReads({ page: 2, pageSize: 2, q: "PagedSource" });

    assert.equal(total, 5);
    assert.equal(page1.length, 2);
    assert.equal(page2.length, 2);
    assert.notDeepEqual(page1.map((r) => r.id), page2.map((r) => r.id));
  });

  it("orders results by created_at descending", () => {
    const source = makeSource("OrderedSource");
    const first = repo.createDataSourceRead({
      dataSourceId: source.id,
      sourceName: "OrderedSource",
      sourceUrl: "https://example.com",
      triggerType: "manual",
      status: "success"
    });
    const second = repo.createDataSourceRead({
      dataSourceId: source.id,
      sourceName: "OrderedSource",
      sourceUrl: "https://example.com",
      triggerType: "manual",
      status: "success"
    });

    const results = repo.listDataSourceReads({ page: 1, pageSize: 50, q: "OrderedSource" });
    const firstIndex = results.findIndex((r) => r.id === first.id);
    const secondIndex = results.findIndex((r) => r.id === second.id);
    assert.ok(secondIndex <= firstIndex);
  });
});
