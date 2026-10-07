import assert from "node:assert/strict";
import os from "os";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let repo: typeof import("../../../src/features/address-book/address-book.repository.js");
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];

const HEX_ADDRESS = "0xDE111E13DBA5054DFF657969BF3A76BFB6CE196F95F6EBEFE1B70FED0115EF1A";
const MX_ADDRESS = "MxG086U24F17MT50Y6VUPBPD6VJKTYVMR71WRSYURYUVZDN1VMG25FF39M0458A";

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  repo = await import("../../../src/features/address-book/address-book.repository.js");
});

afterAll(() => {
  teardown();
});

afterEach(() => vi.restoreAllMocks());

describe("insertAddressBookEntry", () => {
  it("creates and returns the entry with a generated id and timestamp", () => {
    const entry = repo.insertAddressBookEntry({ label: "Alice", address: "Mx01ALICE", notes: "friend" });
    assert.ok(entry.id);
    assert.equal(entry.label, "Alice");
    assert.equal(entry.address, "Mx01ALICE");
    assert.equal(entry.notes, "friend");
    assert.ok(entry.created_at);
    assert.equal(entry.isLocalDevice, false);
  });

  it("allows null notes", () => {
    const entry = repo.insertAddressBookEntry({ label: "Bob", address: "Mx02BOB", notes: null });
    assert.equal(entry.notes, null);
  });
});

