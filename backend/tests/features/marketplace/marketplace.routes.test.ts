import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const KEY = "esk_installation-key-for-route-tests";
const SECRET = "delivery-secret-for-route-tests-0123456789"; // at least 32 characters

let teardown: () => void;
let env: typeof import("../../../src/config/env.js").env;
let app: express.Express;
const fetchMock = vi.fn();

beforeAll(async () => {
  teardown = (await setupTestDatabase()).teardown;
  env = (await import("../../../src/config/env.js")).env;
  const { marketplaceDeliveryRouter, marketplaceRouter } = await import("../../../src/features/marketplace/marketplace.routes.js");
  app = express();
  app.use(express.json());
  app.use("/api/marketplace/delivery", marketplaceDeliveryRouter);
  app.use((req, _res, next) => {
    req.user = { id: "admin-1", displayName: "Admin", role: "admin", lastLogin: null, credentialType: "password" };
    next();
  });
  app.use("/api/marketplace", marketplaceRouter);
});

afterAll(() => teardown());

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  env.marketplaceUrl = "https://market.example";
  env.marketplaceInstallationKey = KEY;
  env.marketplaceDeliverySecret = SECRET;
});

afterEach(() => vi.unstubAllGlobals());

function reply(status: number, body: unknown = {}) {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) };
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, method: init.method, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : undefined };
}

describe("status", () => {
  it("says whether the marketplace is configured and the mapped role, never the key or secret", async () => {
    const response = await request(app).get("/api/marketplace/status");
    assert.deepEqual(response.body, { configured: true, url: "https://market.example", role: "owner" });
    assert.equal(JSON.stringify(response.body).includes(KEY), false);
    assert.equal(JSON.stringify(response.body).includes(SECRET), false);

    env.marketplaceInstallationKey = "";
    assert.deepEqual((await request(app).get("/api/marketplace/status")).body, { configured: false, url: null, role: "owner" });
  });
});

describe("TC-FR01-06 marketplace unreachable", () => {
  it("TC-FR01-06 Module loads when the marketplace backend is unreachable: the proxy answers a clean 503", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const response = await request(app).get("/api/marketplace/publisher/listings");
    assert.equal(response.status, 503);
    assert.equal(response.body.error, "Marketplace service unavailable");
    assert.equal(response.body.errorCode, "marketplace_unavailable");
    assert.equal(JSON.stringify(response.body).includes(KEY), false);

    // The rest of the backend keeps answering.
    fetchMock.mockResolvedValue(reply(200, []));
    assert.equal((await request(app).get("/api/marketplace/publisher/listings")).status, 200);
  });

  it("TC-FR01-06 a marketplace 5xx is reported as unavailable too", async () => {
    fetchMock.mockResolvedValue(reply(503, { error: "edge_studio_unavailable" }));
    const response = await request(app).get("/api/marketplace/publisher/sources");
    assert.equal(response.status, 503);
    assert.equal(response.body.errorCode, "marketplace_unavailable");
  });

  it("answers 503 not configured without calling out when there is no key", async () => {
    env.marketplaceInstallationKey = "";
    const response = await request(app).get("/api/marketplace/catalogue");
    assert.equal(response.status, 503);
    assert.equal(response.body.errorCode, "marketplace_not_configured");
    assert.equal(fetchMock.mock.calls.length, 0);
  });
});

