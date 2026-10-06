import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

vi.mock("../../../src/features/auth/audit.service.js", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("../../../src/features/auth/auth.middleware.js", () => ({
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

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

function testApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/address-book", addressBookRouter);
  return app;
}

describe("address-book routes", () => {
  beforeEach(() => {
    db.prepare("DELETE FROM address_book").run();
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
});
