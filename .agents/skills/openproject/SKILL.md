---
name: openproject
description: Read and write this project's OpenProject tickets (features, tasks, statuses, comments) through its REST API v3. Use when asked about ticket #NNN, what the project manager has queued, a feature's child tasks, or to move a ticket's status or leave a comment. Never use it to delete anything.
---

# OpenProject

OpenProject is this project's ticket tracker. `scripts/dev/openproject.sh` is the only way to reach it from here — do not hand-roll `curl` calls against the API.

## Setup

Credentials live in `.env.local` at the repo root, which is gitignored. `.env.local.example` is the tracked template:

```bash
cp .env.local.example .env.local
# then fill in OPEN_PROJECT_BASE_URL and OPEN_PROJECT_ACCESS_TOKEN
```

Get the token from OpenProject → *My Account* → *Access tokens* → *API*. It is sent as HTTP Basic auth with the literal username `apikey`.

The helper loads `.env.local` itself and passes the token to curl over stdin, so **never** `cat .env.local`, echo the token, or paste it into a command. If a value must be shown, redact it.

## Commands

```bash
scripts/dev/openproject.sh statuses              # id -> name, which ones are closed
scripts/dev/openproject.sh boards                # boards, and the sprint id each one filters on
scripts/dev/openproject.sh sprint 17             # everything on that sprint board
scripts/dev/openproject.sh sprint 17 7           # ...narrowed to one status (7 = In progress)
scripts/dev/openproject.sh wp 363                # one work package, full JSON
scripts/dev/openproject.sh children 363          # direct children of a feature
scripts/dev/openproject.sh get <path>            # any /api/v3/ GET
scripts/dev/openproject.sh status 363 22         # move work package 363 to status 22
scripts/dev/openproject.sh comment 363 "text"    # add a comment
scripts/dev/openproject.sh post  <path> <json|@file|->
scripts/dev/openproject.sh patch <path> <json|@file|->
```

Responses are raw JSON. Pipe through `python3 -m json.tool` or a small `python3 -c` to pull out the few fields you need — a full work package is large and mostly `_links`.

## Sprints and boards

**Sprints here are not versions.** `/api/v3/versions` is empty in this instance — do not conclude from that that sprints don't exist. A sprint is a board: `/api/v3/grids`, where each board carries a grid-level `options.filters` entry like `{"sprint_id": {"operator": "=", "values": ["17"]}}`, and `sprint` is a valid work-package filter.

The trap: a board's columns are ordinary saved queries that filter on **status only**. The sprint filter lives on the grid, not on the column queries. So reading a column query directly returns every matching work package in the project, not the sprint's — plausible-looking numbers that are wrong. Always apply the `sprint` filter yourself, or use `sprint <id>`.

Start with `boards` to map a sprint name to its id, then `sprint <id> [status-id]`.

`status` handles OpenProject's optimistic locking for you: it re-reads `lockVersion` immediately before the PATCH. If you write a raw `patch` against a work package yourself, you must include the current `lockVersion` or the API returns `409`.

## What this skill may and may not do

Allowed:

- Read anything — work packages, statuses, types, projects, activities, queries.
- Move a ticket's status, add a comment, update a description or subject.

Not allowed:

- **Any delete.** Every destructive OpenProject operation is an HTTP `DELETE`, and the helper has no `DELETE` code path — the verb is absent, not guarded. Do not work around that with raw `curl`; `.claude/settings.json` also denies `curl -X DELETE`. If a ticket genuinely needs deleting, tell the user to do it in the web UI.
- Bulk status sweeps, closing a parent feature, or anything touching tickets the user did not name — **confirm the exact ticket list with the user first**, then act.
- Changing assignees, versions, or project membership without being asked.

Set `OPEN_PROJECT_READONLY=true` in `.env.local` to make every write fail closed while leaving reads working.

## Conventions

- `[#NNN]` in a commit subject is reserved for **merge commits only** — see `.claude/skills/commit-message/SKILL.md`. Plain commits carry no ticket prefix.
- "Ready for Deployment" (status `22`) is where a finished-but-unmerged task goes. "Done" (`12`) is a closed status — use it for the parent feature once its children are all through.
- A feature's plan doc lives at `docs/plans/<ticket>-<slug>.md`; keep the ticket and the plan doc in step when you close one out.
