[← Back to security hardening index](./README.md)

# Task 706 — V1 Sign-off Remainder Plan

**Status:** Done — implemented and production Compose sign-off passed 2026-09-18

**Created:** 2026-09-18  
**Branch:** `dev-task/706-v1-sign-off-remainder`  
**Goal:** Close GAP-07, GAP-06, GAP-05, and GAP-03 with nginx security headers, an explicit accepted CSRF posture, unavailable dormant TOTP routes, and a recorded clean-data auth sign-off.

## Context

This task closes the remaining work carried from the archived V1 security checklist. At planning
time, the branch still had all four gaps:

- `frontend/nginx.conf` suppresses version tokens but does not set `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, or `Content-Security-Policy`.
- ADR 0010 accepted `SameSite=Strict` session cookies plus JSON/multipart-only request bodies as an
  adequate V1 CSRF posture, but `SECURITY.md` does not record that acceptance and
  `docs/security/auth-and-transport.md` still describes CSRF tokens as follow-up work.
- Backend `TOTP_ENABLED` is `false`, but the two setup and two authenticated settings TOTP routes
  are still mounted. In particular, setup init can return an enrollment secret before a local admin
  exists.
- GAP-03 has no completed, repeatable manual auth sign-off on a fresh `DATA_DIR`.

ADR 0012 deliberately leaves TOTP retention, redesign, re-enablement, or removal undecided. This
task only removes the disabled feature's callable route surface. It does not remove TOTP services,
schema, dependencies, frontend code, or request fields.

Adding CSRF tokens is also out of scope. ADR 0010 already made that decision for the V1 trusted-LAN,
single-admin threat model.

## Implementation progress

- 2026-09-18: The dormant-TOTP slice conditionally omits all four route registrations, preserves the
  setup first-admin service guard, and covers disabled plus module-mocked enabled behavior.
- 2026-09-18: The nginx-header slice adds the four response headers to HTTP redirects and every
  HTTPS location with `always`. A live Compose check covers the SPA, backend health proxy,
  nginx-generated error, and HTTP redirect.
- 2026-09-18: The CSRF documentation slice records that V1 intentionally uses no CSRF tokens and
  accepts strict same-site cookies plus JSON/multipart browser mutations for the trusted-LAN,
  single-admin threat model. GAP-06 is closed.
- 2026-09-18: The final sign-off used two separately named clean-data production Compose runs. It
  passed account-connected and deferred-Connect onboarding, session/reload/logout/login boundaries,
  generic credential failures, setup immutability, CLI `401`, cookie attributes, shipped TOTP
  `404`s, live nginx headers, and a Brave/Chromium CSP smoke across Dashboard, Account, and Update.
  The evidence is recorded in [the V1 auth sign-off](../../qa/v1-auth-sign-off.md); GAP-03, GAP-05,
  and GAP-07 are closed.

## 1. Add nginx security headers

Update `frontend/nginx.conf` so nginx adds the following headers with `always`, including on nginx
errors and proxied responses:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- A minimal `Content-Security-Policy`

Start with a CSP compatible with the current frontend:

```text
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://raw.githubusercontent.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
```

The exceptions are required by current behavior, not speculative allowances: React components and
the update page use inline styles, QR images use data URLs, automation inbox entries support
user-configured HTTPS image previews, and the update changelog fetches from
`raw.githubusercontent.com`. Inspection confirmed that current blob URLs are download links rather
than image sources, so `blob:` is not included. Do not broaden the policy for unrelated future
integrations.

Apply the headers to both the HTTP redirect server and the HTTPS application server so every nginx
response has a consistent baseline. Do not add HSTS; it remains explicitly deferred for the
self-signed-certificate deployment model.

Add a scripted response-level regression check under `scripts/tests/` which starts or targets the
built frontend container and uses `curl` to assert the exact headers on:

- the SPA entry response;
- a proxied backend response such as `/api/health`;
- an nginx-generated error response.

Keep the existing `scripts/tests/frontend-upload-limit.test.ts` assertions focused on upload-limit
configuration. A static text match alone is not sufficient for this ticket because it would not
prove nginx emits the headers after inheritance and proxy handling.

## 2. Make disabled TOTP routes unavailable

Update:

- `backend/src/features/auth/setup.routes.ts`
- `backend/src/features/auth/auth.routes.ts`

When backend `TOTP_ENABLED` is `false`, do not register these routes:

- `POST /api/setup/totp/init`
- `POST /api/setup/totp/verify`
- `POST /api/auth/settings/totp/init`
- `POST /api/auth/settings/totp/verify`

Absent route registration should produce `404`. The authenticated settings paths must still pass
through the global auth middleware first, so an unauthenticated request may receive `401`; test
their disabled-route result with an authenticated session.

Keep `assertLocalAdminNotCreated()` as the first service-level operation in both setup TOTP
functions. This preserves the required defense in depth if TOTP is deliberately re-enabled later.
Do not move the feature flag into the frontend or infer backend availability from the frontend flag.

### Backend tests

Add route regressions which fail against the current implementation:

- With the shipped `TOTP_ENABLED = false`, both setup TOTP paths return `404` before an admin exists.
- With the shipped flag, both settings TOTP paths return `404` for an authenticated admin.
- The setup services still reject attempts after local-admin creation, preserving
  `assertLocalAdminNotCreated()` independently of route registration.
- With `auth.constants.js` module-mocked to `TOTP_ENABLED = true`, the existing enabled setup/reset
  route behavior remains covered.

`backend/tests/features/auth/auth.routes.test.ts` currently expects
`/api/auth/settings/totp/verify` to succeed while the shipped flag is false. Move that success case
into the enabled-feature module setup rather than weakening or deleting it. Use the existing
`vi.resetModules()` / `vi.doMock(..., importOriginal)` pattern already used by the auth service tests.

## 3. Record the accepted CSRF posture

Update `SECURITY.md` and `docs/security/auth-and-transport.md` to state:

- V1 does not use CSRF tokens.
- Session cookies are `HttpOnly` and `SameSite=Strict`, and `Secure` in the default deployment.
- Browser mutations use JSON or multipart bodies rather than simple form bodies.
- Under the trusted-LAN, single-admin V1 threat model, this is an accepted residual risk per
  ADR 0010.
- The decision must be revisited before public-internet or multi-tenant use, cross-site browser
  integrations, loosening `SameSite`, or accepting simple form content types.

Replace the stale risk-register statement that CSRF tokens are follow-up work. Do not copy ADR
rationale into the policy; link to ADR 0010 for the decision record.

## 4. Run and record the manual auth E2E pass

Create `docs/qa/v1-auth-sign-off.md` as a reproducible checklist with fields for date, commit,
environment, tester, disposable data paths, and observed result. Use explicitly named disposable
`DATA_DIR` and `MINIMA_DATA_DIR` locations so the run cannot overwrite a developer or operator's
normal data.

Run these cases against the production Docker Compose path:

1. Complete the fresh setup wizard with an Integritas key/account connection.
2. Repeat from clean application data without an Integritas key and confirm the intended
   connect/deferred-connect behavior.
3. Reload after setup and confirm the local session and completed setup state persist.
4. Log out and confirm protected browser/API access returns to login/`401`.
5. Try wrong credentials and malformed/unknown credential variants; confirm the response remains
   the generic `Invalid credentials` message.
6. Confirm setup cannot create or replace the local admin after initial completion.
7. Run a CLI command which calls a protected API and confirm the documented `401 Unauthorized`.
8. Confirm all four TOTP routes are unavailable in the shipped disabled configuration, using an
   authenticated session for the settings routes.
9. Confirm the session cookie is `Secure`, `HttpOnly`, and `SameSite=Strict`.
10. Confirm the four nginx headers on SPA, API, and nginx error responses and smoke-test the main UI
    flows for CSP console violations.

Record the commands and results in the runbook. Do not mark GAP-03 complete merely because the
checklist was written; it closes only after both clean-data variants have been executed successfully.

## Docs and tracking

After implementation and verification:

- Mark GAP-03, GAP-05, GAP-06, and GAP-07 complete in `docs/qa/gaps.md`.
- Update the TOTP and CSRF controls/status in `docs/security/auth-and-transport.md`.
- Update `docs/plans/security/README.md` and this plan with completion status and how the work
  landed; keep `phase-8-v1-sign-off-remainder.md` as a pointer to this task plan or archive it to
  avoid two competing Phase 8 plans.
- Add operator-facing entries under a branch-named Unreleased `Security` section in `CHANGELOG.md`.
- Reconcile `docs/SESSION.md` and `docs/TASKS.md` using the session-notes skill.

README already documents that the V1 CLI receives `401` on protected API calls. Change it only if
the manual pass finds that statement inaccurate or the route documentation needs correction.

## Verification

Automated and build checks:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
docker compose build
```

Run the nginx response-header script against the built Compose deployment, then complete and record
`docs/qa/v1-auth-sign-off.md` on fresh disposable data. Before handoff, inspect all untracked files:

```bash
git status --short --untracked-files=all
```

## Completion criteria

- All four required headers are present on real nginx responses without breaking the production UI.
- All four dormant TOTP routes are unavailable when backend TOTP is disabled, while enabled behavior
  and the setup first-admin guard remain tested.
- The accepted V1 CSRF risk is stated consistently in the policy and risk register.
- Both fresh-data wizard variants and every remaining GAP-03 auth check have a recorded passing run.
- GAP-03, GAP-05, GAP-06, and GAP-07 are reconciled as closed, and all verification commands pass.
