# 0026: Preserve Workflow Run History

**Status:** Accepted
**Date:** 2026-09-25

## Context

ADR 0023 classified `automation_runs` and `automation_block_runs` as execution diagnostics and kept
the 30-day and 10,000-row retention limits for them. Workflow Watch mode reads the same rows as
user-facing history: `GET /api/automation/workflows/:id/runs` lists the newest 20 runs of a
workflow, and each run's block runs drive the canvas overlays and the runtime inspector.

That policy breaks Watch mode in three ways:

- The 10,000-row cap is global and oldest-first, so one high-frequency workflow can evict every
  other workflow's history.
- Block runs have their own cap, independent of their parent runs. With several blocks per run the
  block-run cap is reached first, and surviving runs show no run details or canvas overlay.
- The 30-day limit leaves a rarely run workflow with no history at all.

The pruning policy was never released.

## Decision

- Treat workflow runs and block runs as user-facing history, not only diagnostics.
- Set both categories to `{ strategy: "preserve" }` in `RETENTION_POLICIES`, the same temporary
  policy ADR 0023 applies to `data_source_reads`, until the follow-up lifecycle decision covers
  them.
- Keep the retention scheduler running for soft-deleted inbox items. Keep the generic repository
  prune functions, active-run protection, and retention indexes available and tested, as ADR 0023
  requires.

This decision amends only the run and block-run classification in ADR 0023.

## Alternatives considered

- **Per-workflow bound with cascading block runs.** Keep the newest N runs per workflow and delete
  block runs only together with their parent run. This fixes the eviction problems without unbounded
  growth, but it needs new repository queries, a chosen N, and review. Deferred to the same lifecycle
  follow-up as data-source reads.
- **Keep the ADR 0023 limits.** Rejected because they silently empty Watch mode for ordinary usage
  patterns.
- **Raise the limits.** Rejected because a larger global cap and age window still evict
  low-frequency workflows and still orphan runs from their block runs.

## Consequences

- Watch mode keeps the full run and block-run history of every workflow.
- Run and block-run storage grows without bound. This is the same disk-availability risk ADR 0023
  already accepts for data-source reads, and the same follow-up lifecycle must address it.
- `runRetentionPass()` always reports zero deleted runs and block runs.

## Where this lives in code

- `backend/src/features/retention/retention.policy.ts` — `preserve` strategy for runs and block
  runs.
- `backend/src/features/retention/retention.service.ts` — `runRetentionPass()` purges only deleted
  inbox items.
- `backend/src/features/retention/retention.repository.ts` — unused prune machinery kept for a later
  lifecycle policy.
- `docs/adr/0023-classify-stored-records-before-applying-retention.md` — classification amended by
  this record.
