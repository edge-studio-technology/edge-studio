# Tasks

## How To Use This File

- Read this file (and `docs/PROJECT.md`) at the start of every session.
- Keep **Current Focus** to 1-3 items max.
- Move completed items to **Done** immediately; keep Done to the current release cycle. Older history lives in `CHANGELOG.md` and git.
- Every item stands on its own. Plans in `docs/plans/` exist only while their work is open (see the `plan-doc` skill); QA/security gaps live in `docs/qa/gaps.md`.

---

## Current Focus

- [ ] Retire old plan documents and consolidate ADRs (OpenProject #687) — see `docs/plans/features/687-retire-old-feature-plan-documents.md`.

## In Progress

[Nothing in progress.]

## Next

### Follow-ups from finished work

- [ ] Review the #524 lint follow-ups: `JsonPreview` ignores `title`, `WatchRunHistory` ignores `replayPlaying`, and `WorkflowWorkspace` rebuilds its replay arrays every render, so effects rerun and the replay timer re-arms.
- [ ] Clean up table drift left from #697: the workflow watch history's double scroller, the Minima peers table's `<div>` header, and Minima backups not yet on `TableWrap`.
- [ ] Remove the legacy `bcryptjs` verify path, its tests, and the CI outdated check once existing installs have rehashed (#887; ADR 0035).
- [ ] QA password-manager/native autofill and physical mobile keyboards for the PIN/password inputs (excluded from #283; proposed as a separate ticket).
- [ ] Finish the #705 manual checks on a Pi/container: retention sweep, webhook token redaction in backend and nginx logs, run budget, and the documented existing-installation log-rotation migration (installer rerun).
- [ ] Run the 13-step Brave check of the app-wide empty/loading/error states (#229, #659–#661), including Integritas, software update/update-agent, and Wallet while Minima is unavailable.
- [ ] Verify the nightly Minima auto-backup (00:30 container time) creates and rotates a backup on a real Pi; manual backup/restore was verified in #283.
- [ ] Browser QA of workflow watch mode against live runs: follow-live, historic replay, block summaries, and that the replay status text, header controls, and block stack share one horizontal center at desktop width.
- [ ] Browser QA of the workflow canvas against the Figma states (empty, populated, scrolled, selected-block sheet, leave dialog, watch, responsive).

### Security

- [ ] Confirm the two provisional V1.5 product decisions and record them in ADR 0010: accept the unauthenticated first-boot admin claim under the trusted-LAN model (review finding [2]), and keep the anonymous, off-by-default MQTT broker (finding [5], DEVICE-IO-04/05 stay open).
- [ ] Digest-pin the third-party images outside the signed manifest (`minimaglobal/minimacore`, `eclipse-mosquitto:2`, `minimaglobal/minima:dev`, `alpine:3.20`) and document the manual pin-bump procedure (finding [6]).
- [ ] Run the V1.5 manual transport checks on a Pi: `curl -vk https://<pi-ip>:8080/api/health` gives TLS 1.2/1.3 and 200; plain `http://` is refused or 400; the certificate SAN includes the Pi's LAN IP; the session cookie is `Secure`, `HttpOnly`, `SameSite=Strict`; optionally, a login capture shows no readable password.
- [ ] Define the product lifecycle for data-source reads, workflow runs/block runs, and visible inbox items: retention configuration, export, proof-linked reads, storage quotas, and disk-usage warnings (ADR 0022).
- [ ] Turn on branch protection for `main` now that changes land through PRs.

### Hardware support

- [ ] Run manual Pi retry validation for repeated Enable/Disable/Repair of Camera, GPIO, I2C sensors, and local MQTT, including retry after a failed prerequisite or partial action.
- [ ] Decide whether host-agent `.env` writes should reject non-allowlisted keys at the helper boundary (callers pass fixed keys today).
- [ ] Decide on host-agent follow-ups: async jobs for long capability actions, binding to localhost behind a proxy vs. the Docker gateway, an app-triggered reboot for `needs_reboot`, and re-auth for hardware enable/disable.
- [ ] Support Minima node updates through `update-agent`: solve multi-arch digests first (manifest-list digest or per-arch digests, verified on arm64 and armv7), then add backup/restore, the manifest key, and Compose wiring.

### Devices and automation

- [ ] PIR motion sensor: verify a PIR on the Pi through the UI and a `gpio_event_start` workflow, add beginner templates (motion → record, camera capture, stamp), and document defaults that change during hardware testing.
- [ ] ESP32 MQTT boards: verify an ESP32 publishing JSON to the Pi broker is recorded by an MQTT workflow; add DHT22 (after hardware verification), button, analog, and PIR-over-MQTT templates; add first-message troubleshooting; document broker auth limitations.
- [ ] Workflow templates for common GPIO, HTTP, webhook, schedule, output, MQTT, and Integritas flows.
- [ ] Verify `Schedule → Fetch HTTP → Stamp`, `GPIO → Record Event`, `GPIO → Fetch HTTP → Stamp`, and a button-triggered LED pulse on Pi hardware.
- [ ] Workflow editor: configure-block modal refinement, a full draft workspace save model, run-log filters, and evaluating branching/else blocks once the linear UX is stable.
- [ ] Implement the hosted feedback receiver in the Integritas API repo — see `docs/plans/feedback-hosted-receiver.md`.

### Manual checks and other

- [ ] Fix the root `concurrently` → `shell-quote` critical audit finding; consider adding the root package to `audit:moderate`.
- [ ] Verify slow Integritas PDF verification on the Pi after deploying the 5-minute timeout and longer frontend proxy wait; update explicit legacy timeout overrides and recreate backend/frontend containers.
- [ ] Investigate the Minima backup-restore fallback test returning 502 instead of 200 in `backend/tests/features/minima/minima.routes.test.ts:172`, reproduced during Integritas timeout verification.
- [ ] Stop other values from the previous `.env` (for example a hand-added `UPDATE_DRY_RUN`) leaking into the installer's compose run; only `COMPOSE_PROFILES` is unset after `load_existing_config` in `install.sh`.
- [ ] Verify the wiki’s temporary application-data backup/restore procedure on a real Pi with the same app version and unchanged runtime configuration; implement an integrated Edge Studio backup/restore feature separately.
- [ ] Cut one release per channel through the updated `release.yml` before the V1.5 security branch ships — installers carrying Phase 4 refuse any runtime bundle published without an `edge-studio-runtime.tar.gz.sig`. See `docs/adr/0016-install-time-bootstrap-trust-set.md`.
- [ ] Manual browser check of the rebuilt Automation "Workflows" table (`AutomationWorkflowsList.tsx`): filter/search, pagination, pause/play, the overflow menu's six actions, and the delete flow now going through confirm → progress modal instead of deleting immediately.
- [ ] Manual browser check of the rebuilt Automation inbox table (`AutomationInboxTable.tsx`): now full width (previously a bare `<section>` missing `w-full`); filter (All/Unread/Read) + search; the "View preview" modal for each of the four preview formats (text/json/link/image); "Mark read/unread"; and Delete now going through confirm → progress modal instead of deleting immediately.
- [ ] Manual browser check of the "Send feedback" modal's new "Integritas account ID" disclosure row (`FeedbackModal.tsx`): "Not connected" when unlinked, real account ID once linked via Integritas Connect.
- [ ] Manual check of the update-agent UI Back buttons and the dashboard "Update available" badge across a real update cycle (Pi or local Docker Compose) — this session's fixes were only build/typecheck-verified.
- [ ] Manual browser check of `update-agent`'s restyled static update-progress page (`update-agent/public/index.html`): black-to-purple gradient background and the white logo below the centered card, matching the login page — not yet manually checked (static HTML, no build step).
- [ ] Document the `DEV_MODE` install flag in `README.md`'s runtime-config section and note its manifest-signature-verification bypass in `SECURITY.md`/`docs/security/host-and-infrastructure.md` — flagged during code review, deliberately deferred as a separate concern from the pagination work.
- [ ] Consider a shared Minima-node-state hook/context: `WalletPage` and `MinimaSettingsPanel` each run their own independent `useMinimaStatusRefresh` subscription today (accepted duplication, no shared store exists yet).
- [ ] Sanity-check two catalog exclusions added beyond the Minima RPC console plan's named list during `help`-output reconciliation: `createtokenfrom` (same raw-`privatekey:` risk as the named `*from` commands) and `decryptbackup` (can turn an encrypted backup into plaintext key material).
- [ ] Manual check that the Minima 48h auto-restart toggle no longer appears in Minima node settings and the nightly scheduler still runs auto-backup normally (auto-restart execution + UI toggle were commented out; see `minima-backup-scheduler.service.ts`/`MinimaSettingsPanel.tsx`).
- [ ] Manual browser check of the onboarding wizard's brand mark (first-run setup) after swapping its placeholder `Layers3` icon for the real `BrandMark` component.
- [ ] Manual browser check of the Account page's "Delete backup" flow after switching it to the shared `DeleteConfirmModal`/`DeleteProgressModal` component, and confirm the modal-swap flicker fix (removed `Modal`'s `mounted` render gate) actually resolves it in-browser.
- [ ] Manual browser check of the restyled "Send feedback" modal (`FeedbackModal.tsx`) — all form states (bug / feature request / other), the description validation error, and the saved/download state.
- [ ] Manual browser check of Feedback V2 hosted delivery: no-key disabled submit state, footer consent block, hosted success/failure status, and hidden local fallback persistence.
- [ ] Manual browser check of Account settings' new "Software update"/"Feedback" subsections and the Update page's relocated "Update now"/"Check again" actions.
- [ ] Manual browser check of `update-agent`'s static update-progress page (`/update/` during an in-progress apply) to confirm the logo renders correctly and reads as the right size (superseded by the newer gradient-background/logo-position item above; the original 404 this covered is long fixed).
- [ ] Manual browser check of the new `/marketplace` "Coming soon" page and the `NotFoundPage` catch-all (visit an unmatched path) against the Figma reference, the retoned `DeleteConfirmModal` icon (backup/device delete), and the new `ErrorBoundary` "Something went wrong" fallback (needs a manually-thrown error to trigger).
- [ ] Manual browser check of Account settings' three disclosures now starting collapsed, the new "Behaviour settings" section/toggles, the restored `Modal` outside-click-to-close (press-to-close, no accidental close from an inside-to-outside text selection, safety-zone buffer near the dialog edge, setting-off disables it, and the setting persists across a reload via `localStorage`), the "Integritas settings" badge now showing "Checking…" first instead of popping in, and the new "Start sidebar collapsed" toggle (refresh at a desktop width with it on/off, and confirm narrow-viewport auto-collapse still applies regardless of the setting).
- [ ] Manual browser check of Account settings' Minima "Backups"/"Peers" tables (`DataTable` + `ScrollArea` replacing `ListDisclosure`) — scroll cap, row actions, empty states.
- [ ] Manual browser check of the new `EmptyContentState`/`LoadingState`/`SpinnerAlt` components against their Figma references, across all five call sites (Devices table, wallet send history, address book, Diagnostics Integritas tab, Diagnostics Devices tab) and the 4 `SpinnerAlt` swap sites (delete/progress modals, changelog preview, Connect Integritas step).
- [ ] Manual browser check of the `ListFilterBar` label/sizing fix and the always-visible-but-disabled search/filter/pagination controls during loading/empty, across wallet history, address book, and Diagnostics' Integritas/Devices tabs; confirm `Pagination`'s numbered buttons now visually grey out (not just silently no-op) while disabled. (Wallet assets tab is disabled for v1 — see below — so no longer reachable to check. Devices' old numbered `Pagination` control this item also covered has since been replaced by a `ListFilterBar` — see below.)
- [ ] Manual browser check that address book's "New contact" and Diagnostics' "Refresh" buttons now render full-size/black with a leading icon; and that the Diagnostics "Automation" tab now shows the shared loading spinner and empty/filtered-empty state ("Clear filters") instead of no loading state and an inline "no rows" row.
- [ ] Manual browser check that the Wallet page's "Assets" tab is gone (only "History"/"Address book" shown) and defaults to "History".
- [ ] Manual browser check of the Devices page: "Add devices" card is gone; the device list's new filter (All/Input/Output/Capture)+search bar (replacing the old numbered pagination control) works and disables while loading/empty; "New input"/"New output" buttons to its right open the right add-device flow; empty state shows both actions when there are no devices, "Clear filters" when a filter/search matches nothing; bottom pagination footer total reflects the filtered list.
- [ ] Manual browser check of the updated sidebar icons (Minima/Wallet/Integritas/Automation) and the collapsed-sidebar expand button's new plain two-panel icon, against the reference image, at both expanded and collapsed sidebar widths.
- [ ] Manual browser check of the search/filter-disable bugfix (Devices, address book, wallet history/assets, Diagnostics all three tabs): a search/filter matching nothing must keep the search input and filter dropdown enabled (not just "Clear filters"); a genuinely empty list (no data at all) must still disable them.
- [ ] Manual browser check of the tightened page/section descriptions (Dashboard, Minima, Integritas, Devices, Account settings headers; Devices table description; onboarding wizard welcome step; Marketplace "Coming soon") for wording/fit at real viewport widths.
- [ ] Manual browser check of the rebuilt Diagnostics "view details" modals (Integritas proof, device read, workflow run) — now built on the same `DetailList`+`Disclosure`+`ErrorDetailPanel`/`EmptyContentState`/`JsonPreviewContent` composition as the Devices reference modal — and the new consistent per-tab row actions (eye-icon "View details" + kebab menu; Integritas' "Verify"/"Download" moved into the kebab).
- [ ] Manual browser check of the modal footer/button-placement pass: delete confirm, send feedback, send payment, address book add/edit contact, edit device, and all five Minima backup modals — confirm buttons render in the footer, Cancel/primary/danger button order and styling are consistent, and `form={id}`-wired submit buttons still submit correctly (Enter-to-submit and the footer button click).
- [ ] Manual browser check of address book "Edit contact" now allowing the Mx/0x address to be edited (previously read-only): format validation error and the conflict error when saving an address already used by another contact.
- [ ] Manual browser check of the `bodyClassName` scroll-pane fixes (progress spinner modal, address book "Edit contact", "Send payment", Minima console "Confirm whitelist changes"): each should render unboxed (no border/card background) around its content, matching its already-correct sibling, while still fitting without a scrollbar at normal desktop widths.
- [ ] Manual browser check of the address book contact-actions rework: "View contact" is read-only (no Edit/Delete buttons); kebab "Edit" opens the edit form; kebab "Remove" opens the delete-confirm modal then a progress modal, and the row disappears with a success toast on completion.

## Done

- [x] #686 Removed dead code, seed import, token creation, TOTP, unused routes, and `/setup` (ADR 0036).
- [x] #216 Replaced native `bcrypt` with built-in scrypt; legacy hashes rehash on login (ADR 0035).
- [x] #886 Moved update-agent, the frontend build, and the installer verifier to Node 22.
- [x] #524 Added the shared ESLint config and `npm run lint` to `npm run check` and CI.
- [x] #536 Backend-owned Minima resync progress and recovery (ADR 0034).
- [x] #652 Synced wallet history into SQLite with filters and previous-wallet marking (ADR 0033).
- [x] #239 Update page changelog cached by update-agent (ADR 0032).
- [x] #283 PIN/password credential input (ADR 0031).
- [x] #206 App-owned local address-book contact (ADR 0030).
- [x] Hotfix: verified version identity, released as `v0.42.2` (ADR 0029).
- [x] #275 Static guided tour (ADR 0027).
- [x] #667 Responsive application (ADR 0024).
- [x] #229, #659–#661 App-wide empty/loading/error states (ADR 0025); Brave check still in Next.
- [x] #363, #259 Regression and node-failure unit tests; legacy-ticket unit-test gaps closed.
- [x] #704–#707 V1.5 security hardening: fail closed on `APP_SECRET`, retention/redaction/budgets, V1 sign-off, correctness hardening (ADRs 0010, 0021, 0022).
- [x] Host-agent capability management for Camera, GPIO, I2C sensors, and local MQTT (ADR 0019).
- [x] Backend-saved column visibility on every shared `DataTable`.

## Ideas

- [ ] Consider an explicit "Change receive address" action for the app-owned local contact; define old-destination and workflow-reference behavior first (ADR 0030).
- [ ] Add an `update-agent` build step to the verification rule; it lists only the backend and frontend builds.
- [ ] A sync script or CI check to keep `.agents/`, `.claude/`, and `.cursor/` rules and skills from drifting.
- [ ] Graceful automation handling around Minima node restarts (don't interrupt an in-progress HTTP poll, MQTT publish, or wallet send); prerequisite for re-enabling the 48h auto-restart (ADR 0037).
- [ ] One-source-of-truth Minima status/operation lock across all mutating paths, with one shared frontend polling store instead of independent `useMinimaStatusRefresh` subscribers. A first attempt regressed UX and was reverted.

---

Related: [PROJECT.md](./PROJECT.md) · [qa/gaps.md](./qa/gaps.md) · [plans/](./plans/) · [security/](./security/) · [adr/](./adr/)
