# Workflow Watch Mode Upgrade Plan

**Status:** Not started  
**Created:** 2026-09-25  
**Goal:** Upgrade Automation watch mode from an early-alpha runtime view into a production-quality live monitoring, historic replay, and workflow debugging experience.

## Context

The current Automation watch mode has already received visual UX work as part of the workflow canvas redesign, but the product experience is still too shallow compared with the level of polish now present across the rest of the app. Users should be able to understand what a workflow is doing now, what happened in past runs, and what each block contributed without needing to inspect raw JSON first.

This plan is intentionally broader than the existing workflow redesign plan. The redesign focuses on canvas layout and visual parity; this upgrade defines the expected watch-mode behavior and interaction model.

## Target User Experience

Watch mode should let the user:

- Visualize live running workflows.
- Auto-follow live runs by default.
- Turn off auto-follow when inspecting historic runs, so a new live run does not interrupt them.
- Browse a table of historic runs for the selected workflow.
- Select any historic run from the table and view it on the canvas.
- Replay historic runs on the canvas.
- Use replay controls: play, pause, next step, previous step.
- Use a fixed readable replay speed instead of the original recorded timing.
- Click any workflow block to inspect that block's runtime step.
- See a friendly summary first: status, input/output preview, timing, result, and plain-English errors.
- Access raw logs/results secondarily, not as the primary view.
- Focus the run history table on recent runs: status, trigger/source, timestamp, duration, and result.

## Product Decisions

- Watch mode should auto-follow live runs by default.
- The user should have a visible `Follow live runs` toggle.
- Selecting a historic run should turn off auto-follow, or otherwise make it clear the user is now inspecting history.
- If a new live run starts while auto-follow is off, show a non-disruptive indication such as `New run available` rather than switching away from the selected historic run.
- Historic replay should support play/pause and previous/next step controls.
- Replay should use a fixed readable animation speed for the first production-quality version.
- Step/block inspection should prioritize friendly summaries over raw JSON.
- The historic runs table should optimize for recent runs rather than advanced search/filtering in the first pass.

## Project Board Breakdown

Feature: Production-quality Automation Watch Mode

Tasks:

- Define watch-mode user expectations and state model.
- Upgrade workflow status summary and live/runtime overview.
- Improve canvas block runtime visualization.
- Improve run history and debugging/details flow.
- Polish edge states, responsive behavior, QA, and docs.

Initial estimate: 5-8 working days.

## Task 1: State Model And Acceptance Criteria

Task 1 should produce the acceptance criteria for implementation before code changes begin.

Define these states:

- `live`: watch mode is following the current or latest live run.
- `historic-selected`: the user selected a past run from the table.
- `replaying`: a selected run is playing through its blocks at fixed speed.
- `paused`: replay is paused on a specific block/step.
- `step-inspect`: the user clicked a block to inspect its runtime details.

Define these block runtime states:

- Not reached.
- Current/running.
- Succeeded.
- Skipped.
- Failed.
- Waiting/blocked, if backend data supports it.

Define the selected block detail panel content:

- Block name and type.
- Runtime status.
- Started/finished time or duration, where available.
- Trigger/input summary.
- Output/action summary.
- Plain-English error explanation if failed.
- Secondary access to raw JSON, logs, diagnostics, proof links, or read details where available.

Define the recent runs table columns:

- Status.
- Trigger/source.
- Started at.
- Duration.
- Result summary.
- Actions such as view, replay, or details.

Task 1 acceptance criteria:

- Watch mode has documented behavior for live auto-follow and the `Follow live runs` toggle.
- Historic run replay has documented controls: play/pause, previous step, next step.
- Canvas block runtime states are defined.
- Step detail panel content is defined, prioritizing friendly summaries over raw JSON.
- Recent runs table columns and selection behavior are defined.
- Edge cases are listed: no runs, active live run, failed run, skipped blocks, viewing history while a new live run starts.

Estimated effort for Task 1: 0.5-1 day.

## Frontend Changes

Likely implementation areas:

- `frontend/src/pages/AutomationPage.tsx` for route composition and watch-mode orchestration.
- `frontend/src/features/automation/workflow/WorkflowWorkspace.tsx` for watch-mode run selection and canvas state.
- `frontend/src/features/automation/workflow/WorkflowWatchUi.tsx` for run controls, runtime inspector, and run history UI.
- `frontend/src/features/automation/workflow/canvas/WorkflowCanvas.tsx` for runtime block highlighting and replay presentation.
- Existing automation API helpers and run-display helpers for shaping friendly run summaries.

Prefer extending the existing watch-mode components before introducing new abstractions. Keep edit/build behavior unchanged unless required by shared canvas changes.

## Docs

Update these once implementation starts or lands:

- `docs/TASKS.md` for status changes.
- `docs/plans/workflow-redesign.md` if visual redesign scope or watch-mode completion status changes.
- `CHANGELOG.md` when user-facing watch-mode improvements land.

## Verification

Before completing implementation tasks:

1. Run `npm --prefix frontend run build`.
2. Run relevant frontend tests for automation workflow/watch components.
3. Manually check live watch behavior with auto-follow on.
4. Manually check inspecting history with auto-follow off and a new run available.
5. Manually check replay controls: play, pause, previous step, next step.
6. Manually check block selection and friendly step details for success, skipped, and failed states where available.
7. Manually check no-runs, loading, error, invalid workflow, archived workflow, desktop, and narrow viewport states.
