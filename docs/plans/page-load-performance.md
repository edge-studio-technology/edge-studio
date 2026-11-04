# Page Load Performance Plan

**Status:** In progress
**Created:** 2026-11-03
**Goal:** Remove measured Docker-sampling delays from node readiness and retain recent page data without weakening mutation or session boundaries.

## Progress

- [x] Separate current container state from asynchronous, shared resource telemetry.
- [x] Retain bounded, session-scoped read snapshots across navigation with mutation invalidation.
- [x] Initialize Dashboard, Minima and Wallet from snapshots and defer collapsed Minima panels.
- [x] Verify cache expiry, errors, late responses, authentication isolation and operation refreshes.
- [ ] Remeasure candidate backend read paths on the Pi without replacing running services; the attempt stopped at noninteractive sudo authentication before candidate files were written.
- [x] Docs and required local checks; all frontend tests passed, with the existing backend restore-test failure and unavailable Docker daemon recorded in SESSION.

## Backend changes

Use fresh lightweight Docker container state in `minima.docker.ts`. Share normal two-sample CPU telemetry in `docker.service.ts`; cold/stale telemetry refreshes asynchronously for readiness reads. Keep resource timestamps and a pending indicator, and eliminate duplicate sequential collection in status overview.

## Frontend changes

Keep existing page pollers and restart/resync behavior. Cache only explicitly selected read URLs for 30 seconds, with shorter reuse while operations/telemetry are pending. Bound cache entries, retain snapshots during background reads, invalidate before/after mutations and on auth changes, and reject stale cache writes. Initialize page-local display state from snapshots. Load Minima settings/backups only after opening their disclosure.

## Context

Three Pi samples showed approximately 11 ms Minima RPC, 2 s app node/Dashboard reads and 4 s overview reads. Docker two-sample telemetry dominates. One-shot returned quickly but must not silently compromise CPU-delta correctness. An earlier broad shared-polling rewrite regressed UX; this change retains the existing pollers.

## Docs

Record the measured tradeoff in an ADR, update README/SECURITY/CHANGELOG and reconcile SESSION/TASKS.

## Verification

Run focused backend/frontend regressions, full required checks/builds and Compose validation. Compare candidate read-path timings with the existing Pi baseline using an isolated diagnostic process; no production deployment or restart is required for that comparison.