describe("ensureLocalAddressBookEntry", () => {
  beforeEach(() => {
    db.prepare("DELETE FROM address_book").run();
  });

  it("creates one app contact and skips subsequent initialization regardless of pool changes", () => {
    vi.spyOn(os, "hostname").mockReturnValue("dev-pi");
    assert.equal(repo.getLocalAddressBookEntry(), null);
    const result = repo.ensureLocalAddressBookEntry([MX_ADDRESS, "0x01"]);
    assert.ok(result);
    assert.equal(result.changed, true);
    assert.equal(result.entry.label, "dev-pi");
    assert.equal(result.entry.address, "0x01");
    assert.equal(result.entry.notes, null);
    assert.equal(result.entry.isLocalDevice, true);

    for (const pool of [["0x01", MX_ADDRESS], ["0x02"], [], ["invalid"]]) {
      assert.deepEqual(repo.ensureLocalAddressBookEntry(pool), { entry: result.entry, changed: false });
    }
    assert.deepEqual(repo.getLocalAddressBookEntry(), result.entry);
    assert.deepEqual(repo.listAddressBookEntries(), [result.entry]);
  });

  it("creates its own contact even when the user saved the exact same address and name", () => {
    const saved = repo.insertAddressBookEntry({ label: os.hostname(), address: MX_ADDRESS, notes: "Mine" });
    const result = repo.ensureLocalAddressBookEntry([MX_ADDRESS])!;
    assert.notEqual(result.entry.id, saved.id);
    assert.equal(result.entry.address, saved.address);
    assert.equal(result.entry.isLocalDevice, true);
    assert.deepEqual(repo.getAddressBookEntryById(saved.id), saved);
    assert.equal(repo.listAddressBookEntries().length, 2);
    assert.deepEqual(repo.getAddressBookEntryByAddress(MX_ADDRESS), saved);
  });

  it.each(["This device", "My workshop Pi"])("preserves an existing name (%s) when the hostname changes", (label) => {
    const hostname = vi.spyOn(os, "hostname").mockReturnValue("old-container");
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    const saved = repo.updateAddressBookEntry(local.id, { label, notes: "Keep" })!;
    hostname.mockReturnValue("new-container");
    assert.deepEqual(repo.ensureLocalAddressBookEntry(["0x02"]), { entry: saved, changed: false });
    assert.deepEqual(repo.getLocalAddressBookEntry(), saved);
  });

  it("ignores user-created Mx/hex/case aliases and keeps the normal selection", () => {
    const mx = repo.insertAddressBookEntry({ label: "My Mx", address: MX_ADDRESS.toLowerCase(), notes: "Keep" });
    const hex = repo.insertAddressBookEntry({ label: "My hex", address: HEX_ADDRESS, notes: null });
    const result = repo.ensureLocalAddressBookEntry([HEX_ADDRESS])!;
    assert.equal(result.entry.address, HEX_ADDRESS);
    assert.notEqual(result.entry.id, hex.id);
    assert.deepEqual(repo.getAddressBookEntryById(mx.id), mx);
    assert.deepEqual(repo.getAddressBookEntryById(hex.id), hex);
    assert.equal(repo.listAddressBookEntries().length, 3);
  });

  it("still creates its own contact when every wallet candidate is manually saved", () => {
    const first = repo.insertAddressBookEntry({ label: "First", address: "0x01", notes: null });
    const second = repo.insertAddressBookEntry({ label: "Second", address: "0x02", notes: "Saved" });
    const result = repo.ensureLocalAddressBookEntry(["0x02", "0x01"])!;
    assert.equal(result.entry.address, "0x01");
    assert.notEqual(result.entry.id, first.id);
    assert.deepEqual(repo.getAddressBookEntryById(first.id), first);
    assert.deepEqual(repo.getAddressBookEntryById(second.id), second);
    assert.equal(repo.listAddressBookEntries().filter((entry) => entry.isLocalDevice).length, 1);
  });

  it("allows manual contacts sharing the destination to be edited and removed independently", () => {
    const local = repo.ensureLocalAddressBookEntry([MX_ADDRESS])!.entry;
    const manual = repo.insertAddressBookEntry({ label: "My contact", address: MX_ADDRESS, notes: null });
    const edited = repo.updateAddressBookEntry(manual.id, { label: "Renamed", notes: "Edited" });
    assert.deepEqual(edited, { ...manual, label: "Renamed", notes: "Edited" });
    assert.equal(repo.deleteAddressBookEntry(manual.id), true);
    assert.deepEqual(repo.getLocalAddressBookEntry(), local);
    assert.equal(repo.getAddressBookEntryByAddress(MX_ADDRESS), null);
  });

  it("does nothing with an empty or invalid pool before the first contact exists", () => {
    assert.equal(repo.ensureLocalAddressBookEntry([]), null);
    assert.throws(() => repo.ensureLocalAddressBookEntry(["0x01", "invalid"]), /Invalid local wallet address/);
    assert.deepEqual(repo.listAddressBookEntries(), []);
  });

  it("rolls back a failed managed insertion without changing a saved contact", () => {
    const manual = repo.insertAddressBookEntry({ label: "Mine", address: MX_ADDRESS, notes: "Saved" });
    db.exec(`CREATE TRIGGER fail_local_insert BEFORE INSERT ON address_book
      WHEN NEW.is_local_device = 1 BEGIN SELECT RAISE(ABORT, 'local insert failed'); END;`);
    try {
      assert.throws(() => repo.ensureLocalAddressBookEntry([MX_ADDRESS]), /local insert failed/);
      assert.deepEqual(repo.listAddressBookEntries(), [manual]);
    } finally {
      db.exec("DROP TRIGGER fail_local_insert");
    }
    assert.equal(repo.ensureLocalAddressBookEntry([MX_ADDRESS])?.entry.isLocalDevice, true);
  });

  it("enforces one local marker and retains the exact-address duplicate rule between manual contacts", () => {
    repo.ensureLocalAddressBookEntry([MX_ADDRESS]);
    const manual = repo.insertAddressBookEntry({ label: "Mine", address: MX_ADDRESS, notes: null });
    assert.throws(() => repo.insertAddressBookEntry({ label: "Duplicate", address: MX_ADDRESS, notes: null }), /UNIQUE/);
    assert.throws(() => db.prepare("UPDATE address_book SET is_local_device = 1 WHERE id = ?").run(manual.id), /UNIQUE/);
    assert.equal(repo.getAddressBookEntryById(manual.id)?.isLocalDevice, false);
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
