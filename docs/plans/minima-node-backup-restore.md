# Minima Node Backup & Restore Plan (v3 — own scheduler, single stored password)

**Status:** Implemented, needs manual verification against a real/test node
**Created:** 2026-07-29
**Goal:** A first-class Minima node backup/restore feature using our own admin-chosen backup password and our own scheduler — not Minima's built-in `backup auto:true`, which turned out to have hard, unfixable limitations.

## Context

Two earlier designs for this feature were tried and superseded this session:

1. **v1** (single list, optional per-backup password): shipped, then live-testing against Minima's actual source (`minima-global/Minima`) found real gaps — `backup` always AES-encrypts but falls back to Minima's hardcoded default password (`"minima"`, public) when none is given, and Minima's own 24h auto-backup timer always calls a bare, hardcoded `backup` command with no configurable password or file path.
2. **v2** (encrypted/unencrypted split by filename suffix, kept relying on Minima's built-in auto-backup as an untracked background feature): also shipped, but left the auto-backup toggle unable to deliver what its label promised — recurring runs stayed invisible to our lists no matter what.

**This version drops Minima's built-in auto-backup entirely.** Instead:

- The admin sets **one backup password**, once, stored encrypted in SQLite (`shared/crypto.ts`'s existing `encryptSecret`/`decryptSecret`, AES-256-GCM keyed by `APP_SECRET` — the same primitive already used for Integritas tokens; never returned by any API response).
- Every backup — manual (`POST /api/minima/backups`) or automatic (our own scheduler) — uses that same stored password. There is no more "encrypted vs unencrypted" distinction; every backup this feature creates is equally protected.
- Our own backend scheduler (`minima-backup-scheduler.service.ts`, started from `index.ts` like the other pollers) replaces Minima's internal timer: checks an `auto-backup enabled` setting on an interval and calls `createBackup({ auto: true })` directly into our shared `backups/` folder, so it's always visible, always capped, always cleaned up — none of which was achievable while relying on Minima's own scheduler.
- One combined list, not split by trigger source (that distinction was dropped as unnecessary UI complexity once both trigger types share the same password): capped at 20 total, oldest auto-deleted once a new backup pushes past the cap. Filenames still encode trigger source (`minima-manual-<ts>.bak` / `minima-auto-<ts>.bak`) for operators inspecting the shared folder directly, no new DB table.
- The whole list is downloadable now (no more download-gating logic) — every backup is protected by the same real, admin-chosen password, so there's no weaker class to hide.
- Storing the backup password in our own encrypted settings (rather than requiring re-entry every time) was an open question this session. Resolution: it's fine, and meaningfully different from the earlier-rejected idea of encrypting backup *file contents* with `APP_SECRET` directly — that would have doubled as a standing, unrotatable key for the file data itself. Here, `APP_SECRET` only protects a small setting value at rest, exactly like existing Integritas token storage; the actual backup files remain protected by the admin's own chosen password, which is what makes them safe once they leave the device (a laptop Downloads folder, etc.) — the local DB storage doesn't weaken that, since an attacker who already has DB access has host/container access anyway (already out of scope for this project's threat model).

## Backend changes

- **`backend/src/features/minima/minima-backup.service.ts`**:
  - `setBackupPassword(password)` / `getBackupPassword()` (internal) / `hasBackupPassword()` / `clearBackupPassword()` — encrypted via `shared/crypto.ts`.
  - `createBackup({ auto })`: throws if no password is set; builds `backup file:backups/<name> password:"<stored>"`; enforces the manual cap (409 error) or prunes the oldest auto backup after a successful create.
  - `restoreBackup({ fileName, password })`: explicit `password` wins (for uploaded/foreign `.bak` files with unknown history); otherwise falls back to the stored password automatically, so restoring one of our own listed backups needs no password re-entry.
  - `getBackupFilePath()` no longer restricts by filename suffix — download is allowed for any tracked backup.
  - `setAutoBackupEnabled(enabled)` is now a plain, synchronous setting toggle (no RPC call at all) — throws if enabling without a stored password first.
- **`backend/src/features/minima/minima-backup-scheduler.service.ts`** (new): `startMinimaAutoBackupScheduler()`/`stop...()`. Schedules a fixed nightly clock time (00:30, on the backend container's own clock — see `TZ` in `docker-compose.yml`/`.env.example`, default UTC) rather than a rolling interval, recomputing the next occurrence after each run so it self-corrects instead of drifting; checks the enabled flag + stored password before calling `createBackup({ auto: true })`.
- **`backend/src/index.ts`**: starts/stops the new scheduler alongside the other pollers, after migrations.
- **`backend/src/features/minima/minima.routes.ts`**: new `GET/POST /api/minima/backups/password` (re-auth required to set/change); `POST /api/minima/backups` no longer takes a body; `POST /api/minima/backups/auto` handling simplified for the now-synchronous toggle.
- **`backend/src/features/minima/minima-console.service.ts`**: `backup`/`restoresync` console dispatch no longer extracts a `password:` from the typed command — always uses the stored password via the same narrow functions.

## Frontend changes

- **`MinimaBackupPanel.tsx`**: a "set backup password" step (re-auth required) gates everything else. "Backup now" is a single click, no password field. Auto-backup toggle disabled until a password is set, captioned to explain it's tracked in the Auto list like everything else. Two lists (Manual/Auto), both with Download/Restore/Delete. Restore view keeps an optional "password override" field only for the upload case.
- **`minimaBackupApi.ts`** / **`app/types.ts`**: updated for the new response shapes (`{ manual, auto }`, `{ hasPassword }`), `createMinimaBackup()` takes no arguments.

## Docs

- `README.md`, `SECURITY.md`, `docs/security/host-and-infrastructure.md`, `CHANGELOG.md`, and `.claude`/`.agents`/`.cursor` `minima` rules all updated to describe the new stored-password/own-scheduler design in place of the two previous iterations.

## Verification

1. `npm run check`, `npm --prefix backend run build`, `npm --prefix frontend run build`.
2. Manual, against the live dev node:
   - Set a backup password (requires re-auth); confirm "Backup now" and the auto-backup toggle are disabled until then.
   - Create 6 manual backups — 6th must be rejected with a clear error, none created.
   - Enable auto-backup, wait past the initial 5-minute delay (or verify via logs) — confirm a new auto backup appears in the Auto list.
   - Restore one of the listed backups without typing a password — must succeed using the stored password automatically.
   - Upload a foreign `.bak` with a different password via the override field — must succeed, and the uploaded file must not linger in either list afterward.
3. `git status --short --untracked-files=all` before commit.
