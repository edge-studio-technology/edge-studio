# Changelog

All notable changes to `integritas-pi` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) at the package level.

## [Unreleased] ui/global-style-realignment

### Added

- New 404 "Page not found" page, now shown for any unmatched app route (previously silently redirected to the dashboard) — icon, title, description, and a "Back to dashboard" action, via a new shared `StatusPage` layout (`components/patterns/`) for whole-page icon/title/description/action states.
- New `/marketplace` page ("Coming soon"), reached from the existing sidebar "Marketplace" nav item, which previously had no route and fell through to the dashboard. Built on the same new `StatusPage` layout as the 404 page.
- New "Something went wrong" fallback, shown in place of a crashed page's content (sidebar/header stay up) instead of a blank white screen, via a new `ErrorBoundary` (`components/ErrorBoundary.tsx`) wrapping routed page content — resets automatically on navigation, with a "Reload page" action for anything it can't recover from on its own.
- New "Behaviour settings" section on the Account settings page with a "Close modal when clicking outside it" toggle (on by default, stored in the browser via a small reusable local-preference helper (`lib/localSettings.ts`), not on the backend) and a "Start sidebar collapsed" toggle (off by default) fixing the sidebar always starting expanded at desktop widths on every refresh regardless of how it was last left.

### Changed

- Remaining user-facing "Integritas Pi" product-name references (TOTP issuer/account labels, device setup copy, ESP32/MQTT/GPIO/BME guides, onboarding wizard brand mark) renamed to "Edge Studio", matching the earlier in-app rebrand. Also caught leftover pre-"Edge Studio" brand names still live in the app: "Edge Workbench" (TOTP account label, setup page, Integritas Connect panel, onboarding wizard's "Enter" button) and "Minima Edge Stack" (setup page). The repository name (`integritas-pi`, package names, Docker network/service names, file paths) is unchanged and will be renamed separately with the full repo rename.
- Login page restyled to match the onboarding wizard: full-screen black → purple brand backdrop with the Edge Studio logo lockup at the bottom of the screen (previously a small lockup image inside the card on a flat grey background), and a centered "Welcome back" card built from shared ESDS components (`Card`, `InputField`, `Button`) instead of bespoke raw-Tailwind markup. Log in failures now show as an inline field error under the password input (red input border + message) rather than loose text above the button, and the action reads "Log In". Password/PIN sign-in is unchanged.
- Pressing Enter in the login password (or two-factor code) field now submits the form instead of doing nothing.
- Onboarding wizard header now renders the actual `BrandMark` logo instead of a generic `Layers3` placeholder icon.
- Account page's backup delete confirmation now reuses the same delete confirm/progress modal pattern as the Devices page, extracted into a shared `DeleteConfirmModal`/`DeleteProgressModal` component (`components/patterns/`).
- "Send feedback" modal restyled onto shared ESDS components (`Modal`, `SelectField`, `InputField`, `TextareaField`, `Card`, `Button`, `ButtonRow`) and design-system colour/type/spacing tokens, replacing bespoke raw-Tailwind (`slate-*`, `rounded-2xl`, ad hoc borders) markup. No behavior change.
- Account page's Integritas/Minima status pills now show the same status dot indicator as the header status bar (`Pill`'s `indicator` prop was set on the header's pills but not these), so both use identical chrome for the same status concept instead of drifting apart visually.
- Account page's "Check updates" action moved out of the page header into a new "Software update" subsection (User settings), and a new "Feedback" subsection was added next to it with a direct "Export feedback JSON" download — so operators can get the local feedback export file without having to submit a new feedback entry first. Renamed the in-app Update page's title from "Update" to "Software update" to match.
- Update page's "Update now" action moved out of the page header into the body, next to the "Update available"/version copy it acts on; the header now only shows "Check again" once already up to date.
- `update-agent`'s own static update-progress page (`/update/`, shown during an in-progress apply) now shows the Edge Studio logo lockup above the status card, matching the login page.
- Added `LinkButton` (`components/ui/Button.tsx`): `Button` chrome rendered on a real `<a>`, for actions that must be a link (e.g. file downloads) rather than a click handler. Used by the new "Export feedback JSON" action and the "Send feedback" modal's existing download link (previously a one-off locally-styled anchor).
- Shared `DeleteConfirmModal`'s icon retoned from the red "error" icon color to the same neutral/secondary icon color as the new `StatusPage` states, so icon color no longer duplicates what the red "Delete" button already conveys. The "Delete" button itself is unchanged (still `danger`/red).
- Sidebar "Marketplace" nav item now actually links to `/marketplace` — it had hardcoded a redirect to `/dashboard` while the route didn't exist yet; that hardcode was never removed once the page landed.
- `StatusPage` (404/coming-soon/error states) now centers within the actual remaining page height below the header instead of a fixed `70vh` guess, which under- or over-shot depending on viewport height. `AppShell`'s content area is now a proper flex column so page content can size against it precisely.
- Account settings page's "User settings", "Integritas settings", and "Minima settings" sections now start collapsed instead of expanded.
- Account settings page's "Integritas settings" status badge now shows a neutral "Checking…" state while loading instead of popping in once resolved, matching the "Minima settings" badge's existing behavior.
- Shared `Modal` closes on an outside press again (previously disabled entirely after it closed unexpectedly): it now only reacts to `mousedown` landing directly on the backdrop, not `click`/release, so a text selection or drag that starts inside the dialog and ends outside it can no longer trigger an accidental close. A small padding buffer around the dialog edge also absorbs near-edge presses so they don't count as "outside". Gated by the new Account page "Close modal when clicking outside it" setting.
- Minima settings "Restore from backup" modal's `.bak` file picker now uses the same drop box as the Integritas stamp/verify pages (`components/patterns/FileDropBox.tsx`, moved there from the Integritas feature folder since it's now shared) instead of the older compact `FileDropZone`, matching its larger drag target, reject toast for non-`.bak` files, and disabled-while-restoring state. `FileDropZone` is removed as it had no remaining callers.
- Minima settings "Backups" and "Peers" lists (Account page) now render as a height-limited, scrollable `DataTable` instead of a collapsible `ListDisclosure`, so the list is visible without an extra expand click. `ListDisclosure` (`components/patterns/`) is left in place, marked as an unused/possible-deprecation candidate, since it has no remaining callers after this change. The Backups table now splits "Size" and "Created" into separate columns (previously one combined cell) and shows "Created" via the same shared local-timestamp formatting used by other history tables (Integritas proofs, wallet history, automation runs), instead of a one-off local+UTC string. Both tables also no longer reserve empty scrollbar space when their content doesn't overflow (`ui/ScrollArea`'s new `stableGutter` prop, off for these two, on elsewhere).
- Minima page's RPC console refactored to use the shared `Disclosure` component; whitelist button moved into the console toolbar and console styling improved for dark-terminal contrast.

### Fixed

- Fixed a brief blank flash whenever one `Modal` is swapped for another in the same action (e.g. backup/device delete confirm → progress modal): the shared `Modal` gated its first paint behind a post-commit effect for no visual purpose (no mount transition used it), so a modal-to-modal swap always had one frame with neither visible. Removed the gate.

## [0.32.0] 2026-08-08

### Added

- `NoticeCard` shared component (`components/patterns/`): standalone call-to-action card (title, body, action, optional dismiss) for chrome outside page layout. Used in the sidebar, above Feedback, to surface an "Update available" notice driven by the existing update-status poller, with a per-version dismiss.
- New in-app Update page (`/update`, not yet linked from the sidebar nav): shows the live up-to-date/available check and starts an update, styled with the same shared components as the rest of the app. See [docs/adr/0002-update-page-split.md](docs/adr/0002-update-page-split.md).
- `UPDATE_DRY_RUN` env var for `update-agent` (dev only, defaults off, never set by `install.sh`): simulates a successful update apply — same running/succeeded flow, no manifest recorded as applied — without pulling or swapping any container, so the Update flow can be exercised repeatedly in dev. See [docs/adr/0003-update-dry-run.md](docs/adr/0003-update-dry-run.md) and `SECURITY.md`.
- `Spinner` shared component (`components/ui/`): rotating ring loading indicator matching `update-agent`'s waitroom page style, replacing ad hoc `lucide-react` `Loader2`/`animate-spin` usage in `ProgressModal`, `DeleteDeviceProgressModal`, and the Connect Integritas setup step so all spinner-style loaders share one style.
- Update page now shows a "What's new" changelog preview (most recent entries of `CHANGELOG.md`, fetched directly from GitHub, rendered client-side — no server proxy), replacing the per-service update-available row list. Each version is a collapsible `Disclosure` (most recent expanded by default). Heading sizes reuse the app's existing two-tier convention: "Up to date"/"Update available" and "What's new" (sibling section headers) at `type-title`, version names at `Disclosure`'s own `type-body-em`, category labels at `type-meta`. Experimental: see [docs/adr/0004-update-page-changelog.md](docs/adr/0004-update-page-changelog.md) for the security/architecture tradeoffs (client-side third-party fetch, no HTML injection).

### Fixed

- `CredentialInput` no longer breaks `tsc`/the frontend build: its props type didn't exclude the native HTML `size` (`number`) attribute the way `Input` (which it wraps) requires, so any change touching the frontend build tripped a pre-existing type error even though the component has no live call sites yet.

### Changed

