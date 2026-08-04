# 0001: Graceful Minima Node Restart

**Status:** Accepted
**Date:** 2026-07-31

## Context

`POST /api/minima/restart` previously just called `restartComposeService("minima")` — a bare
Docker `/restart?t=10` (SIGTERM, 10s grace, then SIGKILL). That's a hard stop against a live
JVM holding open the wallet/chain database, with real corruption risk. Minima has a `quit`
RPC command (`quit compact:true`) that lets the node close cleanly and compact on the way out,
so the goal was: try that first, only force-stop if it doesn't work.

Verified against the actual running Minima node behind this stack, not just docs:

- `quit compact:true` can return `{"status":true,"message":"Shutdown complete"}` (HTTP 200)
  well before the process actually exits — observed exits ranging from under a second to
  several seconds later, and in one run, no exit within 30 seconds despite that response. The
  RPC response is not a reliable synchronous shutdown confirmation.
- `minima`'s compose service runs with `restart: unless-stopped`. That policy — not our own
  code — is what relaunches the container once the process exits, and it does so faster (often
  well under a second) than an RPC round trip completes, let alone a poll loop.
- First implementation attempt polled Docker's container list for a transient `state !==
  "running"`. Testing showed this doesn't work in practice: by the time the code finished
  waiting on the (hanging) RPC call, the container had typically already exited *and* been
  relaunched by the restart policy, so every subsequent poll saw `"running"` and the code
  always fell through to the forceful fallback — the graceful path never actually engaged.

## Decision

- Detect a real restart cycle by comparing the container's Docker-reported `RestartCount` and
  `State.StartedAt` (`docker.control.ts`'s `getContainerRestartBaseline` /
  `waitForContainerRestart`) against a baseline captured *before* sending `quit`, instead of
  watching for a transient state. This makes detection level-triggered: it doesn't matter
  whether the cycle happens before, during, or after polling starts.
- Wait up to 5 minutes (`MINIMA_GRACEFUL_SHUTDOWN_TIMEOUT_MS`, `minima.service.ts`) before
  falling back to the existing forceful restart (`restartComposeService`). A short timeout is
  actively counterproductive here: forcing SIGTERM/SIGKILL while the node is still legitimately
  mid-shutdown/compacting is the same corruption risk `quit compact:true` exists to avoid. The
  fallback should only ever fire for a node that's truly wedged, not one still closing cleanly.
- Once a cycle is confirmed, call Docker's `start` explicitly (tolerating `304 Not Modified`).
  This is a cheap, idempotent confirmation, not what actually brings the node back up —
  `unless-stopped` has typically already done that by this point.
- Raised `MINIMA_OPERATION_MAX_WINDOW_MS` (`minima-monitoring.ts`, 2 min → 6 min) so the
  "restarting" state shown in the UI covers the full worst-case wait instead of reverting to
  "error"/"stopped" mid-operation and then flipping back once the backend finishes.
- The whole quit → wait → confirm-or-force sequence runs in the background; `POST
  /api/minima/restart` still responds immediately with `{ state: "restarting" }`, unchanged.

## Alternatives considered

- **Poll for a transient "not running" container state.** The first implementation. Rejected
  — verified it doesn't work in practice; see Context.
- **No forceful fallback, wait indefinitely.** Considered so a slow-but-legitimate shutdown is
  never interrupted. Rejected: a genuinely wedged node (`quit` accepted, process never exits)
  would leave the restart button permanently non-functional, with no in-app recovery path short
  of SSH/manual `docker restart`.
- **Keep the original 30-second fallback.** Rejected once real timing data showed 30s is
  frequently *shorter* than a legitimate compact, making the forceful fallback the common case
  instead of the rare one — the opposite of the intended behavior.

## Consequences

- A node that's slow to shut down gets up to 5 minutes to do so cleanly before anything forces
  it. The restart action can occasionally take much longer to resolve than before, both in the
  background and in how long the UI shows "restarting."
- The 5-minute/6-minute figures are calibrated to the observed inconsistency in `quit
  compact:true`'s shutdown timing on the currently pinned `minimaglobal/minimacore` image, not
  a documented Minima guarantee. That inconsistency is worth reporting to whoever maintains the
  Minima node — this decision works around it, it doesn't fix it.
- If `quit` truly never terminates the process, the node gets forcefully restarted after 5
  minutes regardless — an explicit product tradeoff: give it time to shut down cleanly, but
  beyond that, force it even if something ends up corrupted.

## Where this lives in code

- `backend/src/features/minima/minima.service.ts` — `restartMinimaContainer`,
  `performGracefulRestart`, `MINIMA_GRACEFUL_SHUTDOWN_TIMEOUT_MS`.
- `backend/src/features/status/docker.control.ts` — `getContainerRestartBaseline`,
  `waitForContainerRestart`, `startComposeService`.
- `backend/src/features/status/docker.service.ts` — `inspectContainer`.
- `backend/src/features/minima/minima-monitoring.ts` — `MINIMA_OPERATION_MAX_WINDOW_MS`.
