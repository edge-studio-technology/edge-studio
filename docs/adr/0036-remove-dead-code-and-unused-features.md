# 0036: Remove Dead Code and Unused Features

**Status:** Accepted
**Date:** 2026-10-14

## Context

OpenProject #686 asked for code no end user reaches to be cut, so it cannot drift, hide bugs, or
widen the attack surface. A 2026-10-14 audit ran knip 6.41.0 over `backend`, `frontend`, and
`update-agent`, matched every backend route against the browser UI, the CLI, update-agent, the
host helpers, `install.sh`, and `scripts/`, and searched for commented-out code. Nothing outside
the browser UI and the CLI calls the backend; automation calls services directly.

Whole features had no reachable UI:

- Seed phrase import (`POST /api/wallet/import`): its only UI was commented out. Backup restore
  covers wallet replacement.
- Custom token creation (`/api/tokens/*`, `custom_tokens`): UI commented out, no plan to support it.
- TOTP: off behind `TOTP_ENABLED = false` since 2026-07-15, but not free. Verified during the V1.5
  security audit: the flag gated enforcement and UI, not the routes, so
  `POST /api/setup/totp/init` answered unauthenticated callers with the raw secret during the
  first-boot window. `users.totp_secret` being `NOT NULL` forced a placeholder-secret workaround,
  the onboarding QR effect had an unbounded retry bug, and the dormant paths were pinned by tests.
- Debug routes, a static `/setup` page with no nav link, and API routes no client calls:
  `/api/files`, the raw Integritas hash/stamp/status/verify/poll routes,
  `GET /api/minima/balance`, `GET /api/wallet/payment-status/:txpowid`,
  `GET /api/automation/runs/:id`, `POST /api/feedback/retry-pending`, and the four
  single-capability host-capability reads.

## Decision

Remove those features, routes, and pages, plus dead files, commented-out code, and unused exports,
with no change to what an operator can do in the UI or CLI. A typed `/setup` URL shows Not found.

TOTP and token storage are removed from the schema too. `runMigrations()` drops `setup_pending` and
`custom_tokens`, and drops `users.totp_secret` when present; the bundled SQLite 3.49 supports
`ALTER TABLE ... DROP COLUMN`, so no table rebuild touches the `sessions` foreign key. `otpauth`
goes; `qrcode` stays for wallet receive addresses. Single-factor password/PIN is the documented
design for the local admin.

Kept on purpose:

- What the node maintenance tickets build on (#849–#852, #212, #536): the disabled auto-restart
  path, stall detection, the auto-resync poller, `MINIMA_AUTO_RESYNC`, and resync-lock exports.
- The read-only host-files mount, which still backs inbox image previews and the disk status entry.
- The Minima console's `tokencreate` entry, Marketplace, `ui/Menu`, `ui/RadioField`, and backend
  exports only tests import.

## Alternatives considered

- **Keep features dormant behind flags or commented-out UI.** Dormant code still needs
  maintenance, tests, and security review, and the TOTP flag showed "disabled" can leave routes
  mounted.
- **Re-enable TOTP.** Adds a mandatory authenticator step to first-run setup on a single-admin LAN
  appliance; the security review flagged its absence as documentation drift, not a missing
  control. If two-factor is wanted later, passkeys are the likelier design.
- **Gate the TOTP routes and fix the QR loop.** More work than deletion to harden a path no user
  can reach. (This was done as a V1.5 stopgap while the product decision was open.)
- **Drop code but keep the schema.** Unread columns are dead too, and `totp_secret` held encrypted
  secrets with no remaining use.
- **Base removal on `knip --production`.** It lists exports tests use; removal used default-mode
  knip plus a per-route caller search.

## Consequences

- The schema change is one way. An older backend can still log in against a migrated database but
  cannot create a first admin. Accepted: update-agent rejects older manifests and `install.sh`
  installs the latest by default.
- An external script calling a removed route gets 404 with a session and 401 without one; all
  removed routes already required a session.
- Two-factor authentication is a greenfield decision if wanted later.

## History

- 2026-09-04: TOTP removal first proposed (was ADR 0011).
- 2026-09-07: Removal deferred out of V1.5 hardening; routes gated while the flag was off (was ADR
  0012).
- 2026-10-14: TOTP removed with the rest of the dead code.
