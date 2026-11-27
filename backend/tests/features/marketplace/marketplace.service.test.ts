import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const rpc = vi.hoisted(() => ({ runMinimaPathCommand: vi.fn() }));
vi.mock("../../../src/features/minima/minima.rpc.js", () => rpc);

const NODE_KEY = "0x30819F300D06092A864886F70D010101050003818D0030818902818100B4D2C7E1A95F3C6688D0E2F4A1B7C3D5";
const KEY = "esk_installation-key-for-tests";

let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let env: typeof import("../../../src/config/env.js").env;
let service: typeof import("../../../src/features/marketplace/marketplace.service.js");
let dataSources: typeof import("../../../src/features/data-sources/dataSources.repository.js");
let proofs: typeof import("../../../src/features/integritas/integritas.repository.js");
let reads: typeof import("../../../src/features/data-reads/dataReads.repository.js");

const fetchMock = vi.fn();

beforeAll(async () => {
  ({ teardown, db } = await setupTestDatabase());
  env = (await import("../../../src/config/env.js")).env;
  service = await import("../../../src/features/marketplace/marketplace.service.js");
  dataSources = await import("../../../src/features/data-sources/dataSources.repository.js");
  proofs = await import("../../../src/features/integritas/integritas.repository.js");
  reads = await import("../../../src/features/data-reads/dataReads.repository.js");
});

afterAll(() => teardown());

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  rpc.runMinimaPathCommand.mockReset();
  rpc.runMinimaPathCommand.mockResolvedValue({ ok: true, status: 200, command: "keys", body: { status: true, response: { keys: [{ publickey: NODE_KEY }] } } });
  env.marketplaceUrl = "https://market.example";
  env.marketplaceInstallationKey = KEY;
  env.marketplaceDeliverySecret = "delivery-secret-at-least-32-characters";
});

afterEach(() => {
  service.stopMarketplaceSourceSync();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function reply(status: number, body: unknown = {}) {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) };
}

function calls() {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: url as string,
    method: (init as RequestInit).method,
    headers: (init as RequestInit).headers as Record<string, string>,
    body: (init as RequestInit).body ? JSON.parse((init as RequestInit).body as string) : undefined,
  }));
}

/** A source with `ready` stamped reads (oldest first) and one pending stamp that must not count. */
function sourceWithProofs(name: string, ready: string[]) {
  const source = dataSources.createDataSource({ name, type: "json-api", config: { url: "https://api.example/data" } });
  for (const uid of [...ready, "pending-uid"]) {
    const proof = proofs.createProofRecord({ hash: `hash-${uid}`, proofUid: uid, proofStatus: "pending" });
    if (uid !== "pending-uid") proofs.updateProofStatus(proof.id, { proofStatus: "ready" });
    const read = reads.createDataSourceRead({ dataSourceId: source.id, sourceName: name, sourceUrl: "https://api.example/data", triggerType: "manual", status: "success", hash: `hash-${uid}` });
    reads.linkDataSourceReadProof(read.id, proof.id);
  }
  return source;
}

describe("TC-FR01-04 role mapping", () => {
  it("TC-FR01-04 maps Edge Studio admin to marketplace owner and any other role to read-only viewer", () => {
    assert.equal(service.marketplaceRoleFor("admin"), "owner");
    assert.equal(service.marketplaceRoleFor("viewer"), "viewer");
    assert.equal(service.marketplaceRoleFor(""), "viewer");
  });
});

describe("isMarketplaceConfigured", () => {
  it("needs a key and an https URL, allowing plain http only on this machine", () => {
    assert.equal(service.isMarketplaceConfigured(), true);
    env.marketplaceUrl = "http://localhost:4000";
    assert.equal(service.isMarketplaceConfigured(), true);
    env.marketplaceUrl = "http://market.example";
    assert.equal(service.isMarketplaceConfigured(), false);
    env.marketplaceUrl = "not a url";
    assert.equal(service.isMarketplaceConfigured(), false);
    env.marketplaceUrl = "https://market.example";
    env.marketplaceInstallationKey = "";
    assert.equal(service.isMarketplaceConfigured(), false);
  });
});

