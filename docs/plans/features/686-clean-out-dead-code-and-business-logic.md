# Clean Out Dead Code and Business Logic Plan

**Status:** In progress
**Created:** 2026-10-14
**Branch:** `task/686-clean-out-dead-code-and-buisness-logic`
**Goal:** Remove code, routes, and features no end user reaches, with no change to how the app behaves for operators.

## Progress

- [x] Step 1: frontend dead files and commented-out code (`9c0ce9d2`). Also removed what this left unused: the sidebar `onSignOut` prop chain, the tour `points` copy, `activeInputTemplates`/`activeOutputTemplates`, and `isTemplateActiveByCapability`. The commented Setup nav item in `app/nav.ts` moves to Step 7.
- [x] Step 2: debug routes (`e8d6bfae`). Wallet send-history tests now reset the table in `beforeEach` instead of calling the removed debug clear function. README debug-route line removed here.
- [x] Step 3: seed phrase import. README, SECURITY, `minima.md` rules and `docs/TASKS.md` updated here. The recipient-protection test went with `importWallet()`; `runWalletReplacement()` keeps its own tests and the backup-restore ones.
- [ ] Step 4: custom token creation
- [ ] Step 5: TOTP, including the schema migration
- [ ] Step 6: unused API routes
- [ ] Step 7: legacy `/setup` page
- [ ] Step 8: unused exports
- [ ] Step 9: dead UI leftovers (`LoadingDots` shim, `Page` `eyebrow` prop)
- [ ] Docs
- [ ] Verification

## Context

