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

// The password the finding is about: it is stored encrypted, then interpolated into the
// `backup`/`restoresync` RPC command, which is what used to reach clients verbatim.
const BACKUP_SECRET = "route-level-leak-canary";
const ADMIN_PASSWORD = "Abcdef1!";

let teardown: () => void;
let db: import("better-sqlite3").Database;
let app: import("express").Express;
let cookie: string;
let monitoring: typeof import("../../../src/features/minima/minima-monitoring.js");
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
  vi.stubGlobal("fetch", fetchMock);
  fs.rmSync(backupsDir, { recursive: true, force: true });
  fs.mkdirSync(backupsDir, { recursive: true });
  db.prepare("DELETE FROM settings WHERE key IN ('minima_backup_password_enc', 'minima_console_whitelist')").run();
  backupService.setBackupPassword(BACKUP_SECRET);
  monitoring.endMinimaOperation();
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
