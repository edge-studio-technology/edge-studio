# Improve Minima Resync Status Feedback and Expose Progress Logs Plan

**Status:** Proposed — audit complete; implementation not started

**Created:** 2026-10-09

**Ticket:** [OpenProject #536](https://openproject.privateprivate.org/work_packages/536), Bug, In progress; parent #307 Node Management; related spike #212

**Audited baseline:** `620bef8c`, branch `bug/536-improve-minima-resync-status-feedback-and-expose-progress-logs`

**Goal:** Make resync feedback reflect the observed operation outcome, with backend-owned recovery and concise progress events that remain visible after navigation or reload.

## Progress

- [ ] 1. Capture the supported node's resync lifecycle and add regression fixtures.
- [ ] 2. Implement backend resync tracking, asynchronous initiation, and bounded progress persistence.
- [ ] 3. Implement backend recovery and route every supported resync caller through it.
- [ ] 4. Connect the Minima UI to operation state and add the progress panel.
- [ ] 5. Cover ambiguous outcomes, recovery, conflicts, and existing consumers with regression tests.
- [ ] Docs.
- [ ] Verification, including live disposable-node and browser checks.

## Context and agreed scope

#536 reports an error toast while a resync continues and eventually succeeds, originally on Edge Studio v0.38.13. The ticket requires starting, in-progress, failed, recovering, and completed feedback, plus an explanation of recovery after an error. On 2026-10-09 the user selected **concise resync events**, rather than a raw Minima container-log viewer.

The implementation scope is manual resync and the existing console/optional stall-poller callers of the same service. Include a small timestamped progress panel and the safeguards needed to keep that resync's state truthful. Raw log streaming, a generic background-job framework, a shared frontend status store, and the automatic 48-hour maintenance cycle are outside this plan. Workflow/payment queueing policy belongs to #212/#307; #212's 2026-10-02 comment requests FIFO queueing and status polling for that broader workstream.

The current ticket description contains “Fix verified” and “Relevant regression testing completed” under Testing. These are not evidence of completion: the ticket is still In progress, its September audit says the bug remains, and the current code retains the failure path. The audit below is static plus focused local tests; no real node was resynced during planning.

## Codebase audit: what we can work from

Paths in this document are relative to the repository root.

| Existing area | Reusable implementation | Gap relevant to #536 |
| --- | --- | --- |
| `backend/src/features/minima/minima.service.ts` | `resyncMegammr()`, configured MegaMMR host, `getMinimaNodeStatus()`, graceful restart implementation | Resync awaits `runMinimaPathCommand(command, 30000)` and clears the busy marker on any thrown error. It does not monitor completion or own resync recovery. |
| `backend/src/features/minima/minima.rpc.ts`, `backend/src/shared/http.ts` | Encoded path commands, request deadlines, command/payload redaction | A timeout aborts our HTTP request; this code has no evidence that the node cancelled the already-dispatched action. HTTP `ok` also does not establish the RPC envelope's `status: true`. |
| `backend/src/features/minima/minima.parse.ts` | `parseMegammrResyncMessage()` understands `status`, a restart mention, and `finish`/the legacy `fininshed` spelling | The backend resync route checks transport `result.ok` only. The frontend repeats the parser and supplies lifecycle decisions. No parser output establishes that the restarted node is ready. |
| `backend/src/features/minima/minima-monitoring.ts` | Stall/cooldown monitoring; legacy restart/resync/backup/restore busy marker | Only an in-memory `{type, startedAt}` exists. There is no exposed operation ID, phase, outcome, error history, or event list. `beginMinimaOperation()` overwrites any prior operation; the marker expires after six minutes. |
| `minima.service.ts`: `applyOperationOverride()` | Existing `restarting` compatibility state used by other screens | Any healthy running status clears the busy marker, even if resync was just dispatched and has not completed. Offline operations all appear as `restarting`, regardless of type. |
| `backend/src/features/status/docker.control.ts`, `docker.service.ts` | Compose-service lookup, `inspectContainer()`, baseline `RestartCount`/`StartedAt`, `waitForContainerRestart()`, idempotent start | A baseline can identify a real container cycle. A cycle alone cannot prove successful resync. `restartMinimaContainer()` sends `quit compact:true` and eventually forces restart; calling that blindly during resync risks interrupting it. |
| `docker-compose.yml`, `docs/adr/0001-minima-graceful-node-restart.md` | `restart: unless-stopped`; documented graceful restart behavior | ADR 0001 verifies ordinary quit/restart behavior, not the resync lifecycle. #212 still leaves resync process exit and automatic relaunch unverified. Neither the five-minute graceful timeout nor six-minute marker is a measured resync deadline. |
| `backend/src/features/minima/minima.routes.ts` | Admin-gated POST resync, authenticated GET status, shared structured HTTP errors | POST stays open for the node RPC; throws become 502. No resync-operation read endpoint or dedicated resync audit event exists. |
| `backend/src/features/minima/minima-poll.service.ts` | Existing optional auto-resync caller, stall detection, cooldown | Awaits the same RPC and records its message as completion; does not restart/recover the node. Acceptance must no longer count as completion when this service becomes asynchronous. |
| `backend/src/features/minima/minima-console.service.ts` | Whitelisted resync dispatch already calls `resyncMegammr()` | Its response and tests must change with the service contract; resync initiated here needs the same progress/recovery as the button. |
| `backend/src/features/settings/settings.repository.ts` | Existing SQLite key/value persistence | A bounded latest-operation snapshot can use this store without a new migration or an unbounded operation-history table. |
| `frontend/src/pages/MinimaPage.tsx` | Resync/restart controls, toasts, existing layout | `runResync()` shows failure on any rejection, interprets the RPC message, and calls restart from the browser. Normal polling is disabled while busy. `refreshAfterOperation()` stops after 90 seconds and treats any `rpc.ok` as recovery; its result is ignored in the resync cleanup path. Closing the page removes the browser-owned continuation. |
| `frontend/src/features/minima/useMinimaStatusRefresh.ts` | Serial refresh loop; ordinary 30-second and restarting 3-second cadence | Fast polling depends only on node state, not a resync operation; no durable operation is read on page mount. |
| `frontend/src/features/minima/mergeMinimaStatus.ts` | Last-known metrics preservation | On a failed RPC it can replace a new stopped/restarting state with the prior running state and suppress the error. New operation state must retain precedence over this display merge. |
| `MinimaSummaryGrid.tsx`, `MinimaHealthCard.tsx`, `MinimaBackupPanel.tsx`, `frontend/src/app/types.ts` | Status cards, Resync button, existing node-state types and disabled controls | Resync feedback depends on local `resyncing`, with most metrics replaced by loading indicators. Backup/restore controls depend on node state and can remain enabled while the page alone is busy. |
| `frontend/src/features/minima/MinimaConsolePanel.tsx` | Whitelisted RPC input and response display | This is a command-response console, not a progress feed. The catalog's `logs` command enables subsystem logging; there is no existing container-log API to reuse. |

There is a previously reverted Minima operation-lock/status redesign in repository history (`d6973154`, reverted by `60acf9b0`; recorded in `docs/TASKS.md`). Start from the current behavior and add narrowly tested resync ownership. Do not restore that redesign wholesale.

### Confirmed code path versus unresolved runtime cause

The code path is confirmed: an RPC deadline/disconnect can become a rejected POST and an immediate “Megammr resync failed” toast, while recovery polling continues. The operation is also cleared on that rejection. This directly permits the contradictory feedback in the report.

The actual cause on Barry's node is not confirmed. We have no captured Core version, RPC response, timings, or logs from that resync. #212 describes chain rebuild followed by shutdown but has no completed live resync test. Increasing the RPC timeout alone would leave browser-owned restart, premature completion, and absent progress unresolved.

## 1. Establish lifecycle evidence and regression fixtures

Use a disposable node on the deployed image/version. Capture the image digest and Core version, exact RPC envelope, elapsed time, status availability during resync, container identity/`RestartCount`/`StartedAt`, process exit, automatic relaunch, and subsequent chain health. Exercise a quick successful resync, one exceeding 30 seconds, and an unavailable MegaMMR host.

Verify whether aborting the client RPC leaves resync running. Capture completion/rejection message variants, including legacy spelling. Determine what evidence remains available after an RPC disconnect and whether there is a supported read-only resync-status command on this version.

Use those observations to select separate RPC-response, shutdown, and recovery deadlines. Preserve ADR 0001's restart timing for ordinary restart; do not substitute it for measured resync timing. Record verified timing and recovery choices through the `adr` skill before embedding them in implementation.

Add captured non-secret envelopes to parser/RPC tests and a failing regression test for timeout followed by successful recovery. This evidence checkpoint can reuse #212's resync investigation without waiting for its broader workflow policy.

## 2. Track and initiate resync in the backend

Add a small feature-local `backend/src/features/minima/minima-resync.service.ts` and keep `minima.service.ts`'s public resync entry as the common wrapper. Avoid circular imports: the resync worker should use RPC/Docker primitives, not call a service that imports it back.

Persist the latest resync under one private settings key, proposed `minima_resync_operation`. Store an operation ID, trigger (`manual`, `console`, `auto`), phase, timestamps, configured host, bounded event list, observed outcome, and structured error/warning details. Keep Docker baseline/worker metadata internal. Retain at most 100 concise events; record transitions and meaningful observation changes rather than every poll. Redact error/context strings through the existing shared boundary before persistence and presentation.

Expose a purpose-built DTO with `id`, `phase`, `startedAt`, `updatedAt`, `finishedAt`, `outcome`, `recovered`, `message`, `events`, and `errorDetails`. Suggested phases:

| Phase | Meaning |
| --- | --- |
| `starting` | Edge Studio reserved the operation and is dispatching the request; upstream acceptance is not yet confirmed. |
| `in_progress` | Evidence indicates the node is processing resync. |
| `recovering` | RPC outcome is uncertain, or resync has reached shutdown/restart and the backend is checking node recovery. Include a specific reason. |
| `completed` | Resync completion evidence and subsequent usable node status are observed. Preserve `recovered: true` and prior warnings if transport/recovery trouble occurred. |
| `failed` | The node explicitly rejected/failed the resync, or an observed recovery action failed. Keep the actual failure stage visible. |
| `unconfirmed` | The observation deadline elapsed without enough evidence to determine the resync outcome. Report “Could not confirm resync outcome,” with the current node condition separately. |

The extra `unconfirmed` outcome prevents an ambiguous timeout from becoming either a fabricated failure or a fabricated success. RPC reachability, a container cycle, and an advancing recent block each have distinct meanings; none independently proves that the requested rebuild succeeded.

Change `POST /api/minima/megammrsync/resync` to return HTTP 202 with the operation DTO once the backend has reserved/scheduled the work. The UI should say “Resync starting,” not claim upstream acceptance or completion at that point. Add admin-gated `GET /api/minima/resync` returning the latest snapshot or null, independent of node RPC availability. Add a compact optional operation summary to `GET /api/minima/status` for existing consumers; preserve the existing node-state enum.

Reject a duplicate/conflicting start with structured 409 without issuing another RPC. Add a narrow resync reservation checked by restart, backup, and restore entry points, and refuse resync while one of those operations is active. A healthy status read and the legacy six-minute expiry must not clear that reservation. Release by operation ID only; old callbacks must not finish or overwrite a newer operation. Keep broader wallet/console mutation coordination and FIFO queues in #307.

## 3. Own recovery and caller integration in the backend

Capture the container baseline before dispatch. Run RPC and observation work in a handled background task. Separate explicit HTTP/RPC rejection from timeout/socket closure after dispatch. On the latter, record the uncertainty and continue observing without clearing the reservation or replaying resync.

Use `parseMegammrResyncMessage()` on the backend. When completion/shutdown evidence exists, observe Docker's natural restart first. If the container is stopped after a confirmed completion, use idempotent `startComposeService("minima")`. If the supported version requires a separate restart after completion, invoke the existing graceful sequence internally under the same resync ownership. Do not invoke `quit`, force restart, or a second resync just because the RPC response timed out.

After a cycle/start, check usable RPC and the observed chain condition before declaring completion. Retain a completion warning if the node is online but still stale or catching up. If the request's outcome remains unknowable, show node recovery separately and finish as `unconfirmed`. Timeout/restart evidence must never silently become “Resync complete.”

For `unconfirmed`, stop automatic destructive retries and surface an explicit operator action/check. Retain the reservation while evidence still suggests work is running; release only after reconciliation establishes that it has stopped or completed. Ordinary monitoring failure must not silently re-enable another resync. Establish the exact manual recovery path at the lifecycle checkpoint, keeping the existing confirmed restart flow and its failure handling usable.

Update all common callers:

- Manual route and console receive the accepted operation DTO; console whitelist behavior remains intact.
- Stall poller starts the operation and records cooldown at initiation; it records terminal completion/failure separately. A skipped conflict does not consume cooldown or become “auto-resync failed.” Suppress another automatic start while the resync remains active/uncertain.
- Pass trigger/user metadata for a dedicated start audit event; record the terminal result without adding an audit row on every poll.
- In `backend/src/startup.ts`, reconcile a persisted nonterminal operation after migrations and before starting the health poller. Resume observation only; never replay a dispatched RPC on backend restart. Stop timers at shutdown. If evidence cannot reconstruct the outcome, preserve an explicit unconfirmed result.

## 4. Show authoritative operation state and concise events

Update `frontend/src/app/types.ts` and `minimaApi.ts` for the accepted DTO/read endpoint. Remove browser-owned message parsing and resync-triggered restart from `MinimaPage.runResync()`; keep the independent manual restart confirmation flow.

Read the latest operation on mount and poll its lightweight endpoint serially while nonterminal, using the existing three-second fast cadence as a starting point. Keep ordinary node-status refresh active. Navigation/reload must show the same operation and must not issue another command. Deduplicate terminal notifications by operation ID/transition within the mounted page; do not replay an old completion toast merely because the page loaded.

Add feature-local `frontend/src/features/minima/MinimaResyncProgressPanel.tsx` using existing `Card`, `Disclosure`, `Pill`, `ScrollArea`, time formatting, and error-detail patterns. Show the phase, elapsed time, last observation time, and a small timestamped event list. Use concrete copy such as “Resync requested,” “RPC response timed out; checking node progress,” “Node restarted; checking chain health,” and “Resync completed; connection recovered.” No invented percentage or ETA.

Keep events visible after completion/failure, including the warning that preceded recovery. A progress-read failure should preserve the last known operation/events and offer retry; it must not change the operation to failed. Render loading/empty/error states by existing frontend conventions.

Update summary/health presentation so operation phase has precedence over local busy flags, last-known metric merges, and the generic `restarting` label. Keep metrics clearly marked as last observed when unavailable. Pass operation busy state to backup/restore and supported resync/restart controls; backend checks remain authoritative across tabs. Preserve Wallet/Dashboard offline behavior and verify recovery when a resync was initiated elsewhere. No shared frontend polling-store rewrite.

## 5. Regression coverage

Extend existing suites and add one mirrored test file for each new feature-local module. Mock at the owned RPC/Docker I/O boundary; use fake timers for worker deadlines and controlled promises for UI transitions.

- Start returns 202 before slow RPC finishes; a healthy pre-resync status does not end the operation.
- HTTP failure and HTTP 200 with RPC `status: false` are explicit failures with useful structured detail.
- RPC exceeds 30 seconds, or closes during shutdown, then recovers: no false error toast, no duplicate resync/force restart, and the warning remains in events.
- Confirmed completion plus automatic cycle: no additional restart; stopped container: one idempotent start; confirmed restart-required variant: one backend-owned recovery sequence.
- Healthy RPC before any cycle does not prove completion; ambiguous transport followed by healthy status is represented honestly.
- Node remains unavailable/stale, Docker fails, monitoring deadline elapses, and late results arrive: correct phase/outcome and no overwriting a newer operation.
- Duplicate clicks, another tab, console, poller, backup, and restore: reservation prevents conflicting dispatch; skipped automatic attempts preserve cooldown.
- Page navigation/reload and backend restart: operation/event persistence, observation resumes, command never replays.
- Bounded events, redaction, authenticated reads, admin-only mutations, and structured 409 responses.
- Page renders each required phase, explicit recovery, retained diagnostics, and unconfirmed outcome; progress-fetch errors do not fabricate terminal failures.
- `mergeMinimaStatus()` preserves operation state; ordinary restart, backup/restore, dashboard balance, Wallet recovery, and #206 local-contact initialization remain functional.

Existing tests are useful infrastructure, but currently pin the old behavior: `minima.service.test.ts` asserts the 30-second timeout, `minima-monitoring.test.ts` asserts marker expiry, `minimaResync.test.ts` tests synchronous toast mapping, and `MinimaPage.test.tsx` has no resync action test. Update those contracts deliberately rather than retaining tests for the removed browser continuation.

## Docs

- `README.md`: asynchronous resync API, progress panel, expected downtime and recovery semantics.
- `CHANGELOG.md`: concise user-facing fix under this branch's Unreleased section when behavior is implemented.
- `SECURITY.md` and applicable risk-register entry: persisted diagnostic redaction, operation reservation boundaries, and any changed automatic recovery behavior.
- ADR: measured lifecycle, timing, outcome-evidence rules, and recovery choices; preserve ADR 0001's ordinary restart decision.
- Minima project rules and their `.claude`/`.cursor` counterparts: update lifecycle guidance only when implemented.
- `docs/qa/gaps.md`: reconcile MINIMA-02 and MINIMA-08 after verification; cross-reference #212/#307 work that remains.
- This plan, `docs/TASKS.md`, and `docs/SESSION.md`: track actual implementation/verification progress. Reconcile #536 only after the fix and regression evidence exist.

## Verification

### Audit baseline already run

On 2026-10-09, 127 focused existing tests passed:

- Backend: 79 tests across service, monitoring, RPC, poller, and console-service suites; 8 route tests passed on rerun.
- Frontend: 40 tests across MinimaPage, resync helpers, status-refresh hook, status merge, and summary grid.

The route suite initially failed because sandbox permissions blocked Supertest's local listener (`listen EPERM`); the same 8 tests passed with the listener permitted. No application change was needed. Full coverage/build/Compose checks and live Pi/browser resync were not run for this planning-only change.

### Implementation checks

Run focused new/changed suites, plus backup/restore, Docker control, API auth smoke, Wallet/Dashboard, and local-contact recovery regressions. Then run:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
docker compose build backend frontend
git diff --check
git status --short --untracked-files=all
```

Use a disposable node for the final live checks: fast/slow resync, host rejection, natural restart, unavailable node, page closed midway, reload/second tab, and backend restart while observing. Confirm no false failure, no false completion, one command dispatch, visible recovery history, and normal node-dependent UI after recovery. Record image/Core version and timings in the QA evidence. An existing operator node is not needed for the initial fixtures or local development.

## Remaining inputs for implementation

The events-only UI scope is agreed. Live lifecycle evidence, resync deadlines, and the exact outcome-confirmation/manual-recovery rules remain the first checkpoint. No deployment or real-node mutation was performed or required to complete this audit and plan.