describe("publisher proxy", () => {
  it("TC-FR01-04 calls the marketplace as owner for the signed-in admin", async () => {
    fetchMock.mockResolvedValue(reply(200, [{ id: "SRC-1", selectable: true }]));
    const response = await request(app).get("/api/marketplace/publisher/sources");
    assert.deepEqual(response.body, [{ id: "SRC-1", selectable: true }]);
    const call = lastCall();
    assert.equal(call.url, "https://market.example/api/publisher/sources?limit=100"); // the marketplace pages lists; its largest page
    assert.equal(call.headers.Authorization, `Bearer ${KEY}`);
    assert.equal(call.headers["X-Edge-Studio-User"], "admin-1");
    assert.equal(call.headers["X-Edge-Studio-Role"], "owner");
  });

  it("forwards listing create, edit and transitions, sending only `to` (and the accepted declaration version) for a transition", async () => {
    fetchMock.mockResolvedValue(reply(201, { id: "L 1" }));
    const created = await request(app).post("/api/marketplace/publisher/listings").send({ type: "file", billing: "one_off", title: "T" });
    assert.equal(created.status, 201);
    assert.deepEqual(lastCall().body, { type: "file", billing: "one_off", title: "T" });

    fetchMock.mockResolvedValue(reply(200, { id: "L 1" }));
    await request(app).patch("/api/marketplace/publisher/listings/L%201").send({ title: "U" });
    assert.equal(lastCall().method, "PATCH");
    assert.equal(lastCall().url, "https://market.example/api/publisher/listings/L%201");

    await request(app).post("/api/marketplace/publisher/listings/L%201/transitions").send({ to: "published", payoutWallet: "MxOTHER" });
    assert.equal(lastCall().url, "https://market.example/api/publisher/listings/L%201/transitions");
    assert.deepEqual(lastCall().body, { to: "published" });
    // X-05: the version of the rights declaration the user accepted travels with a publish, and nothing else.
    await request(app).post("/api/marketplace/publisher/listings/L%201/transitions").send({ to: "published", acceptDeclaration: 2, payoutWallet: "MxOTHER" });
    assert.deepEqual(lastCall().body, { to: "published", acceptDeclaration: 2 });
    await request(app).post("/api/marketplace/publisher/listings/L%201/transitions").send({ to: "published", acceptDeclaration: "2" });
    assert.deepEqual(lastCall().body, { to: "published" });

    fetchMock.mockResolvedValue(reply(200, { version: 2, text: "T" }));
    const declaration = await request(app).get("/api/marketplace/publisher/rights-declaration");
    assert.deepEqual(declaration.body, { version: 2, text: "T" });
    assert.equal(lastCall().url, "https://market.example/api/publisher/rights-declaration");
  });

  it("passes marketplace 4xx errors through with a readable message and a marketplace errorCode", async () => {
    fetchMock.mockResolvedValue(reply(422, { error: "validation", field: "title" }));
    const invalid = await request(app).post("/api/marketplace/publisher/listings").send({});
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.error, "The marketplace rejected the title field.");
    assert.equal(invalid.body.field, "title");
    assert.equal(invalid.body.errorCode, "marketplace_validation");

    fetchMock.mockResolvedValue(reply(401, { error: "unauthenticated" }));
    const revoked = await request(app).get("/api/marketplace/publisher/earnings");
    assert.equal(revoked.status, 401);
    assert.equal(revoked.body.errorCode, "marketplace_unauthenticated");

    fetchMock.mockResolvedValue(reply(422, { error: "source_not_verified", message: "This source is not Integritas-verified." }));
    assert.equal((await request(app).post("/api/marketplace/publisher/listings/L1/transitions").send({ to: "published" })).body.error, "This source is not Integritas-verified.");

    fetchMock.mockResolvedValue(reply(409, "conflict"));
    assert.equal((await request(app).post("/api/marketplace/publisher/listings/L1/transitions").send({ to: "paused" })).body.error, "The marketplace refused the request (error).");
  });
});

describe("catalogue proxy", () => {
  it("forwards only the q, category and type filters", async () => {
    fetchMock.mockResolvedValue(reply(200, []));
    await request(app).get("/api/marketplace/catalogue").query({ q: "soil", category: "Energy consumption", type: "file", limit: "9" });
    assert.equal(lastCall().url, "https://market.example/api/catalogue?q=soil&category=Energy+consumption&type=file&limit=100");

    await request(app).get("/api/marketplace/catalogue");
    assert.equal(lastCall().url, "https://market.example/api/catalogue?limit=100");

    fetchMock.mockResolvedValue(reply(200, { id: "L1", live: { delivery: "online" } }));
    const detail = await request(app).get("/api/marketplace/catalogue/L1");
    assert.equal(detail.body.live.delivery, "online");
  });
});

