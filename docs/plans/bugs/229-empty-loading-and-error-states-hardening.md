# Empty, Loading & Error States Hardening Plan

**Status:** In progress

**Created:** 2026-09-21
**Branch:** `feature/229-empty-loading-and-error-states-hardening`
**Goal:** Make Dashboard and Devices distinguish first-load progress, legitimate empty results, and request failures so users are never shown false empty data or an indefinite loading state.

## Tracked Tasks

- [x] `bug/661-dashboard-next-action-and-metric-cards-don-t-treat-errors-as-empty` — [#661] Dashboard next-action and metric cards: don't treat errors as empty.
- [ ] `bug/659-devices-failed-load-stays-on-spinner-forever` — [#659] Devices: failed load stays on spinner forever.
- [ ] `bug/660-dashboard-live-activity-add-loading-empty-and-error-states` — [#660] Dashboard live activity: add loading, empty, and error states.

Task #661 is already implemented and Raspberry Pi-verified on this branch; its detailed completed plan remains in `docs/plans/bugs/661-dashboard-next-action-and-metric-cards-don-t-treat-errors-as-empty.md`. This plan records how the two remaining bugs complete the parent feature on the shared feature branch.

## Context

The parent feature requires the Dashboard and Devices surfaces to communicate three distinct outcomes:

1. The required requests have not settled yet.
2. The requests succeeded and returned no data.
3. One or more required requests failed, so the app does not know whether data exists.

The codebase audit found that the backend routes and frontend API clients already preserve these outcomes correctly. `frontend/src/lib/api.ts` normalizes non-success responses into `ApiError` instances, while the existing data-source, read-history, and Integritas clients expose the required requests without converting failures to empty arrays. No backend route, response schema, or API-client change is needed.

The remaining ambiguity is in page-level request orchestration:

- `DataSourcesPage` uses `capabilities === null` as the device list's loading signal. Its initial `refresh()` rejection only raises a toast, so `capabilities` remains `null` and `DataSourcesList` renders `LoadingState` forever. If loading were merely cleared without a separate error state, the initial `items = []` value would incorrectly render `Connect your first device`.
- `DashboardPage` initializes proofs and reads to empty arrays without an explicit loading state. Its concurrent history request therefore looks empty while in flight. A rejection is rendered as raw red text, while a successful empty response is rendered as a fabricated activity-shaped row.
- `DataSourcesPage.refresh()` is also reused by device actions and hardware polling. Initial page-load state must be added without changing those transient action-error and polling paths.
- `getHostCapabilities()` is intentionally best-effort in `DataSourcesPage`: its failure currently falls back to an empty host-capability response while the device list and data-source capability requests remain required. Preserve that boundary rather than expanding this bug into hardware-status error handling.
- `useIntegritasHistoryAutoRefresh()` intentionally treats later pending-proof refresh failures as background-only. Preserve that behavior; the new Live activity error state covers the initial combined proofs/reads load and its explicit Retry action.

The existing `LoadingState`, `EmptyContentState`, `ErrorAlert`, and `Button` components already implement the design-system treatment and accessibility roles this feature needs. Persistent load failures belong in `ErrorAlert`, not a toast; transient device actions should continue using the current toast behavior. No new shared component or ADR is warranted.

## Target State Matrix

| Surface | Loading | Successful empty | Error | Successful data |
| --- | --- | --- | --- | --- |
| Dashboard next action (#661) | Stable loading card | Correct onboarding action | Inline error; never infer zero | Correct action or no card |
| Dashboard metrics (#661) | Metric loading indicators | Legitimate unavailable values only | Alert plus settled unavailable/last-known values | Current metrics |
| Devices (#659) | `LoadingState` in the device-list position | `Connect your first device` | `ErrorAlert` with Retry; no spinner or empty prompt | Configured-device list |
| Dashboard Live activity (#660) | `LoadingState` | `EmptyContentState` | `ErrorAlert` with Retry | Up to ten sorted activity entries |

Each row must render exactly one content state at a time. In particular, an error must not coexist with a loading spinner, an empty prompt, or stale fabricated content.

## Frontend Changes

### 1. Give the Devices initial load an explicit lifecycle

Update `frontend/src/pages/DataSourcesPage.tsx`:

- Add explicit initial-load state for loading and failure instead of deriving loading from `capabilities === null`.
- Keep `refresh()` as the shared data-fetch primitive used by successful device actions and hardware polling. Add a small initial/retry loader around it that:
  - marks the required load as active;
  - clears the previous load error;
  - calls `refresh()`;
  - records a friendly error message when either `listDataSources()` or `getDataSourceCapabilities()` rejects; and
  - always settles the loading state.
- Invoke that loader on mount and from Retry. Replace the initial-load error toast with the persistent inline error; retain existing toasts for create/edit/delete/read/test/hardware action failures.
- Pass the explicit loading flag to `DataSourcesList`. Do not use nullable capabilities as a request-lifecycle flag.
- When the required load has failed, render a full-width shared `ErrorAlert` with a secondary `Retry` button in place of `DataSourcesList`. Do not render the list while failed, because its initial empty array is not evidence that the user has no devices.
- Clear the error before retrying so the list position returns to `LoadingState`; after a successful retry, render the actual configured list or genuine empty state.
- Preserve the current `getHostCapabilities().catch(() => ({ items: [] }))` best-effort behavior and all device/hardware action flows. Header status refresh and broader silent-catch cleanup remain out of scope.

`frontend/src/features/data-sources/DataSourcesList.tsx` already renders loading before empty and needs no new error responsibility. Adjust it only if implementation reveals a small prop/type change required by the explicit page loading flag; do not add a second source of load-error state.

### 2. Add a focused Devices page regression test

Add `frontend/tests/pages/DataSourcesPage.test.tsx` to mirror the page-level state owner:

- Mock the data-source API boundary and render the page with the router/toast context it requires.
- Hold the required requests pending and assert that `Fetching your devices` is visible while neither the error nor `Connect your first device` is shown.
- Reject `listDataSources()` and, separately if useful for coverage, `getDataSourceCapabilities()`; assert that the shared alert and Retry button replace the loading/list state.
- Assert that a failed load never shows `Connect your first device` and does not leave `Fetching your devices` visible.
- Click Retry, assert that the required requests run again, and resolve them to prove the alert clears and the genuine empty state or configured rows render.
- Keep `frontend/tests/features/data-sources/DataSourcesList.test.tsx` coverage for its independent loading, unfiltered-empty, filtered-empty, and populated states. Add only assertions needed to protect any prop behavior changed during implementation.

### 3. Model Dashboard Live activity as one combined request state

Update `frontend/src/pages/DashboardPage.tsx`:

- Add an explicit `activityLoading` state alongside `activityError`; do not infer request state from the proof/read arrays.
- Extract the existing concurrent `getHistory()` and `listDataReads()` call into a page-local load callback shared by the mount effect and Retry action.
- At the start of each load, mark the section loading and clear its previous error. Update proofs and reads only after both required requests succeed, so a partial response cannot be presented as complete Live activity.
- On rejection from either endpoint, store the normalized error message and settle loading. Retry both endpoints because the section represents their combined result.
- Preserve the current proof/read mapping, descending timestamp sort, ten-item cap, and `useIntegritasHistoryAutoRefresh()` behavior after a successful initial load.
- Render the Live activity card body as one mutually exclusive branch:
  - `LoadingState` while the combined request is unsettled;
  - a full-width `ErrorAlert` with a secondary `Retry` button when either request fails;
  - `EmptyContentState` when both requests succeed with no activity; or
  - the existing activity articles when data exists.
- Replace the fabricated `No live activity yet.` article with `EmptyContentState`. Use an existing Lucide activity/history glyph and concise copy; do not add a dashboard-specific state component or CSS.

The #661 `DashboardNextAction` and `DashboardDevices` implementations must remain unchanged except for any import/order conflict required by this page edit.

### 4. Add Dashboard Live activity regression coverage

Add `frontend/tests/pages/DashboardPage.test.tsx`:

- Mock `DashboardNextAction` and `DashboardDevices` so the tests isolate the page-owned Live activity state, and mock the history/read API boundary plus background auto-refresh hook.
- Keep both initial promises pending and assert `LoadingState` is visible instead of an empty section.
- Resolve both requests empty and assert `EmptyContentState` appears without an activity-shaped fake row.
- Resolve representative proof and data-read records and assert the existing labels/statuses render in descending timestamp order, capped at ten items.
- Reject each required endpoint in focused cases and assert `ErrorAlert` appears without raw red text, loading state, empty state, or activity rows.
- Exercise Retry: prove both endpoints are called again, the section re-enters loading, and a successful response clears the alert and renders the correct empty or populated state.
- Retain the existing focused #661 tests in `frontend/tests/features/dashboard/DashboardNextAction.test.tsx` and `frontend/tests/features/dashboard/DashboardDevices.test.tsx` as regression coverage for the already-completed acceptance criteria.

## Scope Boundaries

Do not expand this work into:

- inline `ErrorAlert` page-jump behavior (Feature #693);
- header status refresh failure handling;
- login, onboarding, Connect, or Account/PIN forms;
- Minima console or backups;
- the workflow watch inspector;
- silent `.catch()` cleanup outside Dashboard;
- the workflow canvas; or
- backend/API contract, shared state-management, or global error-boundary changes.

## Docs

When implementation is complete:

- Add or consolidate a `Fixed` entry under `## [Unreleased] feature/229-empty-loading-and-error-states-hardening` in `CHANGELOG.md` covering the Devices and Dashboard state distinctions. Move the already-added #661 Dashboard bullet into that branch section if needed so the parent feature ships as one coherent branch entry rather than duplicating it.
- Mark this plan and tasks #659/#660 complete, then use the `session-notes` skill to reconcile `docs/SESSION.md` and `docs/TASKS.md` with the actual files changed, verification run, and manual checks performed.
- Keep the completed #661 plan as its durable task-level record; do not merge or delete it.
- No README, API, deployment, security, or design-system documentation changes are expected because this reuses existing contracts and documented components.

## Verification

Focused frontend regressions:

```bash
npm --prefix frontend test -- tests/pages/DataSourcesPage.test.tsx tests/features/data-sources/DataSourcesList.test.tsx tests/pages/DashboardPage.test.tsx tests/features/dashboard/DashboardNextAction.test.tsx tests/features/dashboard/DashboardDevices.test.tsx tests/components/patterns/LoadingState.test.tsx tests/components/patterns/EmptyContentState.test.tsx tests/components/patterns/ErrorAlert.test.tsx
```

Required repository checks:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
git diff --check
git status --short --untracked-files=all
```

Manual browser checks with network throttling/request blocking:

1. Throttle the Devices requests and confirm `LoadingState` appears, then resolves to real devices or the genuine first-device empty state.
2. Block `/api/data-sources` and `/api/data-sources/capabilities` one at a time; confirm the spinner stops, the first-device prompt never appears, and the inline Retry action is visible.
3. Restore each Devices endpoint and click Retry; confirm loading reappears temporarily and the list recovers without a page reload.
4. Throttle both `/api/integritas/history` and `/api/data-reads`; confirm Live activity shows `LoadingState` rather than looking empty.
5. Test both successful endpoints with no records; confirm Live activity uses `EmptyContentState` and no fake table/activity row.
6. Block each Live activity endpoint separately; confirm the shared error alert replaces loading/empty/activity content and Retry requests both sources again.
7. Restore the endpoints and retry; confirm activity returns in newest-first order and pending Integritas proofs still auto-refresh.
8. Recheck #661 behavior: the next-action card stays present while loading, failures never become zero counts, and status metric failures settle as unavailable/error rather than spinning indefinitely.
