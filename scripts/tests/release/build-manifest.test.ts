import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/release/build-manifest.mjs");

const baseEnv = {
  VERSION: "1.2.3",
  FRONTEND_DIGEST: "sha256:frontend",
  BACKEND_DIGEST: "sha256:backend",
  UPDATE_AGENT_DIGEST: "sha256:update-agent"
};

function runScript(argv: string[], env: Record<string, string | undefined>) {
  return spawnSync(process.execPath, [scriptPath, ...argv], {
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
}

describe("build-manifest.mjs", () => {
  let dir: string;
  let outPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "build-manifest-"));
    outPath = join(dir, "manifest.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("exits non-zero when VERSION is missing", () => {
    const result = runScript([outPath], { ...baseEnv, VERSION: undefined });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /VERSION env var is required/);
  });

  it("exits non-zero when the frontend digest is missing", () => {
    const result = runScript([outPath], { ...baseEnv, FRONTEND_DIGEST: undefined });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /manifest missing digest for "frontend"/);
  });

  it("exits non-zero when the backend digest is missing", () => {
    const result = runScript([outPath], { ...baseEnv, BACKEND_DIGEST: undefined });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /manifest missing digest for "backend"/);
  });

  it("exits non-zero when the update-agent digest is missing", () => {
    const result = runScript([outPath], { ...baseEnv, UPDATE_AGENT_DIGEST: undefined });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /manifest missing digest for "updateAgent"/);
  });

  it("writes a manifest with the expected shape and fields", () => {
    const result = runScript([outPath], baseEnv);

    assert.equal(result.status, 0);
    const manifest = JSON.parse(readFileSync(outPath, "utf8"));
    assert.equal(manifest.frontend, "sha256:frontend");
    assert.equal(manifest.backend, "sha256:backend");
    assert.equal(manifest.updateAgent, "sha256:update-agent");
    assert.equal(manifest.version, "1.2.3");
    assert.equal(typeof manifest.createdAt, "string");
    assert.equal(Number.isNaN(Date.parse(manifest.createdAt)), false);
    assert.deepEqual(Object.keys(manifest).sort(), ["backend", "createdAt", "frontend", "updateAgent", "version"]);
  });

  it("defaults to manifest.json in the cwd when no output path is given", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      cwd: dir,
      env: { ...process.env, ...baseEnv }
    });

    assert.equal(result.status, 0);
    assert.doesNotThrow(() => readFileSync(join(dir, "manifest.json")));
  });
});
