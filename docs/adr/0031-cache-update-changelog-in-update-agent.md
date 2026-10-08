# 0031: Cache the Update Page Changelog in update-agent

**Status:** Accepted
**Date:** 2026-10-08

## Context

ADR 0004 had the browser fetch `main`'s `CHANGELOG.md` from `raw.githubusercontent.com` on every
`ChangelogPreview` mount, with no cache. That had three problems raised in OpenProject #239:

- Every Update page visit re-downloaded the file, and the frontend CSP needed a
  `connect-src https://raw.githubusercontent.com` exception for it.
- The browser, not the Pi, needed internet access. An offline LAN client got no release notes even
  when the Pi itself had just checked the manifest.
- The notes weren't tied to the update check. The page could say "Update available: vX" while the
  changelog fetch failed or showed a copy that didn't yet have vX's entry.

ADR 0004 rejected proxying through `update-agent` because of its endpoint cap (`GET /status`,
`POST /apply`, one static page). Adding a field to the existing `GET /status` response stays
within that cap.

## Decision

- `update-agent/src/status/changelog-cache.ts` owns the changelog. `syncChangelog(manifestVersion)`
  refetches `main`'s `CHANGELOG.md` only when the manifest version differs from the one the cached
  copy belongs to.
- `getUpdateStatus()` (`status.service.ts`) calls it after every verified manifest fetch. That
  covers both the background status poller (`STATUS_POLL_INTERVAL_MS`) and the live `GET /status`
  behind "Check again", so "Update available" and its notes come from the same check.
- A fetched copy is accepted only if it has a `## [<version>]` heading for the manifest version
  (leading `v` of the tag stripped). If `main`'s changelog lags the tag, the old copy is kept and
  the version stays unrecorded, so the next check retries. A failed fetch behaves the same way, and
  never fails the status call.
- The cache (`{ markdown, manifestVersion, fetchedAt }`) is persisted to
  `UPDATE_AGENT_STATE_DIR/changelog-cache.json`, same pattern as `manifest-state.ts`, and loaded
  lazily on first use. Notes survive an offline restart.
- `GET /status` adds `changelog: { markdown, fetchedAt } | null`. `/status/summary` is unchanged,
  since the nav badge polls it and doesn't need the body.
- The frontend no longer contacts GitHub. `UpdatePage` passes `status.changelog.markdown` to
  `ChangelogPreview`, which previews the latest 3 released entries. "View full changelog" opens an
  in-app modal with every released entry from the same cached copy instead of linking to GitHub.
  `https://raw.githubusercontent.com` is dropped from `connect-src` in both CSP headers.
- Unchanged from ADR 0004: `main`'s changelog for every channel, `## [Unreleased]…` sections
  hidden, rendering as React elements only (no HTML injection), relative links resolved to GitHub.

## Alternatives considered

- **Browser `localStorage` cache with a TTL.** Rejected: each browser keeps its own copy, it isn't
  tied to the manifest check, and the CSP exception stays.
- **A new `update-agent` endpoint for the changelog.** Rejected: breaks the endpoint cap for no
  gain over a field on `GET /status`, which the Update page already loads.
- **Proxy through `backend`.** Rejected for the same reason as ADR 0004, and `backend` doesn't
  know when the manifest changes.
- **Filter entries to the installed → available version range.** Left out for now; the latest
  3 entries already lead with the version on offer.

## Consequences

- The cache is `main`'s changelog as of the latest manifest check. When an update is pending, its
  top entry is the version on offer, not the installed one. This is intended.
- Release notes only appear after `update-agent` has fetched them at least once. A fresh install
  that has never reached GitHub shows "Release notes aren't available" with a retry.
- `main`'s changelog is shown on every channel. Revisit when the Canary channel lands
  (OpenProject #215).
- Notes refresh only when the manifest version changes. A changelog edit on `main` without a new
  release isn't picked up until the next version.

## Where this lives in code

- `update-agent/src/status/changelog-cache.ts` — fetch, version check, persisted cache.
- `update-agent/src/status/status.service.ts` — `getUpdateStatus()` syncs and returns `changelog`.
- `frontend/src/features/update/ChangelogPreview.tsx` — preview and full-changelog modal.
- `frontend/src/features/update/changelog.ts` — `parseChangelog()`, optional limit.
- `frontend/src/pages/UpdatePage.tsx` — passes the cached markdown down.
- `frontend/nginx.conf` — CSP without the GitHub `connect-src` exception.
