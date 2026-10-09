import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const { resyncMegammrMock, addMinimaPeersMock, createBackupMock, restoreBackupMock, runMinimaPathCommandMock } = vi.hoisted(() => ({
  resyncMegammrMock: vi.fn(),
  addMinimaPeersMock: vi.fn(),
  createBackupMock: vi.fn(),
  restoreBackupMock: vi.fn(),
  runMinimaPathCommandMock: vi.fn()
}));

vi.mock("../../../src/features/minima/minima.service.js", () => ({
  resyncMegammr: resyncMegammrMock,
  addMinimaPeers: addMinimaPeersMock
}));

vi.mock("../../../src/features/minima/minima-backup.service.js", () => ({
  createBackup: createBackupMock,
  restoreBackup: restoreBackupMock
}));

vi.mock("../../../src/features/minima/minima.rpc.js", () => ({
  runMinimaPathCommand: runMinimaPathCommandMock
}));

let teardown: () => void;
let db: import("better-sqlite3").Database;
let createUser: typeof import("../../../src/features/auth/auth.repository.js").createUser;
let consoleService: typeof import("../../../src/features/minima/minima-console.service.js");

let userId: string;
const PASSWORD = "Abcdef1!";

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;

  const { hashPassword } = await import("../../../src/features/auth/password.service.js");
  ({ createUser } = await import("../../../src/features/auth/auth.repository.js"));
  consoleService = await import("../../../src/features/minima/minima-console.service.js");

  const passwordHash = await hashPassword(PASSWORD);
  userId = createUser({
    username: "admin",
    passwordHash,
    totpSecretEncrypted: "irrelevant-secret",
    credentialType: "password"
  });
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  db.prepare("DELETE FROM settings WHERE key = 'minima_console_whitelist'").run();
  db.prepare("DELETE FROM settings WHERE key = 'address_book_local_wallet_verification'").run();
  resyncMegammrMock.mockReset();
  addMinimaPeersMock.mockReset();
  createBackupMock.mockReset();
  restoreBackupMock.mockReset();
  runMinimaPathCommandMock.mockReset();
});

describe("getConsoleWhitelist", () => {
  for (const command of ['restore file:test.bak', 'reset action:restore file:test.bak', 'archive action:import phrase:"test seed"', 'mysql action:resync phrase:"test seed"', 'megammr action:import phrase:"test seed"']) {
    it(`marks pending before dispatching ${command.split(" ")[0]}`, async () => {
      const repo = await import("../../../src/features/address-book/address-book.repository.js");
      const verb = command.split(" ")[0];
      db.prepare("INSERT INTO settings (key,value) VALUES ('minima_console_whitelist',?)").run(JSON.stringify([verb]));
      runMinimaPathCommandMock.mockImplementation(async () => {
        assert.ok(repo.getLocalWalletVerificationRevision());
        return { ok: true, status: 200, body: { status: true } };
      });
      await consoleService.runConsoleCommand(userId, command);
    });
  }

  it("does not mark pending for ordinary reads or a rejected replacement command", async () => {
    const repo = await import("../../../src/features/address-book/address-book.repository.js");
    runMinimaPathCommandMock.mockResolvedValue({ ok: true, status: 200, body: {} });
    await consoleService.runConsoleCommand(userId, "status");
    await assert.rejects(consoleService.runConsoleCommand(userId, "restore file:test.bak"), /not permitted/);
    assert.equal(repo.getLocalWalletVerificationRevision(), "");
  });
  it("defaults to only read-only commands enabled when nothing is stored", () => {
    const { catalog, enabledKeys } = consoleService.getConsoleWhitelist();
    assert.ok(enabledKeys.includes("status"));
    assert.equal(enabledKeys.includes("backup"), false);
    assert.equal(catalog.some((entry) => entry.key === "status"), true);
  });

  it("falls back to defaults when the stored whitelist is malformed JSON", () => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('minima_console_whitelist', ?)").run("{not json");
    const { enabledKeys } = consoleService.getConsoleWhitelist();
    assert.ok(enabledKeys.includes("status"));
  });

  it("falls back to defaults when the stored whitelist is not an array", () => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('minima_console_whitelist', ?)").run(JSON.stringify({ foo: "bar" }));
    const { enabledKeys } = consoleService.getConsoleWhitelist();
    assert.ok(enabledKeys.includes("status"));
  });

  it("filters out keys that no longer exist in the catalog", () => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('minima_console_whitelist', ?)").run(
      JSON.stringify(["status", "no-longer-exists"])
    );
    const { enabledKeys } = consoleService.getConsoleWhitelist();
    assert.deepEqual(enabledKeys, ["status"]);
  });
});

describe("updateConsoleWhitelist", () => {
  it("throws 404 for an unknown user", async () => {
    await assert.rejects(
      () => consoleService.updateConsoleWhitelist("no-such-user", { enabledKeys: [], currentPassword: PASSWORD }),
      (error: unknown) => error instanceof consoleService.MinimaConsoleError && error.status === 404
    );
  });

  it("throws 401 for the wrong password", async () => {
    await assert.rejects(
      () => consoleService.updateConsoleWhitelist(userId, { enabledKeys: [], currentPassword: "wrong-password" }),
      (error: unknown) => error instanceof consoleService.MinimaConsoleError && error.status === 401
    );
  });

  it("throws 400 and names unknown keys", async () => {
    await assert.rejects(
      () => consoleService.updateConsoleWhitelist(userId, { enabledKeys: ["status", "bogus"], currentPassword: PASSWORD }),
      (error: unknown) =>
        error instanceof consoleService.MinimaConsoleError && error.status === 400 && error.message.includes("bogus")
    );
  });

  it("saves the whitelist and records an audit event describing the diff", async () => {
    const result = await consoleService.updateConsoleWhitelist(userId, {
      enabledKeys: ["status", "backup"],
      currentPassword: PASSWORD
    });

    assert.deepEqual([...result.enabledKeys].sort(), ["backup", "status"]);

    const stored = db.prepare("SELECT value FROM settings WHERE key = 'minima_console_whitelist'").get() as { value: string };
    assert.deepEqual(JSON.parse(stored.value).sort(), ["backup", "status"]);

    const event = db
      .prepare("SELECT detail FROM audit_events WHERE action = 'minima.console.whitelist_updated' ORDER BY rowid DESC LIMIT 1")
      .get() as { detail: string };
    assert.ok(event.detail.includes("+backup"));
    assert.ok(event.detail.includes("-"));
  });
});