- Native frontend dev (`npm run dev:frontend` against an otherwise-Dockerized stack) can now reach `update-agent`: Vite's dev proxy forwards `/update/...` (trailing slash and deeper) to `http://localhost:8081`, alongside the existing `/api` → `backend` proxy. Requires publishing `update-agent`'s port via a local (gitignored) `docker-compose.override.yml`, documented in the README — dev-only, and `install.sh` regenerates its own copy of that file on every install, so it never affects a deployed Pi.
- The Update page is now split: the in-app `/update` page (above) handles checking for updates and starting one; `update-agent`'s own static page, at `/update/` (trailing slash), is trimmed down to only the apply-in-progress/success/failure view, and no longer starts a job on its own — visiting it directly with nothing running now shows a neutral "nothing to update right now" state instead of the old checking/available screens.
- "Check for updates" (Account settings) and the sidebar update notice now navigate to `/update` in-app instead of a full page reload.
- `update-agent`'s own waitroom page (`/update/`, plain static HTML/CSS — no build step) now uses the same ESDS token values (colors, radius, type scale) as the in-app Update page instead of ad hoc hex colors, so the two pages read as one continuous flow.
- In-app Update page: "Update now"/"Check again" moved into the page title row (`Page`'s `action` slot) instead of sitting in the card body; it renders disabled from first paint instead of popping in once the status check resolves. The card is now full width instead of capped at `max-w-xl`.
- `Page`'s `action` prop is no longer marked deprecated — it's an active, intentional right-aligned header-action slot (used by Account settings and now Update), not dead API surface.

### Fixed

- Sidebar nav item and feedback-modal page label no longer default to "Dashboard" on routes with no matching nav entry (e.g. `/update`, which is intentionally not in the sidebar nav) — nothing is now highlighted instead of incorrectly highlighting Dashboard.

## [0.31.0] 2026-08-07

### Added

- Alternative add-device modal flow on the Devices page, now the default: two steps (Input source / Output target → Add device) instead of three, with Back and the add action in the modal footer. It offers manual device setup only — guided template presets (ESP32 MQTT Board, GPIO Button, PIR Motion Sensor) are not listed while guided setup is reworked. Wiring notes and hardware-not-enabled warnings are not shown in this flow yet; per-device setup guides still open after saving.
- `AltOptionCard` shared component: quieter choice card with a bare glyph, title, short description, and an explicit action button (the card surface is not pressable).
- Device setup guides now open in a reusable modal with collapsible sections (wiring, testing, troubleshooting, code examples) and optional action blocks to create Automation workflows.
- `EmptyState` shared component (`components/patterns/`) for icon + title + description empty states.
- `DeleteDeviceConfirmModal` and `DeleteDeviceProgressModal` components to show confirmation and progress during device deletion.
- Devices list now supports pagination with configurable page size (25, 50, 100 rows per page).

### Changed

- The previous three-step add-device flow is kept intact for comparison under `features/data-sources/add-device-classic/`; the new flow lives in `features/data-sources/add-device-alt/`. Which one renders is a single constant in the Devices page until the old flow is removed.

- Devices page now offers **Add input source** and **Add output target** as two direct buttons, removing the extra "Add device or source" choice step that previously sat in front of them. The template/manual step and its Back control are unchanged.
- Local services card lists the LAN and internal MQTT broker URLs as labelled fields with per-field Copy buttons (with copied confirmation), and shows the broker Enabled/Disabled state as a status pill.
- Table cards (Configured devices, Integritas history, data reads history) use the shared design-system card heading style.
- Device details modal now shows health and last-preview sections as collapsible `Disclosure` components with timestamps and structured error panels.
- DataTable card titles now use ESDS `type-title` and `type-body` typography instead of legacy `<strong>` / `MutedText`.
- Device setup guide section titles now include "Guide" suffix (e.g., "ESP32 MQTT Board Setup Guide") for clarity.
- Device setup guide sections are now organized with `Disclosure` components for collapsible subsections and guide actions, with `CommandBlock` components supporting copy-to-clipboard for command examples.
- Data source health check errors now include the checked-at timestamp and source URL in the backend response, shown in the details panel.
- Devices list rows show truncated data-source hashes extracted as a reusable `TruncatedHash` component.

## [0.30.3] 2026-08-07

### Added

- Shared `Text` family (`components/ui/`): `Text.Link` for in-app text links with accent hover (more roles planned). Flat `components/Text.tsx` re-exports; legacy `MutedText` stays there for now.
- Text colour token `text-accent-hover` (`brand-02`) for accent link hover, paired with `text-accent`.
- Shared `ErrorDetails` in `components/patterns/`: Dialog with Type / Message / Native / Context / optional Additional context / Raw, and Close action. Flat `components/ErrorDetails.tsx` kept for older call sites.
- Shared `JsonBlock` in `components/patterns/`: inverse mono pretty-printed JSON in a scroll area for embedding in modals and disclosures.

### Changed

- Diagnostics page uses a card shell (`TabList` + content) with `ListFilterBar`, Refresh, and `ListPaginationFooter` instead of `ListPagerFilterBar`.
- Diagnostics load/refresh failures use `ErrorAlert` instead of inline `ErrorText`.
- Diagnostics shows a per-tab description under `TabList` for proofs, reads, and workflow logs.
- Integritas proof history table on Diagnostics uses ESDS table primitives, `formatLocalDateTime`, status pills, and bulk actions without a nested `TableCard`.
- Diagnostics read history table uses the same ESDS table primitives, `formatLocalDateTime`, and status pills, without a nested `TableCard`.
- Diagnostics workflow logs table uses ESDS table primitives, `formatLocalDateTime`, status/trigger pills; Eye opens a run inspect modal and `TableIconMenu` offers Show on canvas. The modal shows a plain summary (failed block, type, message) plus disclosures for workflow error JSON, per-block error JSON, and full run data (`JsonBlock`; no nested error dialogs).
- `JsonPreview` modal body uses shared `JsonBlock`.
- Read history uses patterns `ErrorDetails` for row error inspection.
- Read history Integritas proof IDs link to Diagnostics proof history filtered by that proof ID (`Text.Link` “Open proof”).
- Read history preview uses an Eye `TableIconButton` (same pattern as proof payload / workflow-log inspect).
- Proof verify on Diagnostics toasts Full match / No match from the verify response; the active row shows “Verifying…”.
- Proof history selection bar shows count + Clear, icon Download/Delete actions, delete confirmation, and success toasts; download stays available while verifying.
- Proof history header checkbox selects or clears all proofs on the current page (indeterminate when partially selected).
- Proof history “View” payload control is an Eye `TableIconButton` (same pattern as workflow-log inspect), opening the proof payload modal.
- Proof history Eye (view payload) and Download sit in the Actions column with Verify; separate Payload/Download columns removed.
- `JsonPreview` accepts an optional `title` for the modal (proof history uses “Proof payload”).
- `CheckboxField` `label` defaults to `"Label"`; pass `label={null}` with `aria-label` for control-only use (e.g. tables).

## [0.30.2] 2026-08-05

### Added

- Shared native table row primitives on `DataTable`: `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell` (wallet assets and history lists migrated).
- `formatLocalDateTime` in `frontend/src/lib/time.ts` for compact local date+time in tables and detail fields.

### Changed

- Wallet history tab matches assets: `ListFilterBar`, `ListPaginationFooter`, table primitives, `LoadingDots`, status `Pill`, and clear-filters empty state.
- Wallet history UX: amount/token hierarchy, status pills, semantic `<time>`, fuller empty state, `ErrorAlert` on load failure, and descriptive row action labels; send detail modal aligned with asset detail layout.
- Address book tab matches assets/history ESDS: `ListFilterBar`, `ListPaginationFooter`, table primitives, `LoadingDots`, `InputField` forms, `ErrorAlert`, and contact detail modal; Add contact lives in the panel.
- Wallet send history table and detail modal use `formatLocalDateTime` instead of raw `toLocaleString()`.
- `DataTable` no longer forces `min-w-190`; tables fill the container, and wide lists still opt in (e.g. `min-w-[920px]`). `TableWrap` keeps horizontal scroll when content overflows.
- Wallet asset detail modal: sendable hero, side-by-side confirmed/unconfirmed tiles (warning when pending), token type pill, copyable ID last.
- Moved `CopyableCode` into `components/patterns/` and restyled with design-system tokens / `IconButton`; flat re-export kept. Copy shows a success toast (error toast if clipboard fails).
- Wallet hero focuses on balance with Send + Receive actions; receive opens a modal with copyable address. Receive on the dark hero uses local button styles with hover; shared Button `onDark` variant removed.
- Wallet sections use `TabList` in a card; node-unavailable warning uses `ErrorAlert` (`status="warning"`).
- Wallet hero inlines dark surface styles (`DarkHeroCard` removed).
- Send payment modal uses `ToggleTabs`, `ErrorAlert`, and design-system Button/Modal.
- `ToggleTabs` adds optional `size="sm"`.
- `Input` / `InputField` add optional `size` (`md` \| `sm`), matching `SelectField`.
- Moved `DataTable` into `components/patterns/`; flat re-export kept.
- `TableIconMenu` adds a ⋮ overflow menu for secondary row actions (primary icon stays visible).
- Wallet asset list pagination now uses shared `ListPaginationFooter` with compact rows/page-size controls (`SelectField` `size="sm"`) and `ListPagerFilterBar` can hide its pager via `showPager`.

## [0.30.1] 2026-08-05

### Added

- New ESDS logo/brand assets (`frontend/public/es_logo/`), replacing the old favicon SVGs; `BrandMark` renders the new lockup.
- Sidebar nav shows scroll up/down arrows when its items overflow the available height.

### Changed

- Moved the app version indicator from account settings into the sidebar.

## [0.30.0] 2026-08-05

### Added

- Shared `DetailList`/`DetailRow` (`components/patterns/`) for label/value detail rows, replacing hand-rolled `<dl>` markup duplicated across the Megammr host config and Integritas Connect profile panels.

### Changed

- Account settings page and its Minima backup/Integritas Connect panels: replaced hand-rolled icon buttons and inline-hex-styled text with the shared `Button`/`IconButton` components and ESDS text-color tokens, for visual consistency with the rest of the design system.
- Backups/peers list inside `ListDisclosure` now scrolls within a fixed max height instead of growing the page unbounded.

## [0.29.1] 2026-08-04

### Added

- Integritas verify shows an in-panel loading result shell (with bouncing dots) while a proof file upload is in progress; the selected-file remove control is disabled while stamp/verify is busy.

- Moved `ButtonRow` into `components/patterns/` with design-system spacing (`gap-detail-next`); flat re-export kept.
- Integritas stamp and verify failures that return HTTP 402 (plan/API limit) are now classified as `payment_required` and show an upgrade toast (and a clear automation stamp error) instead of a generic stamp/verify failure.
- Integritas “Prove local data” now switches stamp and verify with tabs in one card instead of side-by-side panels
- File drop zones on Integritas stamp/verify use the shared upload pattern (clear selected file, design-system styling). Verify accepts JSON only and shows an error toast when another type is dropped.
- Stamp and verify success stay in-panel (status badge, file/hash, next steps) instead of resetting to an empty drop zone and showing a card below the grid.
- Integritas stamp/verify receipts: status pill + stamp fields (file/UID/hash) and a Diagnostics link; verify shows Full match / No match only. Stamp result actions use matching compact secondary controls (`JsonPreview` button variant).
- `JsonPreview` button variant no longer forces full width; pass `className="w-full"` when needed.

### Removed

- Runtime configuration modal on the Integritas Prove page (Connect link status, `baseUrl`, `requestId`, and related debug fields).

## [0.29.0] 2026-08-04

### Changed

- Automatic Minima node backups now run at a fixed nightly time (00:30 on the backend container's clock) instead of a rolling 24-hour interval from container start, so they land overnight instead of at whatever hour the container happened to boot. A new `TZ` environment variable (default `UTC`) sets the backend container's timezone so "nightly" can mean the Pi's actual local night.
- Restarting the Minima node now shuts it down gracefully first: it sends the node a `quit`-with-compaction command and waits (up to 5 minutes, since the node can take a while to actually stop even after reporting shutdown complete) for it to actually stop before starting it back up, instead of immediately force-stopping the container. If the node still hasn't stopped after that, it falls back to the previous forceful restart so the action still always completes.

## [0.28.3] 2026-08-03

### Added

- Shared `Disclosure` (`components/ui/`) for native collapse/expand sections with lucide chevron styling; the workflow toolkit now uses it for block categories.
- Shared `ScrollArea` (`components/ui/`) for panels and rails that need thin ESDS-token scrollbar styling; the workflow toolkit now uses it.

### Changed

- Moved `LoadingDots` into `components/ui/` (flat re-export kept).
- Moved `ErrorText` into `components/ui/` (flat `Text` re-export kept).
- Moved `JsonPreview` into `components/patterns/` (flat re-export kept).
- Removed legacy `Eyebrow` text helper; section labels use `type-meta` + text colour tokens.
- Shared `Modal` Dialog layout: scrollable body, footer actions, nesting-safe scroll lock when stacked.
- Minima RPC console UI aligned with the design system (actions, scrollback, loading state).
- Minima console whitelist: clearer command list, select-all per group, PIN/password confirm on save.
- Minima container restart uses a confirm Modal instead of the browser confirm dialog.
- Minima in-progress feedback uses short warn Pills on the Sync/Container cards; detailed RPC/Megammr copy moved to toasts (page banner removed).
- Automation workflow create/edit/watch canvases now use the new ESDS/Figma-inspired workflow frame, explicit workflow routes, full-bleed shell layout, right-side toolkit, flat category block cards, selected-block treatment, and create-workflow leave confirmation.
- Automation selected-block inspector now opens as a full-height viewport side sheet above the workspace chrome, with cleaner section cards and shared form controls.
- Automation watch-mode runtime inspector now uses the same section-card hierarchy for run summary, block status, output JSON, and Diagnostics links.
- Automation watch-mode Run controls now share the same rail panel shell and header typography as the workflow toolkit.

### Fixed

- Closing stacked modals no longer leaves page scrolling stuck (e.g. after saving the Minima whitelist).

## [0.28.2] 2026-07-30

### Added

- Shared `MetricCard` (`components/patterns/`) for standalone compact metric tiles (label, optional icon + value, description; `loading` / `status`). Shared `Status` is `neutral` \| `success` \| `warning` \| `error` (separate from Pill `Tone`). Dashboard live-status grid uses it. See `docs/frontend-design-system.md`.
- Frontend spacing: `pad-*` tokens (same values as Figma `esds.spacing.margin.*`) for container edge padding. Prefer `pad` for new / migrated UI; legacy `margin-*` kept until remaining call sites migrate.

### Fixed

- Dashboard getting-started card now also checks for workflows and hides once at least one non-archived workflow exists (it previously only looked at devices, so “Create your first workflow” stayed visible after setup).

### Changed

- Migrated Dashboard shared UI into design-system homes: `Button` / `IconButton`, `Card`, `Pill`, and `Text` → `components/ui/`; Dashboard (and next-action) import from `ui/` / `patterns/Page`. Flat paths re-export for other call sites. See `docs/frontend-design-system.md`.
- Dashboard matches ESDS layout:, next-action card (accent CTA, numbered 1→2 steps with connector), single metric grid, and restyled live activity. Sidebar/status bar already come from the shell.
- Refactor Dashboard
- Shared `Page` is the content frame (`p-pad-distant`, title + optional description / action) in `components/patterns/`; `components/Page.tsx` re-exports. Content padding moved from `AppShell` onto `Page`. Removed `Section` (folded into `Page`). `eyebrow` still accepted but unused — Dashboard migrated; other pages later.
- Shared `Card` is a surface only (white fill, `rounded-soft`, padding via `size="Default" | "Compact"` using `p-pad-*`, overflow clip). Layout (`flex` / `grid` / `gap`) belongs on the caller.
- Renamed container-edge spacing utilities from `inset-*` to `pad-*` (`p-pad-tight`, etc.); removed `--spacing-inset-*`.

## [0.28.1] 2026-07-30

### Added

- Devices now include a `BME680 Environmental Sensor` input template that reuses the opt-in I2C sensor helper and readable BME sensor automation path.
- The sensor helper installer now creates and preserves a dedicated Python virtualenv for the PyPI `bme680` module, avoiding repeated installs and unavailable distro packages such as `python3-bme680`.

## [0.28.0] 2026-07-30

### Added

- Devices now include a `BME280 Environmental Sensor` input template backed by an opt-in host-side I2C sensor helper (`ENABLE_SENSORS=true`). Manual reads and Automation `Fetch data source` blocks can hash temperature, humidity, and pressure JSON for Integritas stamping.
- Devices now expose reusable setup guides from the configured-device list for every supported source/target type, and newly added devices automatically open their guide after saving.
- BME280 and HTTP JSON setup guides now include a `Create basic workflow for this device` action that creates a disabled manual workflow with `Fetch data source` and `Show preview` blocks.
- Hardware-backed device templates such as GPIO, Pi Camera, and BME280 are now selectable even before their required `ENABLE_*` install flag is enabled, so users can save the device and read its setup guide first.
- Hardware wiring guide sections now include a `Wiring schematic` popup with a Raspberry Pi 40-pin GPIO header pinout.

## [0.27.1] 2026-07-30

### Added

- Shared `StatusBar` (`components/`) for the ESDS app status bar (status Tags + Local/UTC clocks). Shell chrome used by `AppShell` in place of the previous header status/clock chrome. See `docs/frontend-design-system.md`.
- Shared `Tooltip` (`components/ui/`) for ESDS tooltip / toggletip (trigger + portal positioning, hover/focus or click, Escape / outside dismiss, basic flip). See `docs/frontend-design-system.md`.
- Toast system now supports `tone: "warning"`.
- Shared `SelectField` (`components/ui/`) for ESDS select fields (label / description / control / error; optional placeholder; default / disabled / error). See `docs/frontend-design-system.md`.
- Shared `SwitchField` (`components/ui/`) for ESDS switch fields (on / off × default / disabled; optional label / description). See `docs/frontend-design-system.md`.
- Shared `RadioField` (`components/ui/`) for ESDS radio fields (selected / unselected × default / disabled; optional description; group via shared `name`). See `docs/frontend-design-system.md`.
- Shared `CheckboxField` (`components/ui/`) for ESDS checkbox fields (checked / unchecked / indeterminate × default / disabled; optional description). See `docs/frontend-design-system.md`.
- Shared `ProgressBar` (`components/ui/`) for ESDS step progress (optional back IconButton, accent track, step count Tag). See `docs/frontend-design-system.md`.
- Shared `TabList` (`components/ui/`) for ESDS underline tabs (active / hover / inactive; optional icons). `TabItem` is internal. Prefer this over `SubTabs` for page-level tab strips. See `docs/frontend-design-system.md`.
- Shared `ToggleTabs` (`components/ui/`) for ESDS segmented toggles (selected inverse / idle ghost on a secondary track). Prefer this for compact binary/segmented controls. See `docs/frontend-design-system.md`.
- Shared `Menu` (`components/ui/`) for ESDS menu lists (rows via `items`; built-in Plus icon; default / hover / disabled). `MenuItem` is internal to the component. See `docs/frontend-design-system.md`.
- Shared `InputField` for ESDS labeled text fields (label / description / control / error). Prefer this over bare `Input` for login and other forms. See `docs/frontend-design-system.md`.
- Shared `Input` matches the ESDS Input Field control look; `InputField` composes it.
- Shared `PinField` (`components/ui/`) for ESDS segmented 6-digit code entry. See `docs/frontend-design-system.md`.
- Shared `TextareaField` (`components/ui/`) for ESDS labeled multiline text fields (label / description / control / error). See `docs/frontend-design-system.md`.
- Shared `Pagination` (`frontend/src/components/ui/Pagination.tsx`) with prev/next controls and a condensed page-number list (ellipsis gaps). Includes a stable full-width layout so prev/next don’t shift when the visible page window changes.

### Changed

- First-run setup wizard restyled to the ESDS onboarding layout: centered card, shared `ProgressBar` / accent Continue, brand mark in the footer, and a dark-to-accent gradient on the final Integritas Connect step (replacing the old header/footer chrome and line-grid background).
- Setup account step uses shared `ToggleTabs`, `PinField`, and `InputField`; password requirements checklist and labels are shortened to match the design system.
- Shared `PinField` shows filled digits as dots (placeholder dashes when empty) and highlights only the active slot while focused.
- Shared `Tooltip` bubble uses a `stroke-secondary` border (including beak edges) so it remains visible on white / light surfaces.
- `Clock` now renders as ESDS Tag pills (`Local …` / `UTC …`) to match the Status Bar design.
- Shared `ErrorAlert` moved to `components/patterns/` and restyled to ESDS feedback chrome (white surface, `stroke-error` border, `feedback-error` wash; optional title / recovery action). Flat `components/ErrorAlert.tsx` re-exports. See `docs/frontend-design-system.md`.
- Shared toasts restyled to ESDS Notification visuals (Light / Dark / Error / Warning) inside `ToastProvider`; `useToast` API unchanged.
- Shared `Modal` now matches ESDS Dialog Type=Modal (`components/ui/`; max-width 600, close IconButton, optional description/footer). Flat `components/Modal.tsx` re-exports. Sheet variant not yet implemented. See `docs/frontend-design-system.md`.
- Moved `Menu`, `PinField`, `TabList`, `TextareaField`, and `ToggleTabs` into `components/ui/`. See `docs/frontend-design-system.md`.
- Frontend shared components: new ESDS primitives go in `components/ui/`, new composed layouts in `components/patterns/`; existing flat files migrate later. See `docs/frontend-design-system.md` and the `frontend-design-system` skill.
- Shared `Pill` matches the ESDS Tag design (Default secondary fill; Success / Warning / Error white + tinted stroke/wash; optional indicator dot). `tone` is `neutral` / `good` / `warn` / `error` (removed unused `future`). See `docs/frontend-design-system.md`.
- Desktop app navigation now uses an Edge Studio-style collapsible dark sidebar with icon-only collapsed state (always on screen; collapses below `lg`), shared `nav` including Account and Marketplace (Coming soon), and sidebar-hosted feedback / sign out when expanded.
- Shared `Input` uses a 1px border (`stroke-primary` / focus `stroke-active` / error `stroke-error`) on the control box.
- Frontend colour tokens now follow ESDS foundations only (primitives + surface/text/icon/stroke/overlay semantics). Shared components use those utilities; legacy `brand-*`, `on-dark*`, and non-Figma status/hover/info aliases were removed.
- Frontend typography follows ESDS foundations: Hanken Grotesk + Azeret Mono, with complete named type utilities (`type-meta`, `type-body`, `type-body-em`, `type-link`, `type-callout`, `type-title`, `type-heading`, `type-display`, `type-mono`). Shared `Text` helpers use those styles.
- Frontend corner-radius tokens follow ESDS foundations (`rounded-sharp`, `rounded-tight`, `rounded-loose`, `rounded-interior`, `rounded-exterior`, `rounded-full`). Components and pages are not migrated yet.
- Frontend spacing tokens follow ESDS foundations (detail / separator / margin scales). Components and pages are not migrated yet.
- Shared `Button` / `IconButton` follow the ESDS button matrices (text button + circular icon button, tokens, focus ring). Call-site migration and aria notes are in `docs/frontend-design-system.md`.
- Shared workflow/history table helpers now use ESDS table visuals (grey header row, `stroke-primary` borders, and `type-body-em` headers / `type-meta` cells). See `frontend/src/components/DataTable.tsx`.
- Added a migration-ready ESDS `components/patterns/Table` shell (`Table`, `TableHeader`, `TableHeaderCell`, `TableRow`, `TableCell`) for future replacement of legacy native `<table>` markup.

## [0.27.0] 2026-07-29

### Added

- Devices now use a step-based add flow that first asks for input source vs output target, then template/example vs manual setup before showing the relevant options.

### Changed

- Device/source naming conventions are now documented for physical devices, generic integrations, and low-level hardware interfaces.
- Device picker labels now follow the naming convention, including `HTTP JSON Source`, `HTTP JSON Target`, `MQTT Subscriber`, `MQTT Publisher`, `Webhook Receiver`, `GPIO Input Pin`, `GPIO LED`, and `Raspberry Pi Camera`.
- Devices referenced by non-archived workflows can no longer be deleted until they are removed from those workflows.
- ESP32 starter firmware now uses the MQTT broker URL saved on the ESP32 MQTT Board source, only asking for an ESP32-reachable override when that URL is Docker-internal or localhost-only.
- GPIO input/output forms no longer expose profile selectors; profiles are fixed by the selected manual option or template, with GPIO LED kept as the only supported GPIO output template.
- Scheduled automation workflows now keep their next run anchored to the prior due time instead of drifting from the actual execution time.
- Devices now include a `GPIO Button` input template for a push button wired between GPIO17 and GND.
- Automation action failures now appear as toast notifications, while load/refresh failures use a dedicated in-page alert with a retry action.

### Added

- Account Settings now includes a Minima node backup & restore panel: create, download, upload, and restore full node backups (`.bak` files — seed phrase, private keys, coin proofs, and transaction history, not just wallet keys). One admin-chosen backup password (re-auth required, stored encrypted) is used for every backup — manual (`Backup now`) or automatic — and can be changed or removed at any time (removing it also turns off automatic backups). A new backend-owned scheduler creates automatic backups every 24 hours, replacing Minima's own built-in auto-backup (which could never be given a custom password or a visible/manageable location). Backups are tracked in a single collapsible list capped at 20, oldest auto-deleted, since every backup now shares the same real password. Setting up the backup password and restoring from an uploaded file are icon buttons that open modals. Deleting a backup or restoring from the list or an uploaded file always asks for confirmation first. Restore always re-syncs from the configured Megammr host. Backups live in a new, narrow read-write volume shared between `backend` and `minima` (`${MINIMA_DATA_DIR}/backups`); downloading, restoring, or changing/removing the backup password all require re-entering the admin PIN/password. See `docs/plans/minima-node-backup-restore.md`.

### Deprecated

- The Wallet settings panel (seed-phrase-only wallet import) is hidden from Account Settings, superseded by the new Node backup & restore panel for the common case. Seed-phrase-only restore (useful when only the words, not a backup file, are available) is deferred to post-v1; the underlying import API/UI code is untouched and not deleted.

## [0.26.1] 2026-07-29

### Fixed

- Dashboard "Update available" badge no longer lingers after a successful update due to lagging on `update-agent`'s own background self-update status; it now only reacts to frontend/backend being out of date.
- Settings page Version field no longer stays stuck on "Unknown" on devices with no recorded `last-applied-manifest.json`; `update-agent` now self-heals by recording the manifest as applied once frontend/backend match it.
- Added a "Back" button to the update-agent UI so it can be dismissed to the dashboard without a redirect or URL edit.

## [0.26.0] 2026-07-28

### Added

- Devices now include an ESP32 MQTT Board onboarding option that saves a normal MQTT input source and generates copyable Arduino ESP32 starter firmware.

### Changed

- ESP32 MQTT Board onboarding now links to a step-by-step flashing and workflow setup guide.
- ESP32 starter firmware now publishes a simple `Ping!` JSON payload instead of fake sensor readings, making first MQTT verification clearer.

## [0.25.5] 2026-07-28

### Fixed

- Every checkbox in the app (Minima RPC console whitelist, Automation block config, Integritas history table row selection) inherited the global text-input styling — a plain, unlayered `input, textarea, select {...}` CSS rule in `styles.css` was overriding any Tailwind utility class applied to an `<input>` regardless of specificity, because Tailwind v4's utilities live inside `@layer utilities` and unlayered rules always win. Scoped that rule off `type="checkbox"`/`type="radio"` so checkboxes render and size correctly everywhere.
- The Minima RPC console's whitelist modal additionally gets explicit checkbox sizing and collapsible Read/Write command-list sections instead of static lists.

## [0.25.0] 2026-07-27

### Added

- Minima node status now reports a `restarting` state (tracked server-side across restart/resync) instead of only `stopped`/`error` while a restart or resync is in progress; Minima Core, Wallet, and Dashboard show a page-level banner, loading indicators, and a restart-complete toast instead of stale or misleading values.
- Wallet page actions (Receive, Send, Create token) and the Minima settings panel are now disabled with an inline notice until the Minima node is confirmed `running`, avoiding RPC calls that would just fail mid-restart/resync.
- Wallet balance, assets, and history now auto-refresh once Minima comes back online after a resync/restart, instead of staying stuck on stale data until the operator navigates away and back.
- Address book is now its own tab on the Wallet page instead of a modal opened from the page header.
- Added a Minima RPC console to the Minima Core page: an admin-curated, closed-world checkbox whitelist of ~90 Minima RPC commands (sorted alphabetically within their read/write groups) with a terminal-like input/scrollback — light theme, custom scrollbar, collapsible section, fullscreen mode, and a clear-scrollback button. `vault`, `sendfrom`, `signfrom`, `createfrom`, `postfrom`, `createtokenfrom`, `decryptbackup`, `keys`, and `quit` are permanently excluded (can never be whitelisted) because they can expose/accept a raw wallet private key or seed phrase, or halt the node with no recovery path. Every other command defaults to enabled if read-only and disabled if it mutates funds/chain/config/network/wallet. Editing the whitelist requires re-entering the admin PIN/password. `megammrsync` and `peers action:addpeers` run through the existing narrow `resyncMegammr()`/`addMinimaPeers()` actions instead of a generic RPC passthrough, so operation-tracking and audit logging stay consistent with the existing Resync/Add peers UI (`docs/plans/minima-rpc-console.md`, `docs/security/host-and-infrastructure.md`).
- `npm run docker:rebuild` operational script to rebuild and restart just the `backend`/`frontend` Docker Compose services and tail their logs, for quickly checking a local change in the Docker environment.

### Changed

- The header status pills on every page (previously "Node online"/"Wallet ready"/"Integritas connected", fetched once on page load and never refreshed) are now two clickable Node/Integritas status dots, bordered to match the secondary button style, that poll `/api/status/overview` every 30s, keep showing the last known status (flagged as stale) if a refresh fails instead of silently going blank, and open a popover with status detail, error text, and last-checked time on click. The old "Wallet" pill silently reused the Minima node's status and was dropped as redundant with the Dashboard's own wallet balance display.
- Wallet settings (import wallet) and Minima node settings (megammr host, peer list/add) moved from page-level modals into Account Settings panels.
- Minima's post-restart status retry window is extended from ~12s to up to 90s, matching the backend's own restart/resync operation-tracking window.
- Peer connections list in Minima settings is now scrollable instead of growing the panel indefinitely.
- Loading placeholders ("Checking…" text) across Minima, Wallet, and Dashboard are replaced with a shared bouncing-dots loading indicator.
- Minima RPC error messages are now normalized for peers/add-peers/restart/balance responses (previously only resync), giving consistent operator-facing wording instead of raw RPC error text.
- Wallet hero now shows an auto-refreshing receive address QR code (regenerated server-side every 3 minutes) instead of only the raw address; Send payment and Create token moved out of the hero card into page-level buttons.
- Wallet Assets, wallet History, and Address book are now paginated, filterable tables (matching the Diagnostics tables) instead of plain lists; Address book's "Add contact" form now opens in a modal instead of inline, and wallet/address-book forms share consistent input and button styling.
- App rebranded from "Edge Workbench"/"Minima Edge Stack" to "Edge Studio" with a new brand mark; the sidebar's user dropdown is replaced with direct "Account settings" and "Sign out" links.

### Fixed

- Account Settings no longer shows a false-positive "Failed to load peers" toast while the Minima node is restarting/resyncing; the peers RPC is only called once node status is confirmed `running`, and automatically retried once it comes back.
- Minima sync status badge no longer shows false/stale status text; sync status is now derived only from block age instead of also weighing the Minima RPC response's unreliable/inconsistent `synced` and `connecting` fields.

## [0.24.0] - 2026-07-27

- Automation workflows now support a `Show preview` action block that writes text, JSON, link, and image previews into a durable local Automation inbox.
- Automation inbox image previews can reference either HTTP(S) image URLs or local file paths streamed through an authenticated backend route under the configured host files root.
- Automation inbox image previews now open from a `View preview` modal link, matching the existing `View JSON` preview behavior.

### Changed

- Main workflow `If field matches` blocks now choose between Trigger event and Variable sources; Latest data is no longer a direct condition source, so workflows should use Set variable before condition checks on recorded or fetched data.
- Automation action failures now appear as toast notifications, while load/refresh failures use a dedicated in-page alert with a retry action.

## [0.23.0] - 2026-07-27

### Added

- Devices now include a PIR Motion Sensor input option for HC-SR501-style GPIO motion sensors, with GPIO23-tested defaults and motion-specific trigger payload labels.
- Event-driven Automation start blocks can now enforce a cooldown between workflow runs, and GPIO starts can ignore inactive events such as PIR `motion_cleared` edges.
- GPIO device guidance now documents the tested HC-SR501 PIR wiring, standalone GPIO test script, and troubleshooting notes.

### Changed

- Automation control-output blocks now preserve compatible payload settings when switching between output targets instead of resetting the block to target defaults.

## [0.22.0] - 2026-07-23

### Added

- Pi Camera capture devices can now be enabled with `ENABLE_CAMERA=true`, configured from Devices, and used in Automation through a `Capture camera` data block that hashes captured media bytes and can attach Integritas stamping.
- Camera capture now uses an opt-in host-side Python helper service so Raspberry Pi camera commands run against the host camera stack instead of inside the backend container.
- Structured error details are now available for device/source errors, read-history failures, workflow runs, and failed workflow blocks.
- Structured app/API error details are now returned by active route-level API error responses while preserving existing top-level compatibility fields.
- Agent rules now document the structured backend/frontend error-handling conventions for future route, domain-error, and UI work.

### Changed

- Docs now describe the implemented block-based automation/device model more accurately, including GPIO output targets, Pi Camera privacy risks, and the moved GPIO device settings guide.
- Failed device/read/workflow rows now show a dedicated error details view instead of making raw JSON the primary error display.

### Fixed

- Downstream workflow block failures, such as a missing camera command after a GPIO trigger, no longer overwrite the triggering data source's last error.

## [0.21.6] - 2026-07-23

### Added

- Shared `ErrorAlert` UI component for in-page errors with optional title and recovery action.
- Shared `Input` and `CredentialInput` form fields (`CredentialInput` supports PIN or password mode, including PIN-friendly autocomplete/input attributes).
- Edge Studio brand colour tokens as Tailwind theme utilities (`brand-white`, `brand-graphite`, `brand-accent`, plus supporting shades and semantic `error` / `warning` / `success` / `info` colours). Manrope as the app UI font.
- Dashboard **Getting started** next-action card: prompts **Connect devices** when no data sources exist, then **Create your first workflow** once at least one device is connected.

### Changed

- First-run setup wizard is a single-column flow (no step sidebar): welcome → secure device → Integritas Connect, with progress tracked only on the work steps.
- Integritas Connect is the final setup step; once connected, the same screen shows the ready state and **Enter Edge Workbench** (the separate "Ready to use" step is gone).
- Setup welcome leads with the Edge Studio name, a short product intro, and a clearer list of upcoming steps; header shows progress and status, welcome CTA is **Get started**, and the shell uses a subtle line-grid background.
- Setup shell header/footer use a taller brand bar titled **Edge Studio**; secure-device and Connect steps use a stable-height onboarding card with shared brand form controls (sign-in method toggle, `CredentialInput`, password requirements styling).
- Integritas Connect step shows numbered open/sign-in/approve steps, switches to a listening state after **Open Integritas Connect**, delays the preparing spinner briefly, and on success lists device security (and 2FA when enabled) plus the connected account.
- Shared `Card` and buttons use brand tokens (including status/danger and on-dark variants) with squarer corners.
- Dashboard title uses the shared app name; the static multi-step "Build flow" guide is replaced by the guided next-action card (device status and live activity remain).
- App shell and sidebar use tighter padding and squarer corners (nav, brand header, mobile tabs, user box).

### Removed

- Separate first-run "Ready to use" / complete step after Connect.

## [0.21.5] - 2026-07-22

### Fixed

- Modal no longer closes on a backdrop click or Escape key press. It previously closed from either even when a modal's `closeDisabled` should have blocked it; the only way to close a modal is now its explicit Close button.

## [0.21.4] - 2026-07-22

### Added

- `install.sh` `DEV_MODE` flag: skips manifest fetch/signature verification and the update agent, building `frontend`/`backend` from source instead of pulling pinned images — for local/dev installs.

### Fixed

- `install.sh` `DEV_MODE` no longer leaves `update-agent` unbuildable: `UPDATE_AGENT_IMAGE` is now set to a local `:dev` tag and `docker-compose.yml`'s `update-agent` service gets a `build` context, so DEV_MODE installs build it from source like `frontend`/`backend` instead of bypassing it.

## [0.21.3] - 2026-07-22

### Fixed

- `scripts/dev/clear-db.sh`: `TARGET=users|history|automation` no longer silently truncates when the script is run via `curl | sudo bash`. `docker compose run` was attaching to stdin, which consumed the remainder of the piped script before it reached the "start backend" step, leaving `backend` stopped (502) without clearing anything.

## [0.21.2] - 2026-07-22

### Added

- Root Prettier setup (`.prettierrc`, `.prettierignore`, and `prettier` / `prettier-plugin-tailwindcss` / `eslint-config-prettier` deps) for consistent formatting across the monorepo.
- Backend startup now logs the configured Integritas Connect base URL alongside the other runtime endpoints.
- `scripts/dev/set-status-poll-interval.sh` operational script to change an installed app's `STATUS_POLL_INTERVAL_MS` (update-agent's manifest poll interval) in place and recreate `update-agent` to apply it.

### Changed

- First-run setup wizard UI is split into dedicated step components (`Welcome`, `Account`, `TwoFactor`, `ConnectAccount`, `Complete`) with shared onboarding styles; setup flow and behavior are unchanged.

## [0.21.1] - 2026-07-22

### Added

- `scripts/dev/clear-db.sh` operational script to wipe an installed app's SQLite database (stops the backend, deletes `integritas-pi.db`, restarts so migrations recreate a fresh schema). `TARGET=users|history|automation` scopes the clear to just accounts/Integritas Connect, Diagnostics history, or data sources/workflows instead of the whole database.

## [0.21.0] - 2026-07-21

### Added

- Diagnostics "Workflow logs" tab now supports pagination, status filtering, and search, matching the existing proof/read history tabs.
- All three Diagnostics tabs (proofs, reads, workflow logs) now share a single lightweight refresh button.

### Changed

- Diagnostics default page size lowered from 50 to 25.

### Fixed

- Diagnostics "Raw details" panel for a workflow run now expands inline below its row instead of rendering at the bottom of the table.
- Diagnostics no longer silently falls back to a page size of 10 when no `pageSize` is set in the URL (affected the shared backend pagination helper too, used by proofs/reads/workflow-runs).

## [0.20.0] - 2026-07-21

### Added

- Planned per-run workflow variables and output templating for reusable values in later workflow blocks.
- Automation workflows now support per-run Set variable blocks and `{{variableName}}` interpolation in custom HTTP/MQTT output JSON.
- Main workflow `If field matches` blocks can now read previously set workflow variables.
- Automation workflows now support a `Show preview` action block that writes text, JSON, link, and image previews into a durable local Automation inbox.
- Automation inbox image previews can reference either HTTP(S) image URLs or local file paths streamed through an authenticated backend route under the configured host files root.

### Changed

- Main workflow `If field matches` blocks now choose between Trigger event and Variable sources; Latest data is no longer a direct condition source, so workflows should use Set variable before condition checks on recorded or fetched data.

### Fixed

- HTTP output failures now include upstream response details when available, making target API errors easier to diagnose.

### Removed

- Removed the old Automation workflow rule compatibility API and response fields; workflows are now exposed through the block API only.

## [0.19.0] - 2026-07-21

### Added

- SQLite tables for Integritas Connect device linking: `integritas_device`, `integritas_activation`, `integritas_auth`, and `integritas_account_cache` (separate from local `users` / `sessions`).
- Backend `integritas-auth` helpers: Connect token encrypt/decrypt at rest (AES-256-GCM via `APP_SECRET`), and `getOrCreateDevice()` that reuses `settings.device_id` with name/type from device info.
- Backend Integritas Connect HTTP client (`startActivation`, `getActivationStatus`, `getMe`, `refreshToken`) using `INTEGRITAS_CONNECT_BASE_URL`.
- Env/config for Connect device activation: `INTEGRITAS_CONNECT_BASE_URL` and `INTEGRITAS_DEVICE_POLL_INTERVAL_SECONDS` (wired through `.env.example`, installer, Docker Compose, and README).
- Pi Connect auth routes (require local session): `POST /api/auth/connect/start` (persists pending activation; returns user code + verification URL) and `GET /api/auth/connect/status` (polls Connect; on approve stores encrypted tokens/API key + account cache; returns frontend-safe status: `unauthenticated` | `pending` | `connected` | `denied` | `expired` | `revoked`; never returns raw tokens). Local passcode logout remains `POST /api/auth/logout` and does not unlink Connect (no Pi Integritas disconnect in v1).
- Backend Integritas token manager (`getValidAccessToken`) that refreshes when within 5 minutes of expiry, stores rotated tokens and `api_key_enc` from `/api/me`, and on `401 DEVICE_REVOKED` clears Connect credentials (status → `revoked`).
- Frontend-safe `GET /api/user/profile` returning redacted account cache (`user`, `plan`, `usage`, `devices`) with no tokens or API key. Optional `?refresh=1` (or `true`) re-fetches Connect `/api/me` and rewrites the cache (for Account/Settings); default GET still serves cache.
- Settings Integritas Connect panel (`useIntegritasAuth`): start/poll Connect link status, pending user code + verify popup/link, connected name/plan/usage (profile refresh on mount). No Pi disconnect in v1; tokens never stored in browser storage.

### Changed

- Integritas proof, verification, polling, status, and automation calls now use only the encrypted API key supplied by Integritas Connect (`integritas_auth.api_key_enc`); manual UI and `INTEGRITAS_API_KEY` env fallbacks are removed.
- Integritas runtime configuration modal is read-only (base URL, request ID, Connect link status, portal link); paste/save/clear/check-key UI removed from the Integritas page.
- Integritas unauthorized errors now direct operators to reconnect under Settings → Integritas Connect instead of saving a new API key.
- First-run setup wizard replaces the Integritas API key step with unified Connect onboarding: create a local admin credential → open cloud account signup from one button in a centered small activation popup → see the account-connected confirmation in the same step → ready screen with name/plan/usage before dashboard. Setup now remains gated across refresh/reopen until the first successful Connect link; interrupted users authenticate with the existing credential and resume the cloud-account step. Later device revocation keeps onboarding complete and reconnects from Settings.
- Local admins can choose either a **6-digit PIN** or a password with at least 8 characters containing uppercase, lowercase, a number, and a symbol during setup and in Account settings. Login supports both credential types, including existing free-form passwords; API request fields remain `password` / `currentPassword` / `newPassword` for compatibility.
- **Temporary:** local admin auth uses a PIN or password without TOTP. TOTP enrollment/login/settings checks are disabled via `TOTP_ENABLED = false` (backend `auth.constants.ts`, frontend `totpEnabled.ts`). Set both to `true` to restore 2FA or delete if not used.
- Pi Connect auth route paths: `POST /api/auth/connect/start` and `GET /api/auth/connect/status` (replacing `/api/auth/device/start` and `/api/auth/status`) so Connect link APIs share a `/connect` prefix and stay distinct from system `/api/status`.
- Connect profile responses include `fetchedAt`. Offline / unreachable Connect on `GET /api/user/profile?refresh=1` returns the last cached profile with `stale: true` instead of blank fields; Settings shows last synced time and a muted notice. `connected` status no longer invents empty user/plan/usage when cache is missing.
- Clarified that losing or changing `APP_SECRET` makes encrypted local secrets (API key, TOTP, and future Connect tokens) unrecoverable; keep `.env` preserved across upgrades.

### Fixed

- After Connect device approval, encrypted tokens are stored (and pending activation cleared) before fetching `/api/me`, so a transient profile failure cannot consume the one-time handoff and leave the Pi permanently unlinked.
- If Integritas Connect tokens cannot be decrypted (e.g. `APP_SECRET` changed), the Pi clears the local Connect link, returns `TOKEN_DECRYPT_FAILED`, and the Settings panel prompts the user to connect again (no remote Connect revoke).
- Settings / reconnect **Connect account** opens the Integritas Connect verify popup on the first click (blank window reserved in the click gesture, then navigated after activation starts), so revoke/reconnect no longer needs a second click.

### Removed

- Manual Integritas API key entry: `INTEGRITAS_API_KEY` env var, installer support, setup `integritasApiKey` / `POST /api/setup/integritas/verify`, and Integritas page save/clear/check-key UI. Backend `/api/integritas/api-key*` routes are disabled (commented out in source for now).

## [0.18.0] - 2026-07-16

### Added

- Planned the Devices page flow for direct input/output add actions, local services, API/MQTT output targets, and optional local MQTT broker support.
- Devices now separates adding input sources and output targets, shows local MQTT broker service URLs, supports HTTP/API and MQTT output targets, and can run an optional profile-gated local Mosquitto broker.
- HTTP/API and MQTT output targets now keep endpoint settings on the device while workflow Control device blocks choose what payload to send.

## [0.17.4] - 2026-07-16

### Removed

- The "debug v1" line on the `/update` page.

## [0.17.3] - 2026-07-16

### Added

- Account settings' Version card now has a "Check for updates" link to the `/update` page.

## [0.17.2] - 2026-07-16

### Changed

- The sidebar "Update available" notice is now a plain colored button linking to `/update` instead of a card with version details; version numbers are no longer shown in the sidebar.
- Account settings now shows the current app version in a dedicated card at the bottom of the page.

## [0.17.1] - 2026-07-16

### Changed

- `update-agent`'s default background manifest poll interval (`STATUS_POLL_INTERVAL_MS`) is now 12 hours instead of 24. Only affects fresh installs or `.env` files without an explicit value; existing deployments keep their current setting.

## [0.17.0] - 2026-07-16

### Added

- **Update service (V1)**: new `update-agent` container provides a manual "Update Now" flow for `frontend`, `backend`, and `minima`. Updates are driven by a signed manifest (Ed25519) built and published by a tag-triggered GitHub Actions release workflow, and applied only after the new container passes a health check; a failed update leaves the previous container running (or, for `minima`, restores its data directory and restarts the previous version).
- **`update-agent` as a built image + self-update**: `update-agent` is now built and pushed by CI and tracked in the manifest like `frontend`/`backend`, instead of building from source on the Pi. It can also update itself through the same "Update Now" flow: a one-shot orchestrator container starts the new version, health-checks it, then retires the old container — a failed self-update just leaves the old container running.
- The update UI is served at `https://<pi-ip>:8080/update`, proxied through the existing frontend nginx on the same origin/certificate — no extra browser certificate approval.
- Real Docker `HEALTHCHECK`s for `frontend`/`backend` so update-agent's health-gated swap has real health data to act on, not just "is the container running".
- Manifest replay/downgrade protection: manifests carry a signed `createdAt` timestamp; `update-agent` persists the last-applied timestamp (`UPDATE_AGENT_STATE_DIR`) and rejects any manifest strictly older than it.
- `/apply` is now asynchronous: `POST /apply` starts a background job and returns immediately, `GET /apply` polls job status — needed since a successful frontend update kills its own in-flight request.
- New `MANIFEST_URL`, `RELEASE_CHANNEL`, `UPDATE_HEALTH_CHECK_TIMEOUT_MS`, `UPDATE_HEALTH_CHECK_INTERVAL_MS`, `UPDATE_PULL_TIMEOUT_MS`, `MINIMA_BACKUP_DIR`, `UPDATE_AGENT_STATE_DIR` environment variables (see README Configuration section).
- **Background update check + navbar notice**: `update-agent` now polls the manifest on its own schedule (`STATUS_POLL_INTERVAL_MS`, default once a day) instead of only checking on request, and caches the result. The product frontend polls this cache (`GET /status/summary`) and shows an "Update" item with a badge in the sidebar when `frontend`, `backend`, or `minima` is out of date, linking to the existing `/update` page.

### Changed

- **Release workflow manifest deploy**: the signed manifest is now pushed to a private `integritas-manifests` repo over HTTPS instead of `scp`'d directly to the VPS over SSH; the VPS pulls it on a cron schedule and serves it locally via nginx. Avoids requiring inbound SSH access from GitHub-hosted Actions runners' unpredictable IPs through the VPS firewall. See `docs/plans/update-service-launch.md` §1.
- **Manifest repo auth**: CI authenticates to `integritas-manifests` via a dedicated GitHub App (`integritas-pi-manifest-deploy`) generating short-lived installation tokens, instead of a static SSH deploy key — the org disables write-access deploy keys org-wide.

### Fixed

- **False "Update Now" on first install**: `install.sh` built `frontend`/`backend` from source, so a fresh install's image could never match the manifest's registry digest and always showed an update as available. It now fetches and verifies the signed manifest and pulls the exact pinned images instead.
- **Release workflow Pi architecture support**: `frontend`/`backend` images were only built for the CI runner's native `amd64`, invisible while installs built from source on-device. Now that installs pull pre-built images, added QEMU + multi-platform build (`linux/arm64`, `linux/arm/v7`) so Pi installs can actually pull them.
- **Release workflow "previous release tag" lookup**: no longer considers pre-release/test-shaped tags (e.g. `v0.0.0-test.1`) as a candidate "previous release," preventing a leftover test tag from hiding real `frontend`/`backend` changes from the release diff.

- **Update-agent frontend/backend swap**: updates to services publishing a host port no longer fail on a port-binding conflict between the old and new container; the candidate is created and health-checked without port bindings first, and only swapped in (old stopped/removed, candidate recreated with its ports, started) once healthy.
- **Update-agent Minima rollback**: backup/restore no longer fails with `EBUSY` on the bind mount root, no longer risks a backup taken mid-write, and now lands on its own dedicated `MINIMA_BACKUP_DIR` bind mount instead of a path inside the container's ephemeral layer.
- **Update-agent retry after a crash**: a stale `<service>-update-candidate` container left behind by a crash mid-update (e.g. a power cut) no longer blocks every subsequent retry with a Docker name-conflict `409`.
- **Update-agent auth check**: the forwarded `GET /api/auth/me` check now times out after 5s instead of hanging indefinitely if `backend` never responds.
- **Update-agent `.sig` URL building**: signature URL is now built by parsing `MANIFEST_URL` and appending `.sig` to the pathname, instead of raw string concatenation (which broke when the manifest URL had a query string).
- **Update-agent manifest public key**: `update-agent` now reads the signing public key from the committed `manifest-public-key.pem` (baked into its image) instead of a duplicate `MANIFEST_PUBLIC_KEY` env var, matching what `install.sh` already used — one source of truth instead of two copies that could drift on key rotation.

### Security

- `update-agent` mounts `/var/run/docker.sock` to apply updates; documented as an accepted, host-root-equivalent risk mitigated by minimal code surface, admin-only access, and signature/digest verification — not by network placement. See `SECURITY.md`.
- **Update-agent error responses**: client-visible error messages (`GET /status`, `POST /apply` job failures, port-bind-failure restore path) no longer leak raw Docker/system error text; full detail is still logged server-side via `console.error`.

## [0.16.1] - 2026-07-15

### Fixed

- Deleting a device no longer deletes its historical read-history rows; preserved rows keep their recorded source name and URL.
- Deleting a workflow no longer deletes its historical workflow run logs; preserved logs keep their recorded workflow name.

## [0.16.0] - 2026-07-15

### Added

- Feedback modal in the app shell saves authenticated user feedback to one local aggregate JSON file, captures feedback area, bug/feature-specific fields, browser context, and offers a browser download for manual sharing.

## [0.15.0] - 2026-07-13

### Changed

- Frontend styling guidance now targets Tailwind-only component and page styling after the dedicated migration, with plain CSS reserved for root/body/base global rules.
- Shared frontend button, text, tab, status-row, and table helpers now use Tailwind utilities, with setup, diagnostics, runtime config, and read-history surfaces migrated off their old global CSS selectors.
- Proof history and read history now share the workflow-style table shell and row styling, moving history/list tables toward reusable Tailwind primitives.
- Devices list now uses the shared workflow-style table and row action primitives, removing the old data-source table/action/health CSS selectors.
- Automation workflow and run-history tables now use the shared table primitives while preserving the workflow list/log visual style.
- Removed the unused frontend file explorer panel and its orphaned file-list CSS selectors.
- Device form and template cards now use Tailwind/shared UI helpers instead of data-source-specific global CSS selectors.
- Wallet page actions, tabs, hero balance card, and empty/error text now use Tailwind/shared UI helpers instead of wallet-specific global CSS selectors.
- Dashboard hero, build-flow, activity, and status sections now use Tailwind/shared UI helpers instead of dashboard-specific global CSS selectors.
- Integritas upload panels, file drop zones, runtime key panel, and stamp-result modal now use Tailwind/shared UI helpers instead of Integritas-specific global CSS selectors.
- Minima runtime/health panels and Automation checkbox rows now use Tailwind/shared UI helpers instead of the old `api-key-box`, `check-row`, and `error-text` hooks.
- Address book modal copy, empty/error, and inline form actions now use Tailwind/shared UI helpers instead of legacy global text/button hooks.
- Account settings forms now use Tailwind utilities instead of the legacy `form-card` global selector.
- Minima stat panels now use the shared card component, allowing old shared global selectors like `card`, `row-actions`, `selected-row`, and `json-preview` to be removed.
- Login screen styling now uses Tailwind utilities directly, removing the standalone `login.css` component layer.
- First-time onboarding styling now uses Tailwind utilities directly, removing the standalone `onboarding.css` component layer and final `error-text` global hook.
- Frontend design-system conventions are now documented with styling boundaries, shared component guidance, and when to use local Tailwind class constants.
- Shared buttons now support compact sizes, and Automation workspace actions now use the shared button variants instead of raw browser buttons.
- Wallet and Diagnostics subtabs now have clearer active/inactive styling with reliable active-tab contrast.
- Dashboard and Wallet now share the dark hero card surface, and wallet hero actions use a dedicated dark-surface button variant for reliable contrast.
- Automation workspace headers now reuse the shared dark hero card surface instead of a flat black topbar.

## [0.14.1] - 2026-07-10

### Changed

- Updated agent documentation.

## [0.14.0] - 2026-07-09

### Added

- Automation workflows now have a validation endpoint and workspace validation panel that flags missing devices, invalid block order/data dependencies, hardware-output warnings, Integritas key warnings, and wallet transaction balance/configuration issues before manual runs.
- Workflow block-run details now link directly to matching Diagnostics read/proof history filters when a block output contains a read id or Integritas proof id.
- Automation workflows can now be searched, filtered by status, duplicated, archived, and restored from the Automation workspace.
- Create workflow now uses a Scratch-inspired full-page draft workspace with a clean Start/Data/Logic block library, a visual block-chain canvas, setup inspector, and inline validation before creating the workflow.
- The create workflow draft now starts empty, requires choosing one start block first, hides start blocks after selection, and includes Reset canvas to choose a different start block.
- The create workflow draft block library now includes Pulse output and Send transaction action blocks plus attached Integritas stamps on Record/Fetch data blocks.
- Draft workflow validation now uses a backend `POST /api/automation/workflows/validate-draft` endpoint backed by the same block-graph validation as created workflows.
- The create workflow draft canvas now has its own editable block model: operators can add, remove, move, select, and configure draft blocks before the workflow is created.
- Workflow canvas presentation has been extracted into reusable automation components as the first step toward using the same canvas for create, edit, and watch modes.
- Existing workflow editing now uses the shared full-page canvas layout with add-block controls on the left, the saved workflow canvas in the center, and selected-block configuration on the right.
- Workflow create, edit, and watch entry points are now URL-driven (`/automation?flow=build`, `/automation?flow=edit&id=...`, `/automation?flow=watch&id=...`) so workflow workspaces render in the page instead of opening edit in a modal.
- Existing workflow validation now appears in the edit workspace right inspector beside selected-block configuration, matching the create workspace layout.
- Workflow-level lifecycle actions remain in the workflow list, while run controls, test payloads, and recent runs now live in Watch mode.
- The edit workspace now shares the builder shell, categorized block library, and selected-block inspector patterns from the create workspace, and operators can rename workflows from the edit setup panel.
- Watch mode now uses the shared canvas with run/test controls on the left, selected-block runtime output/status/timing and Diagnostics links on the right, and recent run history below the canvas.
- Build, Edit, and Watch now share a reusable workflow workspace shell and a unified canvas renderer, reducing duplicated UI paths before adding validation and runtime overlays.
- The workflow canvas is now exposed as one mode-aware component for Build, Edit, and Watch, with persisted workflow blocks normalized before rendering.
- Workflow canvas blocks now show validation error/warning badges in Build and Edit, plus latest run status/duration badges and highlighting in Watch.
- Watch mode now lets operators choose a historic run to visualize on the canvas; the previous expandable recent-runs log table is replaced by a `Show on canvas` run picker.
- Workflow log rows now link to `Show on canvas`, opening Watch mode for the selected workflow run via the `run` URL parameter.
- Watch mode now live-refreshes while the selected or latest run is running, selects the newest run after manual/test execution, and shows whether the canvas is live-updating or viewing a historic run.
- Watch historic runs and Diagnostics workflow logs now provide `Raw details` alongside `Show on canvas` for full workflow run JSON diagnostics.
- Automation workflow list now uses the same table-style layout as Devices, with compact icon actions for edit, watch, run, pause/enable, duplicate, archive/restore, and delete.
- GPIO LED output pulses now explicitly drive the inactive level before and after each pulse, return active/inactive GPIO values in the result, and clarify active-high vs active-low LED wiring in the Devices form.

### Changed

- Automation workspace styling now uses Tailwind utilities for the canvas, workflow list, run history, and inspectors, removing the old Automation-specific global CSS selectors.
- Manual workflow runs are now blocked when workflow validation reports errors; warnings remain visible for operator review.
- Archived automation workflows are excluded from automatic/event execution and cannot be manually run until restored.

## [0.13.0] - 2026-07-07

### Added

- Block automation workflow implementation plan for replacing coarse automation rules with small composable start/action/logic blocks.
- Block automation development plan now documents the remaining major workspace improvements and recommended implementation order.
- Automation backend now stores workflows as ordered blocks, resets the disposable legacy automation schema, records trigger metadata on data reads, and executes schedule/manual/GPIO/webhook/MQTT workflows through the new block executor while preserving the existing UI/API compatibility surface.
- GPIO and MQTT event workflows no longer create failed read-history rows for ignored overlapping events while the same workflow is still running, and the compatibility UI no longer shows start blocks as duplicate collect rules.
- Automation workspace now displays real workflow blocks and can append fetch, wait, and Integritas stamp blocks from the UI.
- Automation blocks can now be updated and reordered from the workspace, including changing fetch targets, wait durations, and action-block enabled state.
- Workflow creation is now block-first: operators choose a start block (manual, schedule, GPIO, webhook, or MQTT) and an optional initial record/fetch action instead of creating workflows from a single data source.
- Workflow run history now records each workflow execution and per-block status/timing/error details, visible in the workflow workspace and in Diagnostics -> Workflow logs.
- Devices now support GPIO Output targets with an LED profile, and Automation supports a generic Control output block that can pulse those LED targets from workflows.
- GPIO Output devices can now be test-pulsed directly from the Devices page before wiring them into an automation workflow.
- Workflow run details now load the stored data-read preview for fetch/record blocks, making it clear which JSON a data condition evaluated.
- Automation workflows can now include a Send transaction block that sends native MINIMA (`0x00`) to an address book recipient with a fixed operator-defined amount.
- GPIO device settings guide documenting tested GPIO17 button input and GPIO18 LED output setups plus suggested untested device profiles.

### Changed

- Data Sources UI is now presented as Devices, with template cards split into Input sources and Output targets ahead of GPIO output support.
- Integritas automation stamping is now attached as a side block on record/fetch data blocks, so stamping no longer has to be the final linear workflow block or block later actions.
- Attached Integritas stamp blocks now show clearer status, last-stamped timing, enable/disable controls, and side-block labeling in workflow run details.
- Automation workflows can now be manually tested with an editable JSON trigger payload from the workflow workspace.
- Automation workflows now support an If payload field equals block that continues when a trigger payload field matches a JSON value and stops the remaining workflow when it does not.
- Attached Integritas stamp blocks can now have an optional field-equals condition against the recorded/fetched data, allowing workflows to skip stamping unless data matches.
- Field-equals conditions now explicitly choose whether they read from the workflow trigger event or the latest recorded/fetched data.
- Event-start workflows can now add a Record trigger event block later from the workflow workspace when the workflow was created without one.
- Workflow workspace Add block controls are now grouped into collapsible cards with titles and descriptions for each block type.
- Field conditions now support operators: equals, not equals, greater/less than, greater/less than or equal to, exists, and does not exist. Existing workflows using the old equals-only condition config should be recreated.
- Workflow workspace now clarifies that edits are saved per block, and Fetch data source edits use an explicit Save fetch source button.
- Workflow block editing now shows per-block unsaved/saved feedback, disables unchanged save buttons, and labels immediate actions such as move/remove/enable as applying now.
- Workflow run details now separate the trigger payload from the fetched/recorded data preview so manual test runs are easier to interpret.
- Automation create/save buttons now use the same styled primary action treatment as the rest of the workspace.

### Fixed

- GPIO Output LED pulses now explicitly return the line to the inactive state after pulsing so LEDs do not remain stuck on after a workflow run.
- Automation Run now is available for all workflow start types and records a synthetic manual test trigger for event workflows instead of being limited to scheduled workflows.
- Backend shutdown now stops GPIO Output holder processes so LED output lines are released cleanly when the container stops.
- Conditional Integritas stamp blocks now log as skipped when their condition is not met instead of appearing as successful stamps, and skipped blocks are not counted as successful blocks in run summaries.

### Security

- Automated wallet transaction blocks are restricted to address book recipients and native MINIMA (`0x00`) only, validate sendable balance server-side, and record wallet history plus audit events.

## [0.12.0] - 2026-07-02

### Changed

- **Diagnostics tabs**: proof vs read history is reflected in the URL (`/diagnostics?tab=reads`). Refreshing or sharing the link opens the correct tab; only the active tab's list is fetched on load.
- **Diagnostics pagination**: proof and read history lists are server-paginated with URL-backed `tab`, `page`, `pageSize`, `status`, and `q` filters (`tab`, `page`, and `pageSize` are always written to the URL, including defaults). Shared pager/filter bar on the Diagnostics page.
- **Diagnostics cleanup**: removed debug `JsonPreview` footer, deduplicated paginated fetch helpers, and avoid double-fetch after poll-pending (uses paginated poll response directly).
- **Diagnostics query performance**: added indexes on `integritas_proofs(proof_status, created_at)` / `(created_at)` and `data_source_reads(status, created_at)` / `(created_at)` so paginated, filtered, and count queries use index seeks instead of full table scans with an in-memory sort. Applied automatically via the existing idempotent migration path — no manual step, existing rows are indexed in place.

### Added

- `GET /api/integritas/history/:id` — fetch a single proof record by id (used by stamp result polling).
- Paginated list responses on `GET /api/integritas/history` and `GET /api/data-reads` (`page`, `pageSize`, `status`, `q` query params).
- `pendingTotal` on proof history list responses — global count of pollable pending proofs for Diagnostics refresh UI and auto-poll.

### Fixed

- **Diagnostics proof export**: corrupt `proof_payload` JSON no longer risks an unhandled export error; export failures return `500` with a message instead.
- **Diagnostics download**: export no longer runs through the post-mutation refresh path (download is read-only).
- **Diagnostics selection**: row selection clears when changing page, filter, or tab so delete/export cannot target off-screen rows.
- **Diagnostics pending poll**: `GET /history` and `poll-pending` return a global `pendingTotal` (pollable pending count across all pages); auto-refresh and the manual "Refresh pending" button (count and enabled state) both use it, so pending proofs on other pages/filters still show and still poll.
- **Diagnostics page size**: rows-per-page control now follows the URL immediately instead of snapping back to the previous API response.
- **Diagnostics auto-refresh loop**: an unstable callback reference caused the proofs auto-refresh to re-fire on every unrelated re-render (e.g. toggling a row checkbox), issuing `GET /history` back-to-back instead of on the intended ~15s interval while a proof was pending.
- **Diagnostics mutation errors**: verify/delete/download failures now surface via toast only, matching every other page (`WalletPage`, `IntegritasPage`, `DataSourcesPage`); previously they also left a persistent inline banner until the next action.
- **Dashboard activity list**: auto-refresh now uses the same `pageSize: 100` as the initial load, so the "Live activity" list no longer shrinks to 50 items after the first background refresh.
- **Proof export in native dev**: `DATA_DIR` / `DATABASE_PATH` now drive the export directory (`./data/exports`) instead of always using `/data`, fixing `EACCES: permission denied, mkdir '/data'` on `npm run dev`.

### Security

- **Diagnostics bulk actions**: `delete-selected` / `export-selected` now cap the `ids` array at 500 entries, closing a self-inflicted DoS gap (an oversized array could stall the single-threaded backend in a synchronous delete/export loop). Well above the UI's actual maximum (selection can't exceed one page, capped at 100 rows).

