# Workflow Replay Positioning Handoff

## Scope

This report covers the desktop positioning of the watch-mode replay status text:

```text
Follow latest run
Run completed - 2026-09-09 09:07:03 - 2026-09-09 09:07:05
```

The visual reference shows three things sharing one vertical center axis:

1. The workflow state/mode controls in the page header (`Paused` and the edit icon).
2. The replay status message in the replay toolbar.
3. The workflow block stack in the canvas.

The red vertical guide in the screenshots represents that shared axis. The replay
message must not overlap `Replay`, the step buttons, or the `Follow latest run`
checkbox.

## Render Path

### Message creation

File: `frontend/src/features/automation/workflow/WorkflowWorkspace.tsx`

- `selectedRun` is selected from `runs` at lines 185-187.
- `playbackMessage` is computed at lines 190-194.
- `playbackStatusMessage()` is defined at lines 840-861.
- For the screenshot state (`followLiveRuns === false`, completed run), the exact
  string is produced at line 855:

```ts
Run completed - ${started} - ${finished}
```

- The message is passed to `WatchReplayControls` at line 628.

The text content and date formatting are not the cause of the positioning problem.
`formatPlaybackDateTime()` only produces the text value.

### Replay toolbar DOM

File: `frontend/src/features/automation/workflow/WorkflowWatchUi.tsx`

`WatchReplayControls` is rendered at lines 157-243.

The root element is currently:

```tsx
<div className="relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-detail-next">
```

The first grid child, lines 184-235, contains all left-side controls:

- `Replay`
- Previous step
- Play
- Pause
- Next step
- `Follow latest run` checkbox and label

The status message is the second child in source order, line 236:

```tsx
<p className="type-body-em text-text-primary m-0 min-w-0 truncate text-center @4xl:absolute @4xl:left-1/2 @4xl:-ml-[180px] @4xl:-translate-x-1/2 @4xl:w-max">
  {message}
</p>
```

The third grid child, lines 237-241, contains the optional right-side notice:

```text
Latest run available. Turn on follow latest run to jump back.
```

That notice should remain on the right and must not determine the center position
of the status message.

### Toolbar shell DOM

File: `frontend/src/features/automation/workflow/chrome/WorkflowWorkspaceShell.tsx`

At lines 109-112, the toolbar is wrapped as:

```tsx
<div className="border-stroke-secondary bg-surface-primary px-pad-relaxed py-detail-tight flex min-h-[48px] items-center border-b">
  {toolbar}
</div>
```

Important facts:

- This wrapper is a horizontal flex container.
- It does not have `w-full`.
- The `WatchReplayControls` root is its flex child.
- The `WatchReplayControls` root also does not have `w-full`.
- The replay status `<p>` is absolutely positioned relative to the
  `WatchReplayControls` root because that root has `relative`.

Therefore, `left-1/2` on the message is relative to the replay-controls flex item,
not necessarily to the full shell or full toolbar row. A flex item with auto width
can shrink to its content. In this case the containing block is effectively sized
around the left replay controls rather than the full viewport/workspace.

This explains the screenshot: the message is placed into the left control area and
drawn over the buttons and checkbox. The text is not rendered twice; glyphs from the
single status message visually overlap the controls, which makes parts of the date
look duplicated.

## Header Centering

File: `frontend/src/features/automation/workflow/chrome/WorkflowWorkspaceShell.tsx`

The header uses a different coordinate system.

The top bar, lines 10-11, is a full-width `relative` grid:

```text
@4xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]
```

The center actions are rendered at lines 18-19:

```text
gap-detail-next flex flex-wrap items-center self-center
@4xl:absolute
@4xl:left-1/2
@4xl:-ml-[180px]
@4xl:-translate-x-1/2
```

The header center actions are therefore positioned relative to the full top bar,
which is why the `Paused` control and edit icon appear near the intended red guide.
Their containing block is not the same as the replay message's shrink-to-content
containing block.

The `180px` value is a hard-coded approximation for half of the 360px right rail.
It is not a shared layout variable and does not mathematically describe the canvas
padding exactly.

## Canvas Centering

File: `frontend/src/features/automation/workflow/canvas/WorkflowCanvas.tsx`

The canvas structure is different again:

```tsx
<ScrollArea className={canvasLaneClass}>
  <div className={cx(canvasContentClass, ...)}>
    {blocks.map(...)}
  </div>
</ScrollArea>
```

`canvasLaneClass`, lines 22-23, includes:

```text
relative flex h-full flex-col items-center
px-pad-relaxed
@4xl:pr-[calc(360px+var(--spacing-pad-relaxed)+var(--spacing-pad-tight))]
```

At `@4xl`:

- Left lane padding is `var(--spacing-pad-relaxed)` = `40px`.
- Right lane padding is `360px + 40px + 16px` = `416px`.
- The rail itself is absolutely positioned and does not participate in normal flow.
- The canvas compensates for the rail by reserving the right-side padding.

`canvasContentClass`, lines 24-25, is:

```text
flex min-h-full w-full flex-col items-center [justify-content:safe_center]
```

Each workflow block uses `w-full max-w-[520px]`, line 30, so the block stack is
centered inside the padded canvas content area.

For a shell width `W`, ignoring borders and scrollbar details, the block center is
approximately:

```text
W / 2 - ((416px - 40px) / 2)
= W / 2 - 188px
```

The current header offset of `180px` is close but is a separate approximation. The
correct implementation should use one shared center definition rather than three
independent positioning guesses.

## Other Relevant Layout Factors

### Shell geometry

`WorkflowWorkspaceShell.tsx` lines 8-17:

- The shell is `relative flex h-screen flex-col overflow-hidden`.
- The workspace is `relative min-h-0 flex-1 overflow-hidden`.
- The rail is `absolute`, `width: 360px`, and pinned to the right at desktop sizes.
- The shell is the `@container` that activates the `@4xl` container-query utilities.

### Toolbar height and padding

The toolbar wrapper has:

- `min-h-[48px]`
- `py-detail-tight` = 4px vertical padding
- `px-pad-relaxed` = 40px horizontal padding
- `items-center`

These affect the vertical position and available width, but not the intended x-axis
center. The status text should remain vertically centered in this 48px row.

### Typography and overflow

`styles.css` lines 132-138 define `type-body-em` as:

- Hanken Grotesk
- 14px
- line-height `1.2`
- font-weight 600

The status message also has `truncate` and `w-max` at desktop. The status string is
long enough that its measured width matters. It must be centered as a whole element,
not left-positioned by its first character and not allowed to overlap the left
controls.

### Responsive behavior

The desktop positioning applies at `@4xl`, which is a container query, not a global
viewport media query. Below that size:

- The rail becomes a drawer.
- The header center action positioning is no longer absolute.
- The replay message must be allowed to return to normal flow or stack safely.
- Any fix must not introduce horizontal overflow on narrow widths.

## Exact Desired Position

At desktop width, the desired layout is:

```text
left group                         shared center axis                 right group
Replay [prev] [play] [pause] [next] [Follow latest run]   Run completed - ...   [optional notice]
                                      |
                                      | header Paused/edit controls
                                      |
                                      | workflow block stack center
```

More precisely:

1. The center of the replay status element must have the same x-coordinate as the
   center of the workflow block cards.
2. The header `Paused`/`Enabled` control group must use that same x-coordinate as
   its group center.
3. The left replay controls, including the checkbox and `Follow latest run` label,
   must remain in the left region and must not be covered by the status message.
4. The optional latest-run notice must remain in the right region and must not move
   the status message away from the shared center axis.
5. The center alignment must remain correct when the message length changes between
   `Run completed`, `Latest run completed`, `New run playing`, and other states.
6. The center alignment must remain correct when the right-side notice appears or
   disappears.
7. At narrow sizes, the toolbar may stack, but it must not overlap or clip the
   checkbox, controls, or status message.

The target is not “center the text in the full viewport.” The target is the center of
the canvas lane after accounting for the pinned 360px rail and the canvas's exact
left/right padding.

## Most Likely Root Cause

The primary root cause is the missing width constraint on the toolbar path:

```text
WorkflowWorkspaceShell toolbar wrapper: flex, no w-full
  -> WatchReplayControls root: relative grid, no w-full
     -> status p: absolute left-1/2
```

The status message's containing block is the narrow replay-controls flex item, not a
full-width row aligned with the canvas. Positioning changes to `left`, `calc()`,
negative margins, or transforms cannot reliably solve that until the containing
block has the intended width.

The secondary issue is duplicated, hard-coded geometry:

- `360px` appears in the shell rail, canvas padding, canvas status position, and
  bottom overlay position.
- `180px` is used as an approximate center correction for the header and replay
  message.
- The exact canvas correction is approximately `188px` with the current token
  values.

## Recommended Implementation Direction

The next implementation should first establish the containing block and then align
against shared geometry:

1. Make the toolbar row and its replay-controls child explicitly `w-full` at the
   desktop layout, or move the status element into a full-width, `relative` shell
   layer. Confirm with browser devtools that the status element's containing block
   spans the full toolbar/workspace width.
2. Define one shared desktop center rule based on the canvas lane's actual right
   reservation, rather than independently repeating `180px`.
3. Apply that same rule to the header center actions and replay status element.
4. Keep the left controls and right notice in normal grid columns so they do not
   participate in or alter the status center calculation.
5. Use a real browser measurement or screenshot at the reference width. Unit tests
   in happy-dom do not calculate layout and cannot detect this bug.

Possible geometry formula using the current tokens:

```css
center-x = 50% -
  ((360px + var(--spacing-pad-relaxed) + var(--spacing-pad-tight)) -
    var(--spacing-pad-relaxed)) / 2;
```

Equivalent current value: `50% - 188px`. If the intended red guide is defined by
the existing header position rather than the exact canvas padding, the implementation
must instead change the canvas and header to consume one shared variable. Do not keep
two visually similar magic numbers.

## Verification Checklist

Use the actual browser at the screenshot's desktop width and inspect these rectangles:

```js
document.querySelector('[data-testid="...replay status..."]').getBoundingClientRect()
document.querySelector('[data-testid="...workflow block..."]').getBoundingClientRect()
document.querySelector('[data-testid="...header center..."]').getBoundingClientRect()
```

The comparison should use element centers:

```text
abs(replayStatus.left + replayStatus.width / 2 - block.left - block.width / 2) <= 1px
abs(headerCenter.left + headerCenter.width / 2 - block.left - block.width / 2) <= 1px
```

The existing tests cover rendering and interactions, but not geometry. A browser-level
visual/layout check is required for acceptance.

## Relevant Files

- `frontend/src/features/automation/workflow/WorkflowWorkspace.tsx`
- `frontend/src/features/automation/workflow/WorkflowWatchUi.tsx`
- `frontend/src/features/automation/workflow/chrome/WorkflowWorkspaceShell.tsx`
- `frontend/src/features/automation/workflow/canvas/WorkflowCanvas.tsx`
- `frontend/src/styles.css`
- `frontend/tests/features/automation/workflow/WorkflowWatchUi.test.tsx`
- `frontend/tests/features/automation/workflow/chrome/WorkflowWorkspaceShell.test.tsx`
