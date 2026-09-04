import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export async function setupTestDatabase() {
  const dbFile = path.join(os.tmpdir(), `integritas-pi-test-${crypto.randomUUID()}.db`);
  process.env.DATABASE_PATH = dbFile;

  const { db, runMigrations } = await import("../../src/db/database.js");
  runMigrations();

  return {
    db,
    teardown() {
      db.close();
      for (const suffix of ["", "-wal", "-shm"]) rmWithRetry(`${dbFile}${suffix}`);
    }
  };
}

function rmWithRetry(filePath: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fs.rmSync(filePath, { force: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EBUSY" && code !== "EPERM") throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  try {
    fs.rmSync(filePath, { force: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EBUSY" && code !== "EPERM") throw error;
  }
}
