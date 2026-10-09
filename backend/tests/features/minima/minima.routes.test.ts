import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import request from "supertest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

// minima-backup.service.ts writes to the fixed container path /minima-backups, which does
// not exist (and is not creatable) outside Docker. Redirect just that prefix to a tmp dir
// and delegate everything else to the real module, so the rest of the app graph is unaffected.
const backupsDir = path.join(os.tmpdir(), "edge-studio-minima-routes-backups");

vi.mock("node:fs/promises", async () => {
  const real = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const redirect = (value: unknown) =>
    typeof value === "string" && value.startsWith("/minima-backups")
      ? path.join(backupsDir, value.slice("/minima-backups".length))
      : value;
  const wrapped = Object.fromEntries(
    Object.entries(real).map(([key, value]) => [
      key,
      typeof value === "function" ? (...args: unknown[]) => (value as Function)(...args.map(redirect)) : value
    ])
  );
  return { ...wrapped, default: wrapped };
});

const fetchMock = vi.fn();
const { restartMinimaContainer } = vi.hoisted(() => ({ restartMinimaContainer: vi.fn() }));

vi.mock("../../../src/features/minima/minima.service.js", async () => {
  const real = await vi.importActual<typeof import("../../../src/features/minima/minima.service.js")>(
    "../../../src/features/minima/minima.service.js"
  );
  return { ...real, restartMinimaContainer };
});

// The password the finding is about: it is stored encrypted, then interpolated into the
// `backup`/`restoresync` RPC command, which is what used to reach clients verbatim.
const BACKUP_SECRET = "route-level-leak-canary";
const ADMIN_PASSWORD = "Abcdef1!";
const BACKUP_FILE_BYTES = "backup-file-canary-bytes";

let teardown: () => void;
let db: import("better-sqlite3").Database;
let app: import("express").Express;
let cookie: string;
let monitoring: typeof import("../../../src/features/minima/minima-monitoring.js");
let resyncService: typeof import("../../../src/features/minima/minima-resync.service.js");
let backupService: typeof import("../../../src/features/minima/minima-backup.service.js");

function minimaResponse(status: number, requestedUrl: string) {
  // Worst case, and not hypothetical for an RPC that echoes its own arguments: the node
  // replies with the command it was given, secret argument included.
  const body = JSON.stringify({ status: status === 200, params: { url: requestedUrl } });
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

function assertNoSecret(response: { text: string }) {
  assert.equal(response.text.includes(BACKUP_SECRET), false, `plaintext backup password in ${response.text}`);
  assert.equal(
    response.text.includes(encodeURIComponent(BACKUP_SECRET)),
    false,
    `encoded backup password in ${response.text}`
  );
}

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;
  fs.mkdirSync(backupsDir, { recursive: true });

  const { hashPassword } = await import("../../../src/features/auth/password.service.js");
  const { createUser } = await import("../../../src/features/auth/auth.repository.js");
  const { createSession } = await import("../../../src/features/auth/session.service.js");
  backupService = await import("../../../src/features/minima/minima-backup.service.js");
  monitoring = await import("../../../src/features/minima/minima-monitoring.js");
  resyncService = await import("../../../src/features/minima/minima-resync.service.js");

  const userId = createUser({
    username: "admin",
    passwordHash: await hashPassword(ADMIN_PASSWORD),
    totpSecretEncrypted: "irrelevant-secret",
    credentialType: "password"
  });
  cookie = `session=${createSession(userId)}`;

  const { createApp } = await import("../../../src/app.js");
  app = createApp();
});

afterAll(() => {
  teardown();
  fs.rmSync(backupsDir, { recursive: true, force: true });
});

beforeEach(() => {
  fetchMock.mockReset();
  restartMinimaContainer.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fs.rmSync(backupsDir, { recursive: true, force: true });
  fs.mkdirSync(backupsDir, { recursive: true });
  db.prepare("DELETE FROM settings WHERE key IN ('minima_backup_password_enc', 'minima_console_whitelist', 'minima_resync_operation')").run();
  backupService.setBackupPassword(BACKUP_SECRET);
  monitoring.endMinimaOperation();
});

