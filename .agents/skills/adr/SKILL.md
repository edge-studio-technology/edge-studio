---
name: adr
description: Use when a change involves non-obvious "why" worth preserving — rejected alternatives, empirically-verified behavior, timing constants, tradeoffs — instead of writing that reasoning into a changelog entry, commit message, or code comment. Also use when the user asks to "write an ADR" or "record this decision".
---

# ADR

`docs/adr/*.md` is where this repo keeps decision rationale. Changelog entries, commit messages, and code comments state what changed; they point here for why, they don't carry the reasoning inline.

## Process

1. Read an existing ADR (e.g. `docs/adr/0001-minima-graceful-node-restart.md`) to match this repo's exact format.
2. Write `docs/adr/<NNNN>-<kebab-case-slug>.md`, numbered one past the highest existing file, with:
   - `# <NNNN>: <Title>`
   - `**Status:** Accepted` (or `Proposed`/`Superseded`)
   - `**Date:** <YYYY-MM-DD>`
   - `## Context` — the problem, and anything verified empirically rather than documented upstream.
   - `## Decision` — what was chosen and why, in concrete terms tied to real files/functions.
   - `## Alternatives considered` — what was rejected and why.
   - `## Consequences` — resulting tradeoffs or limitations.
   - `## Where this lives in code` — files/functions that implement the decision.
3. Add the new file to the table in `docs/README.md` under `## Architecture decisions`.
4. Leave a short pointer comment in the affected code (one line, e.g. `// see docs/adr/0004-...md`) — not the reasoning itself.
5. Report the file path written, nothing else.
