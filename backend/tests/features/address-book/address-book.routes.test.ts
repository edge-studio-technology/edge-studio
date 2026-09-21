import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { beforeEach, describe, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  deleteAddressBookEntry: vi.fn(),
  getAddressBookEntryByAddress: vi.fn(),
  getAddressBookEntryById: vi.fn(),
  insertAddressBookEntry: vi.fn(),
  listAddressBookEntries: vi.fn(),
  updateAddressBookEntry: vi.fn()
}));

vi.mock("../../../src/features/address-book/address-book.repository.js", () => repositoryMocks);
vi.mock("../../../src/features/auth/audit.service.js", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("../../../src/features/auth/auth.middleware.js", () => ({
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

const { addressBookRouter } = await import("../../../src/features/address-book/address-book.routes.js");

function testApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/address-book", addressBookRouter);
  return app;
}

describe("address-book routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(repositoryMocks)) mock.mockReset();
  });

  it("rejects a malformed prefix-matching address before create mutation", async () => {
    const response = await request(testApp())
      .post("/api/address-book")
      .send({ label: "Alice", address: "Mx1234" });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /valid Minima Mx or 0x address/);
    assert.equal(repositoryMocks.getAddressBookEntryByAddress.mock.calls.length, 0);
    assert.equal(repositoryMocks.insertAddressBookEntry.mock.calls.length, 0);
  });

  it("rejects a malformed prefix-matching address before update mutation", async () => {
    repositoryMocks.getAddressBookEntryById.mockReturnValue({
      id: "entry-1",
      label: "Alice",
      address: "0x01",
      notes: null
    });

    const response = await request(testApp())
      .patch("/api/address-book/entry-1")
      .send({ address: "0xnot-hex" });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /valid Minima Mx or 0x address/);
    assert.equal(repositoryMocks.getAddressBookEntryByAddress.mock.calls.length, 0);
    assert.equal(repositoryMocks.updateAddressBookEntry.mock.calls.length, 0);
  });
});
