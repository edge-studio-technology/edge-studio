# Node Failure Mode Unit Testing Plan

**Status:** Complete — implementation and final verification passed (2026-09-28)
**Created:** 2026-09-28  
**Goal:** Close OpenProject #259 by pinning Minima stopped, exited, error, restart, and restart-failure behavior with focused frontend and backend tests, fixing only the runtime gaps those tests expose.

## Context

OpenProject **#259 Node Failure Mode Unit Testing** is an in-progress Dev Task under *Node Management*. It is the final open section carried forward from `docs/plans/legacy-ticket-unit-test-gaps.md` after #363 was completed separately. This plan is the branch-level execution plan for `dev-task/259-node-failure-mode-unit-testing`.

The ticket was re-audited on 2026-09-28 against commit `1eb4ebd`. The existing targeted suites pass (`17` frontend tests across the three named files and `7` backend route tests), but they do not exercise the ticket's failure modes.

| Ticket requirement | Current codebase | Planned resolution |
|---|---|---|
| Container `stopped` / `exited` / `error` cases | `MinimaContainerCard.test.tsx` covers `running`, null, refreshing, and restart-button behavior only. The component capitalizes any container state but has no state-specific styling branch. | Add table-driven assertions for the rendered `Stopped`, `Exited`, and `Error` copy. Do not invent a new visual treatment solely to satisfy the ticket's stale “styling” wording. |
| Dashboard node-state pill mapping | `deviceNodeStatus()` already maps `stopped` to warning and `error` to error, but tests cover only `running` and `restarting`. | Add stopped/error cases that assert the visible label and `MetricCard` status class. |
| Restart disable/re-enable cycle | `MinimaPage.test.tsx` now exists, contrary to the ticket's original premise, but contains only one first-load error test. | Extend the existing page test with a real restart-confirm flow and controlled restart/status promises. |
| Restart failure toast | `restartContainer()` emits the error toast and rethrows; the direct `confirmRestart()` caller does not catch that rejection. | Add the toast test and contain the already-reported rejection in the direct confirm handler. Preserve rethrowing inside `restartContainer()` so resync callers still receive failures. |
| Restart route failure response | `POST /api/minima/restart` returns a structured 502, but `minima.routes.test.ts` has no restart cases. | Mock the service rejection and assert the route's normalized, structured response contract. |
| Dashboard degradation for stopped/error | `DashboardDevices` skips wallet RPC only for `restarting`; it still calls `getWalletStatus()` for `stopped` and `error`. | Treat those two offline states as wallet-unavailable, skip the wallet request, and keep the ordinary 30-second status cadence; only `restarting` retains the fast 3-second poll. |

This remains a narrow regression task. It does not redesign Minima status presentation, add new node states, change backend restart semantics, or refactor the polling architecture.

## Frontend Changes

### 1. Pin container failure-state copy

- File: `frontend/tests/features/minima/MinimaContainerCard.test.tsx`.
- Add a table-driven test for container states `stopped`, `exited`, and `error`.
- Assert that the State cell renders `Stopped`, `Exited`, and `Error` respectively while the supplied runtime text remains visible.
- Keep this test focused on the current public rendering contract. The component has never had state-specific styling in the audited history, so no source or shared-design-system change is justified by this test-only ticket wording.

### 2. Pin dashboard status tones and offline wallet behavior

- Files:
  - `frontend/src/features/dashboard/DashboardDevices.tsx`
  - `frontend/tests/features/dashboard/DashboardDevices.test.tsx`
- Add stopped/error cases using the existing `deviceStatus()` fixture.
- For `stopped`, assert the node label is `Stopped` and the node value uses `text-text-warning`.
- For `error`, assert the node label is `Error` and the node value uses `text-text-error`.
- In both cases, assert the wallet card settles on `Unavailable` and `getWalletStatus()` is not called.
- Update the polling branch so `stopped` and `error`, like `restarting`, clear stale wallet data and return before wallet RPC. Schedule their next status check at `DASHBOARD_POLL_INTERVAL_MS`; retain `STATUS_RESTARTING_INTERVAL_MS` only for `restarting`.
- Leave device CPU, memory, disk, hostname, and Integritas metrics visible because they come from the device-status response and are not dependent on Minima RPC.

### 3. Cover the page-owned restart lifecycle

- Files:
  - `frontend/src/pages/MinimaPage.tsx`
  - `frontend/tests/pages/MinimaPage.test.tsx`
- Extend the `useMinimaStatusRefresh` mock to capture both status and error callbacks so tests can move the page into a known running state.
- Mock `restartMinimaContainer()` and `getMinimaNodeStatus()` at the `minimaApi` module boundary; continue mocking the heavy child panels.
- Make the mocked `MinimaContainerCard` render a minimal Restart button wired to its real `onRestart` and `busy` props, so the test exercises `MinimaPage` state rather than manually rerendering a child.
- Success case:
  1. Deliver an initial running status.
  2. Open the restart confirmation and confirm it.
  3. Hold the restart request/status refresh with controlled promises and assert the page-owned Restart control becomes disabled immediately.
  4. Resolve the restart request and then a healthy status (`rpc.ok: true`).
  5. Assert the control is re-enabled and the completion path settles.
