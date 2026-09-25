# Preserve Workflow Runs Plan

**Status:** Not started  
**Created:** 2026-09-25  
**Goal:** Stop the retention scheduler from deleting `automation_runs` and `automation_block_runs`, because workflow Watch mode depends on them.

## Context

Task #705 (ADR 0022, amended by ADR 0023) classified workflow runs and block runs as execution diagnostics. It prunes them at startup and hourly once they are older than 30 days or beyond the newest 10,000 rows per table. Post-merge feedback: Watch mode uses those rows as user-facing history, so they should not be pruned.

Watch mode reads `GET /api/automation/workflows/:id/runs` (last 20 runs, `listAutomationRunsForWorkflow()`). It then reads each run's block runs (`listAutomationBlockRuns()`) for the canvas overlays and the runtime inspector. The current policy breaks it in three ways:

1. **Global row cap.** The 10,000-row cap is global and oldest-first. One high-frequency workflow can evict every other workflow's history, which leaves a low-frequency workflow with an empty Watch history.
2. **Independent block-run cap.** Block runs have their own 10,000-row cap, independent of their parent runs. With N blocks per run, block runs hit the cap after about 10,000 / N runs, so surviving runs show "No run details" and no canvas overlay.
3. **30-day age limit.** A workflow with no runs in the last 30 days shows no history at all.

#705 is on `dev` only (not on `main`, not tagged), so there is no production hotfix. This branch (`hotfix/preserve-workflow-runs`) is cut from `dev` and merges back to `dev` before the next release.

**Decision (option A):** preserve runs and block runs, the same as `data_source_reads`, until the separate lifecycle decision from ADR 0023 lands.

**Rejected for now (option B):** a per-workflow bound (newest N runs per workflow) with block runs deleted only together with their parent run. It fixes the eviction problems without unbounded growth, but it is larger work. Track it with the data-source-read lifecycle follow-up.

**Accepted consequence:** run and block-run storage grows without bound. This is the same disk-availability risk ADR 0023 already accepts for data-source reads.

## Backend changes

- `backend/src/features/retention/retention.policy.ts`: set `automationRuns` and `automationBlockRuns` to `{ strategy: "preserve" }`. `EXECUTION_HISTORY_LIMITS` becomes unused, so remove it.
- `backend/src/features/retention/retention.service.ts`: `runRetentionPass()` no longer calls `pruneAutomationRuns()` or `pruneRetainedRows("automation_block_runs", …)`. It returns `automationRuns: 0` and `automationBlockRuns: 0`, matching the existing `dataSourceReads: 0` shape. `startRetentionScheduler()` stays, because it still purges soft-deleted inbox items.
- `backend/src/features/retention/retention.repository.ts`: no change. ADR 0023 requires the generic machinery to stay available and tested for a later accepted lifecycle policy. This covers `pruneAutomationRuns()`, `pruneRetainedRows()` and the active-run protection through `getActiveAutomationRunIds()`.
- `backend/src/db/database.ts`: no change. Keep `idx_automation_block_runs_started`; ADR 0023's reasoning for keeping retention indexes still applies.

## Tests

- `backend/tests/features/retention/retention.service.test.ts`:
  - Update the policy assertion so runs and block runs use `{ strategy: "preserve" }`.
  - Replace "bounds workflow diagnostics…" and "applies the age limit only to workflow diagnostics" with tests showing that runs and block runs survive a pass. One test seeds more than 10,000 rows; the other seeds rows older than 30 days.
  - The scheduler error-path test injects a failure through the mocked `pruneAutomationRuns`. Move that injection to `pruneDeletedAutomationInboxItems`, which the service still calls.
- `backend/tests/features/retention/retention.repository.test.ts`: unchanged.

## Docs

- New ADR `docs/adr/0026-preserve-workflow-run-history.md` (use the `adr` skill). It records that runs and block runs are user-facing Watch-mode history and that option A is chosen over B. It amends ADR 0023's retention classification. Add an amendment note to the ADR 0023 header, in the same style as ADR 0022's, and add a row to the `docs/README.md` ADR table.
- `CHANGELOG.md`: delete the unreleased #705 bullet "Automation runs and block runs older than 30 days…". Released behavior never pruned runs, so there is no net change to record.
- `SECURITY.md` (line 29, workflow execution diagnostics paragraph): runs and block runs are preserved. Add them to the unbounded-growth risk list.
- `docs/security/data-sources-and-automation.md`: fix the webhook (line ~166) and MQTT (line ~199) retention bullets and the status line (~182).
- `.agents/rules/automation.md`, `.claude/rules/automation.md`, `.cursor/rules/automation.mdc`: update the last bullet ("Workflow runs and block runs are pruned after 30 days…") identically in all three.
- `docs/SESSION.md` / `docs/TASKS.md` via the `session-notes` skill.
- Out of scope: archived plans, `docs/plans/security/705-retention-redaction-budgets.md` / `phase-7-*` (historical task records), frontend (no behavior change).

## Verification

```bash
npm run check
npm --prefix backend run build
docker compose config
git status --short --untracked-files=all
```

- `npm run check` must pass the backend coverage threshold, with the repository prune functions still covered by `retention.repository.test.ts`.
- Manual check: run a workflow, restart the backend (which triggers the startup sweep), and confirm Watch mode still lists the run with its block overlays.
