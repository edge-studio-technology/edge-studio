import { describe, it, beforeEach, afterEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const images = { frontend: "repo/frontend@sha256:f", backend: "repo/backend@sha256:b" };

async function writeStateFile(dir: string, contents: string) {
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "last-applied-manifest.json"), contents);
}

describe("manifest-state", () => {
  let stateDir: string;
  let originalStateDir: string | undefined;
  let getLastAppliedManifestTimestamp: typeof import("../../src/manifest/manifest-state.js").getLastAppliedManifestTimestamp;
  let getLastAppliedManifest: typeof import("../../src/manifest/manifest-state.js").getLastAppliedManifest;
  let recordAppliedManifest: typeof import("../../src/manifest/manifest-state.js").recordAppliedManifest;

  beforeEach(async () => {
    stateDir = await mkdtemp(path.join(os.tmpdir(), "manifest-state-test-"));
    originalStateDir = process.env.STATE_DIR_IN_CONTAINER;
    process.env.STATE_DIR_IN_CONTAINER = stateDir;

    vi.resetModules();
    const mod = await import("../../src/manifest/manifest-state.js");
    getLastAppliedManifestTimestamp = mod.getLastAppliedManifestTimestamp;
    getLastAppliedManifest = mod.getLastAppliedManifest;
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
      await recordAppliedManifest("2026-08-01T00:00:00.000Z", "1.2.3", images);

      assert.equal(await getLastAppliedManifestTimestamp(), Date.parse("2026-08-01T00:00:00.000Z"));
    });

    it("returns null when the state file has no createdAt field", async () => {
      await recordAppliedManifest("", "1.2.3", images);

      assert.equal(await getLastAppliedManifestTimestamp(), null);
    });

    it("returns null when createdAt is not a parseable date", async () => {
      await recordAppliedManifest("not-a-date", "1.2.3", images);

      assert.equal(await getLastAppliedManifestTimestamp(), null);
    });

    it("returns null when the state file contains invalid JSON", async () => {
      await writeStateFile(stateDir, "not json");

      assert.equal(await getLastAppliedManifestTimestamp(), null);
    });
  });

  describe("getLastAppliedManifest", () => {
    it("returns null when no state file exists", async () => {
      assert.equal(await getLastAppliedManifest(), null);
    });

    it("returns the recorded createdAt, version, and images", async () => {
      await recordAppliedManifest("2026-08-01T00:00:00.000Z", "1.2.3", images);

      assert.deepEqual(await getLastAppliedManifest(), { createdAt: "2026-08-01T00:00:00.000Z", version: "1.2.3", images });
    });

    it("reads a legacy file without images as images: null", async () => {
      await writeStateFile(stateDir, JSON.stringify({ createdAt: "2026-08-01T00:00:00.000Z", version: "1.2.3" }));

      assert.deepEqual(await getLastAppliedManifest(), { createdAt: "2026-08-01T00:00:00.000Z", version: "1.2.3", images: null });
    });

    it("treats incomplete images as images: null", async () => {
      await writeStateFile(stateDir, JSON.stringify({ createdAt: "2026-08-01T00:00:00.000Z", version: "1.2.3", images: { frontend: "repo/frontend@sha256:f" } }));

      assert.equal((await getLastAppliedManifest())?.images, null);
    });

    it("returns null fields when the state file has no createdAt or version", async () => {
      await writeStateFile(stateDir, JSON.stringify({}));

      assert.deepEqual(await getLastAppliedManifest(), { createdAt: null, version: null, images: null });
    });

    it("returns null when the state file contains invalid JSON", async () => {
      await writeStateFile(stateDir, "not json");

      assert.equal(await getLastAppliedManifest(), null);
    });
  });

  describe("recordAppliedManifest", () => {
    it("creates the state directory if it does not exist yet", async () => {
      const nestedDir = path.join(stateDir, "nested");
      process.env.STATE_DIR_IN_CONTAINER = nestedDir;
      vi.resetModules();
      const mod = await import("../../src/manifest/manifest-state.js");

      await mod.recordAppliedManifest("2026-08-01T00:00:00.000Z", "1.2.3", images);

      assert.equal((await mod.getLastAppliedManifest())?.version, "1.2.3");
    });

    it("writes createdAt, version, and images as formatted JSON", async () => {
      await recordAppliedManifest("2026-08-01T00:00:00.000Z", "1.2.3", images);

      const raw = await readFile(path.join(stateDir, "last-applied-manifest.json"), "utf8");
      assert.deepEqual(JSON.parse(raw), { createdAt: "2026-08-01T00:00:00.000Z", version: "1.2.3", images });
    });

    it("overwrites a previously recorded manifest", async () => {
      await recordAppliedManifest("2026-08-01T00:00:00.000Z", "1.2.3", images);

      await recordAppliedManifest("2026-08-02T00:00:00.000Z", "1.3.0", images);

      assert.equal((await getLastAppliedManifest())?.version, "1.3.0");
      assert.equal(await getLastAppliedManifestTimestamp(), Date.parse("2026-08-02T00:00:00.000Z"));
    });
  });
});
