# 0005: Removed the `mounted` Render Gate from `Modal`

**Status:** Accepted
**Date:** 2026-08-08

## Context

`Modal` (`frontend/src/components/ui/Modal.tsx`) held a `mounted` state that started `false` and
only flipped `true` in a `useEffect` that ran after the first commit; until then, `Modal` returned
`null` instead of rendering. Traced via `git log --follow`: it was added in commit `8fa252d`, the
same commit that switched `Modal` from an inline `<div>` to `createPortal(..., document.body)`.
Gating a portal's first render behind a post-mount effect is a standard defensive pattern for
apps that render on the server — `document` doesn't exist during SSR, so a portal must wait for
the client-side mount before it can target `document.body`.

This frontend is a pure client-side Vite SPA: no `react-dom/server` usage, no SSR entry point
(confirmed via `frontend/package.json`, `vite build` only). `document.body` is synchronously
available the moment React starts running in the browser, so the gate was never preventing a real
failure in this codebase — it was copied-in caution from the portal pattern that had no matching
problem here.

Its actual, unintended effect: every `Modal` paid for one extra render/commit cycle before showing
real content. Invisible for a single modal open (the gap is sub-frame). But when one modal is
swapped for another inside the same click handler — e.g. a delete confirm modal replaced by a
delete progress modal (`components/patterns/DeleteConfirmModal.tsx`, used by both the Devices page
device-delete flow and the Account page backup-delete flow) — both state updates batch into a
single React commit: the outgoing modal's portal unmounts, and the incoming modal's first render is
still gated `null`. That commit paints with neither modal visible, producing a one-frame blank
flash between them. This was reported as a visible flicker when switching between the two backup
delete modals.

## Decision

Removed the `mounted` state, its `useEffect`, and the `if (!mounted) return null` early return from
`Modal`. It now renders into the portal on its actual first render. Also removed the `useState`
import, now unused.

Verified before removing that nothing else depended on the extra render pass: no CSS
transition/animation class was conditioned on `mounted` (checked the full component), and no
caller of `Modal` relies on autofocus, measurement, or other mount-order timing tied to it.

## Alternatives considered

- **Keep the gate, fix the flicker by staggering the two `setState` calls** (e.g. close the old
  modal, then open the new one on a following tick/`requestAnimationFrame`). Rejected: trades one
  frame of "both modals gone" for a deliberate, code-visible delay before the new modal appears —
  same user-visible gap, just relocated and now intentional-looking instead of an obvious bug.
- **Add a fade transition gated on `mounted`**, turning the gate into a real animation trigger
  instead of dead weight. Rejected as unrequested scope beyond fixing the flicker; no design-system
  spec currently calls for a modal enter transition.

## Consequences

- Every `Modal` (all current usages) now paints on its true first render instead of one commit
  later. No behavior change observed or expected outside of removing the flash.
- If this frontend ever grows an SSR entry point, this decision should be revisited — the removed
  gate was the correct defense for that case, just not for the app as it exists today.

## Where this lives in code

- `frontend/src/components/ui/Modal.tsx` — the removed gate.
