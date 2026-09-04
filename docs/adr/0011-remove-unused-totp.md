# 0011: Remove TOTP Rather Than Harden It

**Status:** Accepted
**Date:** 2026-09-04

## Context

TOTP has been switched off behind `TOTP_ENABLED = false` — two separate constants,
`backend/src/features/auth/auth.constants.ts` and `frontend/src/features/auth/totpEnabled.ts`, which
have to be flipped together. `README.md` describes it as "temporarily disabled". It has never been
reachable by a user of the shipped app.

It is nonetheless not free. Verified against source while auditing the V1.5 security review:

- **The flag gates enforcement and UI, not the routes.** `login()` sets `totpValid = !TOTP_ENABLED`,
  the wizard drops its two-factor step, and the settings panels hide their branches — but the four
  TOTP endpoints stay mounted. `POST /api/setup/totp/init` is registered before `requireAuth` in
  `app.ts` and is not flag-checked, so it answers any unauthenticated caller and returns the raw
  TOTP secret. Its only guard is `assertLocalAdminNotCreated()`, which bounds it to the first-boot
  window — the same window in which finding [2] lets an attacker simply claim admin, so the marginal
  risk is small. The point is that "TOTP is disabled" was not an accurate description of the
  attack surface, and the risk register said it was.
- **Disabling it required a workaround that is itself carried code.** `users.totp_secret` is
  `NOT NULL`, so `completeSetup()` generates and stores a random placeholder secret when TOTP is
  off. The settings-reset routes therefore do not fail cleanly on a missing secret; they demand a
  code for a secret nobody has ever seen.
- **It has a live bug.** `OnboardingWizard`'s QR effect guards on `qrCode`/`loadingQr` but not
  `qrError`, so a failing `initTotp()` clears its own error and re-fires every render — an unbounded
  retry against the setup endpoint with the error never visible. Unreachable today, and recorded as
  a deferred fix.
- **It is fully tested.** 0.39.0 brought the disabled two-factor paths to near-full coverage and
  raised the package floors partly on the back of that, so the dead code is also pinned by tests
  that must be maintained.

That is a `setup_pending` table, a `users` column, a service module, four routes, two duplicated
constants, an `otpauth` dependency, six branched frontend components, a placeholder-secret hack, a
known bug, and a test suite — none of it delivering anything to a user.

The V1.5 hardening plan had queued two items against it: GAP-05 (both `*/totp/init` routes return
the raw secret) and the QR retry loop. Both are work spent on a feature nobody can use.

## Decision

Remove TOTP. Delete the routes, services, repository helpers, schema, constants, UI branches, tests,
and the `otpauth` dependency, per [plans/remove-totp.md](../plans/remove-totp.md) — its own branch,
kept out of the V1.5 security branch because it is a feature removal with a one-way schema migration
rather than a review finding.

- GAP-05 closes as removed, not fixed. The routes that return the secret cease to exist.
- The QR retry loop is deleted with the step rather than repaired.
- `qrcode` and `@types/qrcode` stay: `features/wallet/wallet.service.ts` renders receive-address QR
  codes with them. Only `otpauth` goes.
- Single-factor password/PIN becomes the documented design for the local admin, not a temporary
  state pending TOTP's return.
- If two-factor auth is wanted later, design it then against the threat model that applies then.
  A dormant 2026 TOTP implementation is not a useful head start, and passkeys are the likelier
  answer for a single-admin LAN appliance.

## Alternatives considered

- **Re-enable TOTP.** Rejected: it would add a mandatory authenticator-app step to first-run setup
  on an appliance whose stated threat model is a trusted LAN with one admin. That is a product
  decision with real onboarding cost, and nothing in the security review argues for it — the review
  noted TOTP's absence as documentation drift, not as a missing control.
- **Keep it dormant and gate the routes on `TOTP_ENABLED`.** Rejected as the worst of both: it
  closes the exposure while keeping every line of dead code, the placeholder-secret hack, the
  schema, and the tests. It also leaves the same decision to be retaken later, with more drift.
- **Keep it dormant and fix GAP-05 and the QR loop properly.** Rejected: strictly more work than
  deletion, to harden a path no user can reach.
- **Leave the code but drop the tests to cut maintenance.** Rejected: that trades a maintenance cost
  for an unverified-dead-code cost, and the 0.39.0 coverage floors would have to come down anyway.

## Consequences

- The login and setup request contracts lose their `totpToken` field. The browser client is the only
  caller — the CLI has no session auth — so no external contract breaks.
- Dropping `users.totp_secret` is one-way and destroys stored secrets. Acceptable because every
  stored value is either a placeholder or unreachable, but the migration needs to be idempotent and
  tested, including on an upgrade from an install that has a populated column.
- Coverage floors raised in 0.39.0 partly on TOTP-branch coverage must be re-measured and adjusted
  deliberately, not lowered until CI passes.
- Two-factor auth becomes a greenfield decision rather than a re-enable. That is the intent; it is
  also a real loss if the appliance is ever exposed beyond a trusted LAN, in which case the
  first-boot admin claim (review finding [2]) is the more urgent of the two anyway.
- The risk register said TOTP was "required at setup and login" while it was off. Removing the
  feature removes the class of drift, rather than restating it.

## Where this lives in code

Nothing is removed yet; these are the sites [plans/remove-totp.md](../plans/remove-totp.md) deletes.

- `backend/src/features/auth/totp.service.ts` — whole module.
- `backend/src/features/auth/auth.constants.ts` — `TOTP_ENABLED`, `TOTP_ACCOUNT_LABEL`.
- `backend/src/features/auth/setup.routes.ts`, `setup.service.ts` — `/totp/init`, `/totp/verify`,
  `initSetupTotp`, `verifySetupTotp`, `completeSetup`'s placeholder-secret branch.
- `backend/src/features/auth/auth.routes.ts`, `auth.service.ts` — `/settings/totp/*`,
  `initTotpReset`, `verifyTotpReset`, the TOTP branches in `login` and `changePassword`.
- `backend/src/features/auth/auth.repository.ts`, `auth.types.ts` — `updateUserTotpSecret`, the
  `setup_pending` helpers, `totp_secret`.
- `backend/src/db/database.ts` — `users.totp_secret`, the `setup_pending` table.
- `backend/package.json` — `otpauth`.
- `frontend/src/features/auth/totpEnabled.ts`, `frontend/src/features/setup/steps/TwoFactorStep.tsx`.
- `frontend/src/features/setup/steps.ts`, `OnboardingWizard.tsx` — the `twofa` step and its QR effect.
- `frontend/src/features/setup/steps/WelcomeStep.tsx`, `ConnectIntegritasStep.tsx`,
  `frontend/src/features/auth/SidebarUserBox.tsx`, `ChangeCredentialPanel.tsx`,
  `frontend/src/pages/AuthSettingsPage.tsx`, `LoginPage.tsx` — flag branches.
- `frontend/src/features/setup/api.ts`, `frontend/src/features/auth/api.ts` — TOTP calls and fields.
