# V1 Auth and Security Sign-Off

This record covers the production Compose sign-off required by
[Task 706](../plans/security/706-v1-sign-off-remainder.md). It uses disposable application and
Minima data only. Never substitute an operator's normal data paths for the paths below.

## Evidence header

- Date: 2026-09-18
- Candidate branch: `dev-task/706-v1-sign-off-remainder`
- Candidate commit: `2bdb882baffe931e599d4878da87742da3369d63`
- Environment: Docker Compose on WSL2, production frontend/backend images built from the candidate
- Automated/API tester: Codex
- Browser/account tester: workspace operator
- Browser: Brave/Chromium 153 on Windows 10
- Result: **PASS**
- Disposable variant A application data: `/tmp/edge-studio-706-auth-no-connect`
- Disposable variant A Minima data: `/tmp/edge-studio-706-auth-no-connect-minima`
- Disposable variant A update state: `/tmp/edge-studio-706-auth-no-connect-update`
- Variant A HTTPS origin: `https://localhost:18443`
- Disposable variant B application data: `/tmp/edge-studio-706-auth-deferred-connect`
- Disposable variant B Minima data: `/tmp/edge-studio-706-auth-deferred-connect-minima`
- Disposable variant B update state: `/tmp/edge-studio-706-auth-deferred-connect-update`
- Variant B HTTPS origin: `https://localhost:18443` after variant A was stopped

Do not attach session-cookie values, the QA credential, activation codes, Integritas tokens, or
unredacted `.env` files to this record.

## Reproduction setup

The normal development Compose containers were stopped with `docker compose down`; their
bind-mounted data was not removed. Variant A used the source `docker-compose.yml` without the local
development override, Compose project `edge-studio-qa706`, `COOKIE_SECURE=true`, frontend host port
`18443`, Minima P2P port `19013`, and Minima RPC port `19015`. `INTEGRITAS_API_KEY` was empty.

Generate the disposable certificate and start the stack with equivalent environment overrides:

```bash
DATA_DIR=/tmp/edge-studio-706-auth-no-connect \
  INTEGRITAS_TLS_IP=127.0.0.1 \
  bash scripts/generate-tls-cert.sh

docker compose --env-file .env --env-file <qa-env-file> \
  -f docker-compose.yml -p edge-studio-qa706 config --quiet
docker compose --env-file .env --env-file <qa-env-file> \
  -f docker-compose.yml -p edge-studio-qa706 up -d --build
```

The QA environment file contained only the disposable paths and alternate ports listed above. It
did not override or reveal the existing generated `APP_SECRET`.

After variant A passed, its Compose project was stopped. Variant B reused the candidate images and
ports with the separately named variant B paths above. An accidental first attempt was reset before
evidence was collected; the passing run began at `localAdminCreated: false` and
`setupComplete: false` and ended, without Connect approval, at `localAdminCreated: true` and
`setupComplete: false`.

## Automated baseline

- `npm run check`: pass — 78 backend files/1,163 tests, 179 frontend files/1,486 tests, 14
  update-agent files/159 tests, and 5 script files/43 tests; 2,851 tests total; all three dependency
  audits reported zero vulnerabilities.
- `npm --prefix backend run build`: pass.
- `npm --prefix frontend run build`: pass; Vite retained its existing large-chunk advisory.
- `docker compose ... config --quiet`: pass for the explicit disposable configuration.
- `docker compose ... up -d --build`: pass; frontend and backend were rebuilt from the candidate,
  and the backend/frontend health checks passed.
- Backend/frontend log review: pass; the only process termination was the intentional backend
  restart used by AUTH-03, and request logging contained paths rather than request bodies.

## Observed results

