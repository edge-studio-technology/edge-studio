import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const secretsMock = vi.hoisted(() => ({ getIntegritasApiKey: vi.fn() }));
vi.mock("../../../src/features/settings/secrets.service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/features/settings/secrets.service.js")>()),
  getIntegritasApiKey: secretsMock.getIntegritasApiKey
}));

// The router is mounted without the global auth gate, so requireRole must not 401 the request.
vi.mock("../../../src/features/auth/auth.middleware.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

const uploadDir = path.join(os.tmpdir(), "edge-studio-uploads");

async function uploadDirEntries() {
  return fs.readdir(uploadDir).catch(() => [] as string[]);
}

/** Cleanup runs in the route's `finally`, after the response is flushed, so poll rather than race it. */
async function waitForUploadDir(expected: string[]) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const entries = await uploadDirEntries();
    if (entries.length === expected.length) return entries;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return uploadDirEntries();
}

let teardown: () => void;
let app: express.Express;

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  const { integritasRouter } = await import("../../../src/features/integritas/integritas.routes.js");
  const { uploadErrorHandler } = await import("../../../src/middleware/uploadErrors.js");

  app = express();
  app.use("/api/integritas", integritasRouter);
  app.use(uploadErrorHandler);
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  secretsMock.getIntegritasApiKey.mockReset();
});

describe("upload temp file cleanup", () => {
  // multer writes the upload to /tmp before the handler runs, so every early return has to
  // remove it — not just the success path.
  for (const route of ["/api/integritas/stamp-file", "/api/integritas/verify-proof-file"]) {
    it(`removes the temp file when ${route} rejects an unlinked Integritas account`, async () => {
      secretsMock.getIntegritasApiKey.mockReturnValue("");
      const before = await uploadDirEntries();

      const response = await request(app).post(route).attach("file", Buffer.from("hello"), "proof.json");

      assert.equal(response.status, 400);
      assert.match(response.body.error as string, /not linked/);
      assert.deepEqual(await waitForUploadDir(before), before);
    });
  }

  it("still reports a missing file when no file is attached", async () => {
    secretsMock.getIntegritasApiKey.mockReturnValue("api-key");

    const response = await request(app).post("/api/integritas/stamp-file").field("other", "value");

    assert.equal(response.status, 400);
    assert.match(response.body.error as string, /file is required/);
  });
});

describe("upload limits", () => {
  it("rejects a file past the size cap with 413 and leaves no temp file", async () => {
    secretsMock.getIntegritasApiKey.mockReturnValue("api-key");
    const { env } = await import("../../../src/config/env.js");
    const before = await uploadDirEntries();

    const response = await request(app)
      .post("/api/integritas/stamp-file")
      .attach("file", Buffer.alloc(env.uploadMaxFileBytes + 1024), "big.bin");

    assert.equal(response.status, 413);
    assert.match(response.body.error as string, /byte limit/);
    assert.equal((response.body.errorDetails as { context?: { code?: string } }).context?.code, "LIMIT_FILE_SIZE");
    assert.deepEqual(await waitForUploadDir(before), before);
  });

  it("rejects more files than the count limit with 400", async () => {
    secretsMock.getIntegritasApiKey.mockReturnValue("api-key");

    const response = await request(app)
      .post("/api/integritas/stamp-file")
      .attach("file", Buffer.from("one"), "a.bin")
      .attach("file", Buffer.from("two"), "b.bin");

    assert.equal(response.status, 400);
    assert.match(response.body.error as string, /Upload rejected/);
  });
});