describe("runConsoleCommand", () => {
  it("rejects a permanently excluded verb with a specific message", async () => {
    await assert.rejects(
      () => consoleService.runConsoleCommand(userId, "quit"),
      (error: unknown) =>
        error instanceof consoleService.MinimaConsoleError && error.status === 400 && error.message.includes("permanently excluded")
    );
  });

  it("rejects a verb that isn't in the catalog at all", async () => {
    await assert.rejects(
      () => consoleService.runConsoleCommand(userId, "notarealcommand"),
      (error: unknown) =>
        error instanceof consoleService.MinimaConsoleError && error.message.includes("isn't part of the console catalog")
    );
  });

  it("rejects a known command that isn't whitelisted", async () => {
    await assert.rejects(
      () => consoleService.runConsoleCommand(userId, "backup"),
      (error: unknown) => error instanceof consoleService.MinimaConsoleError && error.message.includes("not permitted")
    );
  });

  it("dispatches a plain passthrough command and records an audit event", async () => {
    runMinimaPathCommandMock.mockResolvedValue({ ok: true, status: 200, source: "rpc", command: "status", body: {} });

    const result = await consoleService.runConsoleCommand(userId, "status");

    assert.equal(runMinimaPathCommandMock.mock.calls[0][0], "status");
    assert.equal((result as { ok: boolean }).ok, true);
    const event = db
      .prepare("SELECT detail FROM audit_events WHERE action = 'minima.console.run' ORDER BY rowid DESC LIMIT 1")
      .get() as { detail: string };
    assert.equal(event.detail, "status");
  });

  it("dispatches megammrsync-resync via resyncMegammr", async () => {
    await consoleService.updateConsoleWhitelist(userId, {
      enabledKeys: ["status", "megammrsync.resync"],
      currentPassword: PASSWORD
    });
    resyncMegammrMock.mockResolvedValue({ id: "resync-1", phase: "starting" });

    await consoleService.runConsoleCommand(userId, "megammrsync action:resync host:megammr.minima.global:9001");

    assert.deepEqual(resyncMegammrMock.mock.calls[0], ["console"]);
  });

  it("dispatches peers-add via addMinimaPeers with the parsed peerslist", async () => {
    await consoleService.updateConsoleWhitelist(userId, { enabledKeys: ["status", "peers.add"], currentPassword: PASSWORD });
    addMinimaPeersMock.mockResolvedValue({ ok: true });

    await consoleService.runConsoleCommand(userId, "peers action:addpeers peerslist:1.2.3.4:9001");

    assert.equal(addMinimaPeersMock.mock.calls[0][0], "1.2.3.4:9001");
  });

  it("dispatches backup via createBackup", async () => {
    await consoleService.updateConsoleWhitelist(userId, { enabledKeys: ["status", "backup"], currentPassword: PASSWORD });
    createBackupMock.mockResolvedValue({ ok: true });

    await consoleService.runConsoleCommand(userId, "backup");

    assert.deepEqual(createBackupMock.mock.calls[0][0], { auto: false });
  });

  // Finding [10]: the whitelist keys on the first token, so the mutating argument forms of a
  // read-enabled verb must resolve to their own, default-disabled entry.
  it("runs a default-enabled tokens read but refuses tokens action:import", async () => {
    runMinimaPathCommandMock.mockResolvedValue({ status: true });

    await consoleService.runConsoleCommand(userId, "tokens");
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 1);

    await assert.rejects(
      consoleService.runConsoleCommand(userId, "tokens action:import data:0x123"),
      /Command not permitted/
    );
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 1);
  });

  it("refuses maxcontacts action:add while allowing action:list", async () => {
    runMinimaPathCommandMock.mockResolvedValue({ status: true });

    await consoleService.runConsoleCommand(userId, "maxcontacts action:list");
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 1);

    await assert.rejects(
      consoleService.runConsoleCommand(userId, "maxcontacts action:add contact:MAX#abc"),
      /Command not permitted/
    );
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 1);
  });

  it("refuses cointrack by default now that it is classified as a write", async () => {
    await assert.rejects(consoleService.runConsoleCommand(userId, "cointrack enable:true coinid:0x00"), /Command not permitted/);
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 0);
  });

  it("dispatches restoresync via restoreBackup with the parsed file name and password", async () => {
    await consoleService.updateConsoleWhitelist(userId, { enabledKeys: ["status", "restoresync"], currentPassword: PASSWORD });
    restoreBackupMock.mockResolvedValue({ ok: true });

    await consoleService.runConsoleCommand(userId, 'restoresync file:backups/minima-manual-1.bak password:"secret"');

    assert.deepEqual(restoreBackupMock.mock.calls[0][0], { fileName: "minima-manual-1.bak", password: "secret" });
  });
});
