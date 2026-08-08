# Tasks

## How To Use This File

- Read this file (and `docs/PROJECT.md`) at the start of every session.
- Keep **Current Focus** to 1-3 items max.
- Move completed items to **Done** immediately.
- This tracks active work only. Detailed backlogs stay in their own docs:
  `docs/qa/gaps.md` (QA/security gaps), `docs/plans/*.md` (feature plans).

---

## Current Focus

- [ ] Manual browser check of the Minima RPC console whitelist modal fix (checkbox styling, collapsible Read/Write sections) on `main`.

## In Progress

- [ ] Redesign the workflow canvas create/edit/watch experiences — see `docs/plans/workflow-redesign.md`.
- [ ] Block automation workflows — see `docs/plans/block-automation-workflows.md`.
- [ ] V1 security sign-off checklist — see `docs/plans/security-checklist.md`.
- [ ] Minima node backup & restore v3 (own scheduler, single stored backup password, manual/auto caps) — code implemented, needs manual verification against a real/test node — see `docs/plans/minima-node-backup-restore.md`.

## Next

- [ ] Post-v1: add seed-phrase-only restore as an option inside `MinimaBackupPanel`, then remove the commented-out `WalletSettingsPanel` from `AuthSettingsPage.tsx`.
- [ ] Manual check of the update-agent UI Back buttons and the dashboard "Update available" badge across a real update cycle (Pi or local Docker Compose) — this session's fixes were only build/typecheck-verified.
- [ ] Reconcile `.claude/rules/update-agent.md`/`.agents/rules/update-agent.md`/`.cursor/rules/update-agent.mdc`, which still say `update-agent` has "no self-update path" — `update-agent/src/self-update/` already implements one (commit `4e26bfe`), and `docs/notes/update-agent-self-update.md` is stale too.
- [ ] Add HC-SR501 PIR motion sensor as a first-class GPIO input workflow source - see `docs/plans/pir-motion-sensor-workflows.md`.
- [ ] Add ESP32 MQTT board onboarding with generated starter firmware - see `docs/plans/esp32-mqtt-sensor-onboarding.md`.
- [ ] Document the `DEV_MODE` install flag in `README.md`'s runtime-config section and note its manifest-signature-verification bypass in `SECURITY.md`/`docs/security/host-and-infrastructure.md` — flagged during code review, deliberately deferred as a separate concern from the pagination work.
- [ ] Consider a shared Minima-node-state hook/context: `WalletPage`, `WalletSettingsPanel`, and `MinimaSettingsPanel` each run their own independent `useMinimaStatusRefresh` subscription today (accepted duplication, no shared store exists yet).
- [ ] Sanity-check two catalog exclusions added beyond `docs/plans/minima-rpc-console.md`'s named list during `help`-output reconciliation: `createtokenfrom` (same raw-`privatekey:` risk as the named `*from` commands) and `decryptbackup` (can turn an encrypted backup into plaintext key material) — see `docs/SESSION.md` Notes for reasoning.
- [ ] Manual check that the Minima 48h auto-restart toggle no longer appears in Minima node settings and the nightly scheduler still runs auto-backup normally (auto-restart execution + UI toggle were commented out; see `minima-backup-scheduler.service.ts`/`MinimaSettingsPanel.tsx`).
- [ ] Manual browser check of the onboarding wizard's brand mark (first-run setup) after swapping its placeholder `Layers3` icon for the real `BrandMark` component.
- [ ] Manual browser check of the Account page's "Delete backup" flow after switching it to the shared `DeleteConfirmModal`/`DeleteProgressModal` component.

## Done

