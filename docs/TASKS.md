# Tasks

## How To Use This File

- Read this file (and `docs/PROJECT.md`) at the start of every session.
- Keep **Current Focus** to 1-3 items max.
- Move completed items to **Done** immediately; keep Done to the current release cycle. Older history lives in `CHANGELOG.md` and git.
- Every item stands on its own. Plans in `docs/plans/` exist only while their work is open (see the `plan-doc` skill); QA/security gaps live in `docs/qa/gaps.md`.

---

## Current Focus

[Nothing in focus.]

## In Progress

- [ ] Define Edge Studio storage/history lifecycle: monitor usage first, then archive/import, manual cleanup, and category-specific retention — monitor-only inventory implemented; see `docs/plans/storage-history-lifecycle.md`.

## Next

### Follow-ups from finished work


- [ ] Recapture the guided-tour screenshots with clean, Pi-like values and review the copy (#275; ADR 0027).
- [ ] Review the #524 lint follow-ups: `JsonPreview` ignores `title`, `WatchRunHistory` ignores `replayPlaying`, and `WorkflowWorkspace` rebuilds its replay arrays every render, so effects rerun and the replay timer re-arms.
- [ ] Clean up table drift left from #697: the workflow watch history's double scroller, the Minima peers table's `<div>` header, and Minima backups not yet on `TableWrap`.
- [ ] Remove the legacy `bcryptjs` verify path, its tests, and the CI outdated check once existing installs have rehashed (#887; ADR 0035).
- [ ] QA password-manager/native autofill and physical mobile keyboards for the PIN/password inputs (excluded from #283; proposed as a separate ticket).
- [ ] Finish the #705 manual checks on a Pi/container: retention sweep, webhook token redaction in backend and nginx logs, run budget, and the documented existing-installation log-rotation migration (installer rerun).
- [ ] Run the 13-step Brave check of the app-wide empty/loading/error states (#229, #659–#661), including Integritas, software update/update-agent, and Wallet while Minima is unavailable.
- [ ] Verify the nightly Minima auto-backup (00:30 container time) creates and rotates a backup on a real Pi; manual backup/restore was verified in #283.
- [ ] Browser QA of workflow watch mode against live runs: follow-live, historic replay, block summaries, and that the replay status text, header controls, and block stack share one horizontal center at desktop width.
- [ ] Browser QA of the workflow canvas against the Figma states (empty, populated, scrolled, selected-block sheet, leave dialog, watch, responsive).

### Security

- [ ] Confirm the two provisional V1.5 product decisions and record them in ADR 0010: accept the unauthenticated first-boot admin claim under the trusted-LAN model (review finding [2]), and keep the anonymous, off-by-default MQTT broker (finding [5], DEVICE-IO-04/05 stay open).
- [ ] Digest-pin the third-party images outside the signed manifest (`minimaglobal/minimacore`, `eclipse-mosquitto:2`, `minimaglobal/minima:dev`, `alpine:3.20`) and document the manual pin-bump procedure (finding [6]).
- [ ] Run the V1.5 manual transport checks on a Pi: `curl -vk https://<pi-ip>:8080/api/health` gives TLS 1.2/1.3 and 200; plain `http://` is refused or 400; the certificate SAN includes the Pi's LAN IP; the session cookie is `Secure`, `HttpOnly`, `SameSite=Strict`; optionally, a login capture shows no readable password.
- [ ] Define the product lifecycle for data-source reads, workflow runs/block runs, and visible inbox items: retention configuration, export, proof-linked reads, storage quotas, and disk-usage warnings (ADR 0022).
- [ ] Turn on branch protection for `main` now that changes land through PRs.

### Hardware support

- [ ] Run manual Pi retry validation for repeated Enable/Disable/Repair of Camera, GPIO, I2C sensors, and local MQTT, including retry after a failed prerequisite or partial action.
- [ ] Decide whether host-agent `.env` writes should reject non-allowlisted keys at the helper boundary (callers pass fixed keys today).
- [ ] Decide on host-agent follow-ups: async jobs for long capability actions, binding to localhost behind a proxy vs. the Docker gateway, an app-triggered reboot for `needs_reboot`, and re-auth for hardware enable/disable.
- [ ] Support Minima node updates through `update-agent`: solve multi-arch digests first (manifest-list digest or per-arch digests, verified on arm64 and armv7), then add backup/restore, the manifest key, and Compose wiring.

### Devices and automation

- [ ] PIR motion sensor: verify a PIR on the Pi through the UI and a `gpio_event_start` workflow, add beginner templates (motion → record, camera capture, stamp), and document defaults that change during hardware testing.
- [ ] ESP32 MQTT boards: verify an ESP32 publishing JSON to the Pi broker is recorded by an MQTT workflow; add DHT22 (after hardware verification), button, analog, and PIR-over-MQTT templates; add first-message troubleshooting; document broker auth limitations.
- [ ] Workflow templates for common GPIO, HTTP, webhook, schedule, output, MQTT, and Integritas flows.
- [ ] Verify `Schedule → Fetch HTTP → Stamp`, `GPIO → Record Event`, `GPIO → Fetch HTTP → Stamp`, and a button-triggered LED pulse on Pi hardware.
- [ ] Workflow editor: configure-block modal refinement, a full draft workspace save model, run-log filters, and evaluating branching/else blocks once the linear UX is stable.
- [ ] Implement the hosted feedback receiver in the Integritas API repo — see `docs/plans/feedback-hosted-receiver.md`.

### Other

- [ ] Run the UI regression sweep in `docs/qa/gaps.md` (UI changes verified only by build or unit tests).
- [ ] Fix the root `concurrently` → `shell-quote` critical audit finding; consider adding the root package to `audit:moderate`.
- [ ] Verify slow Integritas PDF verification on the Pi after deploying the 5-minute timeout and longer frontend proxy wait; update explicit legacy timeout overrides and recreate backend/frontend containers.
- [ ] Investigate the Minima backup-restore fallback test returning 502 instead of 200 in `backend/tests/features/minima/minima.routes.test.ts:172`, reproduced during Integritas timeout verification.
- [ ] Stop other values from the previous `.env` (for example a hand-added `UPDATE_DRY_RUN`) leaking into the installer's compose run; only `COMPOSE_PROFILES` is unset after `load_existing_config` in `install.sh`.
- [ ] Verify the wiki’s temporary application-data backup/restore procedure on a real Pi with the same app version and unchanged runtime configuration; implement an integrated Edge Studio backup/restore feature separately.
- [ ] Document the `DEV_MODE` install flag in `README.md`'s runtime-config section and note its manifest-signature-verification bypass in `SECURITY.md`/`docs/security/host-and-infrastructure.md` — flagged during code review, deliberately deferred as a separate concern from the pagination work.
- [ ] Sanity-check two catalog exclusions added beyond the Minima RPC console plan's named list during `help`-output reconciliation: `createtokenfrom` (same raw-`privatekey:` risk as the named `*from` commands) and `decryptbackup` (can turn an encrypted backup into plaintext key material).

## Done

- [x] Restored Raspberry Pi Camera in the device setup wizard and updated its focused setup steps, validation, full capture review, and in-app guide; verified with focused tests, frontend lint, and build.

- [x] Updated dependency lockfiles and patched Vitest/coverage, qs and Happy DOM requirements to clear the npm audit blocker; all three application audits and the root install audit reported zero vulnerabilities. Existing local backend/script test limitations are recorded in SESSION.
- [x] Repaired stale documentation indexes/references, reconciled retired-plan task entries, and renumbered the portable-history ADR to 0040; made the docs checker handle Windows paths and line endings and removed the unused frontend archive-list wrapper blocking Knip in CI.

- [x] #687 Retired finished plans, consolidated ADRs into one record per topic, and pruned stale docs; plans are now deleted before their PR into `dev`, and `npm run lint:docs` blocks doc drift.
- [x] #686 Removed dead code, seed import, token creation, TOTP, unused routes, and `/setup` (ADR 0036).
- [x] #216 Replaced native `bcrypt` with built-in scrypt; legacy hashes rehash on login (ADR 0035).
- [x] #886 Moved update-agent, the frontend build, and the installer verifier to Node 22.
- [x] #524 Added the shared ESLint config and `npm run lint` to `npm run check` and CI.
- [x] #536 Backend-owned Minima resync progress and recovery (ADR 0034).
- [x] #652 Synced wallet history into SQLite with filters and previous-wallet marking (ADR 0033).
- [x] #239 Update page changelog cached by update-agent (ADR 0032).
- [x] #283 PIN/password credential input (ADR 0031).
- [x] #206 App-owned local address-book contact (ADR 0030).
- [x] Hotfix: verified version identity, released as `v0.42.2` (ADR 0029).
- [x] #275 Static guided tour (ADR 0027).
- [x] #667 Responsive application (ADR 0024).
- [x] #229, #659–#661 App-wide empty/loading/error states (ADR 0025); Brave check still in Next.
- [x] #363, #259 Regression and node-failure unit tests; legacy-ticket unit-test gaps closed.
- [x] #704–#707 V1.5 security hardening: fail closed on `APP_SECRET`, retention/redaction/budgets, V1 sign-off, correctness hardening (ADRs 0010, 0021, 0022).
- [x] Host-agent capability management for Camera, GPIO, I2C sensors, and local MQTT (ADR 0019).
- [x] Backend-saved column visibility on every shared `DataTable`.

## Ideas

- [ ] Consider an explicit "Change receive address" action for the app-owned local contact; define old-destination and workflow-reference behavior first (ADR 0030).
- [ ] A sync script or CI check to keep `.agents/`, `.claude/`, and `.cursor/` rules and skills from drifting.
- [ ] Graceful automation handling around Minima node restarts (don't interrupt an in-progress HTTP poll, MQTT publish, or wallet send); prerequisite for re-enabling the 48h auto-restart (ADR 0001).
- [ ] One-source-of-truth Minima status/operation lock across all mutating paths, with one shared frontend polling store instead of independent `useMinimaStatusRefresh` subscribers. A first attempt regressed UX and was reverted.

---

Related: [PROJECT.md](./PROJECT.md) · [qa/gaps.md](./qa/gaps.md) · [plans/](./plans/) · [security/](./security/) · [adr/](./adr/)
