# 0034: Observe Resync After Client Timeout

**Status:** Accepted
**Date:** 2026-10-09

## Context

Resync treated the 30-second Minima RPC deadline as failure. Disposable-node observations
([lifecycle report](../reports/536-resync-lifecycle.md)) showed that a client abort can leave the
node rebuilding and closing databases. A quick successful resync returned "fininshed.. please
restart", and Docker relaunched the process with no further command. HTTP 200 can also carry an
explicit RPC rejection.

Measured on Core 1.1.2.4 and 1.0.49.4 (AMD64) and the deployed 1.1.2.6 (ARM64): a throttled resync
continued after a 30-second abort and restarted naturally about 141 seconds after dispatch;
transfers took 141–147 s, post-save process exit about 126 s, RPC startup 8–15 s. Final Pi QA saw a
150-second response and 161-second natural recovery.

## Decision

- **Transport failure is not rejection.** After a dispatched request times out, keep the outcome
  uncertain and observe. Never replay resync or force a restart because of a timeout.
- **The backend owns recovery.** Before dispatch it persists a Docker restart baseline and
  deadlines, then observes serially every 3 s alongside the pending RPC. A cycle seen before the
  RPC settles is kept, but terminal reconciliation waits for the response or its timeout.
- **Budgets:** 5 minutes for the RPC response, 5 minutes for cycle observation after completion
  evidence or an uncertain timeout, 2 minutes for readiness after a cycle. They are operational
  bounds with margin over the measurements, not proven maxima. Expiry records uncertainty and
  continues non-destructive reconciliation every 30 s.
- **Evidence:** completed success needs completion evidence plus a cycle and usable RPC (transport
  success and a chain block). Cycle plus usable RPC without the completion envelope is
  "recovered, unconfirmed". Stale block freshness is a warning, not evidence of failure.
- **Ownership** is persisted separately from the legacy display marker and released only after
  reconciliation or definite rejection. Restart/backup/restore hold an in-memory exclusion against
  resync for their pending I/O; there is no generic operation lock.
- **One start attempt:** confirmed completion with an `exited` container permits one persisted,
  idempotent start. A failed start keeps ownership and needs operator host recovery.
- **Lifecycle:** startup resumes observation only; an undispatched snapshot becomes unconfirmed
  and released. Shutdown stops timers and invalidates callbacks. Audits record initiation and
  outcome/recovery/reservation changes, not every poll. Only the latest operation is persisted.
- **Browser:** reads the persisted progress DTO, polling serially every 3 s while busy (including
  failed/unconfirmed reservations) and 30 s when idle. It never parses completion text or sends a
  restart. Initiation transport errors and 5xx are treated as uncertain. Terminal notifications
  fire only on observed transitions, never for a snapshot already terminal on mount. Read errors
  keep the last observed progress.
- ADR 0001's ordinary restart policy is unchanged.

## Alternatives considered

- **A longer synchronous timeout.** Recovery still depends on the browser and a disconnected
  request's outcome stays unknown.
- **Restart on "please restart".** The node already exits and relaunches; another restart can
  interrupt recovery.
- **Treat RPC reachability after a timeout as success.** Reachability doesn't prove the rebuild
  completed.
- **An in-app clear/force shortcut when a deadline expires.** Recovery needs host diagnostics and
  confirmed cessation first.

## Consequences

- A timeout warning can stay visible while observation continues, and some outcomes stay
  unconfirmed.
- A terminal but unconfirmed operation may still hold its reservation; API consumers must check
  ownership as well as phase.
- Only the latest operation is persisted, so it isn't a full cooldown history when a later manual
  operation replaces an automatic one.
