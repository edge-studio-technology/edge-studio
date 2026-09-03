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
  resyncMegammrMock.mockReset();
  addMinimaPeersMock.mockReset();
  createBackupMock.mockReset();
  restoreBackupMock.mockReset();
  runMinimaPathCommandMock.mockReset();
});

describe("getConsoleWhitelist", () => {
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
    resyncMegammrMock.mockResolvedValue({ ok: true });

    await consoleService.runConsoleCommand(userId, "megammrsync action:resync host:megammr.minima.global:9001");

    assert.equal(resyncMegammrMock.mock.calls.length, 1);
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

  it("dispatches restoresync via restoreBackup with the parsed file name and password", async () => {
    await consoleService.updateConsoleWhitelist(userId, { enabledKeys: ["status", "restoresync"], currentPassword: PASSWORD });
    restoreBackupMock.mockResolvedValue({ ok: true });

    await consoleService.runConsoleCommand(userId, 'restoresync file:backups/minima-manual-1.bak password:"secret"');

    assert.deepEqual(restoreBackupMock.mock.calls[0][0], { fileName: "minima-manual-1.bak", password: "secret" });
  });
});
