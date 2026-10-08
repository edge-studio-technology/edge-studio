export type ChangelogCategory = { name: string; items: string[] };
export type ChangelogEntry = { version: string; categories: ChangelogCategory[] };

/**
 * Parses the leading `limit` released `## [version]` sections of a Keep-a-Changelog-formatted
 * file, or all of them when `limit` is omitted. `## [Unreleased] ...` sections are skipped and
 * don't count toward `limit`.
 */
export function parseChangelog(markdown: string, limit = Infinity): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;
  let currentCategory: ChangelogCategory | null = null;

  for (const line of markdown.split("\n")) {
    const versionMatch = /^##\s+(.+)$/.exec(line);
    if (versionMatch) {
      if (/^\[unreleased\]/i.test(versionMatch[1].trim())) {
        current = null;
        currentCategory = null;
        continue;
      }
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
