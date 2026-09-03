import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let repo: typeof import("../../../src/features/address-book/address-book.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  repo = await import("../../../src/features/address-book/address-book.repository.js");
});

afterAll(() => {
  teardown();
});

describe("insertAddressBookEntry", () => {
  it("creates and returns the entry with a generated id and timestamp", () => {
    const entry = repo.insertAddressBookEntry({ label: "Alice", address: "Mx01ALICE", notes: "friend" });
    assert.ok(entry.id);
    assert.equal(entry.label, "Alice");
    assert.equal(entry.address, "Mx01ALICE");
    assert.equal(entry.notes, "friend");
    assert.ok(entry.created_at);
  });

  it("allows null notes", () => {
    const entry = repo.insertAddressBookEntry({ label: "Bob", address: "Mx02BOB", notes: null });
    assert.equal(entry.notes, null);
  });
});

describe("listAddressBookEntries", () => {
  it("returns entries ordered by label, case-insensitively", () => {
    repo.insertAddressBookEntry({ label: "zeta", address: "Mx03ZETA", notes: null });
    repo.insertAddressBookEntry({ label: "Beta", address: "Mx04BETA", notes: null });

    const labels = repo.listAddressBookEntries().map((e) => e.label);
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    assert.deepEqual(labels, sorted);
  });
});

describe("getAddressBookEntryById", () => {
  it("returns the matching entry", () => {
    const created = repo.insertAddressBookEntry({ label: "Carol", address: "Mx05CAROL", notes: null });
    const found = repo.getAddressBookEntryById(created.id);
    assert.deepEqual(found, created);
  });

  it("returns null when no entry matches", () => {
    assert.equal(repo.getAddressBookEntryById("missing-id"), null);
  });
});

describe("getAddressBookEntryByAddress", () => {
  it("returns the matching entry", () => {
    const created = repo.insertAddressBookEntry({ label: "Dave", address: "Mx06DAVE", notes: null });
    const found = repo.getAddressBookEntryByAddress("Mx06DAVE");
    assert.deepEqual(found, created);
  });

  it("returns null when no entry matches", () => {
    assert.equal(repo.getAddressBookEntryByAddress("Mx00missing"), null);
  });
});

describe("updateAddressBookEntry", () => {
  it("returns null when the entry does not exist", () => {
    assert.equal(repo.updateAddressBookEntry("missing-id", { label: "New" }), null);
  });

  it("updates only the provided fields, leaving others unchanged", () => {
    const created = repo.insertAddressBookEntry({ label: "Erin", address: "Mx07ERIN", notes: "original" });
    const updated = repo.updateAddressBookEntry(created.id, { label: "Erin Updated" });
    assert.equal(updated?.label, "Erin Updated");
    assert.equal(updated?.address, "Mx07ERIN");
    assert.equal(updated?.notes, "original");
  });

  it("updates notes to null when explicitly passed null", () => {
    const created = repo.insertAddressBookEntry({ label: "Frank", address: "Mx08FRANK", notes: "has notes" });
    const updated = repo.updateAddressBookEntry(created.id, { notes: null });
    assert.equal(updated?.notes, null);
  });

  it("leaves notes unchanged when not provided", () => {
    const created = repo.insertAddressBookEntry({ label: "Grace", address: "Mx09GRACE", notes: "keep me" });
    const updated = repo.updateAddressBookEntry(created.id, { label: "Grace Updated" });
    assert.equal(updated?.notes, "keep me");
  });

  it("updates the address field", () => {
    const created = repo.insertAddressBookEntry({ label: "Heidi", address: "Mx10HEIDI", notes: null });
    const updated = repo.updateAddressBookEntry(created.id, { address: "Mx10HEIDI2" });
    assert.equal(updated?.address, "Mx10HEIDI2");
  });
});

describe("deleteAddressBookEntry", () => {
  it("deletes an existing entry and returns true", () => {
    const created = repo.insertAddressBookEntry({ label: "Ivan", address: "Mx11IVAN", notes: null });
    assert.equal(repo.deleteAddressBookEntry(created.id), true);
    assert.equal(repo.getAddressBookEntryById(created.id), null);
  });

  it("returns false when the entry does not exist", () => {
    assert.equal(repo.deleteAddressBookEntry("missing-id"), false);
  });
});
