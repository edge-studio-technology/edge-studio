# 0002: Update Page Split Between Frontend And Update Agent

**Status:** Accepted
**Date:** 2026-08-07

## Context

The entire `/update` flow — checking for updates, showing up-to-date/available, and watching an
apply run through to success or failure — was one static page served by `update-agent`
(`update-agent/public/index.html` + `app.js`), reached wholesale through `frontend`'s nginx
(`location /update` proxying everything to `update-agent`). It was built that way deliberately:
`update-agent` is the one service guaranteed to still be there and answering if `frontend`'s own
deploy is what's being applied and goes wrong mid-update.

That guarantee only actually matters for the apply-in-progress/success/failure part. The
checking/up-to-date/available part carries no more risk than any other page in the app, but
because it lived in `update-agent`'s hand-rolled static HTML/CSS, it couldn't reuse the product's
ESDS components (`NoticeCard`, `Card`, `Button`, `Pill`, `DetailList`) and had started drifting
from the rest of the UI's styling.

## Decision

Split ownership by path shape, not by introducing a new prefix:

- Bare `/update` (no trailing slash) is now a real React Router route in the product frontend
  (`frontend/src/pages/UpdatePage.tsx`). It does the live status check (`GET /update/status`),
  renders up-to-date/available with shared components, and on "Update now" calls
  `POST /update/apply` itself before navigating.
- `/update/` (trailing slash) and everything under it (`/update/status`, `/update/apply`,
  `/update/app.js`) keeps proxying to `update-agent`, whose static page
  (`update-agent/public/index.html` + `app.js`) is trimmed to only the
  updating/success/failure/idle "waitroom" view.
- The frontend page always starts the job itself (`POST /update/apply`) and only then does a
  full-page `window.location.assign("/update/")` to hand off. `update-agent`'s page never starts
  a job — it only polls `GET /update/apply` — so landing there with nothing running (bookmark,
  reload, direct URL) just shows an idle "nothing to update right now" state with a link back to
  `/update`, instead of doing anything.
- `nginx.conf`'s old `location = /update { rewrite ^ /update/ last; }` block was deleted so bare
  `/update` falls through to the SPA's `location /` (`try_files ... /index.html`); the existing
  `location /update/` prefix block is unchanged. The Vite dev proxy
  (`frontend/vite.config.ts`) mirrors this with a regex key `"^/update/"` (requires the trailing
  slash) instead of a plain `"/update"` prefix match, so native dev keeps the same bare-vs-slash
  split as prod.
- `/update` is intentionally not added to `frontend/src/app/nav.ts` — no permanent sidebar link
  for now. It's reachable via the sidebar's update-available `NoticeCard` and the "Check for
  updates" button on Account settings (`AuthSettingsPage.tsx`), both using React Router
  `navigate("/update")` instead of `window.location.assign` now that it's a real in-app route.

## Alternatives considered

- **Auto-POST-on-load in `update-agent`'s page**, closer to the original single-page `app.js`
  where clicking "Update now" navigated and the destination page itself fired the POST. Rejected:
  a page load having a side effect is unsafe on its own terms, not just as a duplicate-job risk
  (`update-agent/src/update/apply.routes.ts` already returns 409 for a concurrent POST) — every
  reload, bookmark, or later revisit of that URL would silently kick off a fresh update, even long
  after a previous one finished. POST-then-navigate keeps `update-agent`'s page a pure,
  side-effect-free status viewer.
- **A new URL prefix for the progress page** (e.g. `/update/progress`) instead of reusing the
  existing bare-vs-trailing-slash distinction. Rejected as unnecessary churn — nginx's prefix
  matching already gives a clean split at zero added surface area (`/update/` still proxies
  everything it always did), and it keeps `update-agent`'s internal route names untouched.

## Consequences

- Two nearly-identical-looking URLs (`/update` and `/update/`) now mean different things, which is
  easy to get wrong when linking to this flow by hand — the fix is to always link to bare
  `/update` from application code, and let the frontend page itself own the handoff to the
  trailing-slash URL after starting the job.
- `update-agent`'s static page lost its ability to show *why* an update is available before
  starting one — it's a pure progress viewer now. Anyone bookmarking or reloading straight into
  `/update/` without ever visiting `/update` first sees only the idle "waitroom" state, never
  service-level detail.

## Where this lives in code

- `frontend/src/pages/UpdatePage.tsx`, `frontend/src/features/update/updateApi.ts` — status
  check, up-to-date/available rendering, starting the apply job.
- `frontend/src/App.tsx` — the `/update` route registration.
- `frontend/src/components/AppShell.tsx`, `frontend/src/pages/AuthSettingsPage.tsx` — in-app
  `navigate("/update")` call sites.
- `frontend/nginx.conf` — the `location /update/` prefix proxy (bare `/update` block removed).
- `frontend/vite.config.ts` — the `"^/update/"` dev-proxy key.
- `update-agent/public/index.html`, `update-agent/public/app.js` — the trimmed waitroom page.