- [x] Added reusable setup-guide starter workflow actions, starting with readable source preview workflows — see `docs/plans/device-guide-starter-workflows.md`.
- [x] Added BME280 environmental sensor support through a reusable host-side Python sensor helper, with BME680 extension path — see `docs/plans/bme-environmental-sensor-support.md`.
- [x] Implemented V1 workflow variables and output templating — see `docs/plans/workflow-variables-and-output-templating.md`.
- [x] Implemented V1 device configuration flow, HTTP/MQTT output targets, and optional local MQTT broker support — see `docs/plans/device-configuration-and-mqtt-broker.md`.
- [x] `AGENTS.md` rewritten as Karpathy-style behavioral guidelines; project-specific rules split into `.agents/rules/*.md`, indexed from `AGENTS.md` and `docs/README.md`.
- [x] `SECURITY.md` split into a policy document (supported use, guidelines, reporting) plus a detailed risk register in `docs/security/*.md`.
- [x] Fixed stale `SECURITY.md` reference to removed `fromAccountAddress` / labeled accounts.
- [x] `.cursor/rules.mdc` updated to point at `.agents/rules/` and `docs/security/` alongside `AGENTS.md`/`SECURITY.md`.
- [x] `docs/PROJECT.md`, `docs/TASKS.md`, `docs/SESSION.md` added.
- [x] Added `CLAUDE.md`/`.claude/rules/` as full duplicates of `AGENTS.md`/`.agents/rules/` (not an `@AGENTS.md` import as originally planned), with a sync notice in both top-level files warning against drift.
- [x] Diagnostics "Workflow logs" tab brought to pagination/filter/search parity with proofs/reads — see `docs/plans/workflow-runs-pagination.md` (now Implemented).
- [x] Unified a single lightweight refresh button across all three Diagnostics tabs; fixed the "Raw details" panel rendering at the table bottom instead of inline; lowered the default Diagnostics page size 50→25 and fixed a bug where it silently fell back to 10 instead.
- [x] Ran a multi-agent code + security review of `chore/workflow-pagination`; security review was clean; fixed 7 of 10 code-review findings (shared backend pageSize=0 bug, duplicated tab-dispatch logic, an orphaned API route, a stale hardcoded default, dead code, a refresh-icon busy-state paper cut, and an empty `CHANGELOG.md [Unreleased]`).
- [x] Added `commit-message` and `session-notes` skills (mirrored in `.claude/skills/` and `.agents/skills/`).
- [x] Added Pi Camera capture devices and `Capture camera` automation blocks; cleaned up stale docs README plan rows and GPIO guide links.
- [x] Implemented structured data-source/workflow/block error attribution and UI details — see `docs/plans/structured-error-handling.md`.
- [x] Added structured app/API error helpers, frontend parser support, and high-impact route conversion for Data Sources/Webhook, Automation/read-history, auth/setup, and Integritas actions — see `docs/plans/app-api-error-handling.md`.
- [x] Completed active route-level structured app/API error response migration for address book, feedback, files, wallet, tokens, Minima, Integritas Connect auth, and data-source health failures — see `docs/plans/app-api-error-handling.md`.
- [x] Documented structured backend/frontend error-handling rules in `.agents/rules/` and synced the `.claude/` and `.cursor/` counterparts.
- [x] Fixed the Minima Core "Syncing" false-status root cause and added a durable backend-owned `"restarting"` node state, friendlier RPC errors, and adaptive status polling — see `docs/plans/minima-restart-resync-status.md` (branch `fix/minima-sync-missmatch`).
- [x] Synced Dashboard wallet display and polling to node state; disabled Minima Core and Wallet page actions until the node is confirmed running/idle; added loading indicators (dots/spinner) in place of stale or misleading values across Minima Core, Dashboard, and Wallet.
- [x] Fixed Wallet page going stale after a resync/restart performed from another page by auto-refreshing balance/assets/history on the node's return to `"running"`.
- [x] Moved Wallet settings and Minima node settings out of page-level modals into new `WalletSettingsPanel`/`MinimaSettingsPanel` cards on the Account settings page; removed the now-unused settings buttons/modals from `WalletPage.tsx`/`MinimaPage.tsx`.
- [x] Fixed a false-positive "Failed to load peers" toast on Account Settings: `MinimaSettingsPanel` now only fetches peers once the node is confirmed `"running"` (reusing the existing `actionsBlocked` gate) instead of fetching unconditionally on mount, so a user-triggered resync/restart no longer surfaces the toast as a false error.
- [x] Moved Address book from a Wallet page modal into its own tab; made the peer connections list in Minima settings scrollable; `CHANGELOG.md` `[Unreleased] fix/minima-sync-missmatch` section now covers all of this branch's user-facing changes to date.
- [x] Implemented the Minima RPC console on the Minima Core page: admin-curated, closed-world checkbox whitelist (96 catalog entries reconciled against Minima's live `help` output) with re-auth-gated whitelist edits and a terminal-style scrollback; `megammrsync`/`peers action:addpeers` dispatch through the existing narrow actions — see `docs/plans/minima-rpc-console.md` and `docs/security/host-and-infrastructure.md`. Merged to `main` via PR #39.
- [x] Fixed the header status section (`AppShell.tsx`, shown on every page) never refreshing after the initial page load and silently going stuck-stale on a failed fetch: added 30s polling (`useStatusOverviewRefresh`) that keeps last known-good status and flags failed refreshes instead of nulling out; replaced the three text pills with clickable Node/Wallet/Integritas status dots (`StatusDot.tsx`) with a click-to-open detail popover; added a real wallet-balance-backed `wallet` service to `GET /api/status/overview` instead of the header's "wallet" pill silently reusing the `minima` node-status check. Merged to `main` via PR #39 (released as part of `0.25.0`+).
- [x] Fixed a root-cause CSS cascade-layers bug in `frontend/src/styles.css` where an unlayered `input, textarea, select {...}` rule silently overrode any Tailwind utility class on any `<input>` app-wide (Tailwind v4 utilities live in `@layer utilities`, and unlayered rules always beat layered rules regardless of specificity) — this broke checkbox sizing/styling in the Minima RPC console whitelist modal, `AutomationPage.tsx`, and `IntegritasHistoryTable.tsx`. Scoped the rule off `type="checkbox"`/`type="radio"`. Also gave the whitelist modal explicit checkbox styling and made its Read/Write command lists collapsible (`<details>`/`<summary>`) — typecheck/build verified, no manual browser check yet (see Current Focus).
- [x] Added a "Back" button to the update-agent UI's up-to-date/available/error views; fixed the dashboard "Update available" badge lingering after a successful update by excluding `update-agent`'s own (background, non-user-actionable) self-update status from the badge trigger in `AppShell.tsx`; fixed Settings showing "Unknown" for Version on already-up-to-date devices that never got `last-applied-manifest.json` written, by having `update-agent`'s `getUpdateStatus()` self-heal that state — branch `fix/update-agent-ui-fixes`, typecheck/build verified, no manual browser/hardware check yet (see Next). Merged to `main` via PR #41, released as `0.26.1`.
- [x] Added a short tester guide for Pi and PC device/source/target workflows, hardware requirements, and end-to-end pass criteria — see `docs/guides/tester-device-workflows.md`.
- [x] Reverted (via `git revert`, history preserved) a shelved Minima status/operation-lock redesign back to the working `a37f808` state after it regressed reported UX; disabled the 48h Minima auto-restart feature (commented out the scheduler call and the settings-panel toggle, setting/routes left intact) pending graceful automation handling around node restarts — branch `feature/minima-resync-rescue-improvements`, typecheck/build verified.
- [x] Renamed remaining "Integritas Pi" product-name references app-wide to "Edge Studio" (TOTP issuer/account label, device/ESP32/MQTT setup copy, guides/plans docs, `SECURITY.md`, `install.sh`, `update-agent`), leaving repo/technical identifiers (package names, Docker network name, systemd unit names, README/PROJECT.md titles) for the later full repo rename; also caught and fixed leftover pre-"Edge Studio" brand names still live in the app ("Edge Workbench" in the TOTP account label, `SetupPage.tsx`, `IntegritasConnectPanel.tsx`, and `OnboardingWizard.tsx`'s "Enter" button; "Minima Edge Stack" in `SetupPage.tsx`), and swapped the onboarding wizard's generic `Layers3` placeholder icon for the real `BrandMark` logo — branch `ui/global-style-realignment`, typecheck/build/`docker compose config` verified.
- [x] Extracted the Devices page's device-delete confirm/progress modal pair into a shared `DeleteConfirmModal`/`DeleteProgressModal` (`components/patterns/DeleteConfirmModal.tsx`), removed the device-specific `features/data-sources/DeleteDeviceModal.tsx`, and switched the Account page's backup delete flow (`MinimaBackupPanel.tsx`) to the same component/UX — branch `ui/global-style-realignment`, typecheck/build/`docker compose config` verified.

## Ideas

- [ ] Sync mechanism (script or CI check) to keep `.claude/`/`.agents/` (rules and skills) from drifting — still unbuilt; this session hit a real, if small, instance of the drift it's meant to prevent, caught manually rather than by tooling.
- [ ] Graceful automation handling around Minima node restarts (avoid interrupting an in-progress workflow run's HTTP poll/MQTT publish/wallet tx) — prerequisite for re-enabling the 48h auto-restart toggle, which is currently disabled for this reason.
- [ ] One-source-of-truth Minima status/operation-lock redesign (single backend lock across all mutating paths incl. wallet/console writes, single shared frontend polling store instead of five independent `useMinimaStatusRefresh` subscribers) — attempted and shelved this session after the redesign regressed reported UX in an unconfirmed way; see `docs/SESSION.md` for the leading (unconfirmed) hypothesis before restarting this.

---

Related: [PROJECT.md](./PROJECT.md) · [qa/gaps.md](./qa/gaps.md) · [plans/](./plans/) · [security/](./security/)