## [0.11.0] - 2026-06-30

### Added

- **Wallet address book**: save and reuse external Mx/0x addresses when sending MINIMA or tokens. Contacts are stored in a new `address_book` SQLite table with a full list, inline add/edit/delete forms, and a copy-to-clipboard button per row. The address book is accessible via a `BookUser` icon button in the wallet page header, opening as a modal. The Send payment modal gains an External / Address book mode toggle — Address book mode shows a dropdown of saved contacts to populate the recipient field.
- Address book REST API (`GET`, `POST /api/wallet/address-book`, `PATCH /DELETE /api/wallet/address-book/:id`): all mutations require admin role and emit audit events (`address-book.create`, `address-book.update`, `address-book.delete`).

### Changed

- **Wallet page layout**: Assets and History are now tabs (using the shared `subtabs` component style) below the hero card instead of separate stacked cards, reducing page height.
- `wallet.routes.ts` send-payment now rejects addresses that do not start with `Mx` or `0x`, consistent with address book validation.
- `TokenListItem.isNative` widened from literal `false` to `boolean`, removing a needless type constraint ahead of known-token support.

### Fixed

- GPIO input watchers now run `gpiomon` continuously and avoid the unsupported `--both-edges` flag on older Raspberry Pi OS/libgpiod versions.
- GPIO input reads now line-buffer `gpiomon` output and ignore stale events from deleted sources instead of crashing on foreign-key errors.

