# Session

Scratch log for the session in progress. Update it as you go; reset it when a session's work is done and merged. Not a changelog — see `CHANGELOG.md` for user-facing history.

## Progress

- #239 update-agent steps 1–3 on `task/239-improve-changelog-service`: added the persisted changelog cache (`changelog-cache.ts`, `/state/changelog-cache.json`, refetch only on a new manifest version, copy accepted only with that version's heading), synced it from every `getUpdateStatus()` call without failing the status check, and added `changelog: { markdown, fetchedAt } | null` to `GET /status`. Commits `f2fb38cb`, `fbb2a887`, `32fc5c22`. Update Agent coverage run (188 tests, thresholds met) and `tsc --noEmit` passed.
- Added project-scope Playwright MCP in `.mcp.json` (`--browser chromium --output-dir .playwright-mcp`; output dir already gitignored); approved via `enabledMcpjsonServers` in `.claude/settings.local.json` and confirmed connecting in a new session. Installed Playwright Chromium 1247 for `@playwright/mcp` 0.0.83. `.mcp.json` is staged, not committed.

- Implemented #206's separate app-owned local contact, automatic initialization, editable name/notes, protected address/deletion, and pending wallet-replacement handling with a legacy-Minima restart/status fallback; preserved user contacts and references. Full check passed 3,326 tests, with builds, typechecks, coverage, dependency audits, and Compose verification.
- Verified #206 on the dev Pi through upgrade and clean app/wallet source installations plus authenticated Playwright contact flows. Default naming, duplicate-safe creation, managed protections, ordinary CRUD, restart persistence, and headless same/different-wallet backup restores passed. Pending protection survived backend restart; metadata/manual contacts and ownership/audits were verified. Original wallet/name/notes restored and test fixtures removed. Pi runs the healthy uncommitted `ef54f4ec.readiness.dirty` build; see [QA summary](qa/206-completed-branch-pi-deployment.md).

- Applied non-breaking npm audit fixes across all four lockfiles: `proxy-addr` 2.0.8, `source-map-js` 1.2.2, and root `brace-expansion` 5.0.12; no application code or package dependency ranges changed. Root/backend/frontend/Update Agent audits report zero vulnerabilities. Repository typechecks and all three production builds passed; frontend coverage (1711 tests) and Update Agent coverage (163 tests) passed. `npm run check` still stopped on the previously recorded Minima restore fallback failure (1264 backend tests passed, 1 failed). Script verification had 19 passes, 26 failures, and 3 skips, with missing sh/openssl, Windows Bash path handling, and CRLF-sensitive assertions; no script fixes or Docker builds were included.

- Increased the shared Integritas request timeout default to 300000 ms (5 minutes) in backend, source/release Compose, and environment examples; extended nginx waits on Integritas routes to 16 minutes for three attempts plus backoff. Updated README/changelog and added default/override configuration tests. All 60 configuration/Integritas tests, repository typechecks, backend/frontend builds, Compose validation, and diff checks passed. `npm run check` stopped at the Minima backup-restore fallback test (502 instead of 200), reproduced in a focused run; Docker builds were blocked by the unavailable Docker Desktop Linux engine. No live Integritas/Pi verification was performed.

- Published wiki commit `d7f4ca6` and confirmed the remote revision and rendered GitHub alerts on Hardware, Getting Started, Backup, and Advanced Networking pages. Updated the user wiki guidance for headings, GitHub alerts, first-file stamping, networking, checksum trust, CLI logs, and temporary manual backup/restore; repository security clarifications are on `chore/wiki-user-guidance`. Checked local wiki links, all 16 Bash blocks, diffs, and a synthetic SQLite/.env archive round trip. No application code changed; full app tests/builds and real-Pi recovery were not run.

- Verified the merged #275 branch: `npm run check` passed 3,116 tests, coverage thresholds, type checks, and clean dependency audits; backend/frontend production builds and `docker compose config --quiet` passed. Fresh browser verification during review remained inconclusive because the isolated session rendered a blank page.

- Merged current `dev` into #275 and resolved the changelog conflict by consolidating the #259 and #275 entries under the global `Unreleased` section at the user's request.

