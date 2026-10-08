import { describe, it, beforeEach, afterEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

type ChangelogModule = typeof import("../../src/status/changelog-cache.js");

const CHANGELOG_V2 = "# Changelog\n\n## [Unreleased] task/x\n\n## [0.2.0] 2026-10-06\n\n- Two\n\n## [0.1.0] 2026-10-01\n\n- One\n";
const CHANGELOG_V1 = "# Changelog\n\n## [0.1.0] 2026-10-01\n\n- One\n";

function textResponse(body: string, status = 200) {
  return new Response(body, { status });
}

describe("changelog-cache", () => {
  let stateDir: string;
  let originalStateDir: string | undefined;
  let mod: ChangelogModule;
  const fetchMock = vi.fn();

  async function loadModule() {
    vi.resetModules();
    mod = await import("../../src/status/changelog-cache.js");
  }

  beforeEach(async () => {
    stateDir = await mkdtemp(path.join(os.tmpdir(), "changelog-cache-test-"));
    originalStateDir = process.env.STATE_DIR_IN_CONTAINER;
    process.env.STATE_DIR_IN_CONTAINER = stateDir;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadModule();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalStateDir === undefined) delete process.env.STATE_DIR_IN_CONTAINER;
    else process.env.STATE_DIR_IN_CONTAINER = originalStateDir;
    await rm(stateDir, { recursive: true, force: true });
  });

  it("returns null before any sync and with no state file", async () => {
    assert.equal(await mod.getCachedChangelog(), null);
  });

  it("fetches main's changelog and caches it for a new manifest version", async () => {
    fetchMock.mockResolvedValue(textResponse(CHANGELOG_V2));

    await mod.syncChangelog("v0.2.0");

    assert.equal(fetchMock.mock.calls[0][0], "https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/CHANGELOG.md");
    const cached = await mod.getCachedChangelog();
    assert.equal(cached?.markdown, CHANGELOG_V2);
    assert.equal(cached?.manifestVersion, "v0.2.0");
    assert.ok(!Number.isNaN(Date.parse(cached!.fetchedAt)));
  });

  it("persists the cache to the state dir", async () => {
    fetchMock.mockResolvedValue(textResponse(CHANGELOG_V2));

    await mod.syncChangelog("v0.2.0");

    const persisted = JSON.parse(await readFile(path.join(stateDir, "changelog-cache.json"), "utf8"));
    assert.equal(persisted.markdown, CHANGELOG_V2);
    assert.equal(persisted.manifestVersion, "v0.2.0");
  });

  it("skips the fetch when the manifest version is unchanged", async () => {
    fetchMock.mockResolvedValue(textResponse(CHANGELOG_V2));

    await mod.syncChangelog("v0.2.0");
    await mod.syncChangelog("v0.2.0");

    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("refetches when the manifest version changes", async () => {
    fetchMock.mockResolvedValueOnce(textResponse(CHANGELOG_V1)).mockResolvedValueOnce(textResponse(CHANGELOG_V2));

    await mod.syncChangelog("v0.1.0");
    await mod.syncChangelog("v0.2.0");

    assert.equal(fetchMock.mock.calls.length, 2);
    assert.equal((await mod.getCachedChangelog())?.markdown, CHANGELOG_V2);
  });

  it("accepts a manifest version without a leading v", async () => {
    fetchMock.mockResolvedValue(textResponse(CHANGELOG_V2));

    await mod.syncChangelog("0.2.0");

    assert.equal((await mod.getCachedChangelog())?.manifestVersion, "0.2.0");
  });

  it("rejects a copy without the manifest version's heading and retries on the next sync", async () => {
    fetchMock.mockResolvedValueOnce(textResponse(CHANGELOG_V1)).mockResolvedValueOnce(textResponse(CHANGELOG_V1));

    await mod.syncChangelog("v0.1.0");
    await mod.syncChangelog("v0.2.0");

    const cached = await mod.getCachedChangelog();
    assert.equal(cached?.manifestVersion, "v0.1.0");

    fetchMock.mockResolvedValueOnce(textResponse(CHANGELOG_V2));
    await mod.syncChangelog("v0.2.0");

    assert.equal(fetchMock.mock.calls.length, 3);
    assert.equal((await mod.getCachedChangelog())?.manifestVersion, "v0.2.0");
  });

  it("does not treat the version as a regex", async () => {
    fetchMock.mockResolvedValue(textResponse("## [0x2y0] 2026-10-06\n"));

    await mod.syncChangelog("v0.2.0");

    assert.equal(await mod.getCachedChangelog(), null);
  });

  it("keeps the old copy and retries when the fetch fails", async () => {
    fetchMock.mockResolvedValueOnce(textResponse(CHANGELOG_V1)).mockRejectedValueOnce(new Error("offline"));

    await mod.syncChangelog("v0.1.0");
    await mod.syncChangelog("v0.2.0");

    assert.equal((await mod.getCachedChangelog())?.markdown, CHANGELOG_V1);

    fetchMock.mockResolvedValueOnce(textResponse(CHANGELOG_V2));
    await mod.syncChangelog("v0.2.0");

    assert.equal((await mod.getCachedChangelog())?.markdown, CHANGELOG_V2);
  });

  it("keeps the old copy on a non-OK response", async () => {
    fetchMock.mockResolvedValueOnce(textResponse(CHANGELOG_V1)).mockResolvedValueOnce(textResponse("nope", 404));

    await mod.syncChangelog("v0.1.0");
    await mod.syncChangelog("v0.2.0");

    assert.equal((await mod.getCachedChangelog())?.manifestVersion, "v0.1.0");
  });

  it("keeps the old copy when the changelog exceeds the size cap", async () => {
    const oversized = `## [0.2.0] 2026-10-06\n${"x".repeat(2 * 1024 * 1024)}`;
    fetchMock.mockResolvedValueOnce(textResponse(CHANGELOG_V1)).mockResolvedValueOnce(textResponse(oversized));

    await mod.syncChangelog("v0.1.0");
    await mod.syncChangelog("v0.2.0");

    const cached = await mod.getCachedChangelog();
    assert.equal(cached?.manifestVersion, "v0.1.0");
    assert.equal(cached?.markdown, CHANGELOG_V1);
  });

  it("accepts a changelog exactly at the size cap", async () => {
    const heading = "## [0.2.0] 2026-10-06\n";
    const atCap = heading + "x".repeat(2 * 1024 * 1024 - heading.length);
    fetchMock.mockResolvedValue(textResponse(atCap));

    await mod.syncChangelog("v0.2.0");

    assert.equal((await mod.getCachedChangelog())?.markdown.length, 2 * 1024 * 1024);
  });

  it("loads the persisted cache after a restart", async () => {
    fetchMock.mockResolvedValue(textResponse(CHANGELOG_V2));
    await mod.syncChangelog("v0.2.0");

    await loadModule();
    fetchMock.mockClear();

    assert.equal((await mod.getCachedChangelog())?.markdown, CHANGELOG_V2);
    await mod.syncChangelog("v0.2.0");
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("treats a corrupt state file as no cache", async () => {
    await writeFile(path.join(stateDir, "changelog-cache.json"), "not json");

    assert.equal(await mod.getCachedChangelog(), null);
  });

  it("treats a state file with missing fields as no cache", async () => {
    await mkdir(stateDir, { recursive: true });
    await writeFile(path.join(stateDir, "changelog-cache.json"), JSON.stringify({ markdown: "x" }));

    assert.equal(await mod.getCachedChangelog(), null);
  });
});