### Removed

- `wallet_accounts` SQLite table dropped — the multi-wallet design it supported was replaced in 0.8.0 and the table has been unused since.

### Internal

- `backend/src/shared/minima-address.ts` — shared `isMinimaAddress` helper used by both address book and wallet send routes.

## [0.10.0] - 2026-06-29

### Changed

- **QA docs**: consolidated five per-area gap files into `docs/qa/gaps.md`; updated `docs/README.md` to remove stale plan references.
- **URL-backed navigation**: replaced local `useState` nav with React Router. Each section now has a real URL (`/dashboard`, `/node`, `/wallet`, etc.), browser history and the back button work, and deep links or page refreshes land on the correct section instead of resetting to dashboard. Sidebar and mobile nav items are `<NavLink>` elements whose active state comes from the router. The `*` catch-all and `/` redirect ensure no dead ends.
- **Auth guard with `/login` route**: unauthenticated access to any protected route redirects to `/login`. `LoginPage` is a proper route; `ProtectedRoute` uses `<Navigate to="/login" replace />`. Visiting `/login` while already authenticated redirects to `/dashboard`.

## [0.9.0] - 2026-06-26

### Added

- **Account settings page**: accessible via the sidebar user box (gear icon replaces the static "Administrator" label). Allows changing the admin password and resetting the TOTP 2FA secret post-setup. Password change requires the current password and a valid 2FA code. TOTP reset follows the same "see once" principle as setup — the QR code and manual key are shown inline once during the reset flow and not retrievable afterward.