describe("marketplaceRequest", () => {
  it("sends the key, acting user and role, and returns status and body", async () => {
    env.marketplaceUrl = "https://market.example/";
    fetchMock.mockResolvedValue(reply(201, { id: "L-1" }));
    const result = await service.marketplaceRequest("POST", "/api/publisher/listings", { userId: "u-1", role: "owner" }, { title: "T" });
    assert.deepEqual(result, { status: 201, body: { id: "L-1" }, next: null }); // next: the marketplace's X-Next-Cursor, none here
    const [call] = calls();
    assert.equal(call.url, "https://market.example/api/publisher/listings");
    assert.equal(call.headers.Authorization, `Bearer ${KEY}`);
    assert.equal(call.headers["X-Edge-Studio-User"], "u-1");
    assert.equal(call.headers["X-Edge-Studio-Role"], "owner");
    assert.deepEqual(call.body, { title: "T" });
  });

  it("returns status 0 when the marketplace cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    assert.deepEqual(await service.marketplaceRequest("GET", "/api/catalogue", { userId: "u-1", role: "owner" }), { status: 0, body: null });
    assert.equal(calls()[0].headers["Content-Type"], undefined);
  });
});

describe("isDeliveryAuthorized", () => {
  it("accepts only the configured bearer secret", () => {
    assert.equal(service.isDeliveryAuthorized("Bearer delivery-secret-at-least-32-characters"), true);
    assert.equal(service.isDeliveryAuthorized("Bearer wrong"), false);
    assert.equal(service.isDeliveryAuthorized("delivery-secret-at-least-32-characters"), false);
    assert.equal(service.isDeliveryAuthorized(undefined), false);
  });

  it("refuses everything when no secret is configured", () => {
    env.marketplaceDeliverySecret = "";
    assert.equal(service.isDeliveryAuthorized("Bearer "), false);
    assert.equal(service.isDeliveryAuthorized("Bearer anything"), false);
  });
});

describe("sourcePushBody", () => {
  it("counts ready proofs and maps the newest one without inventing fields", () => {
    const source = sourceWithProofs("Greenhouse", ["uid-old", "uid-new"]);
    db.prepare("UPDATE integritas_proofs SET created_at = '2020-01-01T00:00:00.000Z' WHERE proof_uid = 'uid-old'").run();
    const latest = proofs.getReadyProofsForDataSource(source.id).latest!;
    assert.equal(latest.proof_uid, "uid-new");
    assert.deepEqual(service.sourcePushBody(source, NODE_KEY), {
      name: "Greenhouse",
      verified: true,
      attestations: 2,
      // The literal hash that was stamped for the newest read (review: not just copied from the same row).
      proof: { nodePublicKey: NODE_KEY, reference: "integritas:uid:uid-new", fingerprint: "hash-uid-new", attestedAt: latest.created_at },
    });
  });

  it("pushes proof null and unverified for a source without a ready proof", () => {
    const source = dataSources.createDataSource({ name: "Unstamped", type: "json-api", config: { url: "https://api.example/x" } });
    assert.deepEqual(service.sourcePushBody(source, null), { name: "Unstamped", verified: false, attestations: 0, proof: null });
  });

  it("returns null (retry) instead of downgrading when the node key is unavailable", () => {
    const source = sourceWithProofs("No key", ["uid-1"]);
    assert.equal(service.sourcePushBody(source, null), null);
  });
});

