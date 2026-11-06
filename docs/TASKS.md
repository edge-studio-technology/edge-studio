# Tasks

## How To Use This File

- Read this file (and `docs/PROJECT.md`) at the start of every session.
- Keep **Current Focus** to 1-3 items max.
- Move completed items to **Done** immediately; keep Done to the current release cycle. Older history lives in `CHANGELOG.md` and git.
- Every item stands on its own. Plans in `docs/plans/` exist only while their work is open (see the `plan-doc` skill); QA/security gaps live in `docs/qa/gaps.md`.

---

## Current Focus

- [ ] Finish Pi/browser validation of the implemented Dashboard/Minima/Wallet loading fix: independent readiness/shared telemetry, bounded navigation snapshots and deferred Minima settings/backups; candidate timing is blocked by sudo authentication and no production deployment was made. See `docs/plans/page-load-performance.md`.

## In Progress

- [ ] Activate release-please: App installation/organization secrets/identity are configured; merge workflows through dev/main after Ubuntu CI, require conventional-title only after it runs, permit merge synchronization into dev, and verify the real bot PR/tag/signed build — see `docs/plans/release-please.md` and [release guide](./guides/releases.md). The Minima test's Windows path mock is fixed; existing POSIX/CRLF script-test limitations remain local.

- [ ] Finish GitHub contribution launch (epics #1249/#1250): forms, app links, public guides, PR process and mirrored AI skill are implemented locally; licensing/ownership, actual GitHub/default-branch/fork review, fresh-harness/independent contributor and disposable-Pi validation remain open — see `docs/plans/github-contributions.md` and [verification](./reports/github-contributions-implementation-2026-11-05/README.md). Module Builder remains deferred separately.
- [ ] Finish Edge Studio storage/history lifecycle: inventory, archive export/import and opt-in retention controls are implemented and the user confirmed recommended Pi verification; manual cleanup, size-based triggers and verification of the remaining features are still open; see `docs/plans/storage-history-lifecycle.md`.

## Next

### Follow-ups from finished work

- [ ] Compare candidate Pi readiness/overview timings with the measured 2 s/4 s baseline once approved Docker diagnostic access is restored, and browser-check navigation, restart/resync/payment refresh, logout isolation and first-open settings/backups; wallet live-sync timing remains unmeasured.
- [ ] Finish #861 Dashboard/status API disk warnings and generated proof-download cleanup; proof-linked camera protection is implemented and the user confirmed recommended Pi verification.
- [ ] Retry local Docker image validation when the daemon is running; the user's successful Pi verification is recorded separately.
- [ ] Verify the terminal uninstaller on a disposable Pi installation: keep-data removal/reinstall, confirmed internal-data deletion, custom helper ports/subnet, retained external data, cancellation, and partially removed installations.
- [ ] Verify the advanced installer on a Pi: fresh `curl | sudo bash -s -- --advanced`, an occupied default port, saved custom ports on rerun, and enabled camera/sensor/MQTT services.

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
- [ ] Finish remaining storage lifecycle work: scoped manual cleanup/size policies (#819), Dashboard/export cleanup (#861) and payload-copy reduction (#860); the configured lifecycle is recorded in ADR 0022.
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
- [ ] Review root-package audit coverage/advisories: isolated fresh contributor install reported ten moderate findings while all three required app package audits were clear; root is not included in `audit:moderate`. Do not apply force upgrades without reviewing compatibility.
- [ ] Verify slow Integritas PDF verification on the Pi after deploying the 5-minute timeout and longer frontend proxy wait; update explicit legacy timeout overrides and recreate backend/frontend containers.
- [ ] Stop other values from the previous `.env` (for example a hand-added `UPDATE_DRY_RUN`) leaking into the installer's compose run; only `COMPOSE_PROFILES` is unset after `load_existing_config` in `install.sh`.
- [ ] Verify the wiki’s temporary application-data backup/restore procedure on a real Pi with the same app version and unchanged runtime configuration; implement an integrated Edge Studio backup/restore feature separately.
- [ ] Document the `DEV_MODE` install flag in `README.md`'s runtime-config section and note its manifest-signature-verification bypass in `SECURITY.md`/`docs/security/host-and-infrastructure.md` — flagged during code review, deliberately deferred as a separate concern from the pagination work.
- [ ] Sanity-check two catalog exclusions added beyond the Minima RPC console plan's named list during `help`-output reconciliation: `createtokenfrom` (same raw-`privatekey:` risk as the named `*from` commands) and `decryptbackup` (can turn an encrypted backup into plaintext key material).

## Done

- [x] Implemented local GitHub contribution forms/chooser, app discovery/privacy links, PR/review guidance, source-build/architecture/device/workflow guides, mirrored public AI skill and current wizard routing; enabled private GitHub vulnerability reporting. Local verification is recorded separately from the open public-launch and independent/hardware gates.
- [x] Created the `github-contributions` branch from current dev, saved the implementation plan, and created/verified two OpenProject epics #1249/#1250 with ten features #1251–#1260 alongside Module Builder. Its branch and all eighteen existing tickets were preserved; implementation remains pending.
- [x] Implemented independent current node readiness and shared 30-second Docker telemetry with correct CPU sampling, bounded navigation snapshots, mutation/session invalidation and deferred Minima panels; local regression checks are recorded in SESSION, with Pi/browser verification still open.
- [x] Reconciled the 10 approved OpenProject tickets with implementation, remaining scope and user-reported Pi verification, and verified saved descriptions/comments/statuses; #628 uses Review because its spike workflow lacks Ready for Deployment.
- [x] User confirmed the recommended Pi verification for runtime-settings migration/persistence, Minima monitoring, history/inbox/camera retention and session expiry; not independently rerun during tracker reconciliation.
- [x] Added SQLite session policy and Settings → Security controls with PIN/password confirmation, transactional audits/session enforcement and safe existing-expiry behavior; focused auth/API/UI tests, full frontend tests, lint/typechecks and application builds passed (known Minima restore-test and Docker-daemon limitations remain).
- [x] Added separate SQLite camera retention with file previews, confirmed migration/resume, optional-extension visibility and proof-media/active-workflow protection; focused backend and full frontend tests, lint/typechecks, builds and Compose config passed (known Minima restore-test and Docker-daemon limitations remain).
- [x] Added independent opt-in inbox age retention with safe legacy/default behaviour, read/unread preview counts, active-run and linked-file protection, and shared batch limits; focused/full frontend tests, backend regressions, lint/typechecks and application builds passed (known restore-test and Docker-daemon limitations remain).
- [x] Added SQLite retention settings and Settings controls (#857 / automatic-retention part of #819), reviewed deletion previews, safe opt-in sweeps and Settings disk warnings; focused/full frontend tests, backend regressions, lint/typechecks, builds and Compose config passed (backend full run retains the known Minima restore failure).
- [x] Recorded the `.env`/runtime-settings and export boundary (#628/#643, ADR 0041) and added the first SQLite-backed Minima monitoring controls with validated admin APIs, audits, migration and live rescheduling; focused backend/UI tests, full frontend coverage, lint/typechecks, application builds and Compose configuration passed (full check still hits the tracked Minima restore failure).
- [x] Added the terminal uninstaller with default data retention, confirmed internal-data deletion, dry-run/ownership checks, and Settings instructions with a Keep data / Delete data command toggle; verified focused regressions, frontend build/tests, lint/typechecks, shell syntax, Compose config, and runtime packaging (full check still hits the tracked Minima restore failure).
- [x] Added guided installer host-port configuration with `--advanced`, saved port defaults, validation, and early conflict checks; verified focused tests, shell syntax, lint/typechecks, builds, and Compose configuration (full check remains blocked by the tracked Minima restore test).
- [x] Release security hardening: bounded proof/history/backup file operations and credential checks, validated report IDs, explicit workflow token permissions, and regression-tested upload-path triage (ADRs 0010/0022); full Linux checks passed in #166.
- [x] Restored Raspberry Pi Camera in the device setup wizard and updated its focused setup steps, validation, full capture review, and in-app guide; reconciled hardware setup with Hardware support and saved-device editing with the current form; verified guide tests, root lint/docs, and frontend build.

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