## [0.8.0] - 2026-06-26

### Added

- Wallet page **Assets card**: lists all wallet tokens (Minima + custom) above send history with tab filters — All / Minima / Tokens. Each row shows token name, full token ID, icon, and sendable balance.
- Wallet page **Receive** button: opens a modal that fetches a wallet address via `POST /api/wallet/receive-address` and displays both the Minima (`Mx…`) and hex (`0x…`) formats with copy buttons.
- Wallet page **Settings** button (gear icon in page header): opens a wallet settings modal with Import wallet (inline form with back navigation) and Export wallet (coming soon). Follows the same pattern as Minima and Integritas page settings.

### Fixed

- Custom token names now correctly extracted from Minima's `balance` RPC response. Minima encodes custom-token metadata as a JSON object (`{ name, description, … }`) rather than a plain string; the parser previously fell back to the token ID for all custom tokens.

### Changed

- Wallet simplified to Minima's default single-wallet model — labeled account architecture removed. Balance, send, and token creation now use the full wallet UTXO pool via `balance`, `getaddress`, and `send` RPC commands. The `wallet_accounts` table is retained in SQLite for backward compatibility but is no longer written to.
- Wallet page hero card now shows total sendable MINIMA from `GET /api/wallet` instead of aggregating per-labeled-account balances.
- Send payment modal simplified: no source account selection, token list and sendable balance sourced from live wallet status.
- Create token modal simplified: no account picker; wallet total sendable MINIMA checked against minimum threshold.
- Token create (`POST /api/tokens/create`) no longer requires `fromAccountAddress`; pre-flight check uses total wallet sendable MINIMA.
- Removed routes: `GET /api/wallet/accounts`, `POST /api/wallet/accounts`, `POST /api/wallet/debug/clear-wallet-accounts`.
- Wallet page hero card restructured: action buttons moved to top-right, MINIMA balance moved to bottom spanning full card width with text wrapping enabled. The Minima icon aligns with the first line of the amount when it wraps.
- Import wallet and Export wallet moved from hero card (where they were commented out) into the wallet settings modal.
- Amount display now uses precision-aware formatting: `formatAmountThreshold` on dashboard and wallet page hero card / assets list (6-decimal truncation with `< 0.000001` for sub-threshold values and `> 0.123456` when non-zero digits are hidden beyond 6 places); `formatAmountAdaptive` used in the asset detail modal and create token modal where full precision is appropriate.
- Assets card rows are now clickable: tapping a row opens an asset detail modal showing full-precision sendable, confirmed, and unconfirmed balances alongside the copyable token ID.

