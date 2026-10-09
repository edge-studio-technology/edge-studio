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

## Alternatives considered

- Increase the existing synchronous timeout: still leaves recovery dependent on the browser and does not resolve a disconnected request's outcome.
- Restart on “please restart” immediately: the observed version already exits and automatically relaunches; another restart can interrupt that recovery.
- Treat RPC reachability after timeout as successful resync: reachability does not establish completion of the requested rebuild.

## Consequences

A timeout warning can remain visible while observation continues. Some outcomes will remain unconfirmed. Initial budgets require revalidation in final QA and cannot establish outcomes by themselves. This evidence step adds no runtime behavior.

## Where this lives in code

- `backend/tests/fixtures/minima/resync-lifecycle.json`: captured envelopes.
- `backend/tests/features/minima/minima.parse.test.ts`: envelope parsing.
- `backend/tests/features/minima/minima.rpc.test.ts`: rejection and client-deadline boundaries.
- `backend/src/features/minima/minima-resync.service.ts`: planned worker, not implemented yet.
