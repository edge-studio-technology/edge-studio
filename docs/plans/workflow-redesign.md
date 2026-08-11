# Workflow Redesign Plan

**Status:** In progress
**Created:** 2026-07-31
**Last updated:** 2026-08-07
**Goal:** Redesign the workflow canvas create, edit, and watch experiences to match the approved Figma direction while preserving current automation behavior and ESDS frontend rules.

## Context

The app redesign is being done component by component and page by page. The workflow canvas is the next focus area, covering the create, edit, and watch variants shown in the designer's Figma screenshots: empty workflow, populated workflow, scrolled populated state, selected-block side panel, leave confirmation dialog, and default/selected block card states.

The current implementation already has functional route modes and automation behavior in place. The redesign should therefore be primarily a frontend composition and styling change, not a backend contract change. Preserve the existing `flow.mode` split in `frontend/src/pages/AutomationPage.tsx` and the shared canvas primitives in `frontend/src/features/automation/workflow/canvas/` unless a small UI-state addition is needed for selected-block focus or unsaved-leave confirmation.

Rejected/deferred alternatives:

- Do not introduce a third-party canvas or drag/drop library for the first pass. The existing click-to-add, move, remove, and select behavior is enough to match the core design states.
- Do not create broad shared design-system abstractions unless a component is clearly reusable outside the workflow page. The workflow canvas shell, block cards, and toolkit are feature-specific for now.
- Do not duplicate the app sidebar inside the workflow canvas. Use the existing `AppShell` navigation unless product later asks for route-specific shell changes.

## Current status

Implemented in the current working tree:

- `frontend/src/features/automation/workflow/canvas/` now uses a redesigned workflow frame with a white top bar, grey canvas surface, right-side toolkit, dashed empty state, flat category-colored block cards, connector lines, `Pill` badges, inset attached-block cards, selected-block border, runtime/validation highlighting, and responsive canvas/panel sizing.
- `frontend/src/pages/AutomationPage.tsx` now places create-workflow name/enabled controls in the workflow top bar, restyles create/edit/watch inspector panels, renders selected block configuration/runtime in a full-height right-side overlay sheet, dims the workspace while a selected-block sheet is active, and adds a create-workflow leave confirmation modal.
- Workflow validation/setup controls now live above the toolkit or watch run controls in the same right rail. Redundant empty selected-block placeholder panels and duplicate create action buttons were removed because selected block details now live in the overlay sheet and workflow actions live in the topbar.
- Workflow modes now use explicit routes (`/automation/new`, `/automation/:workflowId/edit`, `/automation/:workflowId/watch`, `/automation/:workflowId/watch/:runId`) instead of query parameters, and `AppShell` uses that route metadata to hide the global status bar for workflow routes.
- Workflow routes now bypass the normal Automation `<Page>` header/card chrome so the workflow topbar, canvas, toolkit, selected block panel, and watch history occupy the full content area beside the sidebar.
- `CHANGELOG.md` has an `[Unreleased]` entry for the workflow redesign.
- Verification run: `npm --prefix frontend run build` passes. Vite still reports the existing large-chunk warning.

Remaining / not yet strict-plan-complete:

- Browser visual QA against the Figma screenshots is still needed for empty, populated, scrolled, selected-block, leave-dialog, watch, and responsive states.
- Selected-block behavior now covers the right side of the workflow workspace with a full-height sheet over the toolkit/right rail. It is not yet animated/portal-based, and mobile full-screen sheet behavior still needs browser QA.
- Edit-mode unsaved-leave confirmation is not implemented. Create mode has leave confirmation; watch mode remains unguarded as planned unless a protected unsaved field is introduced.
- Drag/drop is not implemented; the workflow keeps existing click-to-add and move controls.

## Frontend changes

**`frontend/src/features/automation/workflow/canvas/`** — redesign the feature-owned canvas components:

- Replace the current dark hero `WorkflowWorkspaceShell` treatment with a Figma-like workflow frame: white top bar, breadcrumb/name/action row, grey canvas surface, and right-side `Toolkit` panel.
- Keep layout and styling local to the automation feature. Use Tailwind utilities, ESDS semantic tokens from `frontend/src/styles.css`, and `cx` for conditional classes.
- Restyle the empty canvas state as a dashed drop/click zone centered in the grey workspace. Avoid promising drag/drop behavior unless it is implemented.
- Replace gradient block cards with flat category cards:
  - Start blocks: pale yellow.
  - Logic/data blocks: pale blue and pale purple.
  - Action blocks: pale pink/red.
  - Integritas/stamp blocks: pale green.
