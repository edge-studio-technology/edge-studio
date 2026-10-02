# 0028: Raise the Workflow Run Budget to 1,000 Runs per Hour

**Status:** Accepted
**Date:** 2026-10-02

## Context

ADR 0022 caps every workflow at 10 runs per rolling hour that reach a privileged block
(`send_transaction`, `control_output`, `capture_camera`, `stamp_integritas`). The value 10 was not
derived from measured usage.

In internal use, ordinary workflows exhaust that budget. A workflow that pulses an output or stamps
on every webhook, MQTT, or GPIO event fails with `WORKFLOW_RUN_BUDGET_EXHAUSTED` after ten events in
an hour. No usage data yet establishes what the right ceiling is.

The budget has not been released.

## Decision

- Raise `WORKFLOW_RUN_BUDGET_MAX_RUNS` from 10 to 1,000 for every privileged block type. This is an
  interim ceiling until usage data supports a measured value.
- Keep the rest of the ADR 0022 mechanism unchanged: the one-hour rolling window, the persisted
  SQLite ledger, one reservation per run, application to every trigger type, the privileged block
  set, and no operator configuration.
- Keep the transaction cooldown rule unchanged.

This decision amends only the budget value in ADR 0022.

## Alternatives considered

- **Keep 10.** Rejected because it blocks normal event-driven workflows.
- **Per-block-type budgets**, for example a lower cap for payments than for device outputs.
  Deferred because no usage data shows where each limit should sit. Revisit together with the
  measured ceiling.
- **Operator-configurable budget.** Rejected for the same reason ADR 0022 gives: workflow or
  environment configuration could weaken a security boundary.
- **Remove the budget.** Rejected because MQTT and GPIO triggers would then have no durable bound
  on repeated effects.

## Consequences

- A leaked webhook token or a hostile MQTT publisher can cause up to 1,000 payments, device outputs,
  camera captures, or Integritas stamps per hour per workflow, instead of 10.
- Automation stamps bypass the HTTP stamp limiter, so a single workflow can consume up to 1,000
  Integritas stamps of external quota per hour.
- Workflow runs and block runs are preserved (ADR 0026), so a workflow running near the cap grows
  run history and camera media on the SD card faster.
- Webhook ingestion (60 requests per minute per client and source) and manual runs (30 per minute)
  still allow more than 1,000 runs per hour, so the budget remains the binding limit.

## Where this lives in code

- `backend/src/features/automation/automation.policy.ts` — `WORKFLOW_RUN_BUDGET_MAX_RUNS`.
- `docs/adr/0022-bound-external-automation-effects.md` — budget value amended by this record.
