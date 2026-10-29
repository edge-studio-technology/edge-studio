# 0002: Update Page Split Between Frontend and update-agent

**Status:** Accepted
**Date:** 2026-08-07

## Context

The whole `/update` flow was one static page served by `update-agent`, because `update-agent` is
the one service guaranteed to still answer if `frontend` is what's being replaced. That guarantee
only matters while an apply is running. The check/up-to-date/available part carried no special
risk, but as hand-rolled HTML it couldn't use the product's components and was drifting from the
rest of the UI.

Verified: for a `proxy_pass` prefix location ending in `/`, nginx answers the slash-less URI with
its own 301 to the slashed one, built from the container's listen port (443) rather than the
published `FRONTEND_PORT`, so a bare `/update` without its own block redirects to an unreachable
origin.

## Decision

Split by path shape:

- Bare `/update` is a React route in the product frontend. It checks status (`GET /update/status`),
  renders with shared components, and on "Update now" calls `POST /update/apply` itself, then does
  a full-page navigation to `/update/`.
- `/update/` and everything under it proxies to `update-agent`, whose static page is only the
  updating/success/failure/idle view. It never starts a job, only polls `GET /update/apply`, so a
  reload or bookmark with nothing running shows an idle state with a link back to `/update`.
- nginx has an exact-match `location = /update { try_files /index.html =404; }` that wins over the
  `/update/` prefix block. The Vite dev proxy mirrors it with a `^/update/` regex key.
  `scripts/tests/frontend-nginx-update-route.test.ts` pins this against the real nginx image.
- `/update` has no sidebar entry; it's reached from the update-available notice and Account
  settings.

## Alternatives considered

- **`update-agent`'s page starts the job on load.** A page load with a side effect re-triggers an
  update on every reload or bookmark.
- **A new prefix like `/update/progress`.** Unneeded churn; the slash split costs nothing.
- **Let bare `/update` fall through to `location /`** (first version). Hits nginx's slash redirect
  described above.
- **`absolute_redirect off`.** Fixes the port but still redirects to the waitroom instead of the
  SPA.

## Consequences

- `/update` and `/update/` mean different things. Application code always links to bare `/update`.
- Landing on `/update/` directly shows only the progress or idle view, never what an update
  contains.

## History

- 2026-10-05: Exact-match `location = /update` block restored after the fallthrough version
  redirected to an unreachable port.
