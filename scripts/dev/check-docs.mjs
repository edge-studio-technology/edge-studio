// Fails when docs, rules, and skills drift from the repo: dead links and paths, mirror copies
// that differ, the docs/README.md index out of step with docs/adr and docs/plans.
// Usage: node scripts/dev/check-docs.mjs [repo-root]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, posix } from "node:path";

const root = process.argv[2] ?? process.cwd();

// Point-in-time or verbatim records: links are checked, but they may name files that no longer exist.
const HISTORICAL = [/^CHANGELOG\.md$/, /^docs\/SESSION\.md$/, /^docs\/adr\//, /^docs\/reports\//, /^docs\/security\/external-review-/];
// Mirrored third-party skill content, not ours to maintain.
const VENDORED = [/^\.(agents|claude|cursor)\/skills\/ui-ux-pro-max\//];
const MIRRORS = [".claude", ".agents", ".cursor"];
const DOCS_TOP_LEVEL = new Set([
  "PROJECT.md",
  "README.md",
  "SESSION.md",
  "TASKS.md",
  "frontend-design-system.md",
  "adr",
  "guides",
  "plans",
  "qa",
  "reports",
  "security"
]);
// Bare file names worth checking; runtime-generated .json/.yml names are left out.
const CODE_EXT = /^[\w-][\w.-]*\.(ts|tsx|mjs|js|sh|py|md|mdc|envsh|css)$/;
const PATH_ROOTS = /^(\.agents|\.claude|\.cursor|\.github|backend|frontend|update-agent|host-agent|camera-helper|sensor-helper|docs|scripts|bin|docker)\//;

const errors = [];
const fail = (file, line, message) => errors.push(`${file}${line ? `:${line}` : ""}: ${message}`);

const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter((f) => f && existsSync(join(root, f)));
const fileSet = new Set(files);
const dirSet = new Set(files.flatMap((f) => f.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))));
const basenames = new Set(files.map((f) => basename(f)));
const exists = (p) => fileSet.has(p) || dirSet.has(p.replace(/\/$/, ""));
const read = (f) => readFileSync(join(root, f), "utf8").replaceAll("\r\n", "\n");

const docs = files.filter((f) => /\.(md|mdc)$/.test(f) && !VENDORED.some((r) => r.test(f)));

