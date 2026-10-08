import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

const CHANGELOG_URL = "https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/CHANGELOG.md";
const CACHE_FILE = "changelog-cache.json";
const FETCH_TIMEOUT_MS = 10000;

export type ChangelogCache = {
  markdown: string;
  manifestVersion: string;
  fetchedAt: string;
};

// Single-process in-memory cache — valid because update-agent always runs as exactly one container.
let cache: ChangelogCache | null = null;
let loaded = false;

function cachePath(): string {
  return path.join(env.stateDirInContainer, CACHE_FILE);
}

async function loadCache(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const parsed = JSON.parse(await readFile(cachePath(), "utf8")) as Partial<ChangelogCache>;
    if (typeof parsed.markdown === "string" && typeof parsed.manifestVersion === "string" && typeof parsed.fetchedAt === "string") {
      cache = { markdown: parsed.markdown, manifestVersion: parsed.manifestVersion, fetchedAt: parsed.fetchedAt };
    }
  } catch {
    cache = null;
  }
}

export async function fetchChangelog(): Promise<string> {
  const response = await fetch(CHANGELOG_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Changelog fetch failed with status ${response.status}`);
  return response.text();
}

function hasVersionHeading(markdown: string, manifestVersion: string): boolean {
  const version = manifestVersion.replace(/^v/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^## \\[${version}\\]`, "m").test(markdown);
}

/**
 * Refetches the changelog when the manifest version differs from the cached
 * one. A failed fetch, or a copy without the manifest version's heading,
 * keeps the old copy so the next manifest check retries.
 */
export async function syncChangelog(manifestVersion: string): Promise<void> {
  await loadCache();
  if (cache?.manifestVersion === manifestVersion) return;

  try {
    const markdown = await fetchChangelog();
    if (!hasVersionHeading(markdown, manifestVersion)) {
      console.warn(`[update-agent] changelog has no entry for ${manifestVersion} yet, keeping cached copy`);
      return;
    }
    cache = { markdown, manifestVersion, fetchedAt: new Date().toISOString() };
    await mkdir(env.stateDirInContainer, { recursive: true });
    await writeFile(cachePath(), JSON.stringify(cache));
  } catch (error) {
    console.error("[update-agent] changelog sync failed:", error);
  }
}

export async function getCachedChangelog(): Promise<ChangelogCache | null> {
  await loadCache();
  return cache;
}
