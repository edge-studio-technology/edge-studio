# Session

Scratch log for the session in progress. Update it as you go; reset it when a session's work is done and merged. Not a changelog — see `CHANGELOG.md` for user-facing history.

## Progress

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

## Next Steps

- Comment on #694 and move it to Ready for Deployment (awaiting go-ahead).
- Separate task: table drift left from #697 (watch history double scroller, peers table `<div>` header, backups onto `TableWrap`).
- Complete the manual container/Pi checks in `docs/plans/security/705-retention-redaction-budgets.md`, including existing-installation Docker log rotation.
- Define the product lifecycle for preserved data-source reads and visible inbox items, covering configuration, export, proof-linked reads, quotas, and disk warnings.
- Browser QA Automation watch mode playback/status copy and toolbar layout from screenshots or a local browser session.
- Browser QA historic replay with edited workflows, including deleted blocks and failed records with omitted block IDs.

## Notes / Open Questions

- The sidebar overlay has no OpenProject ticket yet; the team was asked on #667 to create one.
- The host agent isn't configured locally, so the hardware modal was only checked in its all-disabled state.
- ADR 0023 prevents immediate silent deletion of product data while preserving the security controls that do not depend on record lifetime.
- Data-source reads and visible inbox items can grow without bound until the follow-up lifecycle is implemented; this remains an availability risk.
- The historical credential-scrub migration remains idempotent and runs automatically on startup. This change adds only an idempotent deleted-inbox index; no one-time manual database conversion is required.
- The first two full-check attempts exposed the pre-existing webhook integration-test timeout under suite load. The test passed alone before its timeout was raised and the complete suite passed afterward.
