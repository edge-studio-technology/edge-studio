# 0023: Classify Stored Records Before Applying Retention

**Status:** Accepted
**Date:** 2026-09-23

## Context

ADR 0022 introduced one retention policy for `automation_runs`, `automation_block_runs`,
`automation_inbox_items`, and `data_source_reads`: keep no more than 30 days or the newest 10,000
rows. The implementation runs after startup migrations and then hourly, so deploying that policy can
irreversibly remove existing records immediately.

Those tables do not all contain the same kind of data. Workflow runs and block runs are operational
execution diagnostics. Inbox items are user-visible workflow output. Data-source reads are collected
product data and can be linked to Integritas proofs. Integritas history is an evidence record. Docker
and HTTP request logs are a separate operational stream.

A security limit should not decide the product meaning of these records. First decide which data is
needed, then minimize its contents, redact credentials at its boundaries, and apply a lifecycle that
matches its purpose. Applying one short retention window to every category risks silently deleting
valuable user data. Leaving every category unbounded can eventually exhaust a Raspberry Pi's disk.

## Decision

- Keep credential minimization, historical credential scrubbing, request-log redaction, and bounded
  Docker log rotation from ADR 0022. These controls remain necessary regardless of record lifetime.
- Keep the 30-day and 10,000-row retention limits for `automation_runs` and
  `automation_block_runs`. They are execution diagnostics. Continue to protect active executions,
  delete in 500-row batches, yield between batches, and drain each backlog in the same sweep.
- Treat visible `automation_inbox_items` as user content. Do not delete a visible item because of its
  age or the number of inbox rows. Once the user deletes an item, the bounded retention sweep may
  physically remove its soft-deleted row.
- Remove `data_source_reads` from automatic age- and row-based deletion until a separate product
  decision defines its lifecycle. That decision must consider per-source or installation-level
  configuration, export, proof-linked reads, storage quotas, and disk-usage warnings. This is a
  temporary preservation policy, not a claim that unbounded storage is sustainable.
- Keep Integritas history and proof records until explicit user deletion. They remain outside the
  automatic retention scheduler.
- Express the categories as explicit retention policy in code. Keep the generic repository and
  scheduler machinery available and tested so a later accepted policy can enable data-source
  retention deliberately. Do not comment out calls or add a hidden environment switch.
- Keep the retention indexes already added by ADR 0022. They are harmless while a category is
  disabled and remain useful if a later lifecycle policy enables bounded deletion.

This decision amends only the retention classification in ADR 0022. Its redaction, migration,
automation-budget, rate-limit, cooldown, and Docker log-rotation decisions remain accepted.

## Alternatives considered

- **Revert the complete ADR 0022 implementation.** Rejected because the redaction, credential
  migration, automation budgets, traffic limits, log rotation, and bounded cleanup mechanism solve
  independent security problems.
- **Comment out the current deletion calls.** Rejected because commented code drifts, has no enforced
  behavior, and makes later reactivation difficult to review. Explicit policy keeps disabled
  categories visible and testable.
- **Add an environment flag for the existing all-table policy.** Rejected because a hidden operator
  switch would permit irreversible deletion without a product-facing explanation of what is being
  retained.
- **Keep the shared 30-day and 10,000-row policy.** Rejected because it treats diagnostics and
  user-owned records as equivalent and can delete existing product data during the first startup
  sweep.
- **Declare data-source reads permanent.** Rejected as a final policy because storage is finite. The
  temporary preservation choice prevents silent loss while a complete lifecycle and storage-safety
  design is made.

## Consequences

- Deploying the revised scheduler will not silently delete existing data-source reads or visible
  inbox items.
- Workflow execution diagnostics remain bounded, and large historical backlogs still drain without
  a 500-rows-per-hour ceiling.
- User-deleted inbox items no longer remain indefinitely as soft-deleted database rows.
- Data-source storage can grow without bound until the follow-up lifecycle policy is implemented.
  Disk capacity therefore remains an explicit availability risk rather than being resolved through
  silent deletion.
- Existing retention code and tests need a focused policy correction; most of the ADR 0022
  implementation remains unchanged.

## Where this lives in code

- `backend/src/features/retention/retention.service.ts` — scheduled policy application and repeated
  bounded batches.
- `backend/src/features/retention/retention.repository.ts` — generic oldest-first deletion and active
  execution protection.
- `backend/src/db/database.ts` — retention indexes and historical source-credential scrub.
- `backend/src/features/automation/automationInbox.repository.ts` — visible and soft-deleted inbox
  item semantics.
- `docs/adr/0022-bound-external-automation-effects.md` — original layered hardening decision amended
  by this record.
- `docs/plans/security/705-retention-redaction-budgets.md` — task implementation plan to reconcile
  with this policy.