| ID      | Check                                                     | Result | Sanitized observation                                                                                                                                                                                                                                                                                                                                                              |
| ------- | --------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 | Fresh setup with Integritas account connection            | Pass   | The operator approved the disposable Integritas Connect activation and logged in successfully; setup status then reported `setupComplete: true`, and authenticated Connect status reported `connected` with a profile and plan.                                                                                                                                                    |
| AUTH-02 | Second clean-data run without a legacy Integritas API key | Pass   | Variant B used separately named clean application/Minima paths with `INTEGRITAS_API_KEY` empty. The operator created the local admin without approving Connect; setup remained `localAdminCreated: true`, `setupComplete: false`, and a browser reload resumed at the Integritas Connect step.                                                                                     |
| AUTH-03 | Reload/restart persistence                                | Pass   | After local-admin creation, `GET /api/auth/me` stayed `200` with the same session after a backend restart; the browser remained authenticated across the later production-container recreation, and setup state stayed complete.                                                                                                                                                   |
| AUTH-04 | Logout and protected access                               | Pass   | `POST /api/auth/logout` returned `200`; reuse of the old cookie on `GET /api/auth/me` returned generic `401 Unauthorized`; a subsequent valid login returned `200`.                                                                                                                                                                                                                |
| AUTH-05 | Generic invalid-credential responses                      | Pass   | Wrong PIN, non-string password, and an unknown extra username with a wrong PIN each returned `401` with `Invalid credentials`.                                                                                                                                                                                                                                                     |
| AUTH-06 | Setup cannot replace the admin                            | Pass   | A second `POST /api/setup/complete` returned `403` with `Setup is already complete`.                                                                                                                                                                                                                                                                                               |
| AUTH-07 | CLI protected API behavior                                | Pass   | `EDGE_STUDIO_API_URL=https://localhost:18443/api sh bin/edge-studio status` reached the protected API and curl reported HTTP `401`; the repository copy is not executable, so it was invoked through `sh`.                                                                                                                                                                         |
| AUTH-08 | Disabled TOTP route surface                               | Pass   | Both setup TOTP routes returned `404` before admin creation; both settings TOTP routes returned `404` with an authenticated admin session.                                                                                                                                                                                                                                         |
| AUTH-09 | Session-cookie attributes                                 | Pass   | Setup and login responses both set `session=<redacted>` with `Path=/`, `HttpOnly`, `Secure`, and `SameSite=Strict` (`Max-Age=604800`).                                                                                                                                                                                                                                             |
| AUTH-10 | nginx headers and CSP UI smoke                            | Pass   | The live script passed SPA `200`, API health `200`, nginx error `403`, and HTTP redirect `301`. The operator loaded Dashboard, Account, and Update in Brave/Chromium with no CSP violations. Update `502`s occurred only while the optional update-agent profile was absent or its local manifest response was invalid; yellow browser Permissions-Policy warnings were unrelated. |

## Sanitized API command sequence

Use a unique QA-only PIN or password in place of `<QA_CREDENTIAL>` and a cookie jar under a
temporary directory. The observed response codes for this run are shown in comments.

```bash
# Fresh state: 200, {"localAdminCreated":false,"setupComplete":false}
curl -ksS https://localhost:18443/api/setup/status

# Disabled setup TOTP routes: 404, 404
curl -ksS -o /dev/null -w '%{http_code}\n' -X POST \
  https://localhost:18443/api/setup/totp/init
curl -ksS -o /dev/null -w '%{http_code}\n' -X POST \
  https://localhost:18443/api/setup/totp/verify \
  -H 'Content-Type: application/json' --data '{"totpToken":"000000"}'

# Create the only local admin and capture the QA session: 200
curl -ksS -D <headers> -c <cookie-jar> -X POST \
  https://localhost:18443/api/setup/complete \
  -H 'Content-Type: application/json' --data '{"password":"<QA_CREDENTIAL>"}'

# Authenticated settings TOTP routes: 404, 404
curl -ksS -b <cookie-jar> -o /dev/null -w '%{http_code}\n' -X POST \
  https://localhost:18443/api/auth/settings/totp/init
curl -ksS -b <cookie-jar> -o /dev/null -w '%{http_code}\n' -X POST \
  https://localhost:18443/api/auth/settings/totp/verify

# Admin replacement is rejected: 403
curl -ksS -o /dev/null -w '%{http_code}\n' -X POST \
  https://localhost:18443/api/setup/complete \
  -H 'Content-Type: application/json' --data '{"password":"<DIFFERENT_QA_CREDENTIAL>"}'

# Logout succeeds; the old cookie then receives 401.
curl -ksS -b <cookie-jar> -X POST https://localhost:18443/api/auth/logout
curl -ksS -b <cookie-jar> -o /dev/null -w '%{http_code}\n' \
  https://localhost:18443/api/auth/me

# The V1 CLI has no session and receives 401.
EDGE_STUDIO_API_URL=https://localhost:18443/api sh bin/edge-studio status

# Real response-level header checks.
COMPOSE_PROJECT_NAME=edge-studio-qa706 COMPOSE_FILE=docker-compose.yml \
  FRONTEND_PORT=18443 sh scripts/tests/frontend-security-headers.sh
```

## Browser/account checklist

- [x] Accept the disposable self-signed certificate and sign in.
- [x] Approve the disposable Integritas Connect activation with a QA account.
- [x] Confirm setup becomes complete, “Enter Edge Studio” works, and reload keeps the signed-in UI.
- [x] Open the browser console, clear it, and visit the main shell/Dashboard, Account, and Update
      pages; confirm they render and produce no Content Security Policy violations.
- [x] Start variant B with separately named clean application and Minima paths, create the local
      admin without approving Connect, reload, and confirm onboarding resumes at the Connect step.

GAP-03, GAP-05, and GAP-07 close on this passing record. GAP-06 was already closed by the accepted
V1 CSRF posture.
