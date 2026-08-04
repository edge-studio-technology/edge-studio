# Session

Scratch log for the session in progress. Update it as you go; reset it when a session's work is done and merged. Not a changelog — see `CHANGELOG.md` for user-facing history.

## Progress

Branch `feature/minima-resync-rescue-improvements`. (Previous log entries here were for `fix/update-agent-ui-fixes`, merged to `main` via PR #41 and released as `0.26.1`; reset below per this file's own reset-when-merged rule.)

- Attempted a redesign for a single source of truth for Minima Node status/in-progress-operation tracking (one backend lock covering all mutating paths, one shared frontend polling store) — see the shelved plan in git history / prior session notes. After implementing it, the reported UX regressed compared to the prior working commit (`a37f808`, "Added an opt-in 48h auto-restart for Minima, reusing the nightly backup scheduler"). Investigated but could not confirm root cause live (no running node/browser available this session); leading (unconfirmed) hypothesis was that the redesign's `actionsBlocked` gate coupled unrelated panels (Wallet, Settings, Backup) to *any* in-progress Minima operation anywhere in the app, not just conflicting ones.
- Per explicit user decision, shelved the redesign rather than continuing to debug: discarded the uncommitted redesign changes, then ran `git revert --no-edit` on the two prior fix commits (`d697315`, `7f53b57`) in reverse order, landing the branch's working tree back at byte-identical `a37f808` content while keeping all four commits (two originals + two revert commits) visible in history. Confirmed identical via `git diff a37f808 HEAD --stat` (empty).
- Disabled the 48h Minima auto-restart feature (added in `a37f808`) rather than leaving it live: commented out the `runAutoRestartIfDue()` call in `minima-backup-scheduler.service.ts`'s nightly tick, and commented out the toggle UI in `MinimaSettingsPanel.tsx`, so it can neither fire from the scheduler nor be re-enabled from the UI. Left the underlying setting/routes/service functions (`getAutoRestartEnabled`/`setAutoRestartEnabled`, `GET`/`POST /api/minima/restart/auto`) intact for an easy re-enable later. Reason: restarting the node mid-run has no coordination with in-progress automations (HTTP polls, MQTT publishes, wallet transactions) today; deferred until automations get graceful handling around node restarts.
- Removed the now-inaccurate "Added: Auto restart toggle" `CHANGELOG.md [Unreleased]` entry (never released) and updated `.claude/rules/minima.md`/`.agents/rules/minima.md`/`.cursor/rules/minima.mdc` (kept in sync) to note the feature is currently disabled and why.
- Verified via `npm run typecheck`, `npm --prefix backend run build`, `npm --prefix frontend run build`, `docker compose config` — all pass. No manual browser check this session (no running node/browser available).

## Next Steps

- Manual check on a real/test node: confirm the auto-restart toggle no longer appears in Minima node settings and that the nightly scheduler still runs auto-backup normally.
- When automations get graceful handling around node restarts (tracked separately), re-enable auto-restart by uncommenting the two spots noted above.
- The one-source-of-truth Minima status/operation-lock redesign remains a real architectural gap (see prior plan) but is shelved for a later version per explicit user decision — do not restart it without the user asking.

## Notes / Open Questions

- The redesign's root-cause hypothesis (over-broad `operation != null` gating freezing unrelated panels) was never confirmed against a live node — worth keeping in mind if this area is revisited.
