# 0032: Update Page Changelog, Cached by update-agent

**Status:** Accepted
**Date:** 2026-08-07

## Context

The Update page told an operator *that* an update was available but not *what* it contained. We
wanted release notes on the page without expanding either server's route surface: `update-agent`
is capped at `GET /status`, `POST /apply`, and one static page, and `backend` has no feature
domain this fits.

The first version fetched `main`'s `CHANGELOG.md` from `raw.githubusercontent.com` in the browser
on every visit. That needed a CSP `connect-src` exception, required internet access from the
browser rather than the Pi, and wasn't tied to the update check: the page could offer vX while the
changelog failed to load or didn't yet contain vX (OpenProject #239).

## Decision

- `update-agent` owns the changelog (`status/changelog-cache.ts`). `syncChangelog()` runs after
  every verified manifest fetch, from both the background poller and the live `GET /status`, and
  refetches `main`'s `CHANGELOG.md` only when the manifest version changes. "Update available" and
  its notes come from the same check.
- A fetched copy is accepted only if it has a `## [<version>]` heading for the manifest version.
  Otherwise, or on a failed fetch or a body over the 2 MB streamed cap, the old copy is kept, the
  version stays unrecorded so the next check retries, and the status call never fails.
- The cache is persisted to `UPDATE_AGENT_STATE_DIR/changelog-cache.json`, so notes survive a
  restart without GitHub access.
- `GET /status` carries `changelog: { markdown, fetchedAt } | null`; `/status/summary` does not.
- The browser never contacts GitHub. `ChangelogPreview` shows the latest 3 released entries and an
  in-app modal with all of them; `## [Unreleased]…` sections are hidden.
- `parseChangelog` reads only this project's Keep-a-Changelog shape (`##`/`###`/`- ` prefixes) and
  renders React elements with a small inline pass for code, bold, and links. Never
  `dangerouslySetInnerHTML`: the content is remote, so HTML rendering would be an XSS vector if the
  repo were compromised. Relative doc links resolve to GitHub.

## Alternatives considered

- **Browser fetch from GitHub raw** (original version). Dropped for the CSP exception, the
  browser-internet requirement, and notes drifting from the update check.
- **Browser `localStorage` cache.** Per-browser, not tied to the manifest check, keeps the CSP
  exception.
- **A new `update-agent` endpoint, or a `backend` proxy.** The endpoint breaks the cap for no gain
  over a field on `GET /status`; `backend` has no matching domain and doesn't know when the
  manifest changes.
- **A markdown library.** More weight than the narrow format needs, and HTML output reintroduces
  the injection risk.
- **Bundle `CHANGELOG.md` into the frontend image.** Only shows the running version, not what an
  update brings.
- **Filter entries to the installed → available range.** Left out; the latest 3 already lead with
  the version on offer.

## Consequences

- Notes are `main`'s changelog as of the latest manifest check, shown on every channel. Revisit
  when the Canary channel lands (OpenProject #215).
- A fresh install that has never reached GitHub shows "Release notes aren't available" with a
  retry.
- A changelog edit on `main` without a new release isn't picked up until the next version.
- A structural change to `CHANGELOG.md` headings silently yields empty output, not an error.

## History

- 2026-10-08: Moved fetching from the browser to `update-agent` with a persisted cache (was ADR 0004
  plus this record).
