---
name: plan-doc
description: This skill should be used right after a plan-mode plan is approved for a non-trivial feature, or when the user asks to "save the plan", "write this up as a plan doc", "put the plan in the plans folder" — persist the plan into docs/plans/ and reference it from docs/TASKS.md before any implementation code is written. Also use when a ticket's work is finished and its plan doc needs retiring.
---

# Plan Doc

`docs/plans/` holds plans for work that is **active or upcoming** — nothing else. Plan mode's own plan file (`~/.claude/plans/*.md`) is ephemeral scratch outside the repo; the plan only becomes part of the project's record once it's written into `docs/plans/`. Do this immediately after a plan is approved, before making any code changes — approval of the plan's content is not the same as permission to start implementing it right now, and the user may want it saved for later.

A plan is a working document, not a permanent record. Once its work merges, it is deleted (see Retiring). Lasting rationale goes in an ADR, open follow-ups go in `docs/TASKS.md` or `docs/qa/gaps.md`, and git history keeps the plan itself.

## Process

1. Pick the path: `docs/plans/features/<ticket>-<slug>.md` or `docs/plans/bugs/<ticket>-<slug>.md` for OpenProject tickets, `docs/plans/<kebab-case-slug>.md` otherwise.
2. Write it with:
   - `# <Title> Plan`
   - `**Status:** Not started` (or the real status if resuming/updating an in-progress plan)
   - `**Created:** <YYYY-MM-DD>`
   - `**Goal:** <one sentence>`
   - `## Progress` — a `- [ ]` checklist with one item per implementation step in the sections below, plus `Docs` and `Verification`. This is where progress is tracked, not only the `Status` line.
   - `## Context` — why this is being built, what was discussed/decided, and any rejected alternatives worth remembering.
   - Section(s) describing the concrete changes (e.g. `## Backend changes`, `## Frontend changes`) — name real files/functions to reuse, not just describe behavior in the abstract.
   - `## Docs` — which docs need updating once built, per `.claude/rules/documenting-work.md`.
   - `## Verification` — how to confirm it works, per `.claude/rules/verification.md`.
3. Add one line under `## Next` (or `## In Progress` if the user says work is already underway) in `docs/TASKS.md`, matching the existing style: `- [ ] <short description> — see \`docs/plans/<path>.md\`.`
4. Stop there. Writing the plan doc is the deliverable for this step — do not start implementing unless the user explicitly says to begin now. Exiting plan mode only means the plan's content is approved, not that coding should start immediately.
5. Report the file path(s) written, nothing else.

## Tracking progress

While implementing a plan, tick its `## Progress` item (`- [x]`) as each step lands, with the commit hash once committed, and note any deviation from the plan on that item. Keep `**Status:**` in step.

## Retiring

Before the PR into `dev` (alongside folding the branch `CHANGELOG.md` section), retire the plan:

1. Any decision in `## Context` or the steps that a future reader would need — rejected alternatives, verified behavior, constants — goes into an ADR via the `adr` skill (amend the topic's existing ADR where there is one).
2. Every open item (unchecked step, deferred follow-up, pending manual check) becomes one line in `docs/TASKS.md` `## Next`, or a `docs/qa/gaps.md` entry for QA/security gaps. Write it so it stands alone without the plan.
3. Point any link to the plan (README, SECURITY, `docs/security/`, code comments) at the ADR or remove it. QA evidence worth keeping goes to `docs/reports/`.
4. Delete the plan file and move its `docs/TASKS.md` line to `## Done` without the plan link.
