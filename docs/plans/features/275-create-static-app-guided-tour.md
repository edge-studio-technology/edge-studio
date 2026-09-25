# Static Guided Tour Plan

**Status:** Built, awaiting screenshots and copy review
**Created:** 2026-09-25
**Branch:** `task/275-create-static-app-guided-tour`
**Decision record:** `docs/adr/0027-static-guided-tour.md`
**Goal:** Show new users a skippable, rerunnable, static modal tour of Edge Studio's main areas the first time they reach the app shell.

## Tracked Tasks

OpenProject task **#275 Create static App/Guided Tour** (status _In progress_), under feature **#350 Onboarding & Docu/Info**. The parent's acceptance criterion is "A startup tour or guide is available in the application". Sibling #204 (outgoing Docs link in the sidebar) is separate and not part of this plan.

- [x] Tour store and step content (§1, §2)
- [x] `GuidedTourModal` with image frame and placeholder (§3)
- [x] Auto-open from `AppShell` (§4)
- [x] Rerun entry under Settings → Behaviour (§5)
- [x] Tests (§6)
- [x] Docs, ADR, changelog (§Docs)

Deviations from the plan as built:

- No separate "Step X of N" text. `ProgressBar` already shows `X / N` in its pill.
- Screenshots use `object-contain`, not `object-cover`. At 768×600 the modal's height cap shrinks the frame below 16:9, and letterboxing avoids cropping.
- Step text reserves two lines (`min-h-[2lh]`) so the modal height and button positions stay fixed across steps.
- "Take the tour" matches the page's "Check for updates" button (default variant and size, inside `ButtonRow`).
- No `AuthSettingsPage` test. Pages are excluded from coverage. The replay path is covered by the AppShell "reopens when the seen flag is cleared" test and was checked manually.
- OpenProject #275 is updated manually by the user.

## Context

Ticket #275 settled on a **static modal tour** for v1.5, not an advanced click-through that anchors to page elements. It must be **skippable**, and users must be able to **rerun it at any time**. It left open whether to do one tour per page or a single startup tour.

Decisions from the 2026-09-25 discussion:

- **Single startup tour** covering every main nav area. Per-page tours only if users ask for them via Feedback.
- **"Seen" is stored per browser** in `localStorage`, using the existing `createLocalBooleanSetting` helper (`frontend/src/lib/localSettings.ts`). No backend change. A new browser sees the tour once, which is harmless. The alternative was a per-Pi flag behind `/api/preferences` (the existing router only stores table-column prefs). It was rejected for v1.5 as extra backend surface for little gain. Revisit if users find the repeat annoying.
- **Existing installs see it once too.** It is a new feature. No stored flag means "not seen".
- **Rerun lives in Settings → Behaviour.**
- **Layout, top to bottom:** title → image → text → buttons. Images are screenshots supplied later, so each step reserves a fixed image slot with a placeholder until real screenshots land.
- **No design or approved copy exists.** Copy is drafted from the current pages. Styling stays within ESDS tokens/components so it doesn't drift.

What already exists to build on (audit against `1eb4ebd`):

- Nothing tour-related exists. "Onboarding" in the code means the pre-login setup wizard (`frontend/src/features/setup/`), which is separate. The tour only mounts inside `AppShell`, which only renders after auth and completed setup (`AuthProvider` gates it), so the two can't overlap.
- `components/ui/Modal.tsx` provides portal, Esc, scroll lock, close button, `closeOnOutsideClick` override, and a `footer` slot.
- `components/ui/ProgressBar.tsx` shows step progress.
- `AppShell.tsx` already mounts `FeedbackModal` conditionally. The tour modal mounts the same way.
- `lib/behaviourSettings.ts` holds the two existing local settings. `AuthSettingsPage.tsx` → Behaviour `Disclosure` renders them as `SubSection`s.
- `app/nav.ts` provides nav labels and icons, reused for step icons so the tour matches the sidebar.

## Frontend changes

### 1. Tour "seen" setting

Add to `frontend/src/lib/behaviourSettings.ts`:

```ts
export const guidedTourSeenSetting = createLocalBooleanSetting("guided-tour-seen", false);
```

One boolean drives everything. There is no separate "open" store:

- `AppShell` renders the tour while `seen === false` (read with `useSyncExternalStore`, same as `Modal` reads `closeModalOnOutsideClickSetting`).
- Closing by any path (Skip, X, Esc, Finish) calls `guidedTourSeenSetting.set(true)`.
- Rerun calls `guidedTourSeenSetting.set(false)`, and the modal reopens at step 1 because it remounts.

### 2. Step content — `frontend/src/features/tour/tourSteps.ts`

```ts
export type TourStep = {
  id: string;
  title: string;
  body: string; // 1–3 short sentences
  icon: LucideIcon; // placeholder visual; reuse nav icons
  image?: string; // imported asset URL, added later
  imageAlt?: string; // required when image is set
};
```

Draft steps (copy to be refined during build):

1. **Welcome to Edge Studio.** What the app does: connect devices, automate, and prove data on Minima via Integritas.
2. **Dashboard.** Health at a glance and the suggested next step.
3. **Minima.** Your node: status, peers, backups, console.
4. **Wallet.** Balances, send/receive, tokens, address book.
5. **Integritas.** Stamp files and data, track proofs, verify.
6. **Devices.** Connect sources (sensors, webhooks, MQTT, camera, GPIO) and output targets.
7. **Workflows.** When / Condition / Then automations built from blocks.
8. **Diagnostics.** Reads, runs, and errors to troubleshoot.
9. **You're set.** Settings (rerun this tour under Behaviour), the Feedback button, and Marketplace coming soon.