describe("delivery service relay", () => {
  const auth = `Bearer ${SECRET}`;

  it("refuses calls without the delivery secret", async () => {
    for (const header of [undefined, "Bearer wrong", SECRET]) {
      const call = request(app).post("/api/marketplace/delivery/sources/SRC-1/heartbeat").send({});
      const response = await (header ? call.set("Authorization", header) : call);
      assert.equal(response.status, 401);
    }
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("forwards a heartbeat as publisher with the decoded-then-encoded source id", async () => {
    fetchMock.mockResolvedValue(reply(200, { ok: true }));
    const response = await request(app)
      .post("/api/marketplace/delivery/sources/src%3A1/heartbeat")
      .set("Authorization", auth)
      .send({ lastDataAt: "2026-11-18T10:00:00.000Z", extra: "dropped" });
    assert.equal(response.status, 200);
    const call = lastCall();
    assert.equal(call.url, "https://market.example/api/integration/sources/src%3A1/heartbeat");
    assert.equal(call.method, "POST");
    assert.equal(call.headers["X-Edge-Studio-Role"], "publisher");
    assert.equal(call.headers["X-Edge-Studio-User"], "edge-studio");
    assert.deepEqual(call.body, { lastDataAt: "2026-11-18T10:00:00.000Z" });
  });

  it("forwards an address change as owner, and null clears it", async () => {
    fetchMock.mockResolvedValue(reply(200, { address: "https://seller.example:8443" }));
    await request(app).put("/api/marketplace/delivery/sources/SRC-1/address").set("Authorization", auth).send({ address: "https://seller.example:8443" });
    assert.equal(lastCall().url, "https://market.example/api/integration/sources/SRC-1/delivery");
    assert.equal(lastCall().method, "PUT");
    assert.equal(lastCall().headers["X-Edge-Studio-Role"], "owner");
    assert.deepEqual(lastCall().body, { address: "https://seller.example:8443" });

    fetchMock.mockResolvedValue(reply(200, { address: null }));
    await request(app).put("/api/marketplace/delivery/sources/SRC-1/address").set("Authorization", auth).send({ address: null });
    assert.deepEqual(lastCall().body, { address: null });
  });

  it("rejects a malformed address locally and passes marketplace 4xx through", async () => {
    const malformed = await request(app).put("/api/marketplace/delivery/sources/SRC-1/address").set("Authorization", auth).send({ address: 42 });
    assert.equal(malformed.status, 400);
    assert.equal(fetchMock.mock.calls.length, 0);

    fetchMock.mockResolvedValue(reply(404, { error: "not_found" }));
    const missing = await request(app).post("/api/marketplace/delivery/sources/SRC-9/heartbeat").set("Authorization", auth).send({});
    assert.equal(missing.status, 404);

    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const down = await request(app).post("/api/marketplace/delivery/sources/SRC-1/heartbeat").set("Authorization", auth).send({});
    assert.equal(down.status, 503);
  });
});

// From the security review of this branch: findings and their regression tests.
describe("review: path safety and the delivery gate", () => {
  it("refuses an id made of dots or path characters with 400 and never calls the marketplace", async () => {
    // Sent raw over a socket: an HTTP client library would normalise "%2E%2E" away itself, an attacker's would not.
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const port = (server.address() as import("node:net").AddressInfo).port;
    const raw = (method: string, path: string, headers: Record<string, string> = {}) =>
      new Promise<number>((resolve, reject) => {
        const req = http.request({ host: "127.0.0.1", port, method, path, headers: { "Content-Type": "application/json", ...headers } }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on("error", reject);
        req.end(method === "GET" ? undefined : JSON.stringify({ to: "published", address: null, title: "x" }));
      });
    const auth = { Authorization: `Bearer ${SECRET}` };
    try {
      const statuses = [
        await raw("GET", "/api/marketplace/catalogue/%2E%2E"),
        await raw("GET", "/api/marketplace/catalogue/%2e"),
        await raw("PATCH", "/api/marketplace/publisher/listings/%2E%2E"),
        await raw("POST", "/api/marketplace/publisher/listings/%2E/transitions"),
        await raw("POST", "/api/marketplace/delivery/sources/%2E%2E/heartbeat", auth),
        await raw("PUT", "/api/marketplace/delivery/sources/%2E%2E/address", auth),
        await raw("GET", "/api/marketplace/catalogue/a%2Fb"),
      ];
      assert.deepEqual(statuses, [400, 400, 400, 400, 400, 400, 400]);
      assert.equal(fetchMock.mock.calls.length, 0);
    } finally {
      server.close();
    }
  });

  it("refuses every delivery call while the configured secret is shorter than 32 characters", async () => {
    env.marketplaceDeliverySecret = "short-secret";
    const response = await request(app).post("/api/marketplace/delivery/sources/SRC-1/heartbeat").set("Authorization", "Bearer short-secret").send({});
    assert.equal(response.status, 401);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("never follows a redirect with the installation key", async () => {
    fetchMock.mockResolvedValue(reply(200, []));
    await request(app).get("/api/marketplace/publisher/listings");
    assert.equal((fetchMock.mock.calls.at(-1)![1] as RequestInit).redirect, "error");
  });
});
