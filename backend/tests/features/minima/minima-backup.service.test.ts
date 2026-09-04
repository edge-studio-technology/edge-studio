import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

type FakeEntry = { size: number; mtime: Date; kind: "file" | "dir" };

const { fsState, fsMock } = vi.hoisted(() => {
  const state = new Map<string, FakeEntry>();

  function baseName(p: string) {
    return p.split(/[\\/]/).pop() ?? p;
  }
  function enoent() {
    const err = new Error("ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    return err;
  }

  const mock = {
    mkdir: vi.fn(async () => undefined),
    readdir: vi.fn(async () =>
      Array.from(state.entries()).map(([name, entry]) => ({
        name,
        isFile: () => entry.kind === "file",
        isDirectory: () => entry.kind === "dir"
      }))
    ),
    stat: vi.fn(async (p: string) => {
      const entry = state.get(baseName(p));
      if (!entry) throw enoent();
      return { size: entry.size, mtime: entry.mtime };
    }),
    realpath: vi.fn(async (p: string) => p),
    access: vi.fn(async (p: string) => {
      const name = baseName(p);
      if (name === "minima-backups" || state.has(name)) return undefined;
      throw enoent();
    }),
    unlink: vi.fn(async (p: string) => {
      if (!state.delete(baseName(p))) throw enoent();
    }),
    copyFile: vi.fn(async (_src: string, dest: string) => {
      state.set(baseName(dest), { size: 42, mtime: new Date(), kind: "file" });
    }),
    rm: vi.fn(async (_p: string) => undefined)
  };

  return { fsState: state, fsMock: mock };
});

vi.mock("node:fs/promises", () => ({ default: fsMock }));

const { runMinimaPathCommandMock, getMinimaConfigMock } = vi.hoisted(() => ({
  runMinimaPathCommandMock: vi.fn(),
  getMinimaConfigMock: vi.fn()
}));

vi.mock("../../../src/features/minima/minima.rpc.js", () => ({
  runMinimaPathCommand: runMinimaPathCommandMock
}));

vi.mock("../../../src/features/minima/minima.service.js", () => ({
  getMinimaConfig: getMinimaConfigMock
}));

let teardown: () => void;
let db: import("better-sqlite3").Database;
let backupService: typeof import("../../../src/features/minima/minima-backup.service.js");
let monitoring: typeof import("../../../src/features/minima/minima-monitoring.js");
let userId: string;
const PASSWORD = "Abcdef1!";

function seedBackup(name: string, createdAt: string) {
  fsState.set(name, { size: 100, mtime: new Date(createdAt), kind: "file" });
}

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;

  const { hashPassword } = await import("../../../src/features/auth/password.service.js");
  const { createUser } = await import("../../../src/features/auth/auth.repository.js");
  backupService = await import("../../../src/features/minima/minima-backup.service.js");
  monitoring = await import("../../../src/features/minima/minima-monitoring.js");

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
  fsState.clear();
  db.prepare("DELETE FROM settings WHERE key IN ('minima_backup_password_enc', 'minima_auto_backup_enabled')").run();
  for (const fn of Object.values(fsMock)) fn.mockClear();
  runMinimaPathCommandMock.mockReset();
  getMinimaConfigMock.mockReset();
  getMinimaConfigMock.mockReturnValue({ megammrHost: "megammr.minima.global:9001", megammrHostSource: "default" });
});

describe("verifyCurrentPassword", () => {
  it("throws 401 with no userId", async () => {
    await assert.rejects(
      () => backupService.verifyCurrentPassword(undefined, PASSWORD),
      (error: unknown) => error instanceof backupService.MinimaBackupError && error.status === 401
    );
  });

  it("throws 404 for an unknown user", async () => {
    await assert.rejects(
      () => backupService.verifyCurrentPassword("no-such-user", PASSWORD),
      (error: unknown) => error instanceof backupService.MinimaBackupError && error.status === 404
    );
  });

  it("throws 401 for the wrong password", async () => {
    await assert.rejects(
      () => backupService.verifyCurrentPassword(userId, "wrong-password"),
      (error: unknown) => error instanceof backupService.MinimaBackupError && error.status === 401
    );
  });

  it("resolves for the correct password", async () => {
    await assert.doesNotReject(() => backupService.verifyCurrentPassword(userId, PASSWORD));
  });
});