- Failure case: reject `restartMinimaContainer()`, let the follow-up status request resolve so the operation settles, and assert the `Minima restart failed` toast includes the API error message.
- Add a no-op catch in the direct `confirmRestart()` path because `restartContainer()` has already shown the failure toast. Do not remove `restartContainer()`'s rethrow, which is required by the resync path's outer error handling.
- Use controlled promises instead of fake-timer advancement where possible; no test should wait through the real 3-second/90-second polling window.

## Backend Changes

### 4. Cover the restart route's structured failure response

- File: `backend/tests/features/minima/minima.routes.test.ts`.
- Add a hoisted `restartMinimaContainer` mock while preserving the real exports from `minima.service.ts`, so the existing route-test harness and unrelated Minima behavior remain intact.
- Reset the mock in the existing `beforeEach()` and reject it with a network-shaped error such as `fetch failed`.
- Send an authenticated `POST /api/minima/restart` request and assert:
  - HTTP `502`;
  - top-level `ok: false`;
  - normalized `error: "Minima RPC is temporarily unreachable"`;
  - `errorDetails.domain: "system"` and `errorDetails.type: "dependency_unavailable"`;
  - the structured message matches the normalized public error contract.
- Keep route production code unchanged unless the test exposes a mismatch with the existing shared `dependencyUnavailable()` contract.

## Ticket And Documentation Reconciliation

- `docs/plans/legacy-ticket-unit-test-gaps.md`: mark the Node Failure Mode Testing section complete and link this focused plan once implementation and verification pass.
- `docs/TASKS.md`: move the #259 item from `Next` to `Done` during implementation wrap-up; the current `Next` entry now links this plan.
- `docs/SESSION.md`: record the tests added, the two small runtime fixes, commands run, and any skipped checks.
- `CHANGELOG.md`: add a `Fixed` entry under `## [Unreleased] dev-task/259-node-failure-mode-unit-testing` for the Dashboard no longer requesting/showing wallet data while the Minima node is stopped or errored. Do not add changelog detail for test-only additions.
- `README.md`, `SECURITY.md`, Docker/configuration docs: no changes expected because the API, configuration, deployment, and security boundaries do not change.
- OpenProject #259: reconcile the stale “new `MinimaPage.test.tsx`” and container-card “styling” wording in a completion comment only; leave status and description unchanged per user instruction.

## Verification

Iterate with the focused suites:

```bash
npm --prefix frontend run test -- MinimaContainerCard DashboardDevices MinimaPage
npm --prefix backend run test -- minima.routes
```

Then run the repository-required checks:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
git status --short --untracked-files=all
```

Acceptance checks:

- `Stopped`, `Exited`, and `Error` container copy is pinned by component tests.
- Dashboard stopped/error node labels carry warning/error tones respectively.
- Dashboard does not call the wallet endpoint for stopped, error, or restarting nodes and does not retain a stale balance.
- Restart controls disable as soon as the confirmed operation begins and re-enable only after the mocked status recovery settles.
- A rejected restart shows one actionable error toast without an unhandled promise rejection.
- The authenticated restart route returns the expected redacted structured 502 response when its service rejects.

## Milestones

### Milestone 1: Failure-state rendering and dashboard behavior

- [x] Add `MinimaContainerCard` stopped/exited/error copy cases — verified with `npm --prefix frontend run test -- MinimaContainerCard` (9 tests passed, 2026-09-28).
- [x] Add Dashboard stopped/error tone and wallet-degradation cases — includes stale-balance clearing, recovery, preserved device metrics, and polling cadence (15 dashboard tests passed, 2026-09-28).
- [x] Stop wallet RPC for stopped/error nodes while preserving the intended polling cadence.

### Milestone 2: Restart lifecycle and route failure

- [x] Add `MinimaPage` restart disable/re-enable coverage — controlled restart/status promises verify the page-owned action stays disabled until healthy recovery.
- [x] Add `MinimaPage` restart-failure toast coverage and contain the direct-action rejection — reproduced the unhandled rejection before the fix; all 27 focused frontend tests passed afterward (2026-09-28).
- [x] Add the backend restart-route structured failure case — authenticated service rejection returns the normalized structured 502; all 8 route tests and backend build passed (2026-09-28).

### Milestone 3: Full verification and reconciliation

- [x] Run focused tests, full checks, builds, and Compose validation — 27 focused frontend tests and 8 backend route tests passed; `npm run check` passed all typechecks, coverage suites/thresholds, and dependency audits; both production builds and `docker compose config --quiet` passed (2026-09-28).
- [x] Reconcile `CHANGELOG.md`, `docs/SESSION.md`, `docs/TASKS.md`, and the legacy gap plan — existing branch changelog covers both runtime fixes; no test-only entry needed.
- [x] Add a completion comment to OpenProject #259; leave ticket status and description unchanged per user instruction.

Verification notes: existing frontend >500 kB chunk warning and unset Compose image-variable warnings remain. No container-impacting changes, so no Docker build was required. No manual browser/live-node check was run for this unit-test task.

