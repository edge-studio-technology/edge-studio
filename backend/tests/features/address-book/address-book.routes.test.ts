import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

vi.mock("../../../src/features/auth/audit.service.js", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("../../../src/features/auth/auth.middleware.js", () => ({
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

const fetchMock = vi.fn();

let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let repo: typeof import("../../../src/features/address-book/address-book.repository.js");
let addressBookRouter: typeof import("../../../src/features/address-book/address-book.routes.js")["addressBookRouter"];

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;
  repo = await import("../../../src/features/address-book/address-book.repository.js");
  ({ addressBookRouter } = await import("../../../src/features/address-book/address-book.routes.js"));
});

afterAll(() => teardown());
afterEach(() => vi.unstubAllGlobals());

function testApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/address-book", addressBookRouter);
  return app;
}

describe("address-book routes", () => {
  beforeEach(() => {
    db.prepare("DELETE FROM address_book").run();
    fetchMock.mockReset().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);
  });

  it("rejects a malformed prefix-matching address before create mutation", async () => {
    const response = await request(testApp())
      .post("/api/address-book")
      .send({ label: "Alice", address: "Mx1234" });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /valid Minima Mx or 0x address/);
    assert.deepEqual(repo.listAddressBookEntries(), []);
  });

  it("rejects a malformed prefix-matching address before update mutation", async () => {
    const saved = repo.insertAddressBookEntry({ label: "Alice", address: "0x01", notes: null });
    const response = await request(testApp())
      .patch(`/api/address-book/${saved.id}`)
      .send({ address: "0xnot-hex" });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /valid Minima Mx or 0x address/);
    assert.deepEqual(repo.getAddressBookEntryById(saved.id), saved);
  });

  it("allows creating, editing, and deleting a manual copy without changing the managed contact", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    const app = testApp();
    const created = await request(app).post("/api/address-book")
      .send({ label: "My copy", address: local.address, isLocalDevice: true });
    assert.equal(created.status, 201);
    assert.equal(created.body.isLocalDevice, false);
    assert.notEqual(created.body.id, local.id);

    const edited = await request(app).patch(`/api/address-book/${created.body.id}`)
      .send({ label: "Renamed", address: local.address, notes: "Mine" });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.label, "Renamed");
    assert.equal(edited.body.notes, "Mine");
    assert.equal(edited.body.isLocalDevice, false);

    const removed = await request(app).delete(`/api/address-book/${created.body.id}`);
    assert.equal(removed.status, 204);
    assert.deepEqual(repo.listAddressBookEntries(), [local]);
  });

  it("allows a manual contact to change its address to the managed destination", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    const saved = repo.insertAddressBookEntry({ label: "Alice", address: "0x02", notes: null });
    const response = await request(testApp()).patch(`/api/address-book/${saved.id}`).send({ address: local.address });
    assert.equal(response.status, 200);
    assert.equal(response.body.address, local.address);
    assert.equal(response.body.isLocalDevice, false);
    assert.deepEqual(repo.getLocalAddressBookEntry(), local);
  });

  it("still rejects an exact-address duplicate of another manual contact", async () => {
    repo.ensureLocalAddressBookEntry(["0x01"]);
    repo.insertAddressBookEntry({ label: "Alice", address: "0x01", notes: null });
    const other = repo.insertAddressBookEntry({ label: "Bob", address: "0x02", notes: null });
    const app = testApp();
    assert.equal((await request(app).post("/api/address-book").send({ label: "Duplicate", address: "0x01" })).status, 409);
    assert.equal((await request(app).patch(`/api/address-book/${other.id}`).send({ address: "0x01" })).status, 409);
    assert.deepEqual(repo.getAddressBookEntryById(other.id), other);
  });

  it("creates the app contact during listing without adopting a matching manual contact", async () => {
    const mx = "MxG086U24F17MT50Y6VUPBPD6VJKTYVMR71WRSYURYUVZDN1VMG25FF39M0458A";
    const manual = repo.insertAddressBookEntry({ label: "This device", address: mx, notes: "Mine" });
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ status: true, response: [{
      address: "0xDE111E13DBA5054DFF657969BF3A76BFB6CE196F95F6EBEFE1B70FED0115EF1A",
      miniaddress: mx, default: true, simple: true
    }] }) });
    const first = await request(testApp()).get("/api/address-book");
    assert.equal(first.status, 200);
    assert.equal(first.body.length, 2);
    assert.equal(first.body.filter((entry: { isLocalDevice: boolean }) => entry.isLocalDevice).length, 1);
    assert.deepEqual(repo.getAddressBookEntryById(manual.id), manual);
    const second = await request(testApp()).get("/api/address-book");
    assert.deepEqual(second.body, first.body);
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("returns saved contacts while discovery is unavailable", async () => {
    const saved = repo.insertAddressBookEntry({ label: "Alice", address: "0x01", notes: null });
    const response = await request(testApp()).get("/api/address-book");
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [saved]);
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("shares discovery between concurrent list requests", async () => {
    let resolve!: (value: { ok: boolean; status: number; text: () => Promise<string> }) => void;
    fetchMock.mockImplementation(() => new Promise(done => { resolve = done; }));
    const app = testApp();
    const first = request(app).get("/api/address-book").then(response => response);
    const second = request(app).get("/api/address-book").then(response => response);
    await vi.waitFor(() => assert.equal(fetchMock.mock.calls.length, 1));
    resolve({ ok: true, status: 200, text: async () => JSON.stringify({ status: true, response: [] }) });
    const responses = await Promise.all([first, second]);
    assert.deepEqual(responses.map(response => response.status), [200, 200]);
    assert.deepEqual(responses.map(response => response.body), [[], []]);
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("does not mask a local database failure as successful offline listing", async () => {
    db.exec("ALTER TABLE address_book RENAME TO unavailable_address_book");
    try {
      const response = await request(testApp()).get("/api/address-book");
      assert.equal(response.status, 500);
      assert.equal(response.body.errorDetails.type, "unexpected");
      assert.equal(fetchMock.mock.calls.length, 0);
    } finally { db.exec("ALTER TABLE unavailable_address_book RENAME TO address_book"); }
  });

  it("allows managed notes edits and unchanged protected values even with a matching manual copy", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    const manual = repo.insertAddressBookEntry({ label: "My copy", address: local.address, notes: "Mine" });
    const app = testApp();
    const edited = await request(app).patch(`/api/address-book/${local.id}`)
      .send({ label: local.label, address: local.address, notes: "Desk Pi", isLocalDevice: false });
    assert.equal(edited.status, 200);
    assert.deepEqual(edited.body, { ...local, notes: "Desk Pi" });
    const cleared = await request(app).patch(`/api/address-book/${local.id}`).send({ notes: null });
    assert.equal(cleared.status, 200);
    assert.deepEqual(cleared.body, local);
    assert.deepEqual(repo.getAddressBookEntryById(manual.id), manual);
  });

  it("allows managed name and notes edits without changing identity or a matching manual contact", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    const manual = repo.insertAddressBookEntry({ label: local.label, address: local.address, notes: "Mine" });
    const renamed = await request(testApp()).patch(`/api/address-book/${local.id}`)
      .send({ label: "  Workshop Pi  ", notes: "Desk", isLocalDevice: false });
    assert.equal(renamed.status, 200);
    assert.deepEqual(renamed.body, { ...local, label: "Workshop Pi", notes: "Desk" });
    assert.deepEqual(repo.getAddressBookEntryById(manual.id), manual);
    assert.deepEqual(repo.ensureLocalAddressBookEntry(["0x02"])!.entry, renamed.body);
    assert.equal((await request(testApp()).delete(`/api/address-book/${local.id}`)).status, 409);
  });

  it("validates managed names without saving other changes", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    for (const label of ["", "  ", "x".repeat(81)]) {
      const response = await request(testApp()).patch(`/api/address-book/${local.id}`).send({ label, notes: "Should not save" });
      assert.equal(response.status, 400);
      assert.deepEqual(repo.getLocalAddressBookEntry(), local);
    }
  });

  it("rejects managed address changes and deletion using the stored identity", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    const app = testApp();
    for (const input of [{ address: "0x02" }, { address: "0xnot-hex" }, { label: "Renamed", address: "0x02", notes: "Should not save", isLocalDevice: false }]) {
      const response = await request(app).patch(`/api/address-book/${local.id}`).send(input);
      assert.equal(response.status, 409);
      assert.equal(response.body.errorDetails.type, "conflict");
      assert.match(response.body.error, /address cannot be changed/i);
      assert.deepEqual(repo.getLocalAddressBookEntry(), local);
    }
    const removed = await request(app).delete(`/api/address-book/${local.id}`);
    assert.equal(removed.status, 409);
    assert.equal(removed.body.errorDetails.type, "conflict");
    assert.match(removed.body.error, /cannot be deleted/i);
    assert.deepEqual(repo.getLocalAddressBookEntry(), local);
  });

  it("does not let a manual contact forge the server-owned marker during editing", async () => {
    const manual = repo.insertAddressBookEntry({ label: "This device", address: "0x01", notes: null });
    const edited = await request(testApp()).patch(`/api/address-book/${manual.id}`).send({ notes: "Mine", isLocalDevice: true });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.isLocalDevice, false);
    assert.equal(repo.getLocalAddressBookEntry(), null);
    assert.equal((await request(testApp()).delete(`/api/address-book/${manual.id}`)).status, 204);
  });
});
