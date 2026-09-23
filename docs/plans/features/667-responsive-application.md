# Responsive Application Plan

**Status:** Planning — open questions pending
**Created:** 2026-09-23
**Branch:** `feature/667-responsive-application`
**Goal:** Make the whole app usable on Pi/laptop screens down to 1024x768, and on tablet widths, without a phone-first redesign.

## Tracked Tasks

OpenProject feature **#667 Responsive application** (status *In specification*). Child tasks:

| Ticket | Type | Title | Status | Section |
| --- | --- | --- | --- | --- |
| #694 | Dev Task | Make create/edit workflow usable below 360 | In progress | [1](#1-workflow-createedit-694) |
| #695 | Dev Task | Dashboard metric cards stack to one column | In progress | [2](#2-dashboard-metric-grid-695) |
| #696 | Dev Task | List toolbar looks broken on tablet | Done | [3](#3-list-toolbars-696--done) |
| #697 | Spike | Row actions disappear on tablet | In progress | [4](#4-wide-tables-697) |
| #698 | Dev Task | Status bar gets too tall on tablet | In progress | [5](#5-status-bar-698) |
| #699 | Dev Task | Dashboard rows look messy on small screens | In progress | [6](#6-dashboard-live-activity-rows-699) |
| #700 | Dev Task | Fullscreen console hard to exit on tablet | In progress | [7](#7-minima-console-fullscreen-exit-700) |
| #701 | Dev Task | Settings hard to reach on tablet | In progress | [8](#8-hardware-modal--account-page-701) |
| #269 | Task | Responsive Layout Regression (Unit Testing) | In progress | [9](#9-responsive-regression-tests-269) |

- [ ] #694 Workflow create/edit
- [ ] #695 Dashboard metric grid
- [x] #696 List toolbars — merged as `6c4455e` (#115), already on this branch
- [ ] #697 Wide tables (spike → decision → implementation)
- [ ] #698 Status bar
- [ ] #699 Dashboard live activity rows
- [ ] #700 Minima console fullscreen exit
- [ ] #701 Hardware modal / Account page
- [ ] #269 Regression tests

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

**Current:** In `WorkflowWorkspaceShell.tsx`, `rightRailClass` is `absolute … w-[360px]` and always rendered. `WorkflowCanvas.tsx` reserves space for it with `pr-[calc(360px+…)]` on the lane and on the status pill, and the shell's `bottom` slot uses `right-[calc(360px+…)]`. `SelectedBlockSheet` (`workflowWorkspaceUi.tsx`) is a portal with `fixed inset-0 z-[70]`, `max-w-[400px]`, and covers the sidebar too. Both `CreateWorkflowWorkspace.tsx` and `WorkflowWorkspace.tsx` use this shell. At 1024 with the sidebar expanded, the canvas gets ~344px.

**Plan:**

- Make the workspace a container (`@container` on `workspaceClass`) and switch rail behaviour on the **workspace width**, not the viewport. This fixes 1024+expanded-sidebar and 768 with one rule.
- Wide workspace: unchanged. The rail stays pinned and the canvas keeps its right padding.
- Narrow workspace: the rail becomes a right-side overlay drawer, closed by default. A "Toolkit" toggle button goes in the top-bar actions. The canvas, status pill, and `bottom` slot drop the 360px reservation. The drawer closes after a block is added so the new block is visible.
- Narrow: `SelectedBlockSheet` becomes `w-full` (no `max-w-[400px]`). It stays a portal because it must cover the drawer.
- The only new state is `toolkitOpen` in the shell (or passed from the two workspaces if they need to close it on add). No shared component is needed.
- Tests: extend `tests/features/automation/workflow/chrome/` and `workflowWorkspaceUi.test.tsx` for the toggle (opens/closes, `aria-expanded`, closes on add). happy-dom does not evaluate container queries, so layout switching is covered by manual QA.

Watch mode (`WorkflowWatchUi.tsx`) shares the shell. The ticket keeps it out of scope "unless it shares the same shell and breaks". It does share the shell, so the rail change applies to it automatically. Check it manually; no watch-specific work.

### 2. Dashboard metric grid (#695)

`DashboardDevices.tsx:122` uses `grid-cols-2 xl:grid-cols-3`. The ticket asks for `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`. There are **7** cards, not six. At 1024 with the sidebar expanded, `md:` applies but the content is ~624px, so two columns still truncate the wallet amount. **Recommendation:** use a container query on the grid wrapper (`@container` + `@md:grid-cols-2 @4xl:grid-cols-3` or similar) for the same reason as §1. `DashboardDevices.test.tsx` already exists; add a class assertion only if we keep viewport classes.

