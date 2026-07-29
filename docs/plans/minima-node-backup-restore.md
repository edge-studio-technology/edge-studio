# Minima Node Backup & Restore Plan

**Status:** Code implemented — needs manual verification against a real/test Minima node (see Verification)
**Created:** 2026-07-29
**Goal:** Add a first-class, UI-driven Minima node backup/restore feature (`backup`/`restoresync`) so an operator can recover a node's wallet keys, coin proofs, and transaction history after disk loss or migration — not just its wallet keys, which is all the existing seed-phrase import already covers.

## Context

Integritas-pi had no way to recover a Minima node's wallet/chain state. `wallet.service.ts` only supports importing a 24-word seed phrase (`restore phrase:"..."`), which per Minima's docs only recovers spendable wallet keys — not proof/transaction history or node state. Minima also has a dedicated `backup`/`restore`/`restoresync` command family that captures a much fuller snapshot (seed phrase + private keys + coin proofs + key-use counters + transaction history) to a `.bak` file and can restore it with an automatic archive re-sync. This is the real "move this Pi's node, or recover it after disk loss" mechanism.

`backup`/`restore`/`restoresync` were already present in the Minima RPC console catalog (`minima-console.catalog.ts`) as generic disabled "write" passthrough entries, but that only let an admin type a raw command — there was no way to actually retrieve the resulting `.bak` file (it's written inside the `minima` container's own filesystem, which `backend` had no volume access to) or upload one back in for a restore. This plan adds a dedicated, narrow feature following the same pattern as `resyncMegammr()` / `addMinimaPeers()`: a backend service + routes + a shared, purpose-scoped volume, plus a frontend panel.

**Decisions made with the user before implementing:**

- File-based only — no "view seed phrase" UI. `vault` stays fully hard-excluded exactly as `.claude/rules/minima.md` documents; no new exception carved into it.
- Include a toggle for Minima's built-in unencrypted daily auto-backup (`backup auto:true`), clearly labeled as unencrypted.
- Restore always uses `restoresync` (restore + automatic archive/MegaMMR re-sync in one step), reusing the existing `megammrHost` setting (`getMinimaConfig()`) as the sync host — same host already used by `resyncMegammr()`. Plain `restore` (no resync) stays available only via the raw RPC console for advanced/offline use; not exposed in the new UI.
- No new DB table. The shared backups directory itself is the source of truth for the backup list (name, size, mtime), mirroring how `files.service.ts` treats `hostFilesRoot` as its source of truth. Only the auto-backup on/off intent is persisted, via `settings.repository` (same pattern as `minima_megammr_host`).
- No new env var. Reuses `MINIMA_DATA_DIR` — mounts `${MINIMA_DATA_DIR:-./minima}/backups` into `backend` at a fixed, hardcoded container path (`/minima-backups`, same style as the existing hardcoded `/home/minima/data` in `minima.docker.ts`), so `minima` and `backend` share exactly that one subdirectory — never the full Minima data dir. (Verified live during implementation: this same host directory also had to be mounted a second time, directly into `minima` at `/home/minima/backups` — see the correction below.)

**Rejected alternative:** exposing a "view seed phrase" UI alongside backup/restore was explicitly deferred — stays file-based only.

**Needs verification against a real/test node** (the Minima docs used for this plan were fetched via automated page summarization and may not exactly match the pinned `minimaglobal/minima` image version):

