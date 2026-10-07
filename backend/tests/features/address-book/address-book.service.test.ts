import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const HEX = "0xDE111E13DBA5054DFF657969BF3A76BFB6CE196F95F6EBEFE1B70FED0115EF1A";
const MX = "MxG086U24F17MT50Y6VUPBPD6VJKTYVMR71WRSYURYUVZDN1VMG25FF39M0458A";
const scripts = { status: true, response: [{ address: HEX, miniaddress: MX, default: true, simple: true }] };
const fetchMock = vi.fn();
let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let repo: typeof import("../../../src/features/address-book/address-book.repository.js");
let initialize: typeof import("../../../src/features/address-book/address-book.service.js")["initializeLocalAddressBookEntry"];
let replacement: typeof import("../../../src/features/address-book/wallet-replacement.service.js");
let getDeviceInfo: typeof import("../../../src/features/status/device.service.js")["getDeviceInfo"];
const ready = { status: true, response: { restoring: false, shuttingdown: false, complete: false } };

function response(body: unknown = scripts, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;
  repo = await import("../../../src/features/address-book/address-book.repository.js");
  ({ initializeLocalAddressBookEntry: initialize } = await import("../../../src/features/address-book/address-book.service.js"));
  replacement = await import("../../../src/features/address-book/wallet-replacement.service.js");
  ({ getDeviceInfo } = await import("../../../src/features/status/device.service.js"));
});
afterAll(() => teardown());
beforeEach(() => {
  db.prepare("DELETE FROM address_book").run();
  db.prepare("DELETE FROM audit_events").run();
  db.prepare("DELETE FROM settings WHERE key='address_book_local_wallet_verification'").run();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("wallet replacement verification", () => {
  function discover() {
    fetchMock.mockImplementation(async (url: string) => response(url.endsWith("/checkrestore") ? ready : scripts));
  }

  it("does not re-enable an old destination after an ambiguous restore failure", async () => {
    const local = repo.ensureLocalAddressBookEntry([HEX])!.entry;
    await assert.rejects(replacement.runWalletReplacement(async () => { throw new Error("timed out"); }), /timed out/);
    discover();
    assert.equal(await initialize(), null);
    assert.equal(repo.getLocalAddressBookEntry()!.isLocalDevicePending, true);
    assert.equal(repo.getLocalAddressBookEntry()!.address, local.address);
    await replacement.runWalletReplacement(async () => undefined);
    assert.deepEqual(await initialize(), local);
  });

  it("rolls back the new address and retains payment protection if its audit cannot be recorded", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    await replacement.runWalletReplacement(async () => undefined);
    discover();
    db.exec("CREATE TRIGGER fail_replace_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'audit write failed'); END");
    try {
      await assert.rejects(initialize(), /audit write failed/);
      assert.equal(repo.getLocalAddressBookEntry()!.address, local.address);
      assert.equal(repo.getLocalAddressBookEntry()!.isLocalDevicePending, true);
    } finally { db.exec("DROP TRIGGER fail_replace_audit"); }
    assert.equal((await initialize())!.address, MX);
  });

  it("updates only the app address, preserves references/metadata/manual copies, and audits public destinations once", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    repo.updateAddressBookEntry(local.id, { label: "My workshop Pi", notes: "Keep these notes" });
    const manual = repo.insertAddressBookEntry({ label: "This device", address: MX, notes: "Mine" });
    await replacement.runWalletReplacement(async () => undefined);
    assert.equal(repo.getLocalAddressBookEntry()!.isLocalDevicePending, true);
    assert.throws(() => repo.getAddressBookPaymentRecipient(local.id), /awaiting wallet verification/);
    discover();
    const updated = await initialize();
    assert.deepEqual(updated, { ...local, label: "My workshop Pi", address: MX, notes: "Keep these notes" });
    assert.deepEqual(repo.getAddressBookEntryById(manual.id), manual);
    assert.equal(repo.listAddressBookEntries().length, 2);
    assert.equal(repo.getAddressBookPaymentRecipient(local.id).address, MX);
    const events = db.prepare("SELECT action,detail FROM audit_events").all() as { action: string; detail: string }[];
    assert.deepEqual(events, [{ action: "address-book.local.replace", detail: JSON.stringify({ id: local.id, oldAddress: "0x01", newAddress: MX }) }]);
    await initialize();
    assert.equal(fetchMock.mock.calls.length, 2);
  });

  it("retains the same wallet's saved address text through Mx/hex ownership comparison", async () => {
    const local = repo.ensureLocalAddressBookEntry([HEX])!.entry;
    await replacement.runWalletReplacement(async () => undefined);
    discover();
    assert.deepEqual(await initialize(), local);
    assert.equal((db.prepare("SELECT count(*) AS n FROM audit_events").get() as { n: number }).n, 0);
  });

  it("holds discovery during replacement and retains durable protection after failure until retry verifies ownership", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    let reject!: (error: Error) => void;
    const attempt = replacement.runWalletReplacement(() => new Promise((_resolve, fail) => { reject = fail; }));
    assert.equal((await initialize())!.isLocalDevicePending, true);
    assert.equal(fetchMock.mock.calls.length, 0);
    reject(new Error("RPC disconnected"));
    await assert.rejects(attempt, /disconnected/);
    assert.equal(replacement.isWalletReplacementInProgress(), false);
    assert.ok(repo.getLocalWalletVerificationRevision());
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    assert.equal(await initialize(), null);
    assert.throws(() => repo.getAddressBookPaymentRecipient(local.id), /awaiting/);
    discover();
    assert.equal((await initialize())!.address, MX);
  });

  for (const body of [
    { status: true, response: { ...ready.response, restoring: true } },
    { status: true, response: { ...ready.response, shuttingdown: true } },
    { status: true, response: { ...ready.response, complete: true } },
    { status: false, response: ready.response },
    { status: true, response: {} },
  ]) {
    it(`keeps the recipient pending for unsafe or malformed restore state ${JSON.stringify(body)}`, async () => {
      repo.ensureLocalAddressBookEntry(["0x01"]);
      await replacement.runWalletReplacement(async () => undefined);
      fetchMock.mockResolvedValue(response(body));
      assert.equal(await initialize(), null);
      assert.equal(fetchMock.mock.calls.length, 1);
      assert.equal(repo.getLocalAddressBookEntry()!.isLocalDevicePending, true);
    });
  }

  it("does not clear pending status for an empty wallet, and retries after it is ready", async () => {
    repo.ensureLocalAddressBookEntry(["0x01"]);
    await replacement.runWalletReplacement(async () => undefined);
    fetchMock.mockResolvedValueOnce(response(ready)).mockResolvedValueOnce(response({ status: true, response: [] }));
    assert.equal(await initialize(), null);
    assert.equal(repo.getLocalAddressBookEntry()!.isLocalDevicePending, true);
    discover();
    assert.equal((await initialize())!.isLocalDevicePending, false);
  });

  it("discards discovery from before a newer replacement", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    await replacement.runWalletReplacement(async () => undefined);
    let resolve!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockResolvedValueOnce(response(ready)).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const attempt = initialize();
    await vi.waitFor(() => assert.equal(fetchMock.mock.calls.length, 2));
    await replacement.runWalletReplacement(async () => undefined);
    resolve(response());
    assert.equal(await attempt, null);
    assert.equal(repo.getLocalAddressBookEntry()!.address, local.address);
    assert.equal(repo.getLocalAddressBookEntry()!.isLocalDevicePending, true);
    discover();
    assert.equal((await initialize())!.address, MX);
  });

  it("does not seed a stale address when replacement begins during first initialization", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const attempt = initialize();
    await replacement.runWalletReplacement(async () => undefined);
    resolve(response());
    assert.equal(await attempt, null);
    assert.equal(repo.getLocalAddressBookEntry(), null);
    discover();
    assert.equal((await initialize())!.isLocalDevicePending, false);
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("initializeLocalAddressBookEntry", () => {
  it("discovers a real wallet address through the RPC boundary without changing matching manual contacts", async () => {
    const manual = repo.insertAddressBookEntry({ label: "This device", address: MX, notes: "Mine" });
    fetchMock.mockResolvedValue(response());
    const local = await initialize();
    assert.ok(local);
    assert.equal(local.isLocalDevice, true);
    assert.equal(local.label, getDeviceInfo().hostname);
    assert.equal(local.address, MX);
    assert.notEqual(local.id, manual.id);
    assert.deepEqual(repo.getAddressBookEntryById(manual.id), manual);
    assert.equal(fetchMock.mock.calls[0][0], "http://127.0.0.1:9005/scripts");
    const events = db.prepare("SELECT action,detail,user_id FROM audit_events").all() as { action: string; detail: string; user_id: null }[];
    assert.equal(events.length, 1);
    assert.equal(events[0].action, "address-book.local.create");
    assert.equal(events[0].user_id, null);
    assert.deepEqual(JSON.parse(events[0].detail), { id: local.id, label: local.label, address: MX });
    assert.deepEqual(await initialize(), local);
    assert.equal(fetchMock.mock.calls.length, 1);
    assert.equal((db.prepare("SELECT count(*) AS n FROM audit_events").get() as { n: number }).n, 1);
  });

  it("returns an existing contact without discovery or rotation", async () => {
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    assert.deepEqual(await initialize(), local);
    assert.equal(fetchMock.mock.calls.length, 0);
    assert.equal((db.prepare("SELECT count(*) AS n FROM audit_events").get() as { n: number }).n, 0);
  });

  it("coalesces simultaneous initialization into one request and one creation audit", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementation(() => new Promise(done => { resolve = done; }));
    const first = initialize();
    const second = initialize();
    assert.equal(fetchMock.mock.calls.length, 1);
    resolve(response());
    const [a, b] = await Promise.all([first, second]);
    assert.ok(a);
    assert.deepEqual(a, b);
    assert.equal(repo.listAddressBookEntries().length, 1);
    assert.equal((db.prepare("SELECT count(*) AS n FROM audit_events").get() as { n: number }).n, 1);
  });

  it("keeps a contact created while discovery was in flight without creating or auditing another", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementation(() => new Promise(done => { resolve = done; }));
    const attempt = initialize();
    const local = repo.ensureLocalAddressBookEntry(["0x01"])!.entry;
    resolve(response());
    assert.deepEqual(await attempt, local);
    assert.deepEqual(repo.listAddressBookEntries(), [local]);
    assert.equal((db.prepare("SELECT count(*) AS n FROM audit_events").get() as { n: number }).n, 0);
  });

  for (const [name, body, status] of [
    ["transport failure", scripts, 503],
    ["RPC failure", { status: false, response: scripts.response }, 200],
    ["empty pool", { status: true, response: [] }, 200],
    ["malformed flags", { status: true, response: [{ ...scripts.response[0], default: "true" }] }, 200],
    ["invalid address", { status: true, response: [{ ...scripts.response[0], miniaddress: "MxInvalid" }] }, 200],
  ] as const) {
    it(`preserves saved data after ${name} and allows a later retry`, async () => {
      const manual = repo.insertAddressBookEntry({ label: "Mine", address: MX, notes: null });
      fetchMock.mockResolvedValueOnce(response(body, status)).mockResolvedValueOnce(response());
      assert.equal(await initialize(), null);
      assert.deepEqual(repo.listAddressBookEntries(), [manual]);
      assert.equal((db.prepare("SELECT count(*) AS n FROM audit_events").get() as { n: number }).n, 0);
      assert.ok((await initialize())?.isLocalDevice);
      assert.deepEqual(repo.getAddressBookEntryById(manual.id), manual);
      assert.equal(fetchMock.mock.calls.length, 2);
    });
  }

  it("releases the in-flight attempt after an offline failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED")).mockResolvedValueOnce(response());
    assert.equal(await initialize(), null);
    assert.ok((await initialize())?.isLocalDevice);
    assert.equal(fetchMock.mock.calls.length, 2);
  });

  it("bounds discovery to the existing five-second RPC timeout", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const attempt = initialize();
    await vi.advanceTimersByTimeAsync(5000);
    assert.equal(await attempt, null);
    assert.equal(repo.getLocalAddressBookEntry(), null);
    fetchMock.mockResolvedValue(response());
    assert.ok((await initialize())?.isLocalDevice);
  });

  it("propagates database failure and allows retry after it is repaired", async () => {
    db.exec("CREATE TRIGGER fail_local_insert BEFORE INSERT ON address_book WHEN NEW.is_local_device=1 BEGIN SELECT RAISE(ABORT,'database write failed'); END");
    fetchMock.mockResolvedValue(response());
    try {
      await assert.rejects(initialize(), /database write failed/);
      assert.equal(repo.getLocalAddressBookEntry(), null);
    } finally { db.exec("DROP TRIGGER fail_local_insert"); }
    assert.ok((await initialize())?.isLocalDevice);
  });
});