- Completed #259 final verification: 27 focused frontend tests, 8 backend route tests, `npm run check` (typechecks, coverage suites/thresholds, clean dependency audits), backend/frontend builds, and `docker compose config --quiet` passed. Reconciled the focused/legacy plans and moved the local task to Done; added a completion comment to #259 without changing its status or description.
- Reviewed the branch changelog: both runtime fixes are recorded. Existing frontend chunk-size and unset Compose image-variable warnings remain; no Docker build or manual browser/live-node check was run for this unit-test task.

- Completed #259 plan step 4: added an authenticated restart-route service-rejection test asserting the normalized structured 502 response; production behavior was unchanged. All 8 backend route tests, backend build, and diff checks passed; full repository verification and ticket reconciliation remain queued for the final milestone.

- Completed #259 plan step 3: added page-owned restart disable/re-enable and actionable failure-toast tests, reproduced the unhandled rejection, and contained it in the direct confirm handler while preserving resync error propagation. All 27 focused frontend tests, frontend typechecking, production build, and diff checks passed; full repository verification remains queued for the final milestone.

- Completed #259 plan step 2: pinned stopped/error dashboard tones, preserved device metrics, stale-wallet clearing/recovery, and 30-second offline versus 3-second restart polling; skipped wallet RPC and cleared the balance for stopped/error nodes. All 24 dashboard/container tests, frontend typechecking, and the frontend production build passed; full repository verification remains queued for the final milestone.

- Completed #259 plan step 1: added table-driven Minima container stopped/exited/error label and runtime assertions; `npm --prefix frontend run test -- MinimaContainerCard` passed all 9 tests. Full checks/builds/Compose validation remain queued for the plan's final verification milestone.

