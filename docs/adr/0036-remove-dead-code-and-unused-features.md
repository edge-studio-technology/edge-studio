# 0036: Remove Dead Code and Unused Features

**Status:** Accepted
**Date:** 2026-10-14

## Context

OpenProject #686 asked for code no end user reaches to be cut, so it cannot drift, hide bugs, or
widen the attack surface. A 2026-10-14 audit ran knip 6.41.0 over `backend`, `frontend`, and
`update-agent`, matched every backend route against the browser UI, the CLI (`bin/edge-studio`),
update-agent, the host-agent and camera/sensor helpers, `install.sh`, and `scripts/`, and searched
for commented-out code. Nothing outside the browser UI and the CLI calls the backend, and
automation calls service functions directly, not routes.

The audit found whole features with no reachable UI:

- Seed phrase import (`POST /api/wallet/import`): its only UI, `WalletSettingsPanel`, was
  commented out of the Minima page. Seed-only restore is not planned; backup restore covers
  wallet replacement.
- Custom token creation (`/api/tokens/*`, `custom_tokens` table): the create modal and Assets tab
  were commented out, and there is no plan to support it.
- TOTP: switched off behind `TOTP_ENABLED = false` since 2026-07-15. ADR 0011 proposed removing
  it; ADR 0012 kept that decision out of V1.5 hardening and left it to a later product decision.
  That decision is now made: remove it.
- Debug routes, a static `/setup` page with no nav link (superseded by the onboarding wizard and
  `DashboardNextAction`), and API routes no client calls: `/api/files`, the raw Integritas
  hash/stamp/status/verify/poll routes, `GET /api/minima/balance`,
  `GET /api/wallet/payment-status/:txpowid`, `GET /api/automation/runs/:id`,
  `POST /api/feedback/retry-pending`, and the four single-capability host-capability reads.

## Decision

Remove those features, routes, and pages, plus dead files, commented-out code, and unused
exports, with no change to what an operator can do in the UI or CLI. The only visible change is
that a typed `/setup` URL shows Not found.

TOTP and token storage are removed from the schema, not just from code. `runMigrations()` drops
`setup_pending` and `custom_tokens`, and drops `users.totp_secret` when `PRAGMA table_info`
shows it. The bundled SQLite (3.49) supports `ALTER TABLE ... DROP COLUMN` directly, so there
is no table rebuild and the `sessions` foreign key is untouched. The `otpauth` dependency goes
with it.

Kept on purpose:

- Everything the node maintenance tickets build on (#849, #850, #851, #852, #212, #536): the
  disabled auto-restart path (`runAutoRestartIfDue()`, `/api/minima/restart/auto`, the commented
  settings toggle), stall detection, the auto-resync poller, `MINIMA_AUTO_RESYNC`, and the
  resync-lock exports. Knip flags some of these; tests and #849 use them.
- The read-only host-files mount (`HOST_FILES_DIR` → `/host-files`). `/api/files` is gone, but
  the mount still backs local-path images in Automation inbox previews
  (`resolveHostImagePath()`) and the disk entry in `GET /api/status`.
- The Minima console's `tokencreate` catalog entry, which is a console feature, and Marketplace.
- `ui/Menu` and `ui/RadioField`, ESDS primitives with no call sites yet.
- Backend exports that only tests import. Tests are a legitimate consumer.

This supersedes ADR 0012.

## Alternatives considered

- **Keep the features dormant behind flags or commented-out UI.** Rejected: dormant code still
  needs maintaining, testing, and security review, and "disabled" flags have gated the UI while
  leaving routes mounted (see ADR 0011).
- **Keep the TOTP and token schema and only drop the code.** Rejected: columns and tables nobody
  reads are dead too, and `totp_secret` held encrypted secrets that no longer have a use.
- **Remove the unused routes only with `--production` knip results.** Rejected: that mode lists
  exports that tests use. Removal was based on default-mode knip plus a per-route caller search.

## Consequences

- The schema change is one way. An older backend can still log in against a migrated database and
  recreates `setup_pending`, but cannot create a first admin. Accepted because update-agent
  rejects older manifests and `install.sh` installs the latest signed manifest by default.
- An external script calling a removed route now gets 404 with a session and 401 without one. All
  the removed routes already required a session, and no in-repo client used them.
- Two-factor authentication becomes a greenfield decision if it is wanted later.
- A typed `/setup` URL now shows the Not found page.

## Where this lives in code

- `backend/src/db/database.ts` — `runMigrations()`: `DROP TABLE IF EXISTS custom_tokens`,
  `setup_pending`, and the conditional `ALTER TABLE users DROP COLUMN totp_secret`.
- `backend/tests/db/database.test.ts` — migration tests for the token table and TOTP storage.
- `backend/src/features/auth/` — login, setup, and credential change without TOTP.
- `backend/src/app.ts` and the feature routers — remaining route registrations.
- `backend/tests/app.401-smoke.test.ts` — the auth matrix for the remaining routes.
- `frontend/src/App.tsx`, `frontend/src/app/nav.ts` — routes and navigation without `/setup`.
- `docs/plans/features/686-clean-out-dead-code-and-business-logic.md` — per-step record.
