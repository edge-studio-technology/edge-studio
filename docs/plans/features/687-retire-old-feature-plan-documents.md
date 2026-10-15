# Retire Old Feature Plan Documents Plan

**Status:** Implemented; awaiting review
**Created:** 2026-10-15
**Goal:** Remove finished plans and stale docs so `docs/` only describes the current codebase, and consolidate overlapping ADRs into one current record per topic.

## Progress

- [x] 1. ADR process: `adr` skill and rule amend an existing ADR in place for refinements; new ADR only for a new decision. Drop the `Where this lives in code` section.
- [x] 2. ADR consolidation (`8cbf4bcc`): fold 0006→0029, 0008→0009, 0004→0032, 0020→0016, 0018→0017, 0023/0026/0028→0022, 0011/0012→0036; trim 0010 to its verdict; tighten the rest; redirect references.
- [x] 3. New ADRs from plans: hardware access via host helpers and the host agent (absorbs 0019), Minima backup scheduler and stored password, feedback delivery, workflow watch-mode behaviour.
- [x] 4. Trim rationale out of the `minima` rule (×3 mirrors) into ADRs.
- [x] 5. Delete finished plans and `plans/archive/`; move open items to `docs/TASKS.md` or `docs/qa/gaps.md`; keep only the feedback receiver spec as an active plan; redirect links.
- [x] 6. Remove `docs/notes/`; move point-in-time QA evidence and reports to `docs/reports/`.
- [x] 7. Reconcile `docs/TASKS.md` (merged tickets to Done, trim Done) and rewrite `docs/README.md`. Old manual-check items left as-is pending a decision on collapsing them.
- [x] 8. Process docs: `plan-doc`/`openproject` skills and `documenting-work` rule delete a plan once its ticket merges; fix `.cursor` drift.
- [x] Docs
- [x] Verification

## Context

Every ticket plan in `docs/plans/` has merged to `dev`, and the older loose plans are shipped but still marked "In progress". Status lines disagree across `docs/README.md`, `docs/TASKS.md`, and the plans. Several ADRs only amend or supersede earlier ones, so the current decision has to be assembled from multiple files.

Decisions (user, 2026-10-15):

- Delete finished plans rather than archive; git history keeps them.
- Extract any rationale not already in an ADR before deleting.
- Merge overlapping ADRs into the surviving number; retired numbers stay as gaps and are listed in `docs/README.md` so old references resolve. No renumbering.
- Going forward, refine an existing ADR in place with a dated amendment instead of opening a new one.
- `MERGE-NOTES-686.md` stays.

## Changes

- `docs/adr/` — merges, trims, new records.
- `docs/plans/` — deletions; `feedback.md` reduced to the hosted receiver spec.
- `docs/notes/`, `docs/qa/`, `docs/reports/`, `docs/WORKFLOW_REPLAY_POSITIONING_REPORT.md` — moves/removals.
- `docs/README.md`, `docs/TASKS.md`, `docs/qa/gaps.md`, `docs/security/*.md`, `SECURITY.md`, `README.md` — link and status fixes.
- `.agents`/`.claude`/`.cursor` rules and skills — ADR, plan-doc, openproject, documenting-work, minima, automation, docker, and any rule citing a retired ADR.
- Code comments citing retired ADRs or deleted docs.

## Docs

No `CHANGELOG.md` entry: internal developer docs only, no operator-facing change.

## Verification

- No relative Markdown link under the repo points at a missing file.
- `git grep` finds no reference to a retired ADR number or deleted doc path outside `docs/README.md`'s retired table and `CHANGELOG.md`.
- `diff` confirms `.agents`/`.claude` mirrors identical and `.cursor` bodies match.
- `npm run lint` (code comments touched).
