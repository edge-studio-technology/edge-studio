# 0004: Update Page Changelog Preview

**Status:** Accepted
**Date:** 2026-08-07

## Context

The in-app Update page (`docs/adr/0002-update-page-split.md`) showed a per-service `frontend` /
`backend` / `update-agent` "update available" row list. That tells an operator *that* something
changed but not *what* — for that they'd have to leave the app and read `CHANGELOG.md` on GitHub
by hand. We wanted a "what's new" preview on the page itself, experimentally, without expanding
either server's route surface: `update-agent`'s rules cap it at `GET /status` / `POST /apply` /
its one static page, and `backend` has no existing feature domain this fits (it isn't auth,
Integritas, data sources, automation, Minima, status, settings, or files) — adding a route there
purely to re-serve a static public file over another network hop wouldn't pay for itself.

## Decision

- `frontend/src/features/update/changelog.ts` fetches `CHANGELOG.md` directly from GitHub's raw
  content CDN client-side: `https://raw.githubusercontent.com/integritas-technology/integritas-pi/main/CHANGELOG.md`.
  Plain `fetch()`, not `lib/api.ts`'s `getJson` — this must never attach session cookies to a
  third-party host, unlike every other frontend network call in this app.
- This is a deliberate, narrow exception to "frontend calls backend API only"
  (`.claude/rules/frontend.md`): a read-only, unauthenticated, public GitHub fetch, not a call into
  any product feature domain.
- `parseChangelog` reads only the leading N `## [version]` sections (default 3) of the
  Keep-a-Changelog format this project already writes, splitting on `##`/`###`/`- ` line prefixes.
  No general markdown parser — the format is simple and fully within our control, and a full
  markdown library is more surface than three regexes need.
- `ChangelogPreview.tsx` renders parsed entries as plain React elements — heading, category,
  bullet list, with a small inline-formatting pass for `` `code` ``, `**bold**`, and
  `[text](link)` — never as HTML via `dangerouslySetInnerHTML`. This is a security requirement,
  not a style choice: the content is remote and third-party-hosted (GitHub), even though it's our
  own repo, so rendering it as raw HTML would be an XSS vector if the repo or account were ever
  compromised. Rendering to React elements is safe by construction regardless of content, since
  React escapes text nodes.
- Relative doc links (e.g. `docs/adr/0002-....md`) are rewritten to
  `https://github.com/integritas-technology/integritas-pi/blob/main/...` so they resolve outside
  the repo; links already starting with `http` pass through unchanged.
- This fetches `main`'s `CHANGELOG.md`, not the currently running build's version — on a feature
  branch (like the one that introduced this), the page shows what's on `main`, not the branch's own
  unmerged entries, until that branch merges.
- Replaces the per-service `DetailList` rows entirely rather than showing both — the per-service
  "which service has a pending update" detail wasn't informative to a non-technical operator on its
  own, and the changelog preview is the more useful of the two for "should I update / what am I
  getting."

## Alternatives considered

- **Proxy through `backend`.** Rejected: no existing feature folder fits, and it would just move
  the same unauthenticated public GET server-side for no behavior change — the frontend already
  has no CSP blocking outbound `fetch`, and GitHub's raw content CDN sends permissive CORS headers.
- **Proxy through `update-agent`.** Rejected outright — its rules explicitly cap it at two
  endpoints and one static page; this isn't part of the update-apply flow.
- **A markdown library (e.g. `marked`, `react-markdown`) for full-fidelity rendering.** Rejected
  for now: `CHANGELOG.md`'s actual structure is narrow (headings, bullets, a few inline styles), a
  general parser is unnecessary weight for that, and — if HTML output were used instead of an AST
  → React render — reintroduces the `dangerouslySetInnerHTML` XSS concern this decision avoids.
- **Bundle `CHANGELOG.md` into the frontend image at build time** instead of fetching it live.
  Rejected: that only ever shows the version already running, defeating the point of previewing
  *upcoming* changes before updating.

## Consequences

- A second, narrower trust boundary: the page now renders remote content from a host outside this
  project's own infrastructure. Mitigated by never using raw HTML injection and by GitHub raw
  content being served over TLS from a well-known CDN — same trust level already accepted by the
  `curl | bash` install commands documented in `README.md`.
- Requires outbound internet access from the *browser*, not the Pi/backend — an offline LAN client
  sees a "couldn't load changelog" error state, not a broken page (`ErrorAlert`, page otherwise
  fully functional).
- The custom parser only understands this project's own Keep-a-Changelog formatting conventions;
  a structural change to `CHANGELOG.md` headings (e.g. `##` no longer meaning "version") would
  silently produce empty output rather than an error.

## Where this lives in code

- `frontend/src/features/update/changelog.ts` — fetch + parse.
- `frontend/src/features/update/ChangelogPreview.tsx` — rendering.
- `frontend/src/pages/UpdatePage.tsx` — mounts `ChangelogPreview`, replacing the per-service list.