### 3. List toolbars (#696) — Done

Merged in `6c4455e` and already on this branch. No work planned; spot-check it during the manual QA pass.

### 4. Wide tables (#697)

**Current:** Seven tables, not three, set `min-w-245` (980px) when more than three columns are visible: `IntegritasHistoryTable`, `DataReadsHistoryTable`, `AutomationRunsTable`, `AutomationWorkflowsList`, `AutomationInboxTable`, `DataSourcesList`, `WalletHistoryPanel`. With the content widths above, **every one of them scrolls sideways at 1024 and 768**, and even at 1023. Already shipped: a per-table column picker with backend-saved preferences (spike option 3, `docs/plans/archive/table-column-visibility.md`), left/right scroll-edge shadows in `TableWrap`, and column resize. Every table uses the column id `"actions"` for its row-action column. The operator can hide that column.

**Spike recommendation:** option 1+, which is keep the horizontal scroll and make the `actions` column `position: sticky; right: 0` with an opaque background and a left-edge shadow. Build it once in the shared primitives, for example a `sticky` prop on `TableHeaderCell`/`TableCell` in `components/patterns/DataTable.tsx`, and pass it where `column.id === "actions"`. When the operator hides the actions column, nothing is sticky. Move the right-edge scroll gradient so it does not paint over the sticky column. Do **not** make the first column sticky: Integritas has a `select` checkbox column first, and freezing two left columns uses up the width we are trying to free. Options 2 (expand row) and 4 (cards) are a rebuild for a non-goal (phone).

Tests: in each table's existing test, assert that the actions cells carry the sticky class, or test it once in a `DataTable` pattern test.

### 5. Status bar (#698)

**Current:** `StatusBar.tsx` shows two status pills (Node, Integritas) on the left, and `Clock` on the right as two pills (`Local …`, `UTC …`) with `shrink-0`. The shell hides the bar on `fullBleed` routes.

**Plan:** add `flex-wrap` to the outer row and give the clock `ml-auto`. The clock drops to a second row only when there is no room, the status pills never wrap within themselves, and the bar never goes past two rows. This keeps the clock visible, which matters for workflow scheduling (frontend rule: "show local and UTC time where scheduling clarity matters"). The ticket's `hidden md:block` would still show the clock at exactly 768 (`md` = 768) and would hide it on phones only. Test: extend `StatusBar.test.tsx` only if we hide something.

### 6. Dashboard live activity rows (#699)

`DashboardPage.tsx:101` uses `grid … sm:grid-cols-[minmax(0,1fr)_auto_auto]`. Below `sm` it stacks three rows. **Plan:** wrap `time` + `Pill` in one row (`flex items-center justify-between gap-…`) that becomes two grid cells at `sm+` via `sm:contents`. Result: text on the first line, time left and pill right on the second, with no single-item "header" row. The ticket's note about keeping the "empty state [that] uses the same grid" in sync is stale: the empty state is now `EmptyContentState` (from #229), not a grid row, so there is nothing to sync.

### 7. Minima console fullscreen exit (#700)

`MinimaConsolePanel.tsx`: fullscreen portals to `document.body`, locks body scroll, and exits via Escape or the icon-only `IconButton` (`aria-label="Exit fullscreen"`, line ~222). **Plan:** when fullscreen, render a labelled `Button` "Exit fullscreen" next to the icon, visible at all widths (simpler than breakpoint-gated, and harmless on desktop). Keep the icon and Escape. No whitelist or RPC change. Test: extend `MinimaConsolePanel` tests so that clicking the labelled button exits and restores `body.style.overflow`.

### 8. Hardware modal / Account page (#701)

**Current:** `Modal.tsx` already wraps the body in a `ScrollArea` (`max-h-[min(90vh,760px)]`, `flex-1 min-h-0`). The hardware modal body scrolls. The Enable/Repair/Disable `Button` sits in the **header row** of `HardwareDetailPanel` (`DataSourceTemplates.tsx` ~481), so it is visible without scrolling in the common case. The two-column layout switches at `md:` (768). At 768 the modal is ~750px wide, so the detail column is ~480px. The Account page (`AuthSettingsPage.tsx`) is a normal `Page` inside `app-shell-main-scroll` (`overflow-y-auto`), and I found no nested `overflow-hidden`.

**Plan:** verify first. Reproduce at 768x1024 and 1024x768 in the browser. Likely fixes, only if the repro confirms them: move the modal's two-column switch from `md:` to `lg:` (chip strip above detail below 1024), and `flex-wrap` the detail header so the action button wraps instead of squeezing the title. Change the Account page only if a clip reproduces. This may close as "verified, minor tweak".

