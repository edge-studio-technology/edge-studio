# 0033: Observe Resync After Client Timeout

**Status:** Accepted
**Date:** 2026-10-09

## Context

#536 currently treats the 30-second Minima RPC deadline as resync failure. Disposable-node observations in [the lifecycle report](../qa/536-resync-lifecycle.md) establish that a client abort can leave the node rebuilding and closing databases. A quick successful resync returned the legacy “fininshed.. please restart” message but Docker automatically relaunched the process without another command. HTTP 200 can also contain an explicit RPC rejection.

The source and release Compose configurations reference different images. Cached AMD64 cases covered Core 1.1.2.4 and 1.0.49.4; the exact deployed ARM64 Core 1.1.2.6 image was then tested in a fresh disposable Pi container. Its throttled resync continued after a 30-second abort and naturally restarted about 141 seconds after dispatch. An AMD64 abort run took about 126 seconds from database-save logs to process relaunch.

## Decision

For the #536 worker, distinguish transport failure from explicit RPC rejection. After a dispatched request times out, retain uncertainty and observe; do not replay resync or force restart because of that timeout. Capture Docker restart baseline before dispatch and observe automatic cycles before considering another restart. Require completion evidence separately from subsequent RPC reachability.

Use separate initial observation budgets: five minutes for RPC response, five minutes for cycle observation after completion evidence or uncertain RPC timeout, and two minutes for readiness after a cycle. These give margin over the observed 141–147-second transfers, 126-second post-save process-exit delay, and 8–15-second RPC startup. They are operational bounds, not universal measured maxima. Expiry records uncertainty and never triggers replay or force restart. Observe Docker concurrently with RPC. Leave ADR 0001's ordinary restart policy unchanged.

After losing the completion envelope, cycle plus usable RPC establishes recovery but the resync outcome remains unconfirmed. Release reservation only after that reconciliation or definite rejection; otherwise preserve ownership. Operator recovery requires host diagnostics and confirmed cessation/completion before starting a stopped container. Do not add an in-app clear/force shortcut solely because a deadline expired.

Step 2 persists resync ownership separately from the legacy display marker. Restart/backup/restore hold an in-memory exclusion for the duration of pending work, because healthy status can clear their marker while I/O is still running. These exclusions prevent resync overlap without introducing the previously reverted generic operation-lock redesign. Other mutations remain outside this boundary.

Step 3 implements serial Docker observation every three seconds alongside the pending RPC, with the pre-dispatch baseline and deadlines persisted. A cycle observed before the RPC settles is retained, but terminal reconciliation waits for the response or its timeout; otherwise a quick recovered node could discard a completion response that is still in flight. Usable readiness requires transport/RPC success and a chain block. Stale or unknown block freshness is a warning, rather than invented evidence that resync failed.

A confirmed completion and Docker `exited` state permit one persisted idempotent start attempt. All measured versions naturally exit; no separate graceful-quit sequence is added for an unverified version. Start failure retains ownership, records its actual failure stage, and requires operator host recovery. There is no repeated automatic start. After an unconfirmed deadline, non-destructive reconciliation continues at a slower 30-second cadence so a delayed natural cycle or operator start can release ownership once usable readiness is observed. Stop all timers and invalidate pending callbacks at shutdown. Resume only observation at startup, mark an undispatched snapshot unconfirmed/released, and retain an explicitly unconfirmed legacy snapshot without baseline/deadline.

Lifecycle audits record initiation and changes to outcome/recovered/reservation, not every poll. Late recovery can therefore update an earlier unconfirmed audit without claiming resync success unless completion evidence exists. Automatic result messages update independently of the initiation cooldown; the latest automatic snapshot restores that timestamp at startup. Only the latest operation is persisted, so this is not a complete historical cooldown ledger when a later manual operation replaces it.

Step 4 removes browser parsing of completion text and the resync-triggered restart. A feature-local progress hook serially reads the persisted DTO, polls busy operations every three seconds (including failed/unconfirmed reservations), and polls idle state every 30 seconds to discover other callers without a shared polling-store rewrite. Status-summary changes and console responses prompt a lightweight read. Accepted DTOs invalidate older reads; older operation/observation timestamps cannot roll the display back. Unmount cancels timers and ignores pending callbacks.

The page notifies observed terminal transitions by operation ID/outcome/recovery/reservation, and does not notify an already-terminal snapshot on mount. This prevents replaying historic completion as a fresh result. Initiation transport errors and HTTP 5xx are uncertain, since a backend can have reserved/dispatched before the response is lost; read progress before another attempt. Progress-read errors preserve the last operation/events rather than changing its outcome. Busy reservations and unavailable progress gate conflicting controls; backend enforcement remains authoritative. Metric merging retains previous values/time but preserves current node state, RPC error and operation summary.

## Alternatives considered

- Increase the existing synchronous timeout: still leaves recovery dependent on the browser and does not resolve a disconnected request's outcome.
- Restart on “please restart” immediately: the observed version already exits and automatically relaunches; another restart can interrupt that recovery.
- Treat RPC reachability after timeout as successful resync: reachability does not establish completion of the requested rebuild.

## Consequences

A timeout warning can remain visible while observation continues. Some outcomes will remain unconfirmed. Initial budgets require revalidation in final QA and cannot establish outcomes by themselves. Steps 2–4 implement tracking, dispatch, process observation, recovery, startup reconciliation and browser progress. Final live worker/browser QA remains step 5. An unconfirmed terminal outcome may remain busy; API consumers must poll ownership as well as phase.

## Where this lives in code

- `backend/tests/fixtures/minima/resync-lifecycle.json`: captured envelopes.
- `backend/tests/features/minima/minima.parse.test.ts`: envelope parsing.
- `backend/tests/features/minima/minima.rpc.test.ts`: rejection and client-deadline boundaries.
- `backend/src/features/minima/minima-resync.service.ts`: persisted reservation, progress, asynchronous RPC dispatch, concurrent recovery observation, lifecycle audits and startup reconciliation.

- `frontend/src/features/minima/useMinimaResync.ts`, `MinimaResyncProgressPanel.tsx`, and `frontend/src/pages/MinimaPage.tsx`: persisted progress polling/presentation, accepted initiation and observed-transition notifications.
