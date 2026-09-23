# Empty, Loading & Error States Hardening Plan

**Status:** Implementation complete; manual verification pending

**Created:** 2026-09-21
**Branch:** `feature/229-empty-loading-and-error-states-hardening`
**Goal:** Make Dashboard, Devices, and every other in-scope user-facing async data surface distinguish first-load progress, legitimate empty results, and request failures so users are never shown false empty data or an indefinite loading state.

## Tracked Tasks

- [x] `bug/661-dashboard-next-action-and-metric-cards-don-t-treat-errors-as-empty` — [#661] Dashboard next-action and metric cards: don't treat errors as empty.
- [x] `bug/659-devices-failed-load-stays-on-spinner-forever` — [#659] Devices: failed load stays on spinner forever.
- [x] `bug/660-dashboard-live-activity-add-loading-empty-and-error-states` — [#660] Dashboard live activity: add loading, empty, and error states.
- [x] Complete and close the cross-app async-state gap check before the branch is allowed to merge into `dev`.

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

The two remaining tickets define the known regressions, but they are not the complete release boundary. Before this branch can merge into `dev`, perform an application-wide gap check of user-facing async data displays. The default disposition for a newly discovered gap is to fix and test it on this branch when it is the same class of loading/empty/error ambiguity. This keeps the parent hardening feature coherent instead of knowingly shipping equivalent defects elsewhere. The parent ticket's explicit exclusions remain audit-visible but implementation-excluded unless their scope is separately changed; they must not disappear from the audit simply because this branch does not modify them.

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
- Reject `listDataSources()` and, separately if useful for coverage, `getDataSourceCapabilities()`; assert that the in-content error state and Retry button replace the loading/list state.
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

### 5. Run and close a cross-app async-state gap check

After #659 and #660 pass their focused tests, audit the complete frontend rather than treating those pages as proof that the pattern is correct everywhere:

- Inventory every user-facing page, feature panel, summary card, list, table, and detail view that owns an initial load, refresh, or polling request. Search API call sites, async effects/hooks, nullable-data loading sentinels, `.catch()` paths, spinners, raw error styles, and fabricated placeholder rows as discovery aids; do not treat a text search alone as verification.
- Record the result in this plan during implementation using a compact table with: surface/file, loading behavior, successful-empty behavior (or why empty is not applicable), error behavior, retry/recovery behavior, test/manual evidence, and disposition.
- For every in-scope surface, confirm that request state is not inferred from data values and that loading, successful empty, error, and successful data are mutually exclusive. A failure must settle loading and must not render a zero count, empty prompt, fake record, stale success without an explicit stale/error indication, or raw ad hoc error text.
- Confirm that polling and background refresh failures preserve intentionally usable last-known data without turning the whole surface back into an initial spinner. Where recovery is safe and practical, expose Retry through the shared state components.
- Fix newly discovered instances of the same hardening problem on this branch and add focused regression coverage. Keep changes surgical: reuse `LoadingState`, `EmptyContentState`, and `ErrorContentState`; do not introduce global request-state infrastructure or unrelated UI redesigns.
- List every explicitly out-of-scope surface in the audit table as `Excluded` with the controlling scope item. If an excluded surface has a release-critical version of this defect, stop branch sign-off and obtain an explicit scope decision rather than silently passing it or creating an unowned follow-up.

The branch is not ready for `dev` while an audited in-scope surface is marked unknown, has an unresolved state gap, or lacks verification appropriate to its risk. The goal is gap closure, not merely an audit report.

#### Async-state audit

Error presentation in the table below follows the scope tiers in [docs/adr/0022](../../adr/0022-error-state-scope-tiers.md): an in-content error state when a failure leaves a region with nothing to show, an alert banner when the page still works and one slice degraded.

| Surface / owner | Loading | Successful empty / N/A | Error | Retry / recovery | Evidence | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard next action and metrics (`DashboardNextAction`, `DashboardDevices`) | Stable loading content | Setup action or legitimate unavailable value | Shared alert above the metrics; metrics settle unavailable or retain last-known data | Timed refresh / remount | Focused #661 tests and Pi verification | Pass |
| Dashboard Live activity (`DashboardPage`) | Shared loading state | Shared empty state | In-content error state replaces activity | Retry reloads both sources | `DashboardPage.test.tsx` | Fixed #660 |
| Devices (`DataSourcesPage`, `DataSourcesList`) | Shared loading state | First-device prompt only after success | In-content error state replaces the list | Retry reloads required requests | `DataSourcesPage.test.tsx`, `DataSourcesList.test.tsx` | Fixed #659 |
| Diagnostics histories (`DiagnosticsPage`, three history tables) | Per-tab shared loading state | Per-tab shared empty state | In-content error state now replaces the table, toolbar, and pager | Retry reloads the active tab | `DiagnosticsPage.test.tsx` plus table suites | Fixed in gap check |
| Workflow list (`AutomationPage`, `AutomationWorkflowsList`) | Shared loading state | Shared first-workflow state | In-content error state now replaces both initialized lists | Retry reloads required workflow data | `AutomationPage.test.tsx`, `AutomationWorkflowsList.test.tsx` | Fixed in gap check |
| Automation inbox best-effort load (`AutomationPage`) | Existing table loading | Empty inbox | Failure is intentionally converted to an empty response | Page refresh | Code inspection | Excluded — silent `.catch()` outside Dashboard |
| Workflow create/edit/watch workspace and inspectors | Workspace loading / local action progress | N/A | Existing workspace/action treatment | Existing page/action recovery | Scope inspection | Excluded — workflow canvas and watch inspector |
| Wallet balance and send history (`WalletPage`, `WalletHero`, `WalletHistoryPanel`) | Balance/history loading indicators only while requests are pending | Shared no-history state | Balance now shows unavailable; in-content error state replaces empty/table content | History Retry reloads the combined wallet request; loaded history remains visible when Minima actions are blocked | `WalletHero.test.tsx`, `WalletHistoryPanel.test.tsx` | Fixed in gap check and follow-up audit |
| Wallet address book (`AddressBookPanel`) | Shared loading state only while contacts are pending | Shared first-contact state | In-content error state now replaces empty/table content | Retry reloads contacts; loaded contacts remain visible when Minima actions are blocked | `AddressBookPanel.test.tsx` | Fixed in gap check and follow-up audit |
| Wallet receive modal (`ReceiveAddressModal`) | Modal progress indicator | N/A | In-content error state replaces address content | Close/reopen after restoring Minima/API | Existing focused test and code inspection | Pass |
| Minima node status (`MinimaPage`, status cards) | Status-card loading indicators | N/A | In-content error state now replaces unavailable-looking cards on first-load failure; last-known status remains during later polling failures | Retry plus background polling | `MinimaPage.test.tsx`, `useMinimaStatusRefresh.test.ts` | Fixed in gap check |
| Minima configuration and peer list (`MinimaSettingsPanel`) | Shared config loading state and peer loading row | Empty peers only after success | Retryable in-content error states replace default config/fake empty peers | Retry each failed request | `MinimaSettingsPanel.test.tsx`, `MinimaPeerConnectionsSection.test.tsx` | Fixed in gap check |
| Software update status (`UpdatePage`) | Explicit checking state | N/A | In-content error state replaces status content when update-agent is unavailable | Retry / Check again | `UpdatePage.test.tsx` | Pass |
| Update changelog (`ChangelogPreview`) | Explicit changelog spinner | Parsed list may be empty without fabricated content | In-content error state replaces the preview | Retry reloads the changelog | `ChangelogPreview.test.tsx` | Fixed in follow-up audit |
| Update progress (`update-agent/public`) | Checking state precedes confirmed updating state | Explicit idle state when no job exists | Persistent failure state after update failure, unexpected status, or exhausted contact retries | Retry status check / Back to Update | `update-agent/tests/public/app.test.ts` | Fixed in follow-up audit |
| Integritas Connect status (`IntegritasPage`, `IntegritasConnectPanel`, `useIntegritasAuth`) | Explicit checking state and neutral pill | Not connected is a successful status, not an error | Error pill plus in-content error state replace indefinite Checking/raw error text | Retry re-enters checking and reloads status | `IntegritasPage.test.tsx`, `IntegritasConnectPanel.test.tsx`, `useIntegritasAuth.test.tsx` | Fixed in follow-up audit |
| Integritas stamp/verify actions and pending proof result (`IntegritasPage`, `StampFilePanel`, `VerifyProofPanel`, `StampResult`) | Explicit action progress for both stamp and verify; pending proofs remain explicit | N/A | Action failures use toast; terminal proof failure is explicit | Repeat action / Diagnostics link; polling preserves pending state | Focused Integritas panel/result suites | Fixed in follow-up audit |
| Header status overview (`AppShell`, `useStatusOverviewRefresh`) | Existing header bootstrap | N/A | Preserves last-known status and marks refresh stale | Background polling | Scope inspection | Excluded — header status refresh failure |
| Login, onboarding, Account and PIN/TOTP forms | Form-specific progress | N/A | Form-specific validation/errors | Form resubmission | Scope inspection | Excluded — named parent-feature boundary |
| Minima console, whitelist and backups | Surface-specific progress | Surface-specific empty states | Existing surface-specific errors | Existing actions | Scope inspection | Excluded — Minima console / backups |
| Inline alert page-jump behavior | N/A | N/A | Existing alerts do not add page-jump behavior here | N/A | Scope inspection | Excluded — Feature #693 |

The audit found no remaining unknown or unresolved in-scope user-facing async surface. API action forms without a loadable collection or summary (for example feedback submission and wallet send) have no meaningful successful-empty state and retain their existing submitting/success/error treatment. Unreachable code such as the unmounted `ReceiveQrPanel` was inspected but is not a user-facing release surface.

A follow-up audit expanded the release boundary to the Integritas page and both software-update surfaces. It also rechecked whether non-request availability flags were being presented as loading. This explicit follow-up supersedes the original Integritas Connect exclusion for the mounted Integritas page while leaving onboarding and other forms excluded.

## Scope Boundaries

Do not expand implementation into the following parent-ticket exclusions. They are still inspected and recorded by the cross-app gap check so the release decision is explicit:

- inline `ErrorAlert` page-jump behavior (Feature #693);
- header status refresh failure handling;
- login, onboarding, or Account/PIN forms;
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
npm --prefix update-agent run build
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
9. Block `/api/auth/connect/status` on Integritas; confirm the status pill settles to `Unavailable`, expanding Integritas Connect shows the shared error alert, and Retry recovers after the block is removed.
10. Throttle `/api/integritas/stamp-file` and `/api/integritas/verify-proof-file` separately; confirm each action shows its own loading state and a failed action leaves the selected file available to retry.
11. Block `/update/status` on Software update; confirm checking settles to the shared error alert and Retry recovers after the block is removed.
12. Open `/update/` with no update running; confirm `Checking update status…` resolves to the idle state. Block `/update/apply`, wait for the bounded retries to settle into `Couldn't check update status`, then remove the block and use `Retry status check` to recover.
13. With Wallet history and contacts already loaded, stop Minima and wait for the page warning; confirm both lists remain visible while write actions are disabled, then restart Minima.

Cross-app merge gate:

1. Complete the async-state audit table added to this plan with no unknown in-scope surfaces.
2. Verify every newly discovered in-scope gap has been fixed and covered by an automated test or a recorded manual check.
3. Confirm successful empty results are only shown after successful requests, failures always settle initial loading, and user-visible failures use the shared state treatment rather than fake content or raw error text.
4. Confirm every parent-ticket exclusion is recorded as `Excluded`, with no accidental implementation changes hidden in this branch.
5. Do not merge to `dev` if any in-scope gap remains open or an excluded release-critical gap has not received an explicit scope decision.

### Verification record (2026-09-22)

- Focused async-state regressions: 17 files, 117 tests passed.
- Full `npm run check`: backend 81 files / 1,174 tests, frontend 188 files / 1,515 tests, update-agent 15 files / 162 tests, root scripts 5 files / 43 tests; coverage thresholds and moderate dependency audits passed.
- Backend, frontend, and update-agent builds, `docker compose config`, and `git diff --check` passed.
- The first sandboxed `npm run check` attempt could not bind Supertest's ephemeral local ports (`EPERM`); the required rerun outside that network sandbox passed completely.
- Follow-up focused regressions cover Integritas status/stamping, Software update/update-agent progress, changelog Retry, and Wallet read-only content while Minima actions are blocked.
- Manual browser checks 1–13 above remain pending and are the only outstanding release verification for this plan.
