# Remove TOTP

**Status:** Not started
**Created:** 2026-09-04
**Branch:** `task/remove-totp` (rename once the ticket exists)
**Goal:** Delete the unused TOTP implementation — routes, services, schema, UI, tests, and the
`otpauth` dependency — rather than harden a feature no user can reach.

**Related:** [adr/0011](../adr/0011-remove-unused-totp.md) (the decision and why) ·
[plans/security-hardening-v1-5.md](./security-hardening-v1-5.md) (was Phase 10 there; split out to
keep that branch to review findings) · [qa/gaps.md](../qa/gaps.md) (GAP-05)

---

## Why this is its own branch

Not a security-review finding. It is a feature removal that touches the two most safety-critical
flows in the app — login and first-run setup — and includes a one-way schema migration. Kept
separate so the security branch stays reviewable as security work, the migration stays independently
revertable, and the coverage-floor movement this forces is not confused with coverage changes from
security fixes.

Sequence it **after** `task/272-security-hardening-v1-5`'s Phase 3 (session revocation), which edits
the same auth files. Two items were deferred from that plan on the assumption this lands: GAP-05
(Phase 8) and the onboarding QR retry loop (Phase 9). Neither was fixed, so nothing is wasted if
this slips — but both stay open until it lands.

## Footprint (measured 2026-09-04)

| Area | Files | TOTP lines |
| --- | --- | --- |
| `backend/src` + `frontend/src` | 22 | 208 |
| `backend/tests` + `frontend/tests` | 19 | 263 |

Concentrated, not smeared. Whole-file deletions are `TwoFactorStep.tsx` (206),
`totp.service.ts` (46), `totpEnabled.ts` (2). Beyond those, real work is in six files:
`auth.service.ts` (43), `AuthSettingsPage.tsx` (30), `setup.service.ts` (20),
`OnboardingWizard.tsx` (18), `auth.routes.ts` (13), `LoginPage.tsx` (10). The remaining 13 files are
1-9 lines each — an import and a `TOTP_ENABLED ? … : …` branch.

One hit is **not** coupling and should stay: `FeedbackModal.tsx:356` names TOTP secrets in
placeholder copy listing what not to paste into feedback. Same for `SECURITY.md`'s
"never return … TOTP secrets" guideline — the rule outlives the feature.

## What the flag does and does not cover

`TOTP_ENABLED` gates enforcement and UI only, so "it's disabled" does not bound this work:

- `POST /api/setup/totp/init` is mounted before `requireAuth` in `app.ts` and is not flag-checked.
  It returns a raw TOTP secret to any unauthenticated caller until the local admin exists
  (`assertLocalAdminNotCreated`). This is GAP-05, and it closes by deletion.
- `POST /api/auth/settings/totp/init|verify` are auth-gated but unusable: `completeSetup()` writes a
  random placeholder secret to keep `users.totp_secret` `NOT NULL`, so they demand a code for a
  secret nobody holds.
- There are **two** constants to remove, not one: `backend/src/features/auth/auth.constants.ts` and
  `frontend/src/features/auth/totpEnabled.ts`.

---

## Steps

### Backend

1. Delete `backend/src/features/auth/totp.service.ts`.
2. `auth.constants.ts` — drop `TOTP_ENABLED` and `TOTP_ACCOUNT_LABEL`.
3. `setup.routes.ts` — drop `POST /totp/init`, `POST /totp/verify`.
   `setup.service.ts` — drop `initSetupTotp`, `verifySetupTotp`, and `completeSetup`'s
   `TOTP_ENABLED` branch including the placeholder-secret path.
4. `auth.routes.ts` — drop `POST /settings/totp/init`, `POST /settings/totp/verify`.
   `auth.service.ts` — drop `initTotpReset`, `verifyTotpReset`, the TOTP branches in `login` and
   `changePassword`, and the now-unused `totpToken` inputs.
5. `auth.repository.ts` — drop `updateUserTotpSecret` and the `setup_pending` helpers
   (`createSetupPending`, `getLatestSetupPending`, `markSetupPendingVerified`, `clearSetupPending`,
   `deleteExpiredSetupPending`). `auth.types.ts` — drop `totp_secret`.
6. `backend/package.json` — drop `otpauth`. **Keep `qrcode` and `@types/qrcode`**:
   `features/wallet/wallet.service.ts` renders receive-address QR codes with them.