Screenshots go in `frontend/src/assets/tour/` and are imported in `tourSteps.ts`, so Vite fingerprints them. Adding a screenshot is a one-line change per step.

### 3. `frontend/src/features/tour/GuidedTourModal.tsx`

Props: `{ onClose: () => void }`. Local `stepIndex` state.

Built on `components/ui/Modal`:

- `title` = step title. `description` = `ProgressBar` + "Step X of N" (`type-meta`).
- Body (`bodyScrollable` false):
  - **Image frame:** fixed `aspect-video` (16:9), full width, `rounded-soft border border-stroke-secondary bg-surface-primary overflow-hidden`.
    - With `image`: `<img src alt className="h-full w-full object-cover">`.
    - Without: centered step icon + "Screenshot coming soon" (`type-meta text-text-disabled`). The layout stays identical, so nothing jumps when images arrive.
  - **Text:** `type-body text-text-primary`.
- `footer`: `Skip tour` (ghost, pushed left) · `Back` (secondary, hidden on step 1) · `Next` (primary) → `Finish` on the last step.
- `closeOnOutsideClick={false}`. A stray backdrop click would otherwise dismiss the tour and mark it seen. X, Esc, and Skip remain.
- Uses ESDS `ui/Button`, not the legacy flat `components/Button`.

Check the frame fits `Modal`'s `max-h-[min(90vh,760px)]` at 1024×768 (see `docs/adr/0024-responsive-layout-strategy.md`). If not, cap the frame height and keep 16:9 via `object-contain`.

### 4. Auto-open — `frontend/src/components/AppShell.tsx`

```tsx
const tourSeen = useSyncExternalStore(guidedTourSeenSetting.subscribe, guidedTourSeenSetting.get);
...
{!tourSeen && <GuidedTourModal onClose={() => guidedTourSeenSetting.set(true)} />}
```

It shows on whatever page the user lands on (normally `/dashboard`), including full-bleed workflow routes. This is acceptable because it's a one-time modal.

### 5. Rerun — `frontend/src/pages/AuthSettingsPage.tsx`

Add a third `SubSection` in the Behaviour `Disclosure`:

- Icon: `Compass` (lucide).
- Title: "Guided tour". Description: "Replay the introduction to Edge Studio's main areas."
- Button: `Take the tour` (secondary, `sm`) → `guidedTourSeenSetting.set(false)`.

### 6. Tests

- `frontend/tests/features/tour/GuidedTourModal.test.tsx` (new):
  - Step 1 renders with progress; Back is hidden on step 1.
  - Next/Back move between steps; the last step shows Finish, and Finish calls `onClose`.
  - Skip, X, and Esc each call `onClose`. A backdrop mousedown does not.
  - The placeholder renders when there's no `image`; an `<img>` with alt renders when there is one (mock a step list or pass steps as an optional prop for tests).
- `frontend/tests/components/AppShell.test.tsx`:
  - The tour opens when the setting is unset, and stays closed when it's `true`.
  - Closing sets it to `true`.
  - Existing AppShell tests must pre-set the seen flag (or clear/seed `localStorage` in `beforeEach`) so the modal doesn't interfere with their queries.
- `frontend/tests/lib/behaviourSettings.test.ts`: key and default for `guidedTourSeenSetting`.
- Settings rerun: `AuthSettingsPage` has no test file today. Add a focused `frontend/tests/pages/AuthSettingsPage.test.tsx` case asserting that "Take the tour" sets the flag to `false`, or cover it via `AppShell` if page setup proves heavy.

## Docs

- `CHANGELOG.md`: under `## [Unreleased] task/275-create-static-app-guided-tour` → `Added`: first-visit guided tour, and rerun from Settings → Behaviour.
- `README.md`: one line in the usage/UI section on the tour and where to rerun it.
- `docs/frontend-design-system.md`: short section on the tour image frame (16:9, tokens, placeholder rule) so future screenshot/illustration slots reuse it.
- `docs/adr/0027-static-guided-tour.md` via the `adr` skill: static vs click-through, single vs per-page, per-browser `localStorage` vs per-Pi backend flag. Check `ls docs/adr` for the next free number first.
- `SECURITY.md`: no change. Client-only, no new exposure.
- `docs/SESSION.md` / `docs/TASKS.md` via `session-notes` at the end.
- OpenProject #275: comment with the plan path. Move to _Ready for Deployment_ (22) once built and verified.

## Verification

```bash
npm run check
npm --prefix frontend run build
```

No backend, Docker, or shell changes, so backend build and `docker compose config` are only needed if that changes.

Manual (`npm run dev:frontend` against the running backend):

1. Clear `edge-studio:guided-tour-seen` in localStorage → reload → the tour opens on the dashboard.
2. Step through with Next/Back. The progress bar and "Step X of N" update, and the placeholder frame keeps the same size on every step.
3. Skip → reload → the tour does not reopen.
4. Settings → Behaviour → Take the tour → the tour reopens at step 1. Finish → it stays closed after reload.
5. Esc and X close the tour and mark it seen; a backdrop click does nothing.
6. Check at 1024×768 and 768 wide: the whole modal fits without clipping the buttons.
7. `git status --short --untracked-files=all` before committing.
