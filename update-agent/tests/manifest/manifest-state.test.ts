import { describe, it, beforeEach, afterEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("manifest-state", () => {
  let stateDir: string;
  let originalStateDir: string | undefined;
  let getLastAppliedManifestTimestamp: typeof import("../../src/manifest/manifest-state.js").getLastAppliedManifestTimestamp;
  let getLastAppliedVersion: typeof import("../../src/manifest/manifest-state.js").getLastAppliedVersion;
  let recordAppliedManifest: typeof import("../../src/manifest/manifest-state.js").recordAppliedManifest;

  beforeEach(async () => {
    stateDir = await mkdtemp(path.join(os.tmpdir(), "manifest-state-test-"));
    originalStateDir = process.env.STATE_DIR_IN_CONTAINER;
    process.env.STATE_DIR_IN_CONTAINER = stateDir;

    vi.resetModules();
    const mod = await import("../../src/manifest/manifest-state.js");
    getLastAppliedManifestTimestamp = mod.getLastAppliedManifestTimestamp;
    getLastAppliedVersion = mod.getLastAppliedVersion;
    recordAppliedManifest = mod.recordAppliedManifest;
  });

  afterEach(async () => {
    if (originalStateDir === undefined) delete process.env.STATE_DIR_IN_CONTAINER;
    else process.env.STATE_DIR_IN_CONTAINER = originalStateDir;
    await rm(stateDir, { recursive: true, force: true });
  });

  describe("getLastAppliedManifestTimestamp", () => {
    it("returns null when no state file exists", async () => {
      assert.equal(await getLastAppliedManifestTimestamp(), null);
    });

    it("returns the parsed epoch ms of createdAt after a recorded apply", async () => {
      await recordAppliedManifest("2026-08-01T00:00:00.000Z", "1.2.3");

      assert.equal(await getLastAppliedManifestTimestamp(), Date.parse("2026-08-01T00:00:00.000Z"));
    });

    it("returns null when the state file has no createdAt field", async () => {
      await recordAppliedManifest("", "1.2.3");

      assert.equal(await getLastAppliedManifestTimestamp(), null);
    });

    it("returns null when createdAt is not a parseable date", async () => {
      await recordAppliedManifest("not-a-date", "1.2.3");

      assert.equal(await getLastAppliedManifestTimestamp(), null);
    });

    it("returns null when the state file contains invalid JSON", async () => {
      const { writeFile, mkdir } = await import("node:fs/promises");
      await mkdir(stateDir, { recursive: true });
      await writeFile(path.join(stateDir, "last-applied-manifest.json"), "not json");

      assert.equal(await getLastAppliedManifestTimestamp(), null);
    });
  });

  describe("getLastAppliedVersion", () => {
    it("returns null when no state file exists", async () => {
      assert.equal(await getLastAppliedVersion(), null);
    });

    it("returns the recorded version", async () => {
      await recordAppliedManifest("2026-08-01T00:00:00.000Z", "1.2.3");

      assert.equal(await getLastAppliedVersion(), "1.2.3");
    });

    it("returns null when the state file has no version field", async () => {
      const { writeFile, mkdir } = await import("node:fs/promises");
      await mkdir(stateDir, { recursive: true });
      await writeFile(
        path.join(stateDir, "last-applied-manifest.json"),
        JSON.stringify({ createdAt: "2026-08-01T00:00:00.000Z" })
      );

      assert.equal(await getLastAppliedVersion(), null);
    });

    it("returns null when the state file contains invalid JSON", async () => {
      const { writeFile, mkdir } = await import("node:fs/promises");
      await mkdir(stateDir, { recursive: true });
      await writeFile(path.join(stateDir, "last-applied-manifest.json"), "not json");

      assert.equal(await getLastAppliedVersion(), null);
    });
  });

  describe("recordAppliedManifest", () => {
    it("creates the state directory if it does not exist yet", async () => {
      const nestedDir = path.join(stateDir, "nested");
      process.env.STATE_DIR_IN_CONTAINER = nestedDir;
      vi.resetModules();
      const mod = await import("../../src/manifest/manifest-state.js");

      await mod.recordAppliedManifest("2026-08-01T00:00:00.000Z", "1.2.3");

      assert.equal(await mod.getLastAppliedVersion(), "1.2.3");
    });

    it("writes createdAt and version as formatted JSON", async () => {
      await recordAppliedManifest("2026-08-01T00:00:00.000Z", "1.2.3");

      const raw = await readFile(path.join(stateDir, "last-applied-manifest.json"), "utf8");
      assert.deepEqual(JSON.parse(raw), { createdAt: "2026-08-01T00:00:00.000Z", version: "1.2.3" });
    });

    it("overwrites a previously recorded manifest", async () => {
      await recordAppliedManifest("2026-08-01T00:00:00.000Z", "1.2.3");

      await recordAppliedManifest("2026-08-02T00:00:00.000Z", "1.3.0");

      assert.equal(await getLastAppliedVersion(), "1.3.0");
      assert.equal(await getLastAppliedManifestTimestamp(), Date.parse("2026-08-02T00:00:00.000Z"));
    });
  });
});
