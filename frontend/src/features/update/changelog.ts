export type ChangelogCategory = { name: string; items: string[] };
export type ChangelogEntry = { version: string; categories: ChangelogCategory[] };

const CHANGELOG_URL =
  "https://raw.githubusercontent.com/integritas-technology/edge-studio/main/CHANGELOG.md";

/**
 * Fetches CHANGELOG.md directly from GitHub. See docs/adr/0004-update-page-changelog.md.
 * Plain `fetch`, not `lib/api.ts`'s `getJson` — must never send session credentials to this
 * third-party host.
 */
export async function fetchChangelog(): Promise<string> {
  const response = await fetch(CHANGELOG_URL);
  if (!response.ok) {
    throw new Error(`GitHub returned HTTP ${response.status}`);
  }
  return response.text();
}

/** Parses the leading `limit` `## [version]` sections of a Keep-a-Changelog-formatted file. */
export function parseChangelog(markdown: string, limit = 3): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;
  let currentCategory: ChangelogCategory | null = null;

  for (const line of markdown.split("\n")) {
    const versionMatch = /^##\s+(.+)$/.exec(line);
    if (versionMatch) {
      if (entries.length >= limit) break;
      current = { version: versionMatch[1].trim(), categories: [] };
      currentCategory = null;
      entries.push(current);
      continue;
    }
    if (!current) continue;

    const categoryMatch = /^###\s+(.+)$/.exec(line);
    if (categoryMatch) {
      currentCategory = { name: categoryMatch[1].trim(), items: [] };
      current.categories.push(currentCategory);
      continue;
    }

    const itemMatch = /^-\s+(.+)$/.exec(line);
    if (itemMatch && currentCategory) {
      currentCategory.items.push(itemMatch[1].trim());
    }
  }

  return entries;
}