describe("POST /api/minima/restart", () => {
  it("returns a normalized structured dependency error when the restart service rejects", async () => {
    restartMinimaContainer.mockRejectedValue(new Error("fetch failed"));

    const response = await request(app).post("/api/minima/restart").set("Cookie", cookie);

    assert.equal(restartMinimaContainer.mock.calls.length, 1);
    assert.equal(response.status, 502);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.error, "Minima RPC is temporarily unreachable");
    assert.equal(response.body.errorDetails.domain, "system");
    assert.equal(response.body.errorDetails.type, "dependency_unavailable");
    assert.equal(response.body.errorDetails.message, response.body.error);
  });
});

describe("POST /api/minima/backups", () => {
  it("does not leak the stored backup password in the success body", async () => {
    fetchMock.mockImplementation(async (url: string) => minimaResponse(200, url));

    const response = await request(app).post("/api/minima/backups").set("Cookie", cookie);

    assert.equal(response.status, 200);
    // Proves the secret really was in the outbound command, so the assertion below is
    // testing redaction rather than an RPC that never carried it.
    assert.ok((fetchMock.mock.calls[0][0] as string).includes(encodeURIComponent(BACKUP_SECRET)));
    assertNoSecret(response);
    assert.equal("command" in response.body, false);
    assert.equal("source" in response.body, false);
    monitoring.endMinimaOperation();
  });

  it("does not leak the stored backup password in the failure body", async () => {
    fetchMock.mockImplementation(async (url: string) => minimaResponse(500, url));

    const response = await request(app).post("/api/minima/backups").set("Cookie", cookie);

    assert.equal(response.status, 502);
    assertNoSecret(response);
    monitoring.endMinimaOperation();
  });

  it("does not leak the stored backup password through a thrown RPC error", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      throw new Error(`connect ECONNREFUSED for ${url}`);
    });

    const response = await request(app).post("/api/minima/backups").set("Cookie", cookie);

    assert.equal(response.status, 502);
    assertNoSecret(response);
  });
});

describe("POST /api/minima/backups/restore", () => {
  it("does not leak the stored backup password when it falls back to it", async () => {
    fs.writeFileSync(path.join(backupsDir, "minima-manual-1.bak"), "x");
    fetchMock.mockImplementation(async (url: string) => minimaResponse(200, url));

    const response = await request(app)
      .post("/api/minima/backups/restore")
      .set("Cookie", cookie)
      .send({ fileName: "minima-manual-1.bak", currentPassword: ADMIN_PASSWORD });

    assert.equal(response.status, 200);
    assert.ok((fetchMock.mock.calls[0][0] as string).includes(encodeURIComponent(BACKUP_SECRET)));
    assertNoSecret(response);
    monitoring.endMinimaOperation();
  });
});

describe("backup re-auth", () => {
  it("rejects a download with the wrong current password without reading the file", async () => {
    fs.writeFileSync(path.join(backupsDir, "minima-manual-1.bak"), BACKUP_FILE_BYTES);

    const response = await request(app)
      .post("/api/minima/backups/minima-manual-1.bak/download")
      .set("Cookie", cookie)
      .send({ currentPassword: "wrong-password" });

    assert.equal(response.status, 401);
    assert.equal(response.body.errorCode, "invalid_credential");
    assert.equal(response.text.includes(BACKUP_FILE_BYTES), false, "backup bytes returned despite failed re-auth");
  });

  it("rejects a restore with the wrong current password without calling Minima", async () => {
    fs.writeFileSync(path.join(backupsDir, "minima-manual-1.bak"), BACKUP_FILE_BYTES);
    fetchMock.mockImplementation(async (url: string) => minimaResponse(200, url));

    const response = await request(app)
      .post("/api/minima/backups/restore")
      .set("Cookie", cookie)
      .send({ fileName: "minima-manual-1.bak", currentPassword: "wrong-password" });

    assert.equal(response.status, 401);
    assert.equal(response.body.errorCode, "invalid_credential");
    assert.equal(fetchMock.mock.calls.length, 0);
  });
});