describe("backup password + auto-backup setting", () => {
  it("rejects an empty backup password", () => {
    assert.throws(
      () => backupService.setBackupPassword("   "),
      (error: unknown) => error instanceof backupService.MinimaBackupError && error.status === 400
    );
  });

  it("stores and reports a backup password", () => {
    assert.equal(backupService.hasBackupPassword(), false);
    backupService.setBackupPassword("super-secret");
    assert.equal(backupService.hasBackupPassword(), true);
  });

  it("clearing the password also disables automatic backups", () => {
    backupService.setBackupPassword("super-secret");
    backupService.setAutoBackupEnabled(true);
    assert.equal(backupService.getAutoBackupEnabled(), true);

    backupService.clearBackupPassword();

    assert.equal(backupService.hasBackupPassword(), false);
    assert.equal(backupService.getAutoBackupEnabled(), false);
  });

  it("refuses to enable automatic backups without a stored password", () => {
    assert.throws(
      () => backupService.setAutoBackupEnabled(true),
      (error: unknown) => error instanceof backupService.MinimaBackupError && error.status === 400
    );
  });
});

describe("listBackups / getBackupFilePath / deleteBackup", () => {
  it("returns an empty list when nothing exists", async () => {
    assert.deepEqual(await backupService.listBackups(), []);
  });

  it("lists only .bak files, newest first, ignoring directories and other extensions", async () => {
    seedBackup("minima-auto-2026-01-01T00-00-00-000Z.bak", "2026-01-01T00:00:00.000Z");
    seedBackup("minima-manual-2026-01-03T00-00-00-000Z.bak", "2026-01-03T00:00:00.000Z");
    fsState.set("notes.txt", { size: 1, mtime: new Date(), kind: "file" });
    fsState.set("some-dir", { size: 0, mtime: new Date(), kind: "dir" });

    const backups = await backupService.listBackups();

    assert.deepEqual(
      backups.map((b) => b.fileName),
      ["minima-manual-2026-01-03T00-00-00-000Z.bak", "minima-auto-2026-01-01T00-00-00-000Z.bak"]
    );
  });

  it("getBackupFilePath resolves an existing file and rejects a missing one", async () => {
    seedBackup("minima-manual-1.bak", "2026-01-01T00:00:00.000Z");
    const filePath = await backupService.getBackupFilePath("minima-manual-1.bak");
    assert.ok(filePath.endsWith("minima-manual-1.bak"));

    await assert.rejects(() => backupService.getBackupFilePath("does-not-exist.bak"));
  });

  it("rejects a path-traversal file name before touching the filesystem", async () => {
    await assert.rejects(
      () => backupService.getBackupFilePath("../etc/passwd"),
      (error: unknown) => (error as NodeJS.ErrnoException).code === "OUTSIDE_ROOT"
    );
    assert.equal(fsMock.access.mock.calls.length, 0);
  });

  it("deleteBackup removes an existing file and rejects a missing one", async () => {
    seedBackup("minima-manual-1.bak", "2026-01-01T00:00:00.000Z");
    await backupService.deleteBackup("minima-manual-1.bak");
    assert.equal(fsState.has("minima-manual-1.bak"), false);

    await assert.rejects(() => backupService.deleteBackup("minima-manual-1.bak"));
  });
});

describe("createBackup", () => {
  it("refuses to run without a stored backup password", async () => {
    await assert.rejects(
      () => backupService.createBackup(),
      (error: unknown) => error instanceof backupService.MinimaBackupError && error.status === 400
    );
  });

  it("runs the backup command, leaves the operation marked in-progress on success", async () => {
    backupService.setBackupPassword("super-secret");
    runMinimaPathCommandMock.mockResolvedValue({ ok: true, status: 200, source: "rpc", command: "backup", body: {} });

    const result = await backupService.createBackup({ auto: true });

    const command = runMinimaPathCommandMock.mock.calls[0][0] as string;
    assert.ok(command.startsWith("backup file:backups/minima-auto-"));
    assert.ok(command.includes('password:"super-secret"'));
    assert.equal(result.auto, true);
    assert.equal(monitoring.isMinimaOperationInProgress(), true);
    monitoring.endMinimaOperation();
  });

  it("clears the in-progress operation and rethrows when the RPC call fails", async () => {
    backupService.setBackupPassword("super-secret");
    runMinimaPathCommandMock.mockRejectedValue(new Error("rpc timeout"));

    await assert.rejects(() => backupService.createBackup());
    assert.equal(monitoring.isMinimaOperationInProgress(), false);
  });

  it("prunes the oldest backup once the list exceeds MAX_BACKUPS", async () => {
    backupService.setBackupPassword("super-secret");
    for (let i = 0; i < 21; i++) {
      seedBackup(`minima-auto-2026-01-${String(i + 1).padStart(2, "0")}T00-00-00-000Z.bak`, `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`);
    }
    runMinimaPathCommandMock.mockResolvedValue({ ok: true, status: 200, source: "rpc", command: "backup", body: {} });

    await backupService.createBackup({ auto: true });

    assert.equal(fsMock.unlink.mock.calls.length, 1);
    assert.equal(fsState.has("minima-auto-2026-01-01T00-00-00-000Z.bak"), false);
  });
});

