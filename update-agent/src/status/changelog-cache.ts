import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

const CHANGELOG_URL = "https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/CHANGELOG.md";
const CACHE_FILE = "changelog-cache.json";
const FETCH_TIMEOUT_MS = 10000;
const MAX_CHANGELOG_BYTES = 2 * 1024 * 1024;
const MAX_CACHE_FILE_BYTES = MAX_CHANGELOG_BYTES * 6 + 64 * 1024;

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

async function readCacheFile(): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of createReadStream(cachePath())) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_CACHE_FILE_BYTES) throw new Error("Changelog cache file exceeds size limit");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, size).toString("utf8");
}

async function loadCache(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const parsed = JSON.parse(await readCacheFile()) as Partial<ChangelogCache>;
    if (
      typeof parsed.markdown === "string" &&
      Buffer.byteLength(parsed.markdown, "utf8") <= MAX_CHANGELOG_BYTES &&
      typeof parsed.manifestVersion === "string" &&
      typeof parsed.fetchedAt === "string"
    ) {
      cache = { markdown: parsed.markdown, manifestVersion: parsed.manifestVersion, fetchedAt: parsed.fetchedAt };
    }
  } catch {
    cache = null;
  }
}

export async function fetchChangelog(): Promise<string> {
  const response = await fetch(CHANGELOG_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Changelog fetch failed with status ${response.status}`);
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_CHANGELOG_BYTES) {
      await reader.cancel();
      throw new Error(`Changelog exceeds ${MAX_CHANGELOG_BYTES} bytes`);
    }
    chunks.push(value);
  }
  const markdown = Buffer.concat(chunks).toString("utf8");
  if (Buffer.byteLength(markdown, "utf8") > MAX_CHANGELOG_BYTES) {
    throw new Error(`Decoded changelog exceeds ${MAX_CHANGELOG_BYTES} bytes`);
  }
  return markdown;
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