describe("POST /api/minima/console/run", () => {
  it("does not leak the stored backup password for a whitelisted backup command", async () => {
    // The console dispatches `backup` to createBackup(), so this pins that the fix above
    // covers this route too rather than assuming the dispatch stays wired that way.
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('minima_console_whitelist', ?)").run(
      JSON.stringify(["backup"])
    );
    fetchMock.mockImplementation(async (url: string) => minimaResponse(200, url));

    const response = await request(app).post("/api/minima/console/run").set("Cookie", cookie).send({ command: "backup" });

    assert.equal(response.status, 200);
    assert.ok((fetchMock.mock.calls[0][0] as string).includes(encodeURIComponent(BACKUP_SECRET)));
    assertNoSecret(response);
    assert.equal("command" in response.body, false);
    monitoring.endMinimaOperation();
  });
});


describe("asynchronous resync API", () => {
  it("returns a noncached empty snapshot without issuing node RPC", async () => {
    const anonymous = await request(app).get("/api/minima/resync");
    assert.equal(anonymous.status, 401);
    const response = await request(app).get("/api/minima/resync").set("Cookie", cookie);
    assert.equal(response.status, 200);
    assert.equal(response.body, null);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("returns 202 before slow RPC finishes and returns 409 for a duplicate without redispatch", async () => {
    let finish!: (value: { ok: boolean; status: number; text: () => Promise<string> }) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    try {
      const accepted = await request(app).post("/api/minima/megammrsync/resync").set("Cookie", cookie);
      assert.equal(accepted.status, 202);
      assert.equal(accepted.body.phase, "starting");
      assert.equal(accepted.body.busy, true);
      assert.equal(accepted.body.outcome, null);
      const duplicate = await request(app).post("/api/minima/megammrsync/resync").set("Cookie", cookie);
      assert.equal(duplicate.status, 409);
      assert.equal(duplicate.body.errorDetails.type, "conflict");
      const progress = await request(app).get("/api/minima/resync").set("Cookie", cookie);
      assert.equal(progress.body.id, accepted.body.id);
      assert.equal(progress.body.phase, "starting");
      assert.equal("host" in progress.body, false);
      assert.equal("dispatchedAt" in progress.body, false);
      assert.equal(fetchMock.mock.calls.length, 1);
    } finally {
      finish({ ok: true, status: 200, text: async () => JSON.stringify({ status: true, response: { message: "MegaMMR sync fininshed.. please restart" } }) });
      await vi.waitFor(() => assert.equal(resyncService.getMinimaResyncOperation()?.phase, "recovering"));
    }
  });

  it("blocks backup, restore and console resync while reserved without another node command", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ status: true }) });
    const accepted = await request(app).post("/api/minima/megammrsync/resync").set("Cookie", cookie);
    assert.equal(accepted.status, 202);
    fs.writeFileSync(path.join(backupsDir, "minima-manual-1.bak"), "x");
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('minima_console_whitelist',?)").run(JSON.stringify(["megammrsync.resync"]));
    const backup = await request(app).post("/api/minima/backups").set("Cookie", cookie);
    const restore = await request(app).post("/api/minima/backups/restore").set("Cookie", cookie).send({ fileName: "minima-manual-1.bak", currentPassword: ADMIN_PASSWORD });
    const consoleResponse = await request(app).post("/api/minima/console/run").set("Cookie", cookie).send({ command: "megammrsync action:resync" });
    for (const response of [backup, restore, consoleResponse]) {
      assert.equal(response.status, 409);
      assert.equal(response.body.errorDetails.type, "conflict");
    }
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("returns a structured restart conflict", async () => {
    const { MinimaResyncConflictError } = await import("../../../src/features/minima/minima.errors.js");
    restartMinimaContainer.mockRejectedValue(new MinimaResyncConflictError());
    const response = await request(app).post("/api/minima/restart").set("Cookie", cookie);
    assert.equal(response.status, 409);
    assert.equal(response.body.errorDetails.type, "conflict");
  });
});