## [0.7.3] - 2026-06-26

### Added

- GPIO Input data sources for Raspberry Pi BCM pin edge events. GPIO sources are input-only, automation-gated, and recorded as JSON payloads through the existing read history/stamping path.
- Installer option `ENABLE_GPIO=true` now creates a Docker Compose override for `/dev/gpiochip0` and records the detected GPIO group id in `.env`.
- Data Sources now reports backend capabilities and disables GPIO Input creation when GPIO device access is not available.

## [0.7.2] - 2026-06-26

### Added

- V1 security sign-off checklist in `docs/plans/v1-security.md` (HTTPS done; headers, tests, and APP_SECRET guard remain).
- `npm run dev:https` — native dev over HTTPS using the same self-signed certs as Docker (`data/certs`), with `COOKIE_SECURE=true` on the backend.
- Self-signed HTTPS for the default Docker deploy: installer and `scripts/generate-tls-cert.sh` generate TLS certs in `DATA_DIR/certs`; nginx serves HTTPS on `${FRONTEND_PORT}` (mapped to container port 443).
- Light and dark mode favicons (`favicon-light.svg`, `favicon-dark.svg`) served from `frontend/public`; the browser picks the appropriate variant via `prefers-color-scheme`.

### Changed

- Docker Compose UI port mapping is now `${FRONTEND_PORT}:443` (HTTPS) instead of `:80` (HTTP). Open `https://<pi-ip>:8080` and accept the browser warning for the self-signed certificate.
- Default `COOKIE_SECURE` is `true` in Docker Compose and installer-generated `.env`.
- CLI default API URL is `https://localhost:8080/api` with `curl -k` for the self-signed cert.

