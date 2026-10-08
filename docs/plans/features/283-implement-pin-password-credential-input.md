# PIN/password Credential Input Plan

**Status:** Steps 1–2 implemented; steps 3–5 pending. OpenProject currently marks the ticket In progress.
**Created:** 2026-10-08
**Ticket:** [#283 — Implement PIN/password credential input](https://openproject.privateprivate.org/work_packages/283)
**Goal:** Show the appropriate PIN or password input everywhere the operator enters their local admin credential, using the backend's stored credential type.

## Context

The ticket requests improved credential input UX, a backend PIN/password flag, and dynamic inputs based on the configured credential. This audit covers the current checkout on `task/283-implement-pin-password-credential-input`, commit `b63809d68dafb3c7c60d9bcfe5336a034a84d803`; the working tree was clean before planning. It does not establish the state of a deployed Pi or other branches. The ticket has no child tasks and no substantive existing implementation-plan comment.

At audit time, the backend flag and credential-selection UI already existed. The remaining work was to make the flag available before login, route it to a shared control, replace current-credential fields, and handle existing installations safely. Step 1 extends the existing public setup-status response; its public metadata and legacy-account decisions are recorded in ADR 0031.

## Current codebase audit

| Area | What exists now | Gap / implication |
| --- | --- | --- |
| Credential policy | `backend/src/features/auth/password.service.ts` defines `AdminCredentialType = "pin" \| "password"`, six-digit PIN validation, strong-password validation, and `getAdminCredentialType()`. Both types use bcrypt. `frontend/src/features/auth/adminCredentials.ts` supplies matching creation rules. | Reuse the existing type and policy. Authentication must keep accepting the stored credential; creation policy must not be imposed on existing-password entry. |
| Persistence | `backend/src/db/database.ts` adds `users.credential_type` with default `password`; `auth.repository.ts` stores it on create and updates it alongside password changes. | No second flag or new column is needed. A migrated pre-flag PIN account can be labeled `password`; a bcrypt hash cannot identify the original credential type. |
| Setup and credential changes | `setup.service.ts:completeSetup()` and `auth.service.ts:changePassword()` infer and store the type from a validated new credential. | Correct for new credentials already. Preserve the existing requests (`password`, `newPassword`, `currentPassword`). |
| Auth responses | Successful setup/login responses contain `user.credentialType`; `session.service.ts:validateSession()` and protected `GET /api/auth/me` also return it. Frontend `AuthUser` includes it. | Authenticated consumers already have the required metadata. |
| Before login | Public `GET /api/setup/status` returns only `localAdminCreated` and `setupComplete`. `AuthProvider.tsx` clears `user` on logout/401. `hooks.ts` exposes no separate credential hint. | A fresh browser cannot determine which input to show. A retained authenticated user is insufficient for logout, expiry, or credential-type changes in another session. |
| Login | `frontend/src/pages/LoginPage.tsx` uses a generic password `InputField`, with Password / PIN copy. `AuthProvider.tsx` has an expiry notice that always says PIN. | Render from the public hint, and make copy follow the resolved type or use neutral wording while unknown. |
| New-credential forms | Setup `AccountStep.tsx` and `ChangeCredentialPanel.tsx` already switch between `PinField` and password `InputField` for new/confirmed credentials. Setup PIN fields use `one-time-code`. | Reuse those primitives; consolidate rendering through the new shared field while keeping type selection, requirements, and confirmation at the form level. Use `new-password` for persistent credentials. |
| Current-credential forms | Eight generic fields remain across credential changes, gated TOTP reset, backup operations, and console whitelist confirmation; see the inventory below. | Replace all local current-credential fields and adjust their labels, explanatory copy, and submit readiness. |
| Shared inputs | `ui/PinField.tsx` provides six visual slots over one controlled numeric input, digit normalization, masked visual dots, and label/error associations. `ui/InputField.tsx` wraps the existing `components/Input.tsx`. | Reuse the controls. PIN's underlying input is currently `type="text"` and unconditionally ignores password managers. Add a minimal persistent-credential mode so the actual input is a password input and password-manager behavior is appropriate. Keep TOTP behavior separate. |
| Documentation / tests | Auth services/routes, provider, setup, credential changes, PIN/input controls, backup panel, and whitelist modal have tests. No dedicated `LoginPage` test file was found. The design-system unused inventory names `CredentialInput.tsx`, but that file is absent. | Add login and shared-field regressions and correct that stale inventory entry when documenting the new control. |

### Current-credential field inventory

| File | Fields to replace |
| --- | --- |
| `frontend/src/features/auth/ChangeCredentialPanel.tsx` | Current credential, independent of the selected new credential type. |
| `frontend/src/pages/AuthSettingsPage.tsx` | Current credential for TOTP reset, inside the existing `TOTP_ENABLED` gate. |
| `frontend/src/features/minima/MinimaBackupPanel.tsx` | Download; set/change backup password; uploaded-backup restore; stored-backup restore; remove saved backup password. |
| `frontend/src/features/minima/MinimaConsoleWhitelistModal.tsx` | Confirm whitelist changes. |

The backup-encryption password and uploaded-backup password override are separate secrets and remain ordinary password inputs. ESP32 Wi-Fi passwords and authenticator codes do not follow the admin credential type. The ticket does not require changes to credential strength, TOTP enablement, session lifetime, reauthentication checks, wallet recovery, or CLI authentication.

## Proposed behavior

- A known PIN account gets a masked six-slot numeric field; a password account gets the existing masked password field.
- Unknown or unavailable metadata gets an unrestricted masked field labeled PIN or password. The operator can still submit their existing credential. Never assume PIN, truncate a password, or disable login because metadata is unavailable.
- Existing-credential password entry requires a nonempty value, not the current strong-password creation policy. Known PIN entry requires six digits; preserve leading zeros as a string.
- Use `current-password` for login/reauthentication and `new-password` for new/confirmed local credentials. Keep `one-time-code` for actual authenticator codes.
- Submit through the existing button or Enter action; completing a PIN does not automatically dispatch an action. Preserve pending, error, autofocus, keyboard, and modal-footer behavior.
- Type selection remains explicit when creating/changing a credential. Changing the new-credential tab clears only new/confirmation values and does not change the current-credential input type.

## Implementation sequence

### Progress

- [x] Step 1: credential metadata and legacy compatibility.
- [x] Step 2: auth bootstrap hint.
- [ ] Step 3: shared credential field.
- [ ] Step 4: apply the field across credential surfaces.
- [ ] Step 5: completed-feature documentation and manual verification.

### 1. Complete credential metadata and legacy compatibility

- Extend `backend/src/features/auth/setup.routes.ts`'s existing status DTO with `credentialType: "pin" | "password" | null`, using a narrow read of the local user's stored type. Return null before admin creation; do not expose user records or other credential information. Avoid caching the hint (`Cache-Control: no-store`).
- Keep the existing schema, setup/change inference, and authenticated response fields. Verify these with explicit PIN and password assertions.
- Repair a mismatched legacy type only after a fully successful login, using the verified submitted credential and a repository update that changes only `credential_type` and checks that the verified password hash is still current. Return the corrected type. Never derive it from the hash or update it on failed password/TOTP verification; a concurrent credential change must not receive a stale type correction.
- Preserve unrestricted password-field entry for migration-default `password` accounts so an existing numeric PIN can log in once and be corrected. Add a pre-flag database fixture that pins the default and repeat-migration behavior.
- **Verify:** public status before setup and for each type; no secret fields; successful legacy PIN login repairs metadata; failed login leaves it untouched; existing password login and session revocation still work.

**Implemented 2026-10-08:** Public status now reads only the stored credential type and sends `Cache-Control: no-store`. Fully successful login corrects mismatches using a hash-conditional metadata-only update; failed password/TOTP checks leave user metadata untouched. No schema change or creation-policy change was required. Regression coverage includes leading-zero legacy PINs, existing weak passwords, concurrent credential changes, migration defaults/reruns, setup in both modes, authenticated responses, and credential changes with session revocation. The final focused backend auth/database suite passed **141 tests in 11 files**. Decision: [ADR 0031](../../adr/0031-public-credential-type-and-legacy-correction.md). Full verification passed: `MINIMA_STATUS_URL=http://127.0.0.1:9005/status npm run check` (3,343 tests, all typechecks/coverage thresholds, clean dependency audits), backend/frontend builds, and `docker compose config --quiet`. The Minima URL override matches the existing mocked test expectation; local configuration otherwise uses port 9105. Frontend work starts at step 2; browser/Pi verification remains pending.

### 2. Carry the hint through auth bootstrap

- Update `frontend/src/features/auth/types.ts:SetupStatus`, `api.ts`, `hooks.ts:AuthContextValue`, and `AuthProvider.tsx` to hold a nullable credential type independently of `user`.
- Resolve the hint through the existing bootstrap status fetch. Prefer the authenticated user's type when a session exists. Refresh status when returning to login after logout, expiry, or credential change; account for asynchronous responses arriving after a newer refresh.
- On status failure, clear unverified/stale metadata and render the generic fallback. A metadata fetch should not discard an in-progress credential or trigger login submission.
- Update `App.tsx:LoginRoute()` to supply the hint to `LoginPage`. Replace the PIN-only expiry notice with accurate or neutral wording.
- **Verify:** fresh browser, authenticated boot, logout, 401, status failure, PIN-to-password and password-to-PIN changes, and incomplete-onboarding login/resume.

**Implemented 2026-10-08:** Setup status now carries a nullable `AdminCredentialType`; the API maps missing or unsupported metadata to null. `AuthProvider` holds a separate hint, prefers the authenticated user's type, and refreshes public metadata after logout/expiry, including credential-change sign-out. A request version prevents older status/session/logout completions from overwriting newer state; unmount invalidates pending work. Hint-only refreshes keep login mounted, clear stale hints while pending or failed, preserve typed credentials, and never submit. `LoginRoute` passes the resolved type to `LoginPage`, which uses matching labels/helper text; expiry notices mention both credential types. The input remains unrestricted until steps 3–4. All **158 focused frontend tests in 19 files** passed, covering auth/setup, both type-change directions, metadata fallback, asynchronous races, onboarding resume, and login request/draft preservation. Full verification passed: `MINIMA_STATUS_URL=http://127.0.0.1:9005/status npm run check` (3,374 tests, typechecks, coverage thresholds, and clean dependency audits), backend/frontend builds, and `docker compose config --quiet`. Browser/Pi verification remains pending.

### 3. Add the shared credential field

- Add `frontend/src/components/ui/CredentialField.tsx`, a presentational leaf field with an explicit nullable credential type, string value callback, and the existing label/description/error/disabled/autocomplete/focus/form attributes. It must not fetch metadata or own auth state.
- Render the existing `PinField` or password `InputField`; use generic password rendering for null. Reuse `AdminCredentialType` from `adminCredentials.ts`.
- Extend `PinField` only as needed for persistent credentials: a password input mode and appropriate password-manager attributes, preserving its default one-time-code mode. Review its typing/deletion/paste/autofill behavior with a real browser.
- Keep creation policy and submit validation in forms/existing credential helpers; do not put new-password policy inside the shared field.
- **Verify:** masked input semantics, numeric keyboard, six-digit bound, leading zero, paste/delete, labels/error association, disabled/focus state, Enter submission, and unrestricted password/fallback values.

### 4. Apply the field across the ticket's surfaces

- Update `LoginPage.tsx`, all eight inventoried current-credential fields, and new/confirmation rendering in `AccountStep.tsx` and `ChangeCredentialPanel.tsx`.
- Authenticated forms use `user.credentialType`; new/confirmation fields use the selected new type. Keep authenticator fields behind their existing gates.
- Update mode-specific helper text and submit readiness, including actions submitted from modal footers rather than a native form. Preserve request keys, FormData fields, endpoints, error handling, and server-side verification.
- **Verify:** login and every inventory row in both modes, correct existing payloads, rejected-credential behavior, new/current type independence, and backup-encryption inputs accepting ordinary passwords regardless of admin mode.

### 5. Document and verify the completed feature

- Update `docs/frontend-design-system.md` with `CredentialField` placement, usage, and persistent-PIN semantics; remove its stale absent `CredentialInput.tsx` inventory row.
- Update README auth/setup/API guidance, a branch-named Unreleased changelog entry, and SECURITY.md for exposing the minimal credential-type hint before authentication.
- Revisit step 1's ADR 0031 if the public-hint or legacy-metadata policy changes during frontend work. Reconcile this plan, `docs/TASKS.md`, `docs/SESSION.md`, and #283 when implementation is complete.
- **Verify:** focused tests below, `npm run check`, backend/frontend production builds, and `docker compose config`; then browser and existing-installation checks. No Docker topology or environment changes are expected.

## Verification

Extend existing backend auth/setup/repository/session tests and database migration tests. Add explicit contracts for the public hint, safe response shape, both stored modes, metadata repair, and PIN/password changes with invalidated old sessions.

Add `frontend/tests/components/ui/CredentialField.test.tsx` and `frontend/tests/pages/LoginPage.test.tsx`; extend provider, auth API/types consumers, setup, credential change, backup, whitelist, and gated TOTP-reset tests. Test behavior and requests rather than only inspecting which child component rendered.

Manual browser verification must cover desktop and narrow mobile viewports, numeric keyboard, paste, backspace, Enter, password-manager/autofill behavior, errors, and modal-footer actions. Test on a disposable existing-installation database with a pre-flag PIN, a pre-flag password, and a newly created account; confirm logout/reload and both direction credential changes. Backup restore QA uses disposable node data.

### Audit baseline

- Frontend focused baseline: **170 tests passed in 22 files** (auth, setup, PIN/Input fields, backup panel, whitelist modal, and ProtectedRoute).
- Backend auth/database baseline: **124 tests passed in 11 files** after rerunning with local test-server binding allowed. The first sandbox run passed 113 tests; 11 route tests could not bind (`listen EPERM`). The rerun resolved that environment restriction without code changes.
- The original audit session changed planning documents only. Its baseline did not verify the proposed behavior, full repository checks/builds, browser UX, or deployed-Pi state; implementation verification is recorded under the completed steps above.

## Acceptance criteria

- Fresh-browser login and all eight local current-credential fields follow the stored PIN/password mode.
- Setup and credential changes retain explicit new-type selection, confirmation, and existing creation validation.
- A status-fetch failure or migrated account cannot be locked out by the new input. Successful legacy PIN login corrects its metadata for subsequent sessions.
- Changing credential type revokes sessions as before and the next login uses refreshed metadata.
- Actual authenticator codes and unrelated password fields keep their own semantics; server authentication and reauthentication remain authoritative.
- Focused/full automated verification and the documented manual checks pass, with any remaining deployment limitations explicitly recorded before closure.
