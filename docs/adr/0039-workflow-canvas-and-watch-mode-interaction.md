# 0039: Workflow Canvas and Watch Mode Interaction Model

**Status:** Accepted
**Date:** 2026-08-18

## Context

The workflow canvas has three modes (create, edit, watch) over the same block pipeline. The
redesign had to match the designer's Figma states without changing backend contracts. Watch mode
then had to let an operator understand what a workflow is doing now, what happened in past runs,
and what each block contributed, without starting from raw JSON.

## Decision

**Canvas**

- Modes are explicit routes: `/automation/new`, `/automation/:id/edit`, `/automation/:id/watch`,
  `/automation/:id/watch/:runId`. Workflow routes skip the normal page chrome and the global status
  bar, and keep the app sidebar.
- Blocks are added, moved, and removed with click controls. Selected-block configuration or runtime
  opens in a right-side sheet over the toolkit rail. Create mode confirms before leaving with
  unsaved changes.
- Canvas shell, block cards, and toolkit are feature-local (`features/automation/workflow/canvas/`), not shared
  design-system components.

**Watch mode**

- Follows the newest live run by default, with a visible `Follow live runs` switch. Selecting a
  historic run turns following off; a new run then shows a non-disruptive notice instead of
  switching away.
- History is a compact selected-run navigator that expands into a recent-runs table (status,
  trigger, time, duration, result), not an advanced search.
- Replay steps through the selected run's recorded blocks with play/pause and previous/next at a
  fixed 1.5-second step, not the recorded timing. It doesn't auto-play on entry and pauses when the
  user picks another block. A historic run renders the blocks it recorded, including since-deleted
  ones restored from run metadata.
- Block inspection shows friendly, domain-aware input and result summaries first; raw JSON and
  read diagnostics are secondary, opened in modals.
- Event-triggered workflows offer a trigger-payload test instead of `Run now`.

## Alternatives considered

- **A third-party canvas or drag-and-drop library.** Click controls cover the design states;
  drag-and-drop stays out of scope.
- **Query-parameter modes.** Explicit routes make deep links and shell decisions simpler.
- **Shared abstractions for canvas pieces.** Nothing outside the workflow page reuses them yet.
- **Duplicating the app sidebar inside the canvas.** The existing shell already provides it.
- **Recorded-speed replay.** Hard to read for fast runs and tediously slow for long waits.
- **Auto-switching to every new live run.** Interrupts someone inspecting history.

## Consequences

- Edit mode has no unsaved-leave confirmation; edits save on blur or after a short debounce.
- Watch mode is unguarded since it has no unsaved state.
- Replay shows order and outcome, not real timing; timing is in the run details.
