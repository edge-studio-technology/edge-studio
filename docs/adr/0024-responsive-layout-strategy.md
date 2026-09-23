# 0024: Responsive Layout Strategy

**Status:** Accepted
**Date:** 2026-09-23

## Context

Feature #667 makes the app usable on Pi/laptop screens down to 1024x768 and on tablet widths. The
parent ticket rules phone-first out. The child tickets test at 768 and 1024 wide, and each
proposes a Tailwind viewport breakpoint (`md:` / `lg:`) as its fix.

Measured against the app shell, the viewport width does not predict the content width:

| Viewport | Sidebar                                                         | Page content width |
| -------- | --------------------------------------------------------------- | ------------------ |
| 1280     | expanded `w-80` (320px)                                         | ~880px             |
| 1024     | expanded by default (`EXPAND_MQ` = `min-width: 1024px`)         | ~624px             |
| 1023     | forced collapsed `w-20` (80px)                                  | ~863px             |
| 768      | forced collapsed; the operator can still expand it (pushes content) | ~608px (~368px expanded) |

At 1024 the default layout is as narrow as a 768 tablet. A `lg:` breakpoint would count it as
desktop. The workflow canvas, for example, gets ~344px next to its fixed 360px toolkit rail at
1024. Seven data tables set `min-w-245` (980px) once more than three columns are visible, so every
one of them scrolls sideways at 1024 and at 768. As the row-action column scrolls out of view, a
row can no longer be opened.

The frontend uses Tailwind v4.3, which ships container queries (`@container`, `@md:`, …). Nothing
in the app used them before this decision. happy-dom does not evaluate layout, media queries
(beyond a stubbed `matchMedia`), or container queries.

## Decision

- **Supported widths.** 1024x768 is the primary target. 768 wide is the layout floor. Below 768
  the app must not break (no horizontal page overflow), but it gets no dedicated layouts.
- **Container queries for regions whose width depends on the sidebar.** The workflow workspace,
  the Dashboard metric grid, and the Hardware support modal switch layout on their own container
  width, not the viewport. Every other surface keeps ordinary viewport breakpoints.
- **Sidebar overlays below 1024.** A sidebar the operator expands manually below `EXPAND_MQ`
  overlays the content instead of pushing it. The threshold itself stays at 1024, and a unit test
  fails if `EXPAND_MQ` drifts from Tailwind's `lg` breakpoint.
- **Sticky row actions.** Wide tables keep horizontal scroll. The `actions` column is
  `position: sticky; right: 0` with an opaque background. This is built once in the shared table
  primitives and applied to every table with a row-action column, not only the `min-w-245` ones.
  No first/identity column is frozen.
- **Status bar wraps.** The clock drops to a second row when space runs out. It is never hidden,
  because local/UTC time supports workflow scheduling.
- **Workflow toolkit drawer.** Below the workspace container breakpoint, the toolkit rail becomes a
  right-side overlay drawer toggled from the top bar. The drawer closes after a block is added. The
  selected-block sheet goes full-width.
- **Tests.** Unit tests cover behaviour: toggles, `aria-expanded`, sticky classes, and sidebar
  `matchMedia`. Layout is verified manually at 1280x800, 1024x768 (sidebar expanded and
  collapsed), and 768x1024.

## Alternatives considered

- **Viewport breakpoints as the tickets specify.** Rejected for the three regions above: 1024 with
  the default expanded sidebar would stay broken while counting as "desktop".
- **Move `EXPAND_MQ` to 1280 so 1024 starts collapsed.** Rejected: operators on common 1280-class
  laptops would lose the expanded sidebar they have today, and container queries already cover the
  narrow-1024 case.
- **Tables: hide columns and expand rows, or render cards on small screens.** Rejected: both
  rebuild every table for a phone use case the feature excludes. A column picker with
  backend-saved preferences already exists (`docs/plans/archive/table-column-visibility.md`).
- **Tables: also freeze the first column.** Rejected: Integritas history leads with a `select`
  checkbox column. Freezing two left columns plus the actions column uses up the width the change
  is meant to free.
- **Tables: fix only the three tables named in the spike.** Rejected: the other four `min-w-245`
  tables have the same defect, and a shared primitive costs the same either way.
- **Hide the clock below `md:`.** Rejected: at exactly 768 `md:` still applies, so the cramped
  case is not fixed, and the time readout disappears when it is still useful.
- **Toolkit as a bottom panel.** Rejected: it competes with the workspace's `bottom` slot (watch
  history) and takes vertical space, which is the scarce dimension at 768 height.
- **Phone support (375px) and Playwright visual regression.** Out of scope: phone is a stated
  non-goal, and browser-based visual testing is a separate tooling decision.

## Consequences

- Container queries become a second responsive mechanism beside viewport breakpoints. Contributors
  must know which regions use which; `docs/frontend-design-system.md` records the convention.
- Container-query layout switching cannot be unit-tested under happy-dom. It relies on the manual
  viewport matrix.
- A sticky cell needs an opaque background. While columns sit behind it, it shows a full-height
  divider and an edge shadow, which replace `TableWrap`'s right-edge scroll gradient on that table.
  A divider inset from the row borders was tried and reverted. If the operator hides the actions
  column through the column picker, nothing is sticky.
- The divider depends on a scroll-edge signal from the table's scroller. A table outside
  `TableWrap` must use `useTableScrollEdges()`; Minima backups missed it at first.
  `expectRowActionsPinned()` in each table's row test fails on a missing scroller or a
  misplaced `sticky` prop.
- Sub-768 widths remain best-effort.

## Where this lives in code

- `frontend/src/components/AppShellSidebar.tsx`: `EXPAND_MQ`, overlay behaviour below it.
- `frontend/src/components/AppShell.tsx`: shell layout the overlay sits over.
- `frontend/src/features/automation/workflow/chrome/WorkflowWorkspaceShell.tsx`: workspace
  container, toolkit drawer.
- `frontend/src/features/automation/workflow/canvas/WorkflowCanvas.tsx`: 360px rail reservation.
- `frontend/src/features/automation/workflow/workflowWorkspaceUi.tsx`: `SelectedBlockSheet`.
- `frontend/src/features/dashboard/DashboardDevices.tsx`: metric grid container.
- `frontend/src/features/data-sources/DataSourceTemplates.tsx`: Hardware support modal layout.
- `frontend/src/components/patterns/DataTable.tsx`: sticky cell support, `useTableScrollEdges()`,
  `TableWrap` edge shadows.
- `frontend/tests/helpers/expectRowActionsPinned.ts`: per-table pinning guard.
- `frontend/src/components/StatusBar.tsx`: wrapping clock row.