### 9. Responsive regression tests (#269)

**Stale premises:** the ticket assumes a "mobile nav visible below lg" (none exists; the sidebar collapses to a rail) and a 375px mobile target (parent: "phone-first is not a goal"). happy-dom does not compute layout, media queries beyond stubbed `matchMedia`, or container queries, so "all screen-level layouts at each viewport" cannot be unit-tested here.

**Proposed rescope:**

- Unit (happy-dom): sidebar collapse at <1024 / expand at ≥1024 via stubbed `matchMedia` (check `AppShellSidebar.test.tsx` covers both), all 9 nav items render with accessible names when collapsed, and the behaviour tests from §1, §4, §7.
- Manual matrix (documented here, run once before merge): 1280x800, 1024x768 (sidebar expanded and collapsed), 768x1024. Record overflow issues below.
- Out: 375px and Playwright/visual regression, unless the answer to Q1 changes this.

## Open Questions

1. **Target floor.** The parent says the minimum is 1024x768 and phone is not a goal. The children test at 768 wide and #269 says 375. Proposal: **768 wide is the layout floor** (tablet portrait), 1024x768 is the primary target, and below 768 must only "not break" (no fixes planned). OK?
2. **Container vs viewport queries.** Because 1024+expanded sidebar ≈ 768+collapsed rail, I recommend container queries for the workflow workspace (§1), the metric grid (§2), and possibly the hardware modal (§8). The alternative is viewport `lg:` as the tickets say, which leaves 1024 with the default expanded sidebar broken. Agree?
3. **Sidebar at 1024.** Should 1024 itself default to the collapsed rail (move `EXPAND_MQ` to `min-width: 1280px`), and/or should a manually expanded sidebar below the threshold **overlay** the content instead of pushing it? Either fixes most issues at the root. This is not in any ticket; add to #667 or leave?
4. **#694 drawer form.** Right-side overlay drawer with a top-bar "Toolkit" toggle (my recommendation), or a bottom panel? Auto-close after adding a block? The ticket title says "below 360"; I read it as "below 1024". Confirm.
5. **#697 decision.** Sticky `actions` column only, applied to all 7 `min-w-245` tables through the shared primitive (my recommendation), or only the 3 named tables? Also: sticky first/identity column (not recommended)?
6. **#698 clock.** Wrap to a second row when cramped (recommended, clock always visible) or hide the clock below a breakpoint as the ticket suggests?
7. **#269 rescope.** Accept the unit-vs-manual split in §9 and drop the 375/mobile-nav items? If so, I'll update the ticket description after you confirm.
8. **Plan path convention.** The OpenProject skill says plan docs live at `docs/plans/<ticket>-<slug>.md`. With the new `docs/plans/features/` (and existing `bugs/`), should I update the skill text (plus its `.agents`/`.cursor` counterparts) to point at `docs/plans/{features,bugs}/`?
9. **Branch overlap.** `origin/workflow-bug-fix` (`5114fbc`, not merged) edits `WorkflowWorkspace.tsx`. Rebase onto it or merge it first if it lands on `dev` before #694 starts. `docs/plans/workflow-redesign.md` (In progress) also lists "mobile/tablet: drawer toolkit, full-screen sheet" as pending. #694 would close that item there too.

## Proposed order

1. Resolve Q1–Q3, which set the approach for everything else.
2. Quick wins: #695, #698, #699, #700 → verify: unit tests + manual check at matrix sizes.
3. #697: shared sticky-actions primitive, then apply to tables → verify: table tests + manual horizontal scroll at 768/1024.
4. #694: workspace container + drawer + sheet → verify: create + edit at 1024 (both sidebar states) and 768, adding a start block, and opening/closing a sheet.
5. #701: repro, then minimal fix.
6. #269: tests + manual matrix run; record results here.

## Docs

- `CHANGELOG.md`: `## [Unreleased] feature/667-responsive-application` with `Changed` entries per user-visible fix.
- `docs/frontend-design-system.md`: note the sticky table column primitive and the container-query convention if adopted (Q2).
- `docs/plans/workflow-redesign.md`: mark the mobile/tablet toolkit/sheet item done once #694 lands.
- ADR only if Q2/Q3 choose container queries or change the sidebar threshold (non-obvious rationale: 1024 content width ≈ 768).
- `docs/SESSION.md` / `docs/TASKS.md` via `session-notes`.
- No README/SECURITY change expected (layout only).

## Verification

```bash
npm run check
npm --prefix frontend run build
```

Plus the manual matrix in §9 (1280x800, 1024x768 with the sidebar expanded and collapsed, 768x1024) and `git status --short --untracked-files=all` before commit.
