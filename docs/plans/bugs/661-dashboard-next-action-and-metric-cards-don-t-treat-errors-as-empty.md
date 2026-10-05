# Dashboard Next-Action And Metric Error States Plan

**Status:** Complete

**Created:** 2026-09-21
**Branch:** `bug/661-dashboard-next-action-and-metric-cards-don-t-treat-errors-as-empty`
**Goal:** Keep the Dashboard stable while its next action and status metrics load, and distinguish API failures from legitimate empty or unavailable data.

## Context

The Dashboard currently conflates three different states: waiting for data, successfully receiving
an empty result, and failing to receive data.

- `DashboardNextAction` starts both count states at `null` and returns `null` until both requests
  settle. This removes the whole card during the initial load and causes the page to jump when the
  card appears.
- Each next-action request catches its own failure and returns `0`. A failed devices or workflows
  request can therefore send an established user into the first-run journey.
- `DashboardDevices` schedules another status poll after `getDeviceStatus()` rejects but does not
  settle any visible loading state or record the failure. Its metric cards use missing status data
  (`loading={!device}`, `loading={!node}`, and `loading={!app}`) as a loading signal, so an initial
  failure leaves loading dots on screen until a later poll succeeds.
- Wallet failures already settle `walletLoading` and show `Unavailable`; the defect is in the
  device-status request that supplies the other cards and gates the wallet request.

The existing shared `ErrorAlert`, `Card`, and `MetricCard` components cover the required visual
states. No backend/API changes, new shared component, or ADR are needed. A toast would be a poor fit
because these are persistent load failures attached to dashboard content, not transient action
feedback.

## Frontend Changes

### 1. Give the next-action card explicit request states

Update `frontend/src/features/dashboard/DashboardNextAction.tsx`:

- Replace nullable counts as an implicit loading signal with explicit loading, ready, and error
  rendering state for the combined devices/workflows load.
- Keep the two API calls concurrent, but allow a rejection from either call to enter the error state;
  do not convert either rejection into a zero count.
- While loading, render a card-sized accessible placeholder in the next-action card's position so
  the dashboard layout is stable. Reuse the existing `Card` and shared loading treatment rather
  than introducing a dashboard-only spinner primitive.
- On failure, render a persistent, friendly inline error in that same position using the shared
  `ErrorAlert`. Do not render either onboarding step when one or both counts are unknown.
- Preserve current ready-state behavior: no card when at least one device and one non-archived
  workflow exist; otherwise show the correct connect-device or create-workflow step and existing
  navigation actions.

Update `frontend/tests/features/dashboard/DashboardNextAction.test.tsx`:

- Replace the assertion that the component is empty during loading with an assertion for the
  accessible loading placeholder.
- Replace the failure-as-zero regression with cases proving a devices failure and a workflows
  failure show the error state and never show either onboarding prompt.
- Keep the existing successful empty/non-empty, archived-workflow, and navigation coverage.

### 2. Settle status metrics after status-fetch failures

Update `frontend/src/features/dashboard/DashboardDevices.tsx`:

- Track the device-status request lifecycle separately from whether a `DeviceStatus` object exists.
  Loading is true only while the first status request is unresolved, not whenever a metric value is
  absent.
- When `getDeviceStatus()` fails, settle the initial loading state, record a status error, skip the
  dependent wallet request, and retain the existing 30-second retry schedule.
- After an initial failure, show a single shared `ErrorAlert` above the metric grid and render the
  affected metric values as `Unavailable` with a neutral/error presentation instead of indefinite
  loading dots. The wallet card must also leave its loading state because its gated request cannot
  run without node status.
- If a later refresh fails after a successful load, preserve the last known metric values while the
  alert communicates that the refresh failed. Clear the error after the next successful status
  response. This avoids replacing useful known data with an apparent empty state.
- Preserve the existing faster three-second polling while the node is restarting, wallet fetch
  behavior after a successful status response, and cleanup of scheduled timers on unmount.

No change to `frontend/src/components/patterns/MetricCard.tsx` is expected: callers can already pass
an explicit non-loading `Unavailable` value and status tone. Only extend it if implementation shows
an accessibility gap that cannot be addressed from `DashboardDevices`.

Update `frontend/tests/features/dashboard/DashboardDevices.test.tsx`:

- Replace the test that expects an endless loading state after status failure with assertions that
  the alert and unavailable values appear, loading indicators stop, and the wallet request is not
  made.
- Use fake timers to prove the existing poll retries after the normal interval and a successful
  retry clears the alert and restores real metric values.
- Add or retain coverage that a refresh failure after a successful response keeps the last known
  metrics visible.
- Keep the existing initial-loading, successful rendering, Integritas states, missing disk,
  restarting-node, and wallet-failure coverage.

## Docs

When implementation is complete:

- Add a `Fixed` entry under
  `## [Unreleased] bug/661-dashboard-next-action-and-metric-cards-don-t-treat-errors-as-empty` in
  `CHANGELOG.md` describing the corrected Dashboard loading and failure states.
- Mark this plan complete and use the `session-notes` skill to reconcile `docs/SESSION.md` and
  `docs/TASKS.md` with the work and verification performed.
- No README, API, deployment, or security documentation changes are expected because the backend
  contract and operating model do not change.

## Verification

Focused frontend regressions:

```bash
npm --prefix frontend test -- tests/features/dashboard/DashboardNextAction.test.tsx tests/features/dashboard/DashboardDevices.test.tsx tests/components/patterns/MetricCard.test.tsx
```

Required repository checks:

```bash
npm run check
npm --prefix frontend run build
docker compose config
git status --short --untracked-files=all
```

Manual browser checks with network throttling/request blocking:

1. Throttle the devices and workflows requests and confirm a next-action loading placeholder is
   visible immediately without a layout jump.
2. Block either count request and confirm the Dashboard shows an error without suggesting that the
   user connect a device or create a workflow.
3. Block `/api/status`, reload, and confirm the metric grid stops loading, shows unavailable values,
   and displays an error alert.
4. Restore `/api/status` and confirm the scheduled retry clears the alert and fills the metric
   cards without reloading the page.
5. After a successful status load, block a refresh and confirm the alert appears while the last
   known values remain visible.
