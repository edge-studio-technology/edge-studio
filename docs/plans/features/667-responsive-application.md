# Responsive Application Plan

**Status:** Done — all tasks built; #694 awaiting ticket move
**Created:** 2026-09-23
**Branch:** `feature/667-responsive-application`
**Decision record:** `docs/adr/0024-responsive-layout-strategy.md`
**Goal:** Make the whole app usable on Pi/laptop screens down to 1024x768, and on tablet widths, without a phone-first redesign.

## Tracked Tasks

OpenProject feature **#667 Responsive application** (status *In specification*). Child tasks:

| Ticket | Type | Title | Status | Section |
| --- | --- | --- | --- | --- |
| #694 | Dev Task | Make create/edit workflow usable below 360 | In progress (built) | [1](#1-workflow-createedit-694) |
| #695 | Dev Task | Dashboard metric cards stack to one column | Ready for Deployment | [2](#2-dashboard-metric-grid-695) |
| #696 | Dev Task | List toolbar looks broken on tablet | Done | [3](#3-list-toolbars-696--done) |
| #697 | Task | Row actions disappear on tablet | Ready for Deployment | [4](#4-wide-tables-697) |
| #698 | Dev Task | Status bar gets too tall on tablet | Ready for Deployment | [5](#5-status-bar-698) |
| #699 | Dev Task | Dashboard rows look messy on small screens | Ready for Deployment | [6](#6-dashboard-live-activity-rows-699) |
| #700 | Dev Task | Fullscreen console hard to exit on tablet | Ready for Deployment | [7](#7-minima-console-fullscreen-exit-700) |
| #701 | Dev Task | Settings hard to reach on tablet | Done | [8](#8-hardware-modal--account-page-701) |
| #269 | Task | Responsive Layout Regression (Unit Testing) | Ready for Deployment | [9](#9-responsive-regression-tests-269) |
| — (new, to add under #667) | Dev Task | Sidebar overlays content when expanded below 1024 | — | [10](#10-sidebar-overlay-below-1024-new-task) |

- [x] #695 Dashboard metric grid
- [x] #696 List toolbars — merged as `6c4455e` (#115), already on this branch
- [x] #697 Wide tables — sticky row-action column on every table with one: the 7 `min-w-245` tables plus wallet assets, address book, Minima backups, and workflow watch history (§4)
- [x] #698 Status bar
- [x] #699 Dashboard live activity rows
- [x] #700 Minima console fullscreen exit — 40px icon buttons below 1024 (§7)
- [x] #701 Hardware modal / Account page — verified at 768 and 1024, no change needed (§8)
- [x] Sidebar overlay below 1024 (new task, not yet on OpenProject) — built, with a test keeping `EXPAND_MQ` in sync with Tailwind's `lg` (§10)
- [x] #269 Regression tests — unit tests plus the manual matrix (§9)
- [x] #694 Workflow create/edit — toolkit drawer below the workspace breakpoint (§1)

## Context

Parent ticket: "Whole app, not just workflows. This is a Pi / laptop UI. Sidebar already collapses under 1024px. Most pages survive by wrapping or scrolling sideways. Phone-first is not a goal. Minimum supported ratio 1024x768." The child tickets test at 768 and 1024 widths.

### Audit findings (2026-09-23, against `feature/667-responsive-application` @ `7605f24`)

**The content width at 1024 is about the same as at 768.** That changes how the fixes should be built:

| Viewport | Sidebar | Page content width (`p-pad-relaxed` = 40px each side) |
| --- | --- | --- |
| 1280 | expanded `w-80` (320px) | ~880px |
| 1024 | expanded by default (`EXPAND_MQ` = `min-width: 1024px`) | **~624px** |
| 1023 | forced collapsed `w-20` (80px) | ~863px |
| 768 | forced collapsed | ~608px |

- At 1024 the sidebar is expanded unless the operator turns on "start sidebar collapsed". That leaves about 624px of content, less than at 1023px, where the sidebar is forced collapsed. Fixes that use viewport breakpoints (`lg:` = 1024) will treat the narrowest real layout as "desktop". This hits #694 hardest.
- Below 1024 the operator can still expand the sidebar manually (`AppShellSidebar.tsx` toggle). It then pushes the content instead of overlaying it. At 768 that leaves ~368px of page content.
- Tailwind v4.3 is in use, so container queries (`@container` / `@lg:`) are available with no new dependency. Nothing in the app uses them yet. The only JS media query is the sidebar's `matchMedia`.
- There is no separate mobile nav. Below 1024 the sidebar stays as an 80px icon rail. #269's "mobile nav visible below lg" does not match the code (see §9).

Per-area findings are listed in each section below.

## Frontend changes

### 1. Workflow create/edit (#694)

> **Deferred to last**, started after the co-worker sync on 2026-09-24.

**Current:** In `WorkflowWorkspaceShell.tsx`, `rightRailClass` is `absolute … w-[360px]` and always rendered. `WorkflowCanvas.tsx` reserves space for it with `pr-[calc(360px+…)]` on the lane and on the status pill, and the shell's `bottom` slot uses `right-[calc(360px+…)]`. `SelectedBlockSheet` (`workflowWorkspaceUi.tsx`) is a portal with `fixed inset-0 z-[70]`, `max-w-[400px]`, and covers the sidebar too. Both `CreateWorkflowWorkspace.tsx` and `WorkflowWorkspace.tsx` use this shell. At 1024 with the sidebar expanded, the canvas gets ~344px.

**Plan (ADR 0024):**

- Make the workspace a container (`@container` on `workspaceClass`) and switch rail behaviour on the **workspace width**, not the viewport. This fixes 1024+expanded-sidebar and 768 with one rule.
- Wide workspace: unchanged. The rail stays pinned and the canvas keeps its right padding.
- Narrow workspace: the rail becomes a right-side overlay drawer, closed by default. A "Toolkit" toggle button goes in the top-bar actions. The canvas, status pill, and `bottom` slot drop the 360px reservation. The drawer closes after a block is added so the new block is visible.
- ~~Narrow: `SelectedBlockSheet` becomes `w-full` (no `max-w-[400px]`).~~ Reverted after QA: the sheet keeps `w-full max-w-[400px]`, so it fills the screen only at 400px or narrower. It stays a portal because it must cover the drawer.
- The only new state is `toolkitOpen` in the shell (or passed from the two workspaces if they need to close it on add). No shared component is needed.
- Tests: extend `tests/features/automation/workflow/chrome/` and `workflowWorkspaceUi.test.tsx` for the toggle (opens/closes, `aria-expanded`, closes on add). happy-dom does not evaluate container queries, so layout switching is covered by manual QA.

**Built:** `@container` on the shell `<section>`; the rail pins at `@4xl` (896px workspace width) and is a drawer below it, with a `Toolkit` toggle (`aria-expanded`, `aria-controls`) first in the top-bar actions and a backdrop. The shell owns the open state and closes the drawer when a block sheet opens (every add selects the new block), on Escape, and on a backdrop click. The canvas lane, status pill, and `bottom` slot reserve the 360px only at `@4xl`. The watch rail uses the same drawer and label. Also fixed on the way: long sheet descriptions (source URLs) widened the sheet's grid past 400px; the sheet now uses `grid-cols-[minmax(0,1fr)]` and wraps its header text. Tests: 5 drawer tests in `WorkflowWorkspaceShell.test.tsx` and a sheet class guard in `workflowWorkspaceUi.test.tsx`.

Watch mode (`WorkflowWatchUi.tsx`) shares the shell. The ticket keeps it out of scope "unless it shares the same shell and breaks". It does share the shell, so the rail change applies to it automatically. Check it manually; no watch-specific work.

### 2. Dashboard metric grid (#695)

`DashboardDevices.tsx:122` uses `grid-cols-2 xl:grid-cols-3`. The ticket asks for `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`. There are **7** cards, not six. At 1024 with the sidebar expanded, `md:` applies but the content is ~624px, so two columns still truncate the wallet amount. **Decision (ADR 0024):** use a container query on the grid wrapper (`@container` + `@md:grid-cols-2 @4xl:grid-cols-3` or similar) for the same reason as §1. `DashboardDevices.test.tsx` already exists; add a class assertion only if we keep viewport classes.

### 3. List toolbars (#696) — Done

Merged in `6c4455e` and already on this branch. No work planned; spot-check it during the manual QA pass.

### 4. Wide tables (#697)

**Current:** Seven tables, not three, set `min-w-245` (980px) when more than three columns are visible: `IntegritasHistoryTable`, `DataReadsHistoryTable`, `AutomationRunsTable`, `AutomationWorkflowsList`, `AutomationInboxTable`, `DataSourcesList`, `WalletHistoryPanel`. With the content widths above, **every one of them scrolls sideways at 1024 and 768**, and even at 1023. Already shipped: a per-table column picker with backend-saved preferences (spike option 3, `docs/plans/archive/table-column-visibility.md`), left/right scroll-edge shadows in `TableWrap`, and column resize. Every table uses the column id `"actions"` for its row-action column. The operator can hide that column.

**Spike decision (ADR 0024):** option 1+, which is keep the horizontal scroll and make the `actions` column `position: sticky; right: 0` with an opaque background and a left-edge shadow. Build it once in the shared primitives, for example a `sticky` prop on `TableHeaderCell`/`TableCell` in `components/patterns/DataTable.tsx`, and pass it where `column.id === "actions"`. When the operator hides the actions column, nothing is sticky. ~~Move the right-edge scroll gradient so it does not paint over the sticky column.~~ Built instead: while columns sit behind it, the sticky cell shows a full-height divider and edge shadow, and the right gradient is hidden on that table. Do **not** make the first column sticky: Integritas has a `select` checkbox column first, and freezing two left columns uses up the width we are trying to free. Options 2 (expand row) and 4 (cards) are a rebuild for a non-goal (phone).

Record the decision as a comment on the #697 spike ticket.

Tests: in each table's existing test, assert that the actions cells carry the sticky class, or test it once in a `DataTable` pattern test.

**Built:** a `sticky` prop on `TableHeaderCell`/`TableCell`, applied to all 11 tables with a row-action column: the 7 above plus `WalletAssetsPanel`, `AddressBookPanel`, `MinimaBackupPanel`, and the workflow watch history (`WorkflowWatchUi.tsx`, column `details`). Scroll-edge tracking moved into `useTableScrollEdges()`, which `TableWrap` uses and `MinimaBackupPanel`'s `ScrollArea` spreads directly. Drift fixed on the way: the watch history's raw `<th>/<td>` now use the shared cells. Guard: `frontend/tests/helpers/expectRowActionsPinned.ts`, called in each table's row-render test, fails on a wrong or missing sticky cell or a missing scroller. Left for a separate task because each changes the look: the watch history's double scroller (`ScrollArea` around `TableWrap`), the peers table's `<div>` header, and moving backups onto `TableWrap`.

### 5. Status bar (#698)

**Current:** `StatusBar.tsx` shows two status pills (Node, Integritas) on the left, and `Clock` on the right as two pills (`Local …`, `UTC …`) with `shrink-0`. The shell hides the bar on `fullBleed` routes.

**Decision (ADR 0024):** add `flex-wrap` to the outer row. The clock drops to a second row only when there is no room, left-aligned with the pills, the status pills never wrap within themselves, and the bar never goes past two rows. This keeps the clock visible, which matters for workflow scheduling (frontend rule: "show local and UTC time where scheduling clarity matters"). The ticket's `hidden md:block` would still show the clock at exactly 768 (`md` = 768) and would hide it on phones only. Test: extend `StatusBar.test.tsx` only if we hide something.

### 6. Dashboard live activity rows (#699)

`DashboardPage.tsx:101` uses `grid … sm:grid-cols-[minmax(0,1fr)_auto_auto]`. Below `sm` it stacks three rows. **Plan:** wrap `time` + `Pill` in one row (`flex items-center justify-between gap-…`) that becomes two grid cells at `sm+` via `sm:contents`. Result: text on the first line, time left and pill right on the second, with no single-item "header" row. The ticket's note about keeping the "empty state [that] uses the same grid" in sync is stale: the empty state is now `EmptyContentState` (from #229), not a grid row, so there is nothing to sync.

### 7. Minima console fullscreen exit (#700)

**Done (2026-09-23):** the four console toolbar icon buttons stay `compact` (32px) from `lg` up and grow to 40px below `lg` (`max-lg:size-10`) for touch targets. A labelled Exit button was tried and reverted: the other controls are icon-only, so one text button was inconsistent. Escape still exits.

### 8. Hardware modal / Account page (#701)

**Current:** `Modal.tsx` already wraps the body in a `ScrollArea` (`max-h-[min(90vh,760px)]`, `flex-1 min-h-0`). The hardware modal body scrolls. The Enable/Repair/Disable `Button` sits in the **header row** of `HardwareDetailPanel` (`DataSourceTemplates.tsx` ~481), so it is visible without scrolling in the common case. The two-column layout switches at `md:` (768). At 768 the modal is ~750px wide, so the detail column is ~480px. The Account page (`AuthSettingsPage.tsx`) is a normal `Page` inside `app-shell-main-scroll` (`overflow-y-auto`), and I found no nested `overflow-hidden`.

**Plan:** verify first. Reproduce at 768x1024 and 1024x768 in the browser. Likely fixes, only if the repro confirms them: move the modal's two-column switch from `md:` to `lg:` (chip strip above detail below 1024), and `flex-wrap` the detail header so the action button wraps instead of squeezing the title. Change the Account page only if a clip reproduces. This may close as "verified, minor tweak".

### 9. Responsive regression tests (#269)

**Stale premises:** the ticket assumes a "mobile nav visible below lg" (none exists; the sidebar collapses to a rail) and a 375px mobile target (parent: "phone-first is not a goal"). happy-dom does not compute layout, media queries beyond stubbed `matchMedia`, or container queries, so "all screen-level layouts at each viewport" cannot be unit-tested here.

**Rescope (decided; recorded as a ticket comment, description left unchanged):**

- Unit (happy-dom): sidebar collapse at <1024 / expand at ≥1024 via stubbed `matchMedia` (check `AppShellSidebar.test.tsx` covers both), all 9 nav items render with accessible names when collapsed, and the behaviour tests from §1, §4, §7.
- Manual matrix (documented here, run once before merge): 1280x800, 1024x768 (sidebar expanded and collapsed), 768x1024. Record overflow issues below.
- Out: 375px, the mobile-nav items, and Playwright/visual regression.

**Built:** `AppShellSidebar.test.tsx` adds an explicit expand at ≥1024 and an accessible name on every `nav` link when collapsed. The below-1024 collapse and overlay tests (§10), the sticky row-action guard (§4), and the console exit/Escape tests (§7) already existed.

**Manual matrix (2026-09-23):** Dashboard, Minima, Wallet, Integritas, Devices, Workflows (list), Diagnostics, Marketplace, and Settings at 1280x800, 1024x768 with the sidebar expanded and collapsed, and 768x1024. No page-level horizontal overflow outside table scrollers, and the status bar stayed on one row everywhere.

**Workflow routes (2026-09-24, #694):** create, edit, and watch at the same sizes. 1280 and 1024 with the sidebar collapsed: rail pinned, no toggle. 1024 with the sidebar expanded and 768: drawer closed by default, Toolkit toggle shown, canvas without the 360px reservation. Adding a block closes the drawer and opens a 400px sheet. No page-level horizontal overflow.

### 10. Sidebar overlay below 1024 (new task)

Not in any existing ticket; propose it in a #667 comment; creating the ticket is left to the team. In `AppShellSidebar.tsx` / `AppShell.tsx`, when the viewport is below `EXPAND_MQ` and the operator expands the sidebar, render it as an overlay over `main` (fixed/absolute, keeping the 80px rail's space in the flex flow) instead of widening in flow. Close it on navigation, on Escape, and on a click outside. `EXPAND_MQ` stays at `min-width: 1024px`. Tests: extend `AppShellSidebar.test.tsx` with stubbed `matchMedia` below 1024 so that expanding sets the overlay state and navigation or Escape collapses it.

## Decisions

All resolved 2026-09-23; rationale in `docs/adr/0024-responsive-layout-strategy.md`.

1. **Target floor:** 1024x768 is the primary target and 768 wide is the layout floor. Below 768 the app must only "not break"; no dedicated layouts.
2. **Container vs viewport queries:** container queries for the regions whose width depends on the sidebar (workflow workspace, metric grid, Hardware support modal); viewport breakpoints everywhere else.
3. **Sidebar:** a sidebar the operator expands below 1024 overlays the content (new task, §10). `EXPAND_MQ` stays at 1024.
4. **#694 drawer:** a right-side overlay drawer with a top-bar "Toolkit" toggle. It closes after a block is added, on Escape, and on a click outside. The block settings sheet keeps 400px and fills the screen only when the screen is narrower (changed from full-width after QA). The title "below 360" means "below 1024"; note this in a ticket comment and leave the title unchanged.
5. **#697:** sticky `actions` column via the shared `DataTable` primitive, applied to every table with a row-action column (11, including the 7 `min-w-245` tables). No sticky first column. `min-w-245` stays.
6. **#698:** the clock wraps to a second row; it is never hidden.
7. **#269:** unit tests for behaviour plus a manual viewport matrix. 375px, mobile nav, and Playwright are dropped.
8. **Plan path convention:** update the OpenProject skill text (plus the `.agents`/`.cursor` counterparts) to `docs/plans/{features,bugs}/<ticket>-<slug>.md`.
9. **Workflow overlap:** handled by deferring #694 (below).

### OpenProject: comments only

Original ticket fields (title, description, status) are left unchanged so the audit trail is preserved. Decisions and corrections go into each ticket as activity comments, with no @-mentions. Posted 2026-09-23 (activities 4505–4513):

- #667: summary of the audit findings, the decisions, the ADR/plan paths, and a proposed new sub-task (sidebar overlay below 1024).
- #694: the title means below 1024, not below 360. Container-query drawer approach. Deferred to last pending a co-worker sync.
- #695: there are 7 cards, not 6. Container query instead of `md:`.
- #697: spike outcome. Sticky `actions` column on every table with one (11), not only the 7 `min-w-245` tables.
- #698: the clock wraps to a second row instead of being hidden.
- #699: the empty-state note is stale (now `EmptyContentState`).
- #700: labelled Exit button at all widths.
- #701: verify first; the modal body already scrolls.
- #269: rescope to unit behaviour tests plus a manual matrix; drop 375px and the mobile nav.

## Deferred: workflow workspace (#694)

Only **#694** edits the workflow create/edit/watch workspace files. Co-workers are active there in other branches, and `docs/plans/workflow-redesign.md` is in progress. So #694 is scheduled **last** and gated on a status check with those co-workers before starting.

Files #694 will touch, all under `frontend/src/features/automation/workflow/`:

- `chrome/WorkflowWorkspaceShell.tsx`: container, drawer, toggle.
- `canvas/WorkflowCanvas.tsx`: remove the fixed 360px right padding below the breakpoint.
- `workflowWorkspaceUi.tsx`: `SelectedBlockSheet` full-width.
- `CreateWorkflowWorkspace.tsx`, `WorkflowWorkspace.tsx`: close the drawer after a block is added (only if the shell can't own this).
- Tests under `frontend/tests/features/automation/workflow/`.

**Other tasks do not edit workspace files**, but two of them change what the workspace renders:

- §4 sticky actions: changes `components/patterns/DataTable.tsx` / `TableWrap`, which the watch-mode history table (`WorkflowWatchUi.tsx`) uses. Its `details` column is pinned too, and its raw cells were moved onto the shared components, so `WorkflowWatchUi.tsx` did change.
- §10 sidebar overlay: workspace routes render inside `AppShell` (`fullBleed`), so the overlay appears there too. `AppShell.tsx` / `AppShellSidebar.tsx` only; no workspace file changes.

Before starting #694: sync with the co-workers, rebase onto whatever has landed on `dev`, then re-check the plan in §1 against the current shell.

## Order

1. Quick wins: #695, #698, #699, #700 → verify: unit tests + manual check at matrix sizes.
2. #697: shared sticky-actions primitive, then every table with row actions → verify: table tests + manual horizontal scroll at 768/1024.
3. §10 sidebar overlay → verify: sidebar tests + manual expand at 768.
4. #701: repro, then minimal fix.
5. #269: tests + manual matrix run (excluding workflow create/edit); record results here.
6. **#694, last**, after the co-worker sync → verify: create + edit + watch at 1024 (sidebar expanded and collapsed) and 768; add a start block, open/close a sheet; rerun the #269 matrix on workflow routes.

## Docs

- `CHANGELOG.md`: `## [Unreleased] feature/667-responsive-application` with `Changed` entries per user-visible fix.
- `docs/frontend-design-system.md`: note the sticky table column primitive and the container-query convention.
- `docs/plans/workflow-redesign.md`: mark the mobile/tablet toolkit/sheet item done once #694 lands.
- ADR: `docs/adr/0024-responsive-layout-strategy.md` (written). Update it if implementation changes a decision.
- `docs/SESSION.md` / `docs/TASKS.md` via `session-notes`.
- No README/SECURITY change expected (layout only).

## Verification

```bash
npm run check
npm --prefix frontend run build
```

Plus the manual matrix in §9 (1280x800, 1024x768 with the sidebar expanded and collapsed, 768x1024) and `git status --short --untracked-files=all` before commit.