// 1. Relative links and backticked repo paths resolve.
for (const file of docs) {
  const historical = HISTORICAL.some((r) => r.test(file));
  let fenced = false;
  read(file)
    .split("\n")
    .forEach((text, i) => {
      if (/^\s*```/.test(text)) fenced = !fenced;
      if (fenced) return;
      for (const [, target] of text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
        if (/^[a-z]+:/i.test(target)) continue;
        const resolved = posix.normalize(posix.join(posix.dirname(file), decodeURI(target)));
        // Agent instruction files link repo-root paths such as `.cursor/rules/x.mdc`.
        if (!exists(resolved) && !(PATH_ROOTS.test(target) && exists(target))) fail(file, i + 1, `broken link ${target}`);
      }
      if (historical) return;
      // Backticked link text is covered by the link check.
      for (const [, token] of text.replace(/\[`[^`]*`\]\(/g, "](").matchAll(/`([^`\s]+)`/g)) {
        const ref = token.replace(/:\d+(-\d+)?$/, "").replace(/[.,:;)]+$/, "").replace(/#.*$/, "");
        if (/[*<>{}$[\]|]/.test(ref) || ref.includes("://")) continue;
        if (PATH_ROOTS.test(ref)) {
          if (!exists(ref)) fail(file, i + 1, `missing path ${ref}`);
        } else if (CODE_EXT.test(ref)) {
          // Imports name the compiled .js; the source is .ts.
          if (!basenames.has(ref) && !basenames.has(ref.replace(/\.js$/, ".ts"))) fail(file, i + 1, `no file named ${ref}`);
        }
      }
    });
}

// 2. Mirrors: rules and skills identical across .claude, .agents, .cursor; AGENTS.md matches CLAUDE.md.
const stripFrontmatter = (text) => text.replace(/^---\n[\s\S]*?\n---\n\n?/, "");
const mirrorPaths = (dir) =>
  files.filter((f) => f.startsWith(`${dir}/rules/`) || f.startsWith(`${dir}/skills/`)).map((f) => f.slice(dir.length + 1));
const [base, ...others] = MIRRORS;
const baseSet = new Set(mirrorPaths(base));
for (const dir of others) {
  const toBase = (p) => (dir === ".cursor" ? p.replace(/^rules\/(.+)\.mdc$/, "rules/$1.md") : p);
  const seen = new Set();
  for (const p of mirrorPaths(dir)) {
    if (p === "rules/index.mdc") continue;
    const twin = toBase(p);
    seen.add(twin);
    if (!baseSet.has(twin)) {
      fail(`${dir}/${p}`, 0, `no ${base}/${twin} counterpart`);
      continue;
    }
    const body = p.endsWith(".mdc") ? stripFrontmatter(read(`${dir}/${p}`)) : read(`${dir}/${p}`);
    if (body !== read(`${base}/${twin}`)) fail(`${dir}/${p}`, 0, `differs from ${base}/${twin}`);
  }
  for (const p of baseSet) if (!seen.has(p)) fail(`${base}/${p}`, 0, `no ${dir} counterpart`);
}

if (fileSet.has("AGENTS.md") && fileSet.has("CLAUDE.md")) {
  const normalized = (f, dir) =>
    read(f)
      .split("\n")
      .filter((l, i) => i > 0 && !l.startsWith("> **Sync notice:**"))
      .join("\n")
      .replaceAll(`${dir}/rules/`, "<rules>/");
  if (normalized("AGENTS.md", ".agents") !== normalized("CLAUDE.md", ".claude")) fail("AGENTS.md", 0, "differs from CLAUDE.md");
}

const guidelines = (text) => text.slice(text.indexOf("## 1. Think Before Coding"), text.indexOf("**These guidelines are working if:**"));
if (fileSet.has(".cursor/rules/index.mdc") && fileSet.has("CLAUDE.md")) {
  if (guidelines(read(".cursor/rules/index.mdc")) !== guidelines(read("CLAUDE.md")))
    fail(".cursor/rules/index.mdc", 0, "behavioral guidelines differ from CLAUDE.md");
}

for (const [index, dir, ext] of [
  ["CLAUDE.md", ".claude", ".md"],
  ["AGENTS.md", ".agents", ".md"],
  [".cursor/rules/index.mdc", ".cursor", ".mdc"]
]) {
  if (!fileSet.has(index)) continue;
  const text = read(index);
  for (const f of files.filter((f) => f.startsWith(`${dir}/rules/`) && f.endsWith(ext) && f !== index)) {
    if (!text.includes(f)) fail(index, 0, `rules table is missing ${f}`);
  }
}

// 3. docs/README.md indexes every ADR and plan; ADR numbers are unique and retired ones stay retired.
const docsIndex = fileSet.has("docs/README.md") ? read("docs/README.md") : "";
const adrs = files.filter((f) => /^docs\/adr\/[^/]+\.md$/.test(f));
const numbers = new Map();
for (const f of adrs) {
  const match = /^(\d{4})-[a-z0-9-]+\.md$/.exec(basename(f));
  if (!match) {
    fail(f, 0, "ADR file name must be NNNN-slug.md");
    continue;
  }
  const [, number] = match;
  if (numbers.has(number)) fail(f, 0, `ADR number ${number} also used by ${numbers.get(number)}`);
  numbers.set(number, f);
  if (!read(f).startsWith(`# ${number}: `)) fail(f, 1, `heading must start with "# ${number}: "`);
  if (!docsIndex.includes(`(./adr/${basename(f)})`)) fail("docs/README.md", 0, `ADR table is missing ${f}`);
}
const retired = docsIndex.split(/^### Retired ADRs$/m)[1]?.split(/^## /m)[0] ?? "";
for (const [, number] of retired.matchAll(/^\| (\d{4}) /gm)) {
  if (numbers.has(number)) fail(numbers.get(number), 0, `ADR number ${number} is retired`);
}

for (const f of files.filter((f) => f.startsWith("docs/plans/"))) {
  if (!docsIndex.includes(`(./${f.slice("docs/".length)})`)) fail("docs/README.md", 0, `plans table is missing ${f}`);
}

// 4. docs/ keeps its documented layout.
for (const entry of new Set(files.filter((f) => f.startsWith("docs/")).map((f) => f.split("/")[1]))) {
  if (!DOCS_TOP_LEVEL.has(entry)) fail(`docs/${entry}`, 0, "not part of the docs/README.md layout");
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\ncheck-docs: ${errors.length} problem(s). See docs/README.md (Lifecycle) and the documenting-work rule.`);
  process.exit(1);
}
console.log("check-docs: ok");