- ~~Exact accepted params for `backup` (`password`, `file`, `auto`, `maxhistory`) and whether `file:` really accepts a relative subdirectory path like `file:backups/name.bak`.~~ **Verified live:** `file:backups/name.bak` is accepted, but resolves relative to `/home/minima` (the container's home dir), not `/home/minima/data` as originally assumed — see the `docker-compose.yml` correction above. `password`/`auto`/`maxhistory` still unverified.
- ~~Whether `backup auto:false` actually turns the built-in auto-backup back off, since the fetched docs only described how to turn it on.~~ **Verified live:** `backup auto:false` cleanly disables it (`{"autobackup":false}`). Also found live: `backup auto:true` alone writes its rolling backup to `/home/minima/data/minima-backup-<ts>.bak`, outside the shared `backups/` folder and invisible to `listBackups()` — fixed by always passing `file:backups/auto-backup.bak` alongside `auto:true` (`setAutoBackupEnabled()`), which Minima honors, redirecting the rolling auto-backup into the shared, UI-visible folder as one fixed, overwritten-in-place file. Not yet observed: whether Minima's own internal daily timer re-applies that same `file:` target on each subsequent automatic run, or only honors it for the confirmation backup made at toggle-on time (would require waiting a full day to confirm).
- Whether `restoresync` requires the node to already be freshly initialized, or can run against an already-running node in place — **still outstanding, not yet tested** (destructive to current wallet/chain state; needs a deliberate test run, not casual verification).

## Backend changes

- **`docker-compose.yml`** — `backend` service gains `${MINIMA_DATA_DIR:-./minima}/backups:/minima-backups` in `volumes:`. **Correction found during live testing:** `minima` also needs its own mount of the same host directory at `/home/minima/backups`. Minima does not resolve the `backup`/`restoresync` `file:` argument relative to `/home/minima/data` as originally assumed — a direct RPC test (`backup file:backups/sanity-test.bak`) confirmed it resolves relative to `/home/minima` (the container's home dir) instead, so without this second mount the file lands in the container's ephemeral layer and is invisible to `backend`/lost on restart.
- **`backend/src/features/minima/minima-backup.service.ts`** (new) — `listBackups()`, `createBackup({ password? })`, `restoreBackup({ fileName, password? })`, `deleteBackup(fileName)`, `saveUploadedBackup(tmpPath, originalName)`, `getBackupFilePath(fileName)`, `getAutoBackupEnabled()`/`setAutoBackupEnabled(enabled)`, plus `verifyCurrentPassword()`/`MinimaBackupError` for the re-auth gate. Reuses the resolve-then-realpath containment check pattern from `files.service.ts`. `createBackup`/`restoreBackup` wrap `beginMinimaOperation("backup"|"restore")` with the same "clear only on throw" try/catch shape as `resyncMegammr()` in `minima.service.ts`, so the node shows as busy until the next successful status poll.
- **`backend/src/features/minima/minima-upload.middleware.ts`** (new) — small multer tmpdir middleware mirroring `backend/src/features/integritas/upload.middleware.ts`, used for restore-by-upload.
- **`backend/src/features/minima/minima-monitoring.ts`** — `MinimaOperationType` extended from `"restart" | "resync"` to also include `"backup" | "restore"`.
- **`backend/src/features/minima/minima-console.catalog.ts`** / **`minima-console.service.ts`** — `backup` and `restoresync` are now dedicated special-dispatch catalog entries (same shape as `megammrsync.resync`/`peers.add`) that route through `createBackup()`/`restoreBackup()` instead of the generic RPC passthrough, extracting `password:`/`file:` from the typed command. Plain `restore` and `reset` remain generic passthrough, unchanged.
- **`backend/src/features/minima/minima.routes.ts`** — new routes, all `requireRole("admin")`:
  - `GET /api/minima/backups` — list.
  - `POST /api/minima/backups` — create, body `{ password? }`.
  - `POST /api/minima/backups/:fileName/download` — re-auth (`{ currentPassword }`) then stream the file; POST (not GET) because re-auth needs a body.
  - `POST /api/minima/backups/restore` — re-auth + either `{ fileName, password? }` for an existing backup or a multipart upload (`file` field).
  - `DELETE /api/minima/backups/:fileName` — no re-auth (only removes a copy of already-recoverable data).
  - `GET`/`POST /api/minima/backups/auto` — read/toggle the auto-backup setting.
  - All mutating routes call `recordAuditEvent` (`minima.backup.created`, `.downloaded`, `.restored`, `.deleted`, `.auto_toggled`) — never the password.

## Frontend changes

- **`frontend/src/features/minima/minimaBackupApi.ts`** (new) — thin fetch wrappers via `frontend/src/lib/api.ts` (`getJson`/`postJson`/`postForm`/`deleteJson`), plus a `downloadMinimaBackup()` blob-download helper matching the existing pattern in `integritasApi.ts`'s `downloadSelected()`.
- **`frontend/src/features/minima/MinimaBackupPanel.tsx`** (new) — added to Account Settings below `MinimaSettingsPanel`. Gates actions on `actionsBlocked` (node must be `"running"`, same pattern as `MinimaSettingsPanel`/`WalletSettingsPanel`). Backup list (name, size, local+UTC created time) with Download/Restore/Delete per row; "Backup now" with optional password; "Automatic daily backups" toggle with an unencrypted-files warning; a restore view (pick an existing backup or upload a `.bak` file, optional password) gated behind a re-auth confirmation modal (reusing `Modal`) for both download and restore.
- **`frontend/src/app/types.ts`** — added `MinimaBackupEntry`, `MinimaBackupListResponse`, `MinimaBackupCreateResult`, `MinimaAutoBackupResponse`.
- **`frontend/src/pages/AuthSettingsPage.tsx`** — renders `<MinimaBackupPanel />` between `MinimaSettingsPanel` and `WalletSettingsPanel`.

## Docs

- `README.md` — new paragraph under Configuration documenting the feature and volume, plus a new Backend API block for `/api/minima/backups*`.
- `docs/security/host-and-infrastructure.md` — new "Minima Node Backup & Restore" risk entry (narrow scoped volume, path containment, admin + re-auth gating, audit logging, unencrypted-by-default risk).
- `SECURITY.md` — guideline bullet extended to cover backup file download/upload alongside seed phrase import.
- `CHANGELOG.md` — `Added` entry under `[Unreleased]`.
- `.claude/rules/minima.md` / `.agents/rules/minima.md` / `.cursor/rules/minima.mdc` (kept in sync) — new bullet describing the backup/restoresync dispatch and the shared volume.

## Verification

1. `npm run check`, `npm --prefix backend run build`, `npm --prefix frontend run build`, `docker compose config`, `docker compose build` (compose volumes changed).
2. Manual, against a real/test Minima node (not production wallet funds) — still outstanding:
   - Confirm `backup file:backups/test.bak password:...` writes a file visible from the `backend` container at `/minima-backups/test.bak`.
   - Confirm `restoresync file:backups/test.bak password:... host:<megammr host>` succeeds end-to-end and the node's balance/history reappear.
   - Confirm the auto-backup toggle's on *and* off commands behave as expected (the biggest documentation-accuracy risk called out above).
3. Exercise the panel in the browser: create a password-protected backup, download it, delete it from the list, re-upload it, restore it, and confirm the re-auth prompt is enforced on both download and restore.
4. `git status --short --untracked-files=all` before commit.
