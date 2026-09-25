# 0027: Static Guided Tour

**Status:** Accepted
**Date:** 2026-09-25

## Context

OpenProject #275 asks for a guided tour for v1.5, under feature #350 (Onboarding & Docu/Info),
whose acceptance criterion is "A startup tour or guide is available in the application". The
ticket requires the tour to be skippable and rerunnable at any time. It leaves open whether each
page gets its own tour or one tour runs at startup.

Nothing tour-related existed. The first-run setup wizard (`frontend/src/features/setup/`) runs
before login and is a separate flow. `AppShell` renders only after auth and completed setup, so a
tour mounted there cannot overlap the wizard.

No design or approved copy exists, and no screenshots are available yet.

## Decision

- **Static modal tour.** One `Modal` walks through fixed steps with Next, Back, Skip tour, and
  Finish. It does not anchor to or highlight live page elements.
- **Single startup tour.** Nine steps: a welcome, one step per main nav area (Dashboard, Minima,
  Wallet, Integritas, Devices, Workflows, Diagnostics), and a closing step. Nav steps take their
  title and icon from `app/nav.ts`, so they follow sidebar renames.
- **Seen flag per browser.** `guidedTourSeenSetting` is a `createLocalBooleanSetting`
  (`localStorage` key `edge-studio:guided-tour-seen`, default `false`). `AppShell` renders the
  tour while it is `false`. Every close path sets it to `true`.
- **Existing installs see it once.** The flag is new, so no stored value means "not seen".
- **Replay from Settings → Behaviour.** "Take the tour" sets the flag back to `false`, which
  remounts the modal at step 1.
- **Fixed 16:9 image slot.** Each step reserves an `aspect-video` frame above the text. It shows
  the step icon and "Screenshot coming soon" until a screenshot is added to the step, so layout
  does not change when images land. Images use `object-contain` so they letterbox rather than crop
  when the modal is height-capped.
- **Backdrop clicks do nothing.** `closeOnOutsideClick={false}` overrides the user's Behaviour
  preference, because an accidental backdrop press would dismiss the tour and mark it seen. X,
  Escape, and Skip tour still close it.

## Alternatives considered

- **Click-through tour anchored to page elements.** Rejected for v1.5 by the ticket. It needs a
  positioning layer, breaks when layouts change, and has to handle responsive and full-bleed
  routes.
- **One tour per page.** Rejected for now. It multiplies copy and screenshot upkeep before anyone
  has asked for it. Revisit if users request it through Feedback.
- **Per-Pi seen flag in the backend** (a new preference behind `/api/preferences`, which only
  stores table-column preferences today). Rejected for v1.5 as extra backend surface for little
  gain. The cost of the per-browser choice is that each new browser shows the tour once.
- **Separate "open" state alongside the seen flag.** Rejected. One boolean covers first visit,
  close, and replay.

## Consequences

- A user who signs in from a second browser, or clears site data, sees the tour again.
- Adding a screenshot is one import plus `image`/`imageAlt` on the step in `tourSteps.ts`.
- Tour copy is a draft written from the current pages. It needs review when screenshots land or
  nav areas change.
- Tests that render `AppShell` must set the seen flag first or the tour opens over them.

## Where this lives in code

- `frontend/src/lib/behaviourSettings.ts`: `guidedTourSeenSetting`.
- `frontend/src/features/tour/tourSteps.ts`: `TourStep` and `tourSteps`.
- `frontend/src/features/tour/GuidedTourModal.tsx`: modal, image frame, and footer controls.
- `frontend/src/components/AppShell.tsx`: renders the tour while the flag is unset.
- `frontend/src/pages/AuthSettingsPage.tsx`: "Guided tour" replay under Behaviour.
