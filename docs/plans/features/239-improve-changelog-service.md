# Improve Changelog Service Plan

**Status:** Not started
**Created:** 2026-10-08
**Branch:** `task/239-improve-changelog-service`
**Goal:** Cache the Update page changelog in `update-agent`, kept in step with the signed manifest, instead of having the browser fetch GitHub on every page load.

## Context

[OpenProject #239](https://openproject.privateprivate.org/work_packages/239), "Improve Changelog Service", is a task under the Changelog feature. The ticket's decision keeps the current flow, which is main's `CHANGELOG.md` rendered on the Update page. It adds a local cache, fetched on the same schedule as the update check, and requires that only released entries are shown.

Current state:

- `frontend/src/features/update/changelog.ts`: `fetchChangelog()` fetches `https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/CHANGELOG.md` from the browser on every `ChangelogPreview` mount, with no cache. `parseChangelog()` returns the first 3 released `## [version]` sections.
- `frontend/src/features/update/ChangelogPreview.tsx`: renders those entries plus a "View full changelog on GitHub" link. `REPO_URL` is `integritas-technology/edge-studio`, but the repo is `edge-studio-technology/edge-studio`, so that link and relative entry links point at the wrong org (bug).
- `frontend/nginx.conf`: both CSP headers allow `connect-src https://raw.githubusercontent.com` only for this fetch.
- `update-agent/src/status/status-poller.ts`: polls the signed manifest every `STATUS_POLL_INTERVAL_MS` (compose default 12h) and caches the result in memory. `GET /status` (`status.routes.ts`) does a live manifest check, which is the Update page's "Check again".
- `docs/adr/0004-update-page-changelog.md` rejected proxying through `update-agent`. This plan supersedes that part.

Decisions with the user (2026-10-08):

- **Sync with the manifest.** Whenever a manifest check finds a version different from the one the cached changelog belongs to, whether it's the background poll or a manual `GET /status`, `update-agent` refetches the changelog. "Update available" and its notes then always match.
- **Persist across restarts.** The cache is written to `update-agent`'s `/state` dir, so notes still show after an offline restart and a failed fetch keeps the last good copy.
- **Show the last 3; link to the cached copy.** The preview stays at 3 released entries. "View full changelog" opens an in-app view of every released entry from the cached copy instead of GitHub. Relative links inside entries still resolve to GitHub.
- **Cache content (option a).** The cache is main's changelog as of the latest manifest check. When an update is pending, its top entry is the version on offer. This is intended.
- **No version-range filtering** for now (ticket idea 2 left out).
- **Unreleased entries stay hidden.** `parseChangelog()` already skips every `## [Unreleased]…` variant, with a test. Keep that test.
- **Main changelog for all channels.** Accepted for release + dev. Revisit when the Canary channel lands (comment added on #215).

Rejected: a browser `localStorage` cache with a TTL. Each browser keeps its own copy, it isn't tied to the manifest check, and the CSP exception stays.

## update-agent changes

1. New `update-agent/src/status/changelog-cache.ts`:
   - `fetchChangelog()`: plain `fetch` of main's raw `CHANGELOG.md`.
   - Cache shape: `{ markdown, manifestVersion, fetchedAt }`, in memory and persisted to `/state/changelog-cache.json` (same `env.stateDirInContainer` + `mkdir`/`writeFile` pattern as `manifest-state.ts`). Loaded from disk on startup.
   - `syncChangelog(manifestVersion)`: refetches only when `manifestVersion` differs from the cached one. On failure, it keeps the old copy and leaves `manifestVersion` unchanged so the next check retries.
   - Accept a fetched copy only if it contains a `## [<version>]` heading for the manifest version (manifest `version` is the tag, e.g. `v0.42.2`, so strip the leading `v`). Otherwise keep the old copy and retry, in case main's changelog lags the tag.
   - `getCachedChangelog()`.
2. `status.service.ts` `getUpdateStatus()` calls `syncChangelog(manifest.version)` after a verified manifest fetch. That covers both the poller and live `GET /status`. A changelog failure must never fail the status call.
3. `GET /status` response adds `changelog: { markdown, fetchedAt } | null`. `/status/summary` stays unchanged because the nav badge polls it. No new endpoint, so the rules' `GET /status` / `POST /apply` cap still holds.

## Frontend changes

1. `frontend/src/app/types.ts`: add `changelog` to `UpdateStatus`.
2. `changelog.ts`: remove `fetchChangelog()`. `parseChangelog()` takes an optional limit (none = all released entries).
3. `ChangelogPreview.tsx`: take `markdown` as a prop from `UpdatePage` instead of fetching. A null changelog shows the existing "Release notes aren't available" state, with retry going through `UpdatePage`'s `load`.
4. "View full changelog" opens an in-app view (existing `Modal`) rendering every released entry from the same cached markdown, reusing `ChangelogEntryView`.
5. Fix `REPO_URL` to `edge-studio-technology/edge-studio`.
6. `frontend/nginx.conf`: drop `https://raw.githubusercontent.com` from `connect-src` in both CSP headers.

## Docs

- New ADR (next free number, currently 0031) superseding ADR 0004's client-side fetch. Mark 0004 as partially superseded and add it to the `docs/README.md` table.
- `.claude/rules/update-agent.md`, `.agents/rules/update-agent.md`, `.cursor/rules/update-agent.mdc`: the poller/status check also caches the changelog in `/state`; endpoint cap unchanged.
- `SECURITY.md`: the browser no longer contacts GitHub; `update-agent` fetches the changelog, and content is still rendered as React elements only.
- `README.md`: update-agent paragraph, noting the changelog cache in `UPDATE_AGENT_STATE_DIR`.
- `CHANGELOG.md` under `## [Unreleased] task/239-improve-changelog-service`.

## Verification

- update-agent tests (`global.fetch` mocked, fake timers where needed):
  - fetch on a new manifest version, skip on the same version
  - failure keeps the old copy and retries
  - copy missing the manifest version's heading is rejected
  - persisted cache loaded on startup
  - corrupt or missing state file handled
  - `GET /status` includes `changelog` and still succeeds when the changelog fetch fails
- Frontend tests: `ChangelogPreview` renders from the prop, shows the null state, and the full-changelog view lists all released entries. `parseChangelog` without a limit; existing Unreleased-skip test kept.
- `npm run check`, `npm --prefix backend run build`, `npm --prefix frontend run build`, `docker compose config`, `docker compose build`.
- Pi: Update page shows notes with no browser requests to GitHub; restart `update-agent` offline and notes still show.