describe("source sync", () => {
  it("pushes every input source at start-up and removes output targets", async () => {
    const before = new Set(dataSources.listDataSources().map((s) => s.id));
    const input = sourceWithProofs("Start-up", ["uid-s"]);
    const led = dataSources.createDataSource({ name: "LED", type: "gpio-output", config: { pin: 17 } });
    const display = dataSources.createDataSource({ name: "Display", type: "spi-display", config: { model: "pim576", rotation: 0 } });
    fetchMock.mockResolvedValue(reply(200));

    service.startMarketplaceSourceSync();
    await service.flushMarketplaceSync();

    const synced = calls().filter((c) => !before.has(decodeURIComponent(c.url.split("/").pop()!)));
    assert.deepEqual(new Map(synced.map((c) => [c.url, c.method])), new Map([
      [`https://market.example/api/integration/sources/${input.id}`, "PUT"],
      [`https://market.example/api/integration/sources/${led.id}`, "DELETE"],
      [`https://market.example/api/integration/sources/${display.id}`, "DELETE"],
    ]));
    const pushed = synced.find((c) => c.method === "PUT")!;
    assert.equal(pushed.headers["X-Edge-Studio-User"], "edge-studio");
    assert.equal(pushed.headers["X-Edge-Studio-Role"], "owner");
    assert.equal(pushed.body.proof.nodePublicKey, NODE_KEY);
  });

  it("removes deleted sources and output targets, treating 404 as already gone", async () => {
    const output = dataSources.createDataSource({ name: "Target", type: "http-output", config: { url: "https://hook.example" } });
    const display = dataSources.createDataSource({ name: "Display target", type: "spi-display", config: { model: "pim576", rotation: 0 } });
    fetchMock.mockResolvedValue(reply(404, { error: "not_found" }));
    service.queueMarketplaceSourceSync("deleted-id", output.id, display.id);
    await service.flushMarketplaceSync();
    assert.deepEqual(calls().map((c) => c.method), ["DELETE", "DELETE", "DELETE"]);

    fetchMock.mockClear();
    await service.flushMarketplaceSync();
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("does nothing when the marketplace is not configured", () => {
    env.marketplaceInstallationKey = "";
    vi.useFakeTimers();
    service.queueMarketplaceSourceSync("x");
    vi.runAllTimers();
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("coalesces changes into one push and retries after the marketplace is unreachable", async () => {
    vi.useFakeTimers();
    const source = sourceWithProofs("Retry", ["uid-r"]);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValue(reply(200));

    service.queueMarketplaceSourceSync(source.id);
    service.queueMarketplaceSourceSync(source.id);
    await vi.advanceTimersByTimeAsync(1_000);
    assert.equal(fetchMock.mock.calls.length, 1);

    await vi.advanceTimersByTimeAsync(60_000);
    assert.equal(fetchMock.mock.calls.length, 2);
    await vi.advanceTimersByTimeAsync(60_000);
    assert.equal(fetchMock.mock.calls.length, 2);
  });

  it("retries a source whose proof cannot be described yet because the node is not answering", async () => {
    const source = sourceWithProofs("Node down", ["uid-n"]);
    rpc.runMinimaPathCommand.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    fetchMock.mockResolvedValue(reply(200));

    service.queueMarketplaceSourceSync(source.id);
    await service.flushMarketplaceSync();
    assert.equal(fetchMock.mock.calls.length, 0);

    await service.flushMarketplaceSync();
    assert.equal(calls()[0].body.proof.nodePublicKey, NODE_KEY);
  });

  it("logs a refused push once without the installation key and does not retry it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const source = dataSources.createDataSource({ name: "x".repeat(10), type: "json-api", config: { url: "https://api.example/y" } });
    fetchMock.mockResolvedValue(reply(422, { error: "validation", field: "name" }));

    service.queueMarketplaceSourceSync(source.id);
    await service.flushMarketplaceSync();
    await service.flushMarketplaceSync();

    assert.equal(fetchMock.mock.calls.length, 1);
    assert.equal(warn.mock.calls.length, 1);
    assert.equal(JSON.stringify(warn.mock.calls).includes(KEY), false);
    warn.mockRestore();
  });
});

describe("review: sync ordering", () => {
  it("a source deleted while its push waits for the node key is removed, not re-created", async () => {
    env.marketplaceUrl = "https://market.example";
    env.marketplaceInstallationKey = "esk_key";
    fetchMock.mockResolvedValue(reply(200));
    const source = sourceWithProofs("Short-lived", ["uid-1"]);
    rpc.runMinimaPathCommand.mockImplementationOnce(async () => {
      dataSources.deleteDataSource(source.id); // the admin deletes it while the node is being asked
      return { ok: true, status: 200, command: "keys", body: { status: true, response: { keys: [{ publickey: NODE_KEY }] } } };
    });
    service.queueMarketplaceSourceSync(source.id);
    await service.flushMarketplaceSync();
    assert.deepEqual(calls().map((c) => c.method), ["DELETE"]);
  });

  it("a flush that starts while another runs does not run at the same time; the queue is still pushed once", async () => {
    env.marketplaceUrl = "https://market.example";
    env.marketplaceInstallationKey = "esk_key";
    fetchMock.mockResolvedValue(reply(200));
    const source = sourceWithProofs("Busy", ["uid-1"]);
    let release!: () => void;
    const slowNode = new Promise<void>((r) => { release = r; });
    rpc.runMinimaPathCommand.mockImplementationOnce(async () => {
      await slowNode;
      return { ok: true, status: 200, command: "keys", body: { status: true, response: { keys: [{ publickey: NODE_KEY }] } } };
    });
    service.queueMarketplaceSourceSync(source.id);
    const first = service.flushMarketplaceSync();
    service.queueMarketplaceSourceSync(source.id); // a change arrives during the flush
    await service.flushMarketplaceSync(); // returns at once: one flush at a time
    assert.equal(calls().length, 0);
    release();
    await first;
    await service.flushMarketplaceSync(); // the change that arrived meanwhile
    assert.deepEqual(calls().map((c) => c.method), ["PUT", "PUT"]);
  });
});
