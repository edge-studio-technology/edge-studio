---
name: adr
description: Use when a change involves non-obvious "why" worth preserving — rejected alternatives, empirically-verified behavior, timing constants, tradeoffs — instead of writing that reasoning into a changelog entry, commit message, or code comment. Also use when the user asks to "write an ADR" or "record this decision".
---

# ADR

`docs/adr/*.md` is where this repo keeps decision rationale. Changelog entries, commit messages, and code comments state what changed; they point here for why, they don't carry the reasoning inline.

Each ADR is the **current** record for one topic. A reader should get the decision in force from one file, not by assembling a chain of amendments.

## Amend or create?

First look for an existing ADR on the same topic (`docs/README.md` → Architecture decisions, or `git grep` the subsystem).

- **Amend in place** when the change refines, extends, reverses, or re-tunes part of an existing decision (a new constant, an extra case, a changed default, a replaced mechanism within the same design). Edit the Decision/Consequences so they describe what is true now, move the replaced choice into `## Alternatives considered` with why it was dropped, and add one line to `## History`.
- **Create a new ADR** only for a decision on a topic no existing ADR covers. If a new decision fully replaces an old one on a different footing, update the old one in place instead unless the topic itself changed.

Never create an ADR whose only content is "amends ADR NNNN".

## Format

Keep it concise: state the decision and the reasons, not the implementation narrative. No file inventories — code comments point at the ADR, not the other way round.

- `# <NNNN>: <Title>`
- `**Status:** Accepted` (or `Proposed`)
- `**Date:** <YYYY-MM-DD>` — original decision date.
- `## Context` — the problem, and anything verified empirically rather than documented upstream.
- `## Decision` — what is in force now and why, naming the key functions/files only where needed to identify the mechanism.
- `## Alternatives considered` — rejected options, including earlier versions of this decision, and why.
- `## Consequences` — resulting tradeoffs or limitations.
- `## History` — optional; one dated line per amendment (`- 2026-10-15: Budget raised from 10 to 1,000 runs/hour.`).

## Process

1. Decide amend vs create (above).
2. **Amend:** edit the existing file; keep its number and filename unless the title no longer fits (then rename and update every reference). Update its row in `docs/README.md` if the summary changed.
3. **Create:** write `docs/adr/<NNNN>-<kebab-case-slug>.md`, numbered one past the highest number ever used on the current branch and `origin/dev` (run `git fetch` first; include retired numbers listed in `docs/README.md`). Add a row to the table in `docs/README.md` under `## Architecture decisions`.
4. Retired numbers are never reused. If ADRs are merged, the absorbed number goes in the `Retired` table in `docs/README.md` pointing at the surviving ADR.
5. Report the file path written or amended, nothing else.