### Schema

7. `db/database.ts` — drop the `setup_pending` table (it exists only to stage a TOTP secret during
   setup/reset) and the `users.totp_secret` column.
   - Bundled SQLite is 3.49.2, so `ALTER TABLE … DROP COLUMN` is available.
   - The column is `NOT NULL` today, and existing installs have a real or placeholder value in it.
     Dropping it destroys those secrets. Acceptable — every stored value is either a placeholder or
     unreachable — but it is one-way.
   - The migration must be idempotent and must be covered by a test that runs it against a database
     created by the *previous* schema, not just a fresh one.

### Frontend

8. Delete `features/auth/totpEnabled.ts` and `features/setup/steps/TwoFactorStep.tsx`.
9. `features/setup/steps.ts` — drop the conditional `twofa` step.
   `OnboardingWizard.tsx` — drop the two-factor step and its QR effect. This removes the unbounded
   retry bug (the effect guards on `qrCode`/`loadingQr` but not `qrError`) outright rather than
   fixing it.
10. `AuthSettingsPage.tsx` — remove the TOTP reset panel: `initTotpReset`/`verifyTotpReset` imports,
    `TotpResetPhase`, and the `totpPhase`/`totpSecret`/token state and handlers. Largest frontend
    edit after `TwoFactorStep`; check the surrounding layout still reads correctly with the panel
    gone.
11. Unbranch `WelcomeStep.tsx`, `ConnectIntegritasStep.tsx`, `SidebarUserBox.tsx`,
    `ChangeCredentialPanel.tsx`, and `LoginPage.tsx` — delete the dead branch rather than leaving a
    ternary on a constant.
12. `features/setup/api.ts` — drop `initTotp`/`verifyTotp`. `features/auth/api.ts` — drop
    `initTotpReset`/`verifyTotpReset` and the `totpToken` fields on `login`/`changePassword`.

### Tests

13. Delete `backend/tests/features/auth/totp.service.test.ts`, `backend/tests/helpers/totp.ts`,
    `frontend/tests/features/auth/totpEnabled.test.ts`,
    `frontend/tests/features/setup/steps/TwoFactorStep.test.tsx`.
14. Strip TOTP cases from the rest — chiefly `auth.service.test.ts` (96 lines),
    `setup.service.test.ts` (43), and `OnboardingWizard.test.tsx` (31). `OnboardingWizard.test.tsx`
    carries a deliberately narrow assertion with a comment explaining that the retry loop is not
    asserted; that comment goes with the step.
15. Add a migration test per step 7.
16. 0.39.0 raised the coverage floors (backend 94% lines, frontend 92%) partly on TOTP-branch
    coverage. Re-measure and adjust `coverage.thresholds` in each `vitest.config.ts` deliberately —
    do not lower a floor further than the deletion accounts for, and do not let the removal fail CI
    silently.

### Docs

17. `README.md:374` — remove the "temporarily disabled" note.
18. `docs/security/auth-and-transport.md` — single-factor password/PIN is the design, not a state
    pending TOTP's return; drop the note about the unauthenticated `/api/setup/totp/init`.
19. `docs/qa/gaps.md` — close GAP-05 as removed.
20. `docs/plans/security-hardening-v1-5.md` — mark the two deferred items resolved by removal.
21. `CHANGELOG.md` under `### Removed`, on this branch's own `## [Unreleased]` heading.
22. Leave `FeedbackModal.tsx:356` and `SECURITY.md`'s "never return … TOTP secrets" alone.

---

## Verification

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

Manual, both required — this touches the only two flows that can lock an operator out:

- **Fresh install:** clean `DATA_DIR` → wizard completes without a two-factor step → login works.
- **Upgrade:** an existing install with a populated `users.totp_secret` → migration runs without
  error → existing admin can still log in with their current password/PIN.

## Out of scope

- Any replacement second factor. If 2FA is wanted later it gets designed then, against the threat
  model that applies then — see [adr/0011](../adr/0011-remove-unused-totp.md). Passkeys are the
  likelier answer for a single-admin LAN appliance than a revived TOTP.
- The first-boot admin claim (review finding [2]). Related in that both concern who can become
  admin, but it is a separate product decision owned by the security hardening plan.