### Security

- Browser-to-Pi traffic is encrypted on the default deploy. Residual risk: self-signed cert warnings and click-through MITM on untrusted networks.

## [0.7.1] - 2026-06-24

### Changed

- Dashboard device status: wallet balance, Minima node status, and Integritas API connection are shown in the first metric row; host device, CPU, memory, and disk metrics are grouped in a second row with clearer **Device** labels.

## [0.7.0] - 2026-06-24

### Added

- `GET /api/tokens` — auth-protected list of non-native wallet tokens from Minima `balance`, merged with SQLite `custom_tokens` metadata (`createdLocally`, `decimal` when recorded on this Pi).
- `GET /api/tokens/create-requirements` — returns estimated MINIMA colouring cost, minimum labeled-account balance, and operator note.
- `POST /api/tokens/create` (admin) — creates a custom token via Minima `tokencreate name:X amount:Y decimals:Z` from a **labeled** wallet account (`fromAccountAddress`) with at least `0.001` MINIMA on that address. Persists `name`, `amount`, `decimal`, and `token_id` in SQLite; audit event `tokens.create` records tokenId, amounts, txpowId, and source address (no secrets). On-chain creation is irreversible.
- Wallet page **Create token** action: modal with labeled-account picker, name, supply amount, and decimal places; success toast and account list refresh.
- Backend unit tests for `parseTokenCreateResponse` (`tokens.parse.test.ts`).

### Changed

- Wallet UI formats MINIMA amounts for display (trimmed decimals).
- Dashboard and Wallet hero totals use formatted MINIMA amounts with ellipsis truncation when space is tight; hover shows the full formatted value.
- Webhook and MQTT Data Sources now define connection details only; incoming push data is recorded and optionally stamped only while an Automation workflow is enabled for that source.
- Automation now presents workflows as ordered When / Condition / Then rules. V1 creates a Collect data rule and lets operators add or remove an Integritas stamping rule.
- Automation now uses a compact workflow overview with a modal workspace for opening a workflow, reviewing its rule chain, and adding/removing V1 rules.

### Fixed

- Custom token creation: Minima expects `decimals:` (not `decimal:`) in `tokencreate`; token ID is now parsed from the txpow output body. API request field remains `decimal`.
- Removed MINIMA routing hack that sent funds to random addresses before `tokencreate`, which left labeled accounts empty and inflated unlabeled funded addresses.

## [0.6.0] - 2026-06-16

### Added

- `GET /api/wallet` — auth-protected wallet endpoint returning a normalized `WalletStatus` (checkedAt, tokens array). Each `TokenBalance` includes tokenId, name, confirmed, unconfirmed, sendable, and an `isNative` flag (`tokenId === "0x00"`). Wraps the existing Minima `balance` RPC; the legacy `GET /api/minima/balance` passthrough is unchanged.
- `POST /api/wallet/receive-address` (admin) — returns one of the node's 64 pre-created default wallet addresses at random via the Minima `getaddress` RPC command. Response includes `miniAddress` (Mx… native format, primary for sharing), `address` (0x… hex), and `publicKey`. Does not create new key material.
- `POST /api/wallet/send-payment` (admin) — sends MINIMA or tokens via `send amount:X address:Y tokenid:Z`. Validates address and amount server-side. Returns `txpowId` and `status: "pending"` on submission; audit-logged with address, amount, tokenId, and txpowId (never logs seed phrases or secrets).
- `GET /api/wallet/payment-status/:txpowid` (any authenticated user) — polls the Minima `txpow` command for a submitted transaction and returns `pending | confirmed | failed | unknown`.
- Wallet page redesign: dark hero balance card with MINIMA icon watermark, confirmed/unconfirmed/sendable stats, and two action buttons — **Receive address** and **Send payment**.
- Receive address modal: fetches a random address from the node's 64-address pool, displays Mx (primary) and 0x formats, one-click clipboard copy, and a "Get another address" button to sample a different address.
- Send payment modal: form with recipient address (accepts both Mx and 0x formats), amount, and token selector (built from the live token list). On submit, transitions to a pending state that polls `payment-status` every 5 s for up to 60 s; shows confirmed/failed/timeout states inline and fires a toast on each terminal state. Closes cleanly mid-poll with an info toast.
- Token holdings table with All / Minima / Tokens filter tabs (subtabs component). MINIMA icon shown inline next to native token confirmed balance.
- Dashboard wallet balance card: shows confirmed MINIMA with MINIMA icon inline in the metric grid. Non-blocking — shows "Unavailable" if the node is unreachable.
- `MinimaIcon` component: reusable inline SVG using `currentColor`, used across Wallet page and Dashboard.
- `POST /api/wallet/import` (admin) — restores wallet from a 24-word BIP-39 seed phrase via Minima `restore` RPC. Overwrites the node's current wallet; the node may restart after import. Audit event `wallet.import` is recorded without the phrase. Input is validated server-side (minimum 12 words).
- Import wallet modal on Wallet page: textarea for seed phrase entry, destructive-action warning, success/error inline feedback, and a toast on completion.
- Disabled "Export wallet" button on Wallet page as a placeholder for the deferred encrypted backup feature.
- `POST /api/wallet/accounts` (admin) — creates a labeled wallet account by assigning one random default Minima address (`getaddress`) and storing it in SQLite.
- `GET /api/wallet/accounts` — returns labeled wallet accounts with per-address balances and token counts derived from Minima `coins relevant:true`.
- Wallet page account architecture: account list cards, create-account modal, account details modal, and send form source-account selection.
- Wallet fallback for migration/recovery: unlabeled funded addresses are now surfaced from `coins relevant:true` and can be labeled directly into accounts.
- Wallet fallback labeling now resolves and persists `miniaddress` (`Mx...`) for imported `0x...` addresses when available from the node's default address pool.
- Wallet token display for per-address funds now uses Minima `tokenamount` and token metadata names (when present), fixing raw token-id labels and tiny scientific-notation amounts.
- Dev-only wallet debug action: `POST /api/wallet/debug/clear-wallet-accounts` (admin, blocked in production) clears labeled wallet accounts from SQLite to speed up local label/unlabel testing. Wallet page now shows a `Debug: clear labels` button only in frontend dev mode.
- Wallet send history (Phase 1): backend now persists `POST /api/wallet/send-payment` activity in SQLite and exposes it via `GET /api/wallet/history`; Wallet page now renders a `History` card with recent sent transactions.
- Wallet history display now annotates account-aware transfer flow (`From <address> (<account>) -> <address> (<destination account | External>)`) and adds dev-only `POST /api/wallet/debug/clear-wallet-history` + `Debug: clear history` button for local test resets.
- Reusable `CopyableCode` component with icon copy buttons for addresses, token IDs, and txpow IDs in wallet modals.
- Wallet UI polish: Minima/custom token glyphs in account list and send history rows; send form shows selected-token available balance beside the Token label and blocks submits that exceed it; wallet hero card responsive layout improvements for phone/tablet widths.