- Use a black selected border for selected blocks and keep validation/runtime states visible without fighting the selected border.
- Move badges to compact pill-style chips, preferably through the existing `Pill` component where it fits.
- Render attached blocks as inset pale sub-cards inside parent data blocks.
- Keep connector lines between blocks and preserve existing move/remove/select behavior.
- Convert `WorkflowBlockLibrary` into the Figma `Toolkit` panel with grouped sections for start, data, logic, action, and attached actions. Use local rows unless the existing `Menu` component can express title/description rows without awkward overrides.

**`frontend/src/pages/AutomationPage.tsx`** — adapt create/edit/watch composition around the redesigned canvas:

- Build mode:
  - Top bar contains workflow name input, reset action, cancel/back action, and create action.
  - Toolkit allows start-block selection until a start block exists, then enables data/logic/action additions according to current rules.
  - Selected block opens a configuration side panel using existing draft inspector logic.
- Edit mode:
  - Preserve existing per-block/per-workflow save behavior unless product explicitly changes it to whole-workflow publish.
  - Show workflow setup, validation, and selected-block editing in the selected-block side panel or adjacent inspector area according to the Figma selected-block state.
  - Keep immediate add/remove/move/enable/disable semantics unless a separate publish workflow is designed.
- Watch mode:
  - Remove destructive edit controls from the canvas/toolkit.
  - Prioritize run controls, selected run summary, selected block runtime, validation, and output inspection.
  - Keep historic runs visible below the canvas or as a lower panel after the first redesign pass.

**Selected-block panel** — add a feature-owned side panel/sheet behavior:

- Open when a canvas block is selected.
- Dim the canvas behind the panel for selected-block focus, matching the Figma selected-block state.
- Use existing inspector components (`DraftBlockInspector`, `PersistedBlockInspector`, `WatchRuntimeInspector`) as the source of behavior and validation, but restyle their wrappers and controls to match the new panel.
- Use existing ESDS controls where possible: `Button`, `IconButton`, `InputField`, `SelectField`, `TextareaField`, `CheckboxField`, and `Modal`.
- On mobile/tablet, make the selected-block panel behave as a full-screen modal/sheet instead of preserving the desktop right rail.

**Leave confirmation** — add an unsaved-leave guard for workflow canvas routes:

- Use `frontend/src/components/ui/Modal.tsx` for the confirmation dialog.
- Match the Figma state with title `Are you sure?`, explanatory copy, a leave/back action, and a cancel action.
- Build mode is dirty when the workflow name or blocks differ from the initial empty state.
- Edit mode is dirty when the workflow name or selected block config differs from persisted state.
- Watch mode should not show a confirmation unless a protected unsaved field is introduced later.

**Responsive behavior**:

- Desktop: keep the top bar fixed within the workflow frame, let the canvas scroll vertically, keep the toolkit sticky/right aligned, and overlay the selected-block panel from the right.
- Mobile/tablet: stack or drawer the toolkit, keep block cards full-width, and use a full-screen selected-block panel.

## Design-system rules

- Follow `docs/frontend-design-system.md` and the `frontend-design-system` skill.
- Use Tailwind utilities and ESDS semantic tokens. Do not add component CSS files or global component classes.
- Prefer existing shared components before creating new ones.
- Keep workflow-specific canvas/block/toolkit components in `frontend/src/features/automation/` unless they become clearly reusable.
- If a new shared `ui/` or `patterns/` component is introduced, document it in `docs/frontend-design-system.md` and add a `CHANGELOG.md` entry.

## Docs

- Update `CHANGELOG.md` once implementation starts and user-facing redesign work lands.
- Update `docs/frontend-design-system.md` only if new shared `components/ui/` or `components/patterns/` components are added or taxonomy changes.
- Update `docs/TASKS.md` when implementation starts, completes, or is intentionally deferred.

## Verification

1. Run `npm --prefix frontend run build` for frontend styling/composition changes.
2. Manually check create workflow states: empty canvas, populated canvas, selected block, reset, validation, create action, and leave confirmation.
3. Manually check edit workflow states: populated/scrolled canvas, selected block editing, save workflow name, save selected block, add/move/remove/enable/disable block, validation, and leave confirmation.
4. Manually check watch workflow states: run controls, selected run, runtime block status, selected block runtime details, historic runs, and no destructive edit controls.
5. Manually check responsive behavior on desktop and a narrow/mobile viewport.
