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
- [ ] Clean out dead code and business logic (OpenProject #686): remove dead files, debug routes, seed phrase import, token creation, TOTP, unused API routes and the legacy `/setup` page with no behaviour change — all steps, docs and verification done (local check, Pi fresh install of `v0.42.3-dev.2`, migration from a v0.42.2 database, full browser smoke) on `task/686-clean-out-dead-code-and-buisness-logic`; security sanity check and PR to `dev` pending; decisions in `docs/adr/0036-remove-dead-code-and-unused-features.md`; see `docs/plans/features/686-clean-out-dead-code-and-business-logic.md`.
- [ ] Replace native `bcrypt` with built-in `crypto.scrypt` (OpenProject #216): legacy bcrypt verified via `bcryptjs` and rehashed on login — implemented and verified (unit, Pi), PR to `dev` pending on `task/216-change-bcrypt-deps-to-something-more-stable`; see `docs/plans/features/216-change-bcrypt-deps-to-something-more-stable.md`.
- [ ] Upgrade update-agent, frontend build and installer verifier to Node 22 (OpenProject #886) — implemented and locally verified on `dev-task/886-upgrade-update-agent-frontend-build-and-installer-verifier-to-node-22`; `v0.42.3-dev.1` released and Pi fresh install + self-update verified; wiki 32-bit notice added; PR to `dev` open for review.
- [ ] Lint CI pipeline (OpenProject #524): shared root ESLint config, root `npm run lint` in `npm run check`/CI, and the existing violations cleared — implemented and verified on `task/524-lint-ci-pipeline`; PR to `dev` open; see `docs/plans/features/524-lint-ci-pipeline.md`.
- [ ] Incoming payment service and wallet history filtering (OpenProject #652, includes #655): synced Minima history in SQLite, server-paginated history with direction/date filters, previous-wallet marking with re-auth clear — all steps, docs, and final Pi verification (offline receive, backup restore marking, per-wallet rows) done on `task/652-implement-the-incoming-payment-service`; PR to `dev` open for review; decisions in `docs/adr/0033-persist-synced-wallet-history.md`; see `docs/plans/features/652-implement-the-incoming-payment-service.md`.
- [ ] Improve changelog service (OpenProject #239): `update-agent` caches main's changelog in `/state`, kept in step with the manifest; Update page reads it from `GET /update/status` with an in-app full view — code, docs, local and Pi verification done on `task/239-improve-changelog-service`; PR to `dev` pending; see `docs/plans/features/239-improve-changelog-service.md`.
- [ ] Upgrade Automation watch mode into a production-quality live monitoring, historic replay, and workflow debugging experience — runtime overview, domain-aware block summaries, replay toolbar/status messaging, status-colored replay animation, and run-specific historic canvas rendering are implemented and build/test verified; browser visual QA remains; see `docs/plans/workflow-watch-mode-upgrade.md`.
- [ ] Static guided tour (OpenProject #275): built on `task/275-create-static-app-guided-tour`, current `dev` merged for PR preparation (first-visit modal with 9 steps, seen flag per browser, replay from Settings → Behaviour); draft screenshots from dev data are in for every slide, crossfading in a full frame when a slide has two; recapture all of them with clean, Pi-like values before merge, then copy review and merge. Decisions in `docs/adr/0027-static-guided-tour.md`; see `docs/plans/features/275-create-static-app-guided-tour.md`.
- [ ] Responsive application (OpenProject #667; tasks #694, #695, #697–#701, #269) — all built including #694 (toolkit drawer); #694 still needs its ticket move, then merge; decisions in `docs/adr/0024-responsive-layout-strategy.md`; see `docs/plans/features/667-responsive-application.md`.
- [ ] Run the 13-step Brave verification for the completed app-wide empty/loading/error hardening, including tasks #659/#660/#661 plus Integritas, software update/update-agent, and Wallet behavior while Minima is unavailable, before merging to `dev` — see `docs/plans/bugs/229-empty-loading-and-error-states-hardening.md`.
- [ ] Redesign the workflow canvas create/edit/watch experiences — see `docs/plans/workflow-redesign.md`.
- [ ] Block automation workflows — see `docs/plans/block-automation-workflows.md`.
- [ ] Security hardening V1.5 — close the external-review findings and remaining work in one ordered workstream; see `docs/plans/security/README.md`. Pi QA passed Phases 1-5 on `v0.50.0-dev.9`; task 704 closed finding [12], task 706 completed Phase 8, and task 707 completed Phase 9.
- [ ] Add bounded workflow-diagnostic retention, webhook/MQTT credential redaction, persisted workflow run budgets, and rate limits for event-driven security paths — category-specific retention from ADR 0023 is implemented and the full check/build/Compose suite passes on `dev-task/705-retention-redaction-budgets`; needs remaining manual container/Pi checks and the documented existing-installation log migration — see `docs/plans/security/705-retention-redaction-budgets.md`.
- [ ] Minima node backup & restore v3 (own scheduler, single stored backup password, manual/auto caps) — code implemented, needs manual verification against a real/test node — see `docs/plans/minima-node-backup-restore.md`.
[Nothing in progress.]

## Next

- [ ] Resolve Full Module Builder workshop decisions D3-D8 and confirm named library/official-package ownership before revising the implementation plan; D1 agrees in-app editing/tools, external AI-assisted generation with a planned module-builder-skill, and no CLI actions; D2 scopes low core workload mainly to community module creation with separate web-library maintenance — see `docs/plans/module-builder/workshop-revision.md`.

- [ ] Module builder: dynamic hardware agent, device setup, and workflow blocks with full host access; extract default capabilities into installable packages, prove removal/download/reactivation against a local demo library, then build authoring tools — see `docs/plans/module-builder.md`; research alternatives in `docs/plans/module-builder/discussion.md` and stakeholder presentation source in `docs/reports/module-builder-2026-10-20/stakeholder-brief.md`. Implementation not started.

### Follow-ups from finished work

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

- [x] Added visible explanations for all choices beneath the strategy workshop's brief and priority dropdown questions, including all resource ceiling levels and scoring implications.

- [x] Built an English-only, local long-term strategy workshop for the seven module approaches, with a brief guided question by question across four sections, consensus questions, hard boundaries, editable assumptions, one selected path compared against the team vision, autosave, and exports — see `docs/reports/module-strategy-research/README.md`; no real extension platform or public service was implemented.

- [x] Added module ratings, weighted builder profiles, module download counts, and rating/download sorting to the disposable library frontend concept; real registry voting/counter services remain future public-library work.

- [x] Built a disposable frontend-only Module Builder and public library concept on the module-builder branch, including editable drafts, sample install/remove/activate/publish flows, and browser-verified desktop/tablet/phone layouts — see `docs/reports/module-builder-demo/README.md`; the real extension-platform implementation remains unstarted.

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
- [ ] Graceful automation handling around Minima node restarts (don't interrupt an in-progress HTTP poll, MQTT publish, or wallet send); prerequisite for re-enabling the 48h auto-restart (ADR 0037).
- [ ] One-source-of-truth Minima status/operation lock across all mutating paths, with one shared frontend polling store instead of independent `useMinimaStatusRefresh` subscribers. A first attempt regressed UX and was reverted.

---

Related: [PROJECT.md](./PROJECT.md) · [qa/gaps.md](./qa/gaps.md) · [plans/](./plans/) · [security/](./security/) · [adr/](./adr/)