describe("restoreBackup", () => {
  it("rejects a missing backup file", async () => {
    await assert.rejects(() => backupService.restoreBackup({ fileName: "missing.bak" }));
  });

  it("uses an explicit password over the stored one", async () => {
    seedBackup("minima-manual-1.bak", "2026-01-01T00:00:00.000Z");
    backupService.setBackupPassword("stored-secret");
    runMinimaPathCommandMock.mockResolvedValue({ ok: true, status: 200, source: "rpc", command: "restoresync", body: {} });

    await backupService.restoreBackup({ fileName: "minima-manual-1.bak", password: "explicit-secret" });

    const command = runMinimaPathCommandMock.mock.calls[0][0] as string;
    assert.ok(command.includes('password:"explicit-secret"'));
    assert.ok(command.includes("host:megammr.minima.global:9001"));
    monitoring.endMinimaOperation();
  });

  it("falls back to the stored password when none is passed", async () => {
    seedBackup("minima-manual-1.bak", "2026-01-01T00:00:00.000Z");
    backupService.setBackupPassword("stored-secret");
    runMinimaPathCommandMock.mockResolvedValue({ ok: true, status: 200, source: "rpc", command: "restoresync", body: {} });

    await backupService.restoreBackup({ fileName: "minima-manual-1.bak" });

    const command = runMinimaPathCommandMock.mock.calls[0][0] as string;
    assert.ok(command.includes('password:"stored-secret"'));
    monitoring.endMinimaOperation();
  });

  it("omits the password argument when neither an explicit nor stored password exists", async () => {
    seedBackup("minima-manual-1.bak", "2026-01-01T00:00:00.000Z");
    runMinimaPathCommandMock.mockResolvedValue({ ok: true, status: 200, source: "rpc", command: "restoresync", body: {} });

    await backupService.restoreBackup({ fileName: "minima-manual-1.bak" });

    const command = runMinimaPathCommandMock.mock.calls[0][0] as string;
    assert.equal(command.includes("password:"), false);
    monitoring.endMinimaOperation();
  });

  it("clears the in-progress operation and rethrows when the RPC call fails", async () => {
    seedBackup("minima-manual-1.bak", "2026-01-01T00:00:00.000Z");
    runMinimaPathCommandMock.mockRejectedValue(new Error("rpc timeout"));

    await assert.rejects(() => backupService.restoreBackup({ fileName: "minima-manual-1.bak" }));
    assert.equal(monitoring.isMinimaOperationInProgress(), false);
  });
});

describe("saveUploadedBackup", () => {
  it("keeps a .bak suffix, sanitizes unsafe characters, and cleans up the tmp file", async () => {
    const fileName = await backupService.saveUploadedBackup("/tmp/upload-xyz", "my backup!.bak");

    assert.ok(fileName.endsWith("my_backup_.bak"));
    assert.equal(fsMock.copyFile.mock.calls[0][0], "/tmp/upload-xyz");
    assert.equal(fsMock.rm.mock.calls[0][0], "/tmp/upload-xyz");
    assert.equal(fsState.has(fileName), true);
  });

  it("appends .bak when the original name lacks it", async () => {
    const fileName = await backupService.saveUploadedBackup("/tmp/upload-abc", "restore-me");
    assert.ok(fileName.endsWith("restore-me.bak"));
  });

  it("falls back to uploaded.bak for an empty original name", async () => {
    const fileName = await backupService.saveUploadedBackup("/tmp/upload-def", "");
    assert.ok(fileName.endsWith("uploaded.bak"));
  });
});