### Changed

- Wallet page UX pivot: labeled **accounts** are the primary model (create account, account detail with Mx/0x addresses and per-account funds). Receive addresses are shown per account in the detail modal rather than via a separate random receive-address modal.
- Send payment modal: requires a source account; supports external address or internal transfer to another labeled account; closes on successful submit with a success toast (in-page `payment-status` polling removed from the wallet UI). Backend `GET /api/wallet/payment-status/:txpowid` remains available.

### Fixed

- `generateAddress` renamed to `getReceiveAddress` throughout — was incorrectly calling `newaddress` (creates new key material) instead of `getaddress` (returns from the node's 64 pre-created address pool).

## [0.5.0] - 2026-06-12

System basic status and health checks added to Dashboard with 30s auto-polling, and graceful shutdown to backend systems.

### Added

- `GET /api/status` — new auth-protected device summary endpoint: stable device ID (UUID persisted in `settings`), hostname, platform, arch, uptime, CPU count, host memory, load averages, disk usage (`/data`, falling back to `/`), setup state, Minima node state (from poller cache), and a live Integritas API connection check (3 s timeout, 30 s server-side cache).
- Graceful shutdown: SIGTERM and SIGINT now stop all background schedulers (automation, Integritas proof poller, Minima health poller) and close the SQLite connection before exiting.
- Dashboard live-status grid: six metric cards (Node status, Device, Integritas API, CPU, Memory, Disk) fed by `GET /api/status`, auto-polling every 30 seconds. No Minima RPC or Docker socket calls on the dashboard path.

## [0.4.0] - 2026-06-11

Minima node status, health monitoring, container restart, peer management, and Minima Core UI.

### Fixed

- Minima status no longer shows raw `fetch failed` during resync/restart when last-known stats are still shown; transient RPC blips are suppressed and post-operation refresh retries until Minima is back.
- Minima UX: removed duplicate Peer connections section (configured peer list vs active P2P count were different metrics); health card now shows **Active peers** from status RPC; add-peers moved to Configure Minima.
- Megammr resync now automatically restarts the Minima container when Minima reports a restart is required.
- Minima container restart control moved to a header icon on the Container card.
- Modal dialogs (including JSON preview on Minima resync) now render via a document portal, fixing incorrect positioning and hover flicker inside cards that use CSS transforms.
- Minima status parsing now reads `chain.time`, `network.connected`, and `memory.ram` / `memory.disk` from the live `status` RPC response; falls back to allowlisted `block` / `peers` commands when needed.
- Minima resync UX: pause health polling during resync, keep last known stats when RPC blips, derive sync status as Active/Stale/Syncing, and show accurate resync toasts (including restart hint when Minima reports resync finished).

### Changed

- Minima Core page layout aligned with the Edge Workbench mock: three summary cards (node, sync, storage) and a Node health stat grid.
- Minima Core splits **Node health** (RPC: node memory, peers, blocks) from **Container** (Docker: CPU, container memory, state, runtime); node memory no longer falls back to Docker stats.
- `GET /api/status/overview` Minima service check now uses the same normalized node status logic as `/api/minima/status`.

### Added

- Minima Phase 3: `POST /api/minima/restart` (admin, Docker container restart with audit log), `GET /api/minima/peers`, `POST /api/minima/peers/add` (admin, allowlisted `peers action:addpeers`), Minima Core UI for restart and peer list/add, and `node:test` fixtures for `minima.parse.ts`.
- Backend Minima health poller: detects chain stalls on an interval (`MINIMA_HEALTH_POLL_INTERVAL_SECONDS`), exposes `monitoring` on `GET /api/minima/status`, and optionally triggers Megammr auto-resync when `MINIMA_AUTO_RESYNC=true`.
- Minima Core UI shows a stall warning when `monitoring.stallDetected` is true.
- Minima node status API returns a normalized operator view: container state, chain block/age, peer count, CPU/memory, and container disk (`GET /api/minima/status`).
- Minima Core page shows structured node health cards with 30s auto-refresh; RPC debug JSON is collapsible. Megammr resync failures surface via toast.
- Configure Minima modal: Integritas-style layout with runtime config, Megammr host, and peer list/add in one place (settings icon on the page header).

### Security

- Backend Docker socket mount is writable (not read-only) so admin-only `POST /api/minima/restart` can restart the Minima container; see `SECURITY.md`.

## [0.3.0] - 2026-06-11

Integritas integration hardening and proof polling, plus data-source health/editing, shared toast notifications, and runtime config UX.

### Added

- Integritas runtime config: **Check key** button and validity badge via `POST /api/integritas/api-key/check` (admin). Uses the stored key server-side only; auto-checks when the modal opens if a key is configured.
- Data sources can now store an optional health status URL; the Added data sources table polls it once per minute through the backend and shows a green/red status indicator with the latest response.
- Shared frontend toast system for transient API/action errors, starting with Data Sources actions.
- Data sources can now be edited from the Added data sources table.
- Data Sources now has protocol cards for HTTP JSON API and webhook JSON receive sources; webhook sources get generated receive URLs and update source history when JSON is posted.
- Data Sources now supports MQTT JSON subscriptions as push sources; the backend subscribes to configured broker/topic pairs and records received JSON in source history.
- Integritas upstream HTTP client hardening: request timeouts (`INTEGRITAS_REQUEST_TIMEOUT_MS`), transient retry with backoff for `429`/`502`/`503` and network errors, and structured `errorCode` on failed stamp/status/verify API responses.
- Background Integritas proof poller: pending proof records are status-checked on an interval (`INTEGRITAS_POLL_INTERVAL_SECONDS`, default 30s) without manual Diagnostics polling.
- Integritas retry policy: automation treats transient stamp failures as deferred retries; pending proofs time out after `INTEGRITAS_PROOF_POLL_TIMEOUT_MINUTES` (default 5) if on-chain confirmation never completes.
- Integritas page UX: friendly stamp-result modal after file upload (proof UID, hash, on-chain status with optional live poll); portal link in Integritas config modal via `INTEGRITAS_PORTAL_URL` / `GET /api/integritas/config` `portalUrl`.
- `docs/reports/integritas-integration-audit.md` — implementation audit for Integritas Phases 1–3, 5–6.

### Changed

- Integritas runtime config modal: runtime details, portal link, and API key controls each sit in separate cards; key validity and last-checked time share one row.
- Data source template cards now use the clearer `Add source` call to action instead of `Use template`.
- Added data source row actions now use accessible icon buttons for manual trigger, edit, and delete.
- Data source creation now presents protocol cards instead of separate internal/external HTTP templates, and the source type field is hidden from the form.
- Integritas upstream API key rejection no longer logs the user out: session `401` stays separate from Integritas `errorCode: unauthorized` (HTTP 403 + toast). Invalid keys show a non-destructive error and open Configure Integritas when stamping.
- Integritas proof status UX: backend poller runs immediately on startup; Diagnostics, Dashboard, and the stamp-result modal auto-refresh history while proofs are pending (no manual page reload).
- Diagnostics proof history: per-row Poll removed; single **Refresh pending** header action calls `POST /api/integritas/history/poll-pending` (same batched upstream logic as the background poller).
- Integritas sandbox integration tests moved from feature Phase 4 to the planned QA phase; see `docs/qa/README.md`.
- Documentation layout: `docs/plans/` (implementation plans with status), `docs/qa/` (open gaps and checklists), `docs/reports/` (audits only); index at `docs/README.md`. Auth plans marked **Complete**; Integritas plan **In progress**.

## [0.2.0] - 2026-06-09

Local authentication, first-run setup, and related UI/platform work merged.

### Added

#### Authentication and sessions

- Backend auth feature (`backend/src/features/auth/`): admin login with password + TOTP, HttpOnly session cookies, hashed session tokens in SQLite, login rate limiting, and audit events for login/logout.
- Protected API surface: all `/api/*` routes except `GET /api/health`, `GET /api/setup/status`, `POST /api/setup/*`, and `POST /api/auth/login` require a valid session (`requireAuth` in `backend/src/app.ts`).
- Role-gated admin mutations: Integritas API key changes, file browser access, and automation/data-source mutations require `admin` role.
- New auth API routes:
  - `POST /api/auth/login` — password + TOTP; sets session cookie
  - `POST /api/auth/logout` — clears session
  - `GET /api/auth/me` — current user profile
  - `GET /api/setup/status` — whether first-run setup is complete
  - `POST /api/setup/totp/init`, `POST /api/setup/totp/verify` — TOTP enrollment during setup
  - `POST /api/setup/integritas/verify` — validate Integritas API key during setup
  - `POST /api/setup/complete` — finish setup and create admin session
- SQLite migrations for `users`, `sessions`, and related auth columns in `backend/src/db/database.ts`.
- Session configuration via `.env`: `COOKIE_SECURE`, `SESSION_MAX_AGE_DAYS`, `SESSION_IDLE_HOURS`.

#### First-run setup wizard

- Frontend setup wizard (`frontend/src/features/setup/`) shown when setup is incomplete: welcome, password, TOTP enrollment, Integritas API key, and completion steps.
- `AuthProvider` bootstrap flow: setup wizard → login → authenticated app shell.
- Sidebar user box with sign-out (`frontend/src/features/auth/SidebarUserBox.tsx`).
- Login page with password and TOTP fields (`frontend/src/features/auth/LoginPage.tsx`).

#### UI and feature pages

- **Wallet page** — Minima balance read through allowlisted backend RPC (`GET /api/minima/balance`).
- **Diagnostics page** — consolidated Integritas proof history and data-read history in tabbed views (replaces separate Data Reads nav entry).
- **Minima page** — Configure Minima modal (Megammr host stored in SQLite), Megammr resync action (`POST /api/minima/megammrsync/resync`).
- **Integritas page** — Configure Integritas modal for runtime API key management.
- **Data Sources page** — add-source flow moved into a modal.
- **Dashboard** — activity feed (recent Integritas proofs and data reads), use-case/build-flow sections, and “Start setup” navigation.
- **App shell** — service status pills in the header (backend, Minima, Integritas).
- Reusable `Modal` component (`frontend/src/components/Modal.tsx`).

#### Backend (non-auth)

- Minima config persistence and allowlisted RPC helpers in `backend/src/features/minima/minima.service.ts` (`getMinimaConfig`, `saveMinimaConfig`, `getWalletBalance`, `resyncMegammr`).
- `backend/src/db/ensureDatabaseDirectory.ts` for safer database directory creation on startup.
- `backend/src/config/loadEnv.ts` for local development env loading.

#### Development tooling

- Root `npm run dev`, `dev:frontend`, and `dev:backend` scripts for native iteration without Docker rebuilds.
- Root `postinstall` to install backend and frontend dependencies.
- `frontend/vite.config.ts` with `/api` proxy to the backend during local dev.
- Tailwind CSS integration in the frontend build.

#### Documentation

- `docs/auth-implementation.md` — Phase 1 auth implementation plan aligned with this repo.
- `docs/auth-security.md` — auth security model and checklist.
- `docs/reports/auth-implementation-audit.md` — implementation audit report.
- `docs/reports/auth-qa-gaps.md` — QA and testing gap tracker.
- `.cursor/rules.mdc` — project documentation rules for Cursor.
- Expanded `README.md`, `SECURITY.md`, and `AGENTS.md` for auth, sessions, and Minima allowlist behavior.

### Changed

- `frontend/src/App.tsx` — wrapped in `AuthProvider`; pages render only after authentication; setup page receives `onSignOut`.
- `frontend/src/lib/api.ts` — all fetches use `credentials: "include"`; centralized JSON helpers and `401` handler to return user to login.
- Wallet and Diagnostics nav entries now route to real pages instead of `EmptyPage` placeholders.
- Data Reads removed as a standalone sidebar item; history is available under Diagnostics.
- Integritas proof history removed from the Integritas page; history actions live under Diagnostics.
- `docker-compose.yml` — `APP_SECRET` and session-related env vars passed to the backend container.
- `frontend/Dockerfile` — build adjusted for Vite config.

### Security

- Passwords hashed with bcrypt; TOTP secrets encrypted with existing `APP_SECRET`-backed crypto.
- Generic login errors (`Invalid credentials`) to avoid account enumeration.
- Session cookies: HttpOnly, `SameSite=Strict`, optional `Secure` flag for HTTPS deploys.
- Documented prototype limits: CLI has no session auth in V1 (protected API calls return `401` without a browser session).

### Known limitations

- CLI (`bin/integritas-pi`) does not authenticate; operational commands against protected routes will receive `401` until a later CLI auth story is added.
- Guest/mock login paths were removed; V1 is admin-only.
- Automated npm audit may report transitive `tar` advisories in backend dev dependencies; unrelated to runtime auth behavior.