- Built the #667 responsive fixes on `feature/667-responsive-application`: container-query dashboard metric grid (#695), pinned row-action column on all 11 tables with row actions (#697), wrapping status bar (#698), two-line dashboard activity rows (#699), 40px console toolbar buttons below 1024 (#700), and a sidebar that overlays the page when expanded below 1024 (§10), plus a test keeping `EXPAND_MQ` in sync with Tailwind's `lg`.
- Verified #701 (hardware modal, Account settings) at 768x1024 and 1024x768 with no change needed; commented on the ticket and moved it to Done.
- Added `AppShellSidebar.test.tsx` cases for expand at ≥1024 and accessible nav-link names when collapsed (#269).
- Ran the #269 manual matrix: 9 routes at 1280x800, 1024x768 (sidebar expanded and collapsed), and 768x1024, with no page-level horizontal overflow; results recorded in the plan (§9).
- Browser sanity-checked every change at 500–1280px, including sidebar overlay close paths, console fullscreen exit, and pinned actions after scrolling on Devices, Workflows, and Diagnostics history.
- Verified the full frontend suite (1564 tests) and `tsc --noEmit`.
- Moved #695, #697, #698, #699, #700, #269 to Ready for Deployment and #694 to Blocked; commented the #697 decision and proposed a sidebar-overlay ticket on #667.
- Built #694: the workflow toolkit (and watch run controls) becomes a drawer with a Toolkit toggle when the workspace is under 896px, closing on block add, Escape, or a click outside; the canvas drops its 360px reservation there.
- Fixed long block descriptions (source URLs) pushing the block settings sheet content out of view.
- Kept the block settings sheet at 400px on tablet widths after QA, replacing the planned full-width sheet; updated ADR 0024 and the plan.
- Stacked the workflow top bar on a narrow workspace (name field min width, buttons aligned left) and made canvas block cards wrap long text.
- Audited the whole #667 plan against code and in the browser: all 9 routes plus workflow create/edit/watch at 1280/1024/768 with no page overflow, a one-row status bar, pinned row actions, sidebar overlay closing on Escape/navigation, 1/3-column dashboard grid, 40px/32px console buttons, and the hardware modal action visible; `npm run check` and builds pass; merge with `dev` has no conflicts.
- Checked create, edit, and watch at 1280, 1024 (sidebar expanded and collapsed), and 768 in the browser; workflow tests 332/332 and `tsc` pass.
- Merged current `dev` into task 705 and confirmed the branch's retention, redaction, migration, budgets, rate limits, and Docker rotation changes remained intact.
- Audited the task 705 implementation and corrected retention catch-up so repeated 500-row batches drain eligible backlogs in one startup/hourly sweep.
- Recorded the stored-record classification in ADR 0023, linked the amendment from ADR 0022 and the task plan, and posted the decision and implementation steps to OpenProject #705.
- Added an explicit retention policy for workflow runs, block runs, inbox items, data-source reads, and Integritas proofs.
- Kept 30-day/10,000-row cleanup for workflow runs and block runs, with active-run protection and repeated bounded batches.
- Preserved visible inbox items and all data-source reads, added bounded physical deletion for user-deleted inbox items, and kept Integritas history until explicit deletion.
- Kept the generic age/count repository operation and existing data-source indexes available for a later approved read-history lifecycle; added a partial index for deleted-inbox cleanup.
- Updated retention/database tests, the task and Phase 7 plans, security policy and risk register, changelog, ADR references, and mirrored automation rules.
- Stabilized the existing 61-request webhook rate-limit integration test with a 10-second timeout after it reproducibly exceeded the default timeout only under full coverage load.
- Verified 21 focused retention/database tests and backend typechecking.
- Verified `npm run check`: backend 1,262 tests, frontend 1,596, Update Agent 163, scripts 46, all coverage thresholds met, and all dependency audits clean.
- Verified backend/frontend production builds, `docker compose config`, and `docker compose build` for backend, frontend, and Update Agent.
- Upgraded Automation watch-mode block debugging with domain-aware input/result summaries, replay controls, canvas focus layering, a toolbar above the canvas, centered run-status messaging, direct block-to-block detail switching through the overlay, no auto-play for the already-loaded latest run, and pause-on-manual-block-selection behavior.
- Added replay animations for Automation watch playback: a glowing border-worm travels from the active block's top midpoint to bottom midpoint over the 1.5-second step interval, alternates direction by block order, and loops around the selected-run summary's outer border while replay is playing.
- Updated replay playback so pressing Play from the last run block restarts playback at the first block.
- Fixed historic replay to render only the selected run's recorded blocks, restore deleted blocks from run metadata, and recover missing block IDs from failed-block error context.
- Added status-colored one-shot replay animation and persistent live-run focus overlay behavior.
- Moved the Automation watch `Open proof` diagnostic link from downstream preview blocks to the producing data-fetch block.
- Fixed replay sequences containing attached Integritas stamp blocks so the stamp is not animated as a separate canvas step.
- Fixed failed stamp runs so the visible fetch block receives the failed runtime state while downstream not-reached blocks remain visible and replay does not select the hidden stamp step.
- Changed Automation watch playback so follow-latest defaults off, manually enabling it jumps to the latest run without starting playback, and the toolbar title stays fixed as `Replay` to avoid shifting controls.
- Added quiet watch-mode run polling so new runs can appear and auto-play when follow-latest is already enabled without showing the full workflow loading overlay.
- Redesigned workflow header controls so the center contains a pill-shaped `Enabled`/`Paused` toggle and icon-only edit/watch switch, while the right side keeps only Back.
- Verified the Automation watch-mode changes with `npm --prefix frontend run test -- WorkflowWatchUi WorkflowWorkspace WorkflowWorkspaceShell`, `npm --prefix frontend run test -- WorkflowWatchUi WorkflowWorkspace AutomationPage DataReadsHistoryTable`, and `npm --prefix frontend run build`.
- Implemented the preserve-workflow-runs hotfix: workflow runs and block runs use the `preserve` retention policy; the retention pass now only purges deleted inbox items.
- Updated retention service tests, added ADR 0026 (amends ADR 0023), removed the #705 run-pruning changelog bullet, and updated SECURITY, the security risk register, and mirrored automation rules.
- Verified `npm run check` (all suites and coverage thresholds), the backend build, and `docker compose config`.
- Planned #275 guided tour in `docs/plans/features/275-create-static-app-guided-tour.md` (renamed to match the branch).
- Built the #275 guided tour: `guidedTourSeenSetting`, 9 tour steps with nav-derived titles/icons, `GuidedTourModal` with a screenshot placeholder, auto-open from `AppShell`, and a "Take the tour" replay under Settings → Behaviour.
- Added `GuidedTourModal` and `tourSteps` tests and AppShell tour tests; existing AppShell tests now pre-set the seen flag.
- Checked the tour in the browser at 1024×768 and 768×600: fits, all close paths mark it seen, backdrop ignored, reload keeps it closed, and replay reopens at step 1. Switched images to `object-contain` and reserved step-text lines so the modal height stays fixed.
- Shortened the tour image frame to 3:1 and rewrote the step copy in plain language (no blockchain/protocol terms) as a lead sentence plus three short points; the closing step shows the brand lockup on the brand gradient. The modal is a steady 598px at 1024×768 and 577px at 768 wide.
- Verified `npm run check` (frontend 1632 tests, all thresholds met) and the frontend build.
- Added ADR 0027, a changelog section, a README line, and a modal image frame note in the design-system doc.
- Replaced the tour's diagonal two-screenshot split with a full-frame crossfade after stakeholder feedback: two images alternate every 4s with a 0.7s fade, no controls, restarting on each step; the hidden image is `aria-hidden`.
- Recaptured all 15 tour screenshots as 1440×480 (960×320 regions at 1.5× from a 1280-wide page, headless Playwright; Welcome is the whole 1200×400 app), ordered overview first then detail; updated ADR 0027 and the plan.
- After review: recaptured Minima status with the RPC console open, Diagnostics workflow logs with the tabs and both runs (wider region, same output size), and the failed-run details from the top of the modal.
- Commented out the tour's step checklist (points and check icons) after stakeholder feedback; the points stay in `tourSteps` for a possible return. Updated the modal test, ADR 0027, and the plan.
- Verified the crossfade in a headless browser at 1024×768 (swap at 4s, back at 8s, reset per step, modal steady at 598px), a fake-timer crossfade test, `npm run check`, and the frontend build.
- Implemented verified version identity on `hotfix/version-identity` (ADR 0029, now Accepted): image build labels, verified `currentVersion` with self-heal of old state files, backend build identity in feedback/status, the "doesn't match a release" Update page warning, `install.sh` recording after `start_app`, and `DEV_MODE` cleanup. The Update page's "What's new" now skips `[Unreleased]` changelog sections.
- Found on the Pi that reinstalls exported the previous `.env`'s `COMPOSE_PROFILES` into compose, so a normal install after a `DEV_MODE` one kept a stale `:dev` update-agent that rejected newer manifests. Reproduced it, fixed it with `unset COMPOSE_PROFILES` plus a scripts test, and confirmed the fix on the Pi.
- Fixed new `proxy-addr`/`source-map-js` audit advisories (lockfiles only) and moved this branch's and #141's changelog entries under the shared `Unreleased` section.
- Verified `npm run check` (backend 1270, frontend 1720, update-agent 171, scripts 52; 0 vulnerabilities), backend/frontend builds, `docker compose config`, and `bash -n install.sh`. Pi 5 checks on dev build `v0.42.2-dev.1`: fresh install, `DEV_MODE` → normal reinstall, a `v0.42.1` → dev update through the old update-agent (self-update plus state-file self-heal), and a Feedback submission delivered to Integritas with `app.build`.
- Opened PR #143 to `dev`.

## Next Steps

- #239 remaining (plan `docs/plans/features/239-improve-changelog-service.md`): frontend steps 1–6 (`UpdateStatus.changelog` type, drop browser `fetchChangelog()` + `parseChangelog()` limit, `ChangelogPreview` from prop, in-app full-changelog modal, `REPO_URL` org fix, drop `raw.githubusercontent.com` from both nginx CSP `connect-src`), then docs (ADR 0031 superseding ADR 0004's client fetch, update-agent rules ×3, SECURITY, README, CHANGELOG `## [Unreleased] task/239-improve-changelog-service`), then full verification and the Pi check.
- Commit the staged `.mcp.json`.

- #206: commit the verified compatibility fix, obtain user signoff, and prepare the PR to dev.
- Deploy the longer Integritas timeout and verify a slow PDF verification on the Pi; change any explicit `INTEGRITAS_REQUEST_TIMEOUT_MS=15000` override to `300000` and recreate the backend/frontend containers. Rerun Docker builds with the engine available and investigate the Minima backup-restore fallback test failure separately.

- Comment on #694 and move it to Ready for Deployment (awaiting go-ahead).
- Separate task: table drift left from #697 (watch history double scroller, peers table `<div>` header, backups onto `TableWrap`).
- Complete the manual container/Pi checks in `docs/plans/security/705-retention-redaction-budgets.md`, including existing-installation Docker log rotation.
- Define the product lifecycle for preserved data-source reads and visible inbox items, covering configuration, export, proof-linked reads, quotas, and disk warnings.
- Browser QA Automation watch mode playback/status copy and toolbar layout from screenshots or a local browser session.
- Browser QA historic replay with edited workflows, including deleted blocks and failed records with omitted block IDs.
- Manual check for the hotfix: run a workflow, restart the backend, and confirm Watch mode still shows the run with its block overlays.
- Define the product lifecycle for preserved workflow runs/block runs (per-workflow bound, ADR 0026), data-source reads, and visible inbox items, covering configuration, export, proof-linked reads, quotas, and disk warnings.
- #275: stakeholder review of the crossfade; screenshots still use dev data (e.g. `ab78a7a5beb5 · linux x64`, a backup-password warning above the backups list) — recapture with clean, Pi-like values before merge; review the step copy.
- #275: user updates OpenProject manually.
- PR #143: review and merge to `dev`; then a separate release branch bumps `package.json` to `0.42.2`, dates the changelog, merges `dev` → `main`, and tags `v0.42.2`.

## Notes / Open Questions

- #239: `changelog` is returned by `getUpdateStatus()` itself (route unchanged, testable), so the poller and apply flow also receive it and ignore it; `/status/summary` unchanged.
- Playwright MCP: deferred aligning Codex's global `~/.codex/config.toml` entry (pinned 0.0.83, headless, isolated, `--ignore-https-errors`, chromium-1246 path, no `--output-dir`) and adding `--ignore-https-errors` to `.mcp.json` for the self-signed `:8080` cert.

- #206 policy and rationale are recorded in ADR 0030. Reroll and out-of-band wallet-change detection remain out of scope.

- The sidebar overlay has no OpenProject ticket yet; the team was asked on #667 to create one.
- The host agent isn't configured locally, so the hardware modal was only checked in its all-disabled state.
- ADR 0023 prevents immediate silent deletion of product data while preserving the security controls that do not depend on record lifetime.
- Workflow runs, block runs, data-source reads, and visible inbox items can grow without bound until the follow-up lifecycle is implemented; this remains an availability risk.
- The historical credential-scrub migration remains idempotent and runs automatically on startup. This change adds only an idempotent deleted-inbox index; no one-time manual database conversion is required.
- The first two full-check attempts exposed the pre-existing webhook integration-test timeout under suite load. The test passed alone before its timeout was raised and the complete suite passed afterward.
- #275: frontend branch coverage is 89.23% against an 89% floor.
- #275: below 768 wide the tour footer wraps Finish onto its own row; mobile is out of scope (768 floor).
- Version identity: only `COMPOSE_PROFILES` is kept out of the installer's compose environment. Other old `.env` values (e.g. a hand-added `UPDATE_DRY_RUN`) can still leak into one install run; deferred until it comes up.
- Dev Pi: `devpi5@192.168.0.108`, SSH key `~/.ssh/id_ed25519_devpi5`, DEV_MODE test build `v0.42.2-dev+ef54f4ec.readiness.dirty` (uncommitted fix). Fresh app/wallet installed; Integritas connected; hardware options disabled. Historical #206 backups were deleted with user approval.
