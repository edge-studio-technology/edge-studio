import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let db: import("better-sqlite3").Database;
let teardown: () => void;
let repo: typeof import("../../../src/features/address-book/address-book.repository.js");
let service: typeof import("../../../src/features/address-book/wallet-replacement.service.js");
beforeAll(async () => {
  ({ db, teardown } = await setupTestDatabase());
  repo = await import("../../../src/features/address-book/address-book.repository.js");
  service = await import("../../../src/features/address-book/wallet-replacement.service.js");
});
afterAll(() => teardown());
beforeEach(() => {
  db.prepare("DELETE FROM address_book").run();
  db.prepare("DELETE FROM settings").run();
});

describe("runWalletReplacement", () => {
  it("persists protection before dispatch and holds it across overlapping replacement requests", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    let finishFirst!: () => void;
    let finishSecond!: () => void;
    const first = service.runWalletReplacement(() => {
      assert.throws(() => repo.getAddressBookPaymentRecipient(local.id), /awaiting wallet verification/);
      const persisted = repo.getLocalWalletVerificationRevision();
      assert.ok(persisted.startsWith("uncertain:"));
      assert.equal(repo.reconcileLocalAddressBookEntry([local.address], persisted), null);
      return new Promise<void>(resolve => { finishFirst = resolve; });
    });
    const revision = repo.getLocalWalletVerificationRevision();
    const second = service.runWalletReplacement(() => new Promise<void>(resolve => { finishSecond = resolve; }));
    assert.notEqual(repo.getLocalWalletVerificationRevision(), revision);
    finishFirst();
    await first;
    assert.equal(service.isWalletReplacementInProgress(), true);
    finishSecond();
    await second;
    assert.equal(service.isWalletReplacementInProgress(), false);
    assert.ok(repo.getLocalWalletVerificationRevision());
    assert.throws(() => repo.getAddressBookPaymentRecipient(local.id), /awaiting wallet verification/);
  });

  it("does not dispatch a mutation when durable protection cannot be written", async () => {
    db.exec("CREATE TRIGGER fail_verification BEFORE INSERT ON settings BEGIN SELECT RAISE(ABORT,'write failed'); END");
    let dispatched = false;
    try {
      await assert.rejects(service.runWalletReplacement(async () => { dispatched = true; }), /write failed/);
      assert.equal(dispatched, false);
      assert.equal(service.isWalletReplacementInProgress(), false);
    } finally { db.exec("DROP TRIGGER fail_verification"); }
  });
});
