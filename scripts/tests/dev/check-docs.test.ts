import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/dev/check-docs.mjs");

const rule = "# X\n\nSee `backend/src/app.ts`.\n";
const docsIndex = (extra = "") =>
  [
    "# Docs",
    "",
    "| Plan | Status |",
    "| [plans/p.md](./plans/p.md) | open |",
    "",
    "| ADR | Decision |",
    "| [0001](./adr/0001-first.md) | First |",
    "",
    "### Retired ADRs",
    "",
    "| Retired | Now in |",
    "| 0002 Old | [0001](./adr/0001-first.md) |",
    "",
    "## Guides",
    extra
  ].join("\n");

const baseline: Record<string, string> = {
  "backend/src/app.ts": "export {};\n",
  "CLAUDE.md": "# CLAUDE.md\n\n> **Sync notice:** claude\n\n[x](.claude/rules/x.md)\n",
  "AGENTS.md": "# AGENTS.md\n\n> **Sync notice:** agents\n\n[x](.agents/rules/x.md)\n",
  ".claude/rules/x.md": rule,
  ".agents/rules/x.md": rule,
  ".cursor/rules/x.mdc": `---\ndescription: x\n---\n\n${rule}`,
  ".claude/skills/s/SKILL.md": "skill\n",
  ".agents/skills/s/SKILL.md": "skill\n",
  ".cursor/skills/s/SKILL.md": "skill\n",
  "docs/README.md": docsIndex(),
  "docs/adr/0001-first.md": "# 0001: First\n\nReplaced `backend/src/gone.ts`.\n",
  "docs/plans/p.md": "# Plan\n\nTouches [app](../../backend/src/app.ts) and `app.ts`.\n"
};

describe("check-docs.mjs", () => {
  let dir: string;

  const write = (files: Record<string, string>) => {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(dir, dirname(path)), { recursive: true });
      writeFileSync(join(dir, path), content);
    }
  };
  const run = () => spawnSync(process.execPath, [scriptPath, dir], { encoding: "utf8" });
  const expectProblem = (pattern: RegExp) => {
    const result = run();
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, pattern);
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "check-docs-"));
    spawnSync("git", ["init", "-q"], { cwd: dir });
    write(baseline);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("passes a consistent tree, including removed paths named in ADRs", () => {
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /check-docs: ok/);
  });

  it("fails on a broken relative link", () => {
    write({ "docs/plans/p.md": "[gone](../../backend/src/gone.ts)\n" });
    expectProblem(/docs\/plans\/p\.md:1: broken link \.\.\/\.\.\/backend\/src\/gone\.ts/);
  });

  it("fails on a backticked repo path or file name that does not exist", () => {
    write({ "docs/plans/p.md": "`backend/src/gone.ts:12` and `gone.service.ts`\n" });
    expectProblem(/missing path backend\/src\/gone\.ts/);
    expectProblem(/no file named gone\.service\.ts/);
  });

  it("ignores paths inside code fences and placeholders", () => {
    write({ "docs/plans/p.md": "```\n`backend/src/gone.ts`\n```\n`docs/plans/<ticket>-<slug>.md`\n" });
    assert.equal(run().status, 0);
  });

  it("fails when a rule mirror differs, including the Cursor body", () => {
    write({ ".cursor/rules/x.mdc": "---\ndescription: x\n---\n\n# X changed\n" });
    expectProblem(/\.cursor\/rules\/x\.mdc: differs from \.claude\/rules\/x\.md/);
  });

  it("fails when a skill file has no counterpart", () => {
    write({ ".claude/skills/s/extra.md": "extra\n" });
    expectProblem(/\.claude\/skills\/s\/extra\.md: no \.agents counterpart/);
  });

  it("fails when AGENTS.md drifts from CLAUDE.md beyond the sync notice", () => {
    write({ "AGENTS.md": "# AGENTS.md\n\n> **Sync notice:** agents\n\n[x](.agents/rules/x.md)\nExtra.\n" });
    expectProblem(/AGENTS\.md: differs from CLAUDE\.md/);
  });

  it("fails when a rules index does not list a rule file", () => {
    write({ "CLAUDE.md": "# CLAUDE.md\n\n> **Sync notice:** claude\n", "AGENTS.md": "# AGENTS.md\n\n> **Sync notice:** agents\n" });
    expectProblem(/CLAUDE\.md: rules table is missing \.claude\/rules\/x\.md/);
  });

  it("fails on an unindexed ADR, a duplicate number, and a reused retired number", () => {
    write({
      "docs/adr/0001-second.md": "# 0001: Second\n",
      "docs/adr/0002-old.md": "# 0002: Old\n"
    });
    expectProblem(/ADR table is missing docs\/adr\/0001-second\.md/);
    expectProblem(/ADR number 0001 also used by/);
    expectProblem(/docs\/adr\/0002-old\.md: ADR number 0002 is retired/);
  });

  it("fails on an ADR heading that does not match its number", () => {
    write({ "docs/adr/0001-first.md": "# ADR 1: First\n" });
    expectProblem(/0001-first\.md:1: heading must start with "# 0001: "/);
  });

  it("fails on a plan missing from the docs index", () => {
    write({ "docs/plans/q.md": "# Plan\n" });
    expectProblem(/plans table is missing docs\/plans\/q\.md/);
  });

  it("fails on a top-level docs entry outside the documented layout", () => {
    write({ "docs/notes/n.md": "# Note\n" });
    expectProblem(/docs\/notes: not part of the docs\/README\.md layout/);
  });
});