[OpenProject #686](https://openproject.privateprivate.org/work_packages/686), "Clean out dead code and buisness logic", is a task under #668 "General Refactoring and Structure". Code that is not used by the end user is cut so it can't drift, hide bugs, or widen the attack surface.

Audit (2026-10-14): knip 6.41.0 over `backend`, `frontend`, and `update-agent` (default and `--production`), every backend route matched against frontend, CLI, update-agent, host-agent, camera/sensor helpers, `install.sh`, and `scripts/`, plus a search for commented-out code. No component outside the browser UI and CLI calls the backend. Automation calls service functions directly, not routes.

Decisions (with the user):

- **Remove:** dead files and commented-out code, debug routes, seed phrase import (not planned), custom token creation (no plan to support it), TOTP (deprecated, columns dropped by migration), the unused API routes in Step 6, and the static `/setup` page (replaced by `DashboardNextAction`).
- **Keep:** Marketplace. Everything the node maintenance tickets build on: #849 (48h restart), #850 (payment steps wait), #851 (admin view), #852 (auto-resync setting), spike #212, and #536. That means `runAutoRestartIfDue()` and its commented call in `minima-backup-scheduler.service.ts`, the `/api/minima/restart/auto` routes, `getAutoRestartEnabled()`, `restartMinimaContainer()`, the commented toggle in `MinimaSettingsPanel.tsx`, stall detection, the auto-resync poller, `MINIMA_AUTO_RESYNC`, and the resync-lock exports in `minima-resync.service.ts`/`minima-poll.service.ts`. Knip lists some of these as unused; tests and #849 use them.
- **Keep the host-files mount** (`HOST_FILES_DIR` → `/host-files:ro`). `/api/files` goes, but the mount also backs Show preview image blocks with a "Local file path" (`resolveHostImagePath()` in `automation.routes.ts`) and the disk entry in `GET /api/status`.
- **Downgrade:** dropping the TOTP columns is one-way. An older backend still logs in (`SELECT *`, TOTP off since 2026-07-15) and recreates `setup_pending`, but cannot create a first admin against a migrated database. Accepted: update-agent rejects older manifests and `install.sh` installs the latest signed manifest by default.

Not dead (exported only for tests): knip `--production` lists many backend exports (`executeWorkflow`, rate-limit constants, `runRetentionPass`, …) that tests import. They stay.

Functional result: no visible change except that a typed `/setup` URL shows Not found. The CLI uses only status, data-sources, automation, and Integritas history routes, all kept.

Each step is one commit and must pass typecheck and tests for the packages it touches. Every removed admin route also comes out of `backend/tests/app.401-smoke.test.ts`. After each step, remove any function, type, test helper, or import that the step left unused, and nothing more.

## Frontend changes

### Step 1: dead files and commented-out code

Delete (no production import):

- `components/patterns/AltOptionCard.tsx`, `CopyField.tsx`, `ListDisclosure.tsx`, `OptionCard.tsx`
- `features/auth/SidebarUserBox.tsx`, `features/setup/components/CredentialTypeToggle.tsx`, `lib/paths.ts`
- `features/data-sources/add-device-classic/` (all; the Devices page renders `add-device-alt/AltAddDeviceFlow`)
- `features/data-sources/add-device-alt/AltDevicePicker.tsx`, `altDeviceOptions.ts`
- `features/wallet/ReceiveQrPanel.tsx`
- Their mirrored tests under `frontend/tests/`
- **Keep:** `components/ui/Menu.tsx` and `components/ui/RadioField.tsx`. They are ESDS primitives with no call sites yet, kept as part of the app's UI library (`docs/TASKS.md:82`).

Remove commented-out code:

- `features/integritas/integritasTypes.ts:1-8`, `integritasApi.ts:5-7`, `features/setup/api.ts:13`
- The commented legacy bodies in `components/JsonPreview.tsx` and `components/Modal.tsx`; the one-line re-exports stay (shim removal is #689)
- Commented JSX/imports: `AppShellSidebar.tsx:267`, `AuthSettingsPage.tsx:390`, `WalletHero.tsx:100`, `AssetDetailModal.tsx:84`, `AutomationRunsTable.tsx:301`, `WorkflowBlockLibrary.tsx:131`, `DataSourcesPage.tsx:3`, `GuidedTourModal.tsx:1` (and its parked checklist; update ADR 0027 and the #275 plan to match)
- **Keep:** the auto-restart toggle in `MinimaSettingsPanel.tsx:202` (#851)

Backend in the same step: delete `backend/src/features/auth/integritas-validation.service.ts` (fully commented, no import), and the commented `/api-key`, `/api-key/check`, and DELETE `/api-key` routes in `integritas.routes.ts:64-104`, and `settings/secrets.service.ts:18-24`.

## Backend and frontend changes

### Step 2: debug routes

- Backend: delete `features/debug/` and its `app.ts` registration. Remove `POST /api/wallet/debug/clear-wallet-history` (`wallet.routes.ts:176`, already 403 when `NODE_ENV=production`) and `clearWalletSendHistoryForDebug()`.
- Frontend: delete `features/debug/debugApi.ts`, the `pingDebugEndpoint` state/handler in `AppShell.tsx`, `clearWalletHistoryForDebug()` in `walletApi.ts`, and the debug-clear state/handler in `WalletHistoryPanel.tsx` (lines 104-162).

### Step 3: seed phrase import

- Backend: remove `POST /api/wallet/import`, `importWallet()` in `wallet.service.ts`, and its parse helper and types if orphaned. Leave wallet-replacement handling used by backup restore.
- Frontend: delete `features/wallet/WalletSettingsPanel.tsx` (import is its only function), `{/* <WalletSettingsPanel /> */}` in `MinimaPage.tsx:232`, `importWallet()` and its types in `walletApi.ts`. Reword the `MinimaBackupPanel.tsx:187` comment that names `WalletSettingsPanel`.

### Step 4: custom token creation

- Backend: delete `features/tokens/` and its `app.ts` registration, and `backend/tests/features/tokens/`. Migration in `database.ts`: `DROP TABLE IF EXISTS custom_tokens` (read only by the tokens feature) and remove its `CREATE TABLE`.
- Frontend: delete `features/tokens/`, `features/wallet/CreateTokenModal.tsx`, `WalletAssetsPanel.tsx`, and the commented imports and branches in `WalletPage.tsx:18-21`. `AssetDetailModal` stays (still imported by `WalletPage`).
- The Minima console catalog `tokencreate` entry is a console feature and stays.

### Step 5: TOTP

- Backend (`features/auth/`): delete `totp.service.ts` and `TOTP_ENABLED` (`auth.constants.ts`). Remove `POST /api/setup/totp/init|verify` (`setup.routes.ts`), `POST /api/auth/settings/totp/init|verify` (`auth.routes.ts`), and the TOTP branches and types in `auth.service.ts`, `setup.service.ts`, `auth.repository.ts`, `auth.types.ts`.
- Schema (`database.ts`): drop `totp_secret` from the `users` `CREATE TABLE`, remove the `setup_pending` table and its `verified_at` migration. New idempotent migration: `DROP TABLE IF EXISTS setup_pending`; `ALTER TABLE users DROP COLUMN totp_secret` when `PRAGMA table_info` shows it. Bundled SQLite is 3.49, so a direct drop works; no table rebuild, so the `sessions` foreign key is unaffected.
- Dependencies: remove `otpauth` from `backend/package.json` and the lockfile. `qrcode` stays (wallet receive QR).
- Frontend: delete `features/auth/totpEnabled.ts` and `features/setup/steps/TwoFactorStep.tsx`. Remove TOTP branches from `steps.ts`, `OnboardingWizard.tsx`, `WelcomeStep.tsx`, `ConnectIntegritasStep.tsx`, `ChangeCredentialPanel.tsx`, `AuthSettingsPage.tsx`, `LoginPage.tsx`, `FeedbackModal.tsx`, `features/auth/api.ts`, `features/setup/api.ts`.
- Tests: delete `totp.service.test.ts`, `backend/tests/helpers/totp.ts`, `totpEnabled.test.ts`, `TwoFactorStep.test.tsx`. Remove TOTP cases from the remaining auth/setup/minima tests listed by `grep -rli totp backend/tests frontend/tests`. Add `database.test.ts` cases: migration drops `totp_secret` and `setup_pending` on an old-shape database, is a no-op on a new one, and keeps existing users and sessions.

### Step 6: unused API routes

| Route | Remove with it |
|---|---|
| `GET /api/files` | `features/files/` (routes, service, tests), `app.ts` registration, `FileItem`/`FilesResponse` in `frontend/src/app/types.ts`. Keep the mount and `env.hostFilesRoot` |
| `POST /api/integritas/hash`, `/stamp`, `/status`, `/verify`, `/history/:id/poll` | Service functions only these routes call (e.g. `hashCanonicalBytes`). Keep anything `/stamp-file`, `history/:id/verify`, `/verify-proof-file`, the proof poller, or automation uses |
| `GET /api/minima/balance` | `getWalletBalance()` in `minima.service.ts` |
| `GET /api/wallet/payment-status/:txpowid` | `getPaymentStatus()`, `parsePaymentStatusResponse()`, frontend `getPaymentStatus()`/types. Wallet history sync uses `txpow onchain:` directly |
| `GET /api/automation/runs/:id` | `getSerializedAutomationRun()` if orphaned |
| `POST /api/feedback/retry-pending` | `retryPendingFeedback()` and retry-only helpers. Failed uploads stay in the local export |
| `GET /api/host-capabilities/camera`, `/gpio`, `/mqtt`, `/sensors` | Routes only; `GET /api/host-capabilities` and the enable/disable routes stay |

### Step 7: legacy `/setup` page

Delete `pages/SetupPage.tsx`, its route in `App.tsx:37`, its test, and the commented Setup nav item in `app/nav.ts`. The onboarding wizard (`features/setup/`) and `DashboardNextAction` are unaffected.

### Step 8: unused exports

Run `npx knip@6.41.0` (default mode, not `--production`) per package and remove the unused exports it still reports:

- Unexport or delete unused values, e.g. `APP_TAGLINE`, the duplicate `table*Class` exports in both `DataTable.tsx` files, unused `Text.*` roles, `Textarea`, `blockShellClass`, the `workflowWorkspaceUi` class constants, `DeviceSetupGuideShell`.
- Unexport unused types (about 25 across packages).
- Delete unused test helpers `LOCAL_MINIADDRESS` and `stubHttpRequest`.
- Leave knip false positives alone: update-agent `public/app.js`, `self-update/orchestrator.ts`, and the GPIO binaries.
- Check update-agent `removeImage`, `listImagesForRepo`, `isContainerHealthy`, and `fetchChangelog` by hand before touching them.

### Step 9: dead UI leftovers

- Delete `components/LoadingDots.tsx`: a re-export shim with no importers.
- Remove the deprecated, already-ignored `eyebrow` prop from `components/patterns/Page.tsx`. Its last callers (`SetupPage`, `add-device-classic`) are deleted in Steps 1 and 7.

## Out of scope (noted on other tickets)

The 2026-10-14 frontend sweep also found migration leftovers that are refactoring, not dead code. They are recorded on the owning tickets rather than done here:

- #689 (Refactoring the Frontend source code):
  - The 9 flat re-export shims still imported (~99 import lines) and the `Text`/`ErrorText` re-exports in `components/Text.tsx`
  - The Button `xs` size alias
  - The duplicate `statusValueClass` in `MinimaSummaryGrid`
  - The resolved IconButton aria-label TODO
  - The "Alt" naming in `add-device-alt/`
  - Raw palette colours, static inline styles and hex values
  - Local button classes in `WalletHero`
  - The raw `<button>`/`<textarea>`
  - The legacy `Input`/`StatusRow`/`MutedText`
- #688 (Backend) and #691 (Update-agent): the sweep found no re-export shims or migration leftovers. Their "legacy" code is intentional data migration and compatibility. Nothing to record.
- #692 (Update and enhance AI configs and skills): wrong paths in rules — `frontend.md` `features/integritasAuth/` (real: `integritas-auth/`), `automation.md` `workflow-canvas/` (real: `workflow/canvas/`).

## Docs

- `docs/frontend-design-system.md`: remove references to components this ticket deletes (including the flat `LoadingDots`), update its Unused list, remove the `eyebrow` row and its "Cleanup later" note under Page, and remove the stale references to already-deleted `patterns/Table.tsx` and flat `CopyableCode`.
- `README.md`: remove the seed phrase import (`:270`, `:279`), debug routes (`:285`), TOTP (`:451-456`), `/api/files` (`:652`, `:708-709`), retry-pending (`:697`, `:701`), payment-status/import (`:805-806`), tokens (`:835-840`), and raw Integritas routes (`:846-849`) text. Search for remaining mentions of each removed route.
- `SECURITY.md`: drop seed phrase import from `:12`, TOTP from `:19-20`. Reword any host-files text that refers to the file browser.
- Rules, kept in sync across `.claude/rules/`, `.agents/rules/`, and `.cursor/rules/*.mdc`: remove "File browser" from `backend.md:20`; drop "TOTP secrets" from `backend.md:49`.
- New ADR (next free number, checked against `origin/dev`): what was removed and why, the keep list for node maintenance, the one-way TOTP and `custom_tokens` migration and its downgrade effect. Mark ADR 0012 superseded. Add the new ADR to the `docs/README.md` table.
- `CHANGELOG.md` under `## [Unreleased] task/686-clean-out-dead-code-and-buisness-logic`:
  - Removed: each feature and API route.
  - Changed: database migration dropping the TOTP and token tables/columns.
  - Security: smaller exposed API.
- `docs/TASKS.md`: close `:80` (SetupPage) and `:82` (unused components: deleted ones removed, `ui/Menu`/`ui/RadioField` kept as ESDS primitives).

## Verification

- After each step, typecheck and test the touched packages.
- At the end, run `npm run check` (lint, typecheck, coverage thresholds, audit). Removing tested code can lower the coverage percentage; fix gaps rather than lowering thresholds.
- `npm --prefix backend run build`, `npm --prefix frontend run build`, `docker compose config`, `docker compose build backend frontend` (dependency change).
- Re-run knip on all three packages: no unused files and no unused exports beyond the listed false positives.
- `git status --short --untracked-files=all`.
- Migration check: start the backend on a copy of a pre-change database (Pi or dev `data/`). Existing admin logs in, sessions survive, `PRAGMA table_info(users)` has no `totp_secret`, `setup_pending` and `custom_tokens` are gone, and a second start is a no-op.
- Browser smoke (dev or Pi): onboarding wizard on a fresh database (no two-factor step), login, Dashboard, Devices (add input/output), Workflows (Show preview image with a local path under host files), Wallet (history, send, receive), Minima (backups, settings, console), Integritas (stamp file, verify, history), Settings (change credential), Feedback (submit, export). `/setup` shows Not found.
- CLI: `edge-studio status`, `data-sources list`, `automation list`, `integritas history`.
