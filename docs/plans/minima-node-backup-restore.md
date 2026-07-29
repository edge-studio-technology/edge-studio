# Minima Node Backup & Restore Plan

**Status:** Not started
**Created:** 2026-07-29
**Goal:** Add a first-class, UI-driven Minima node backup/restore feature (`backup`/`restoresync`) so an operator can recover a node's wallet keys, coin proofs, and transaction history after disk loss or migration — not just its wallet keys, which is all the existing seed-phrase import already covers.

## Context

Integritas-pi has no way to recover a Minima node's wallet/chain state today.
`wallet.service.ts` only supports importing a 24-word seed phrase (`restore
phrase:"..."`), which per Minima's docs only recovers spendable wallet keys —
not proof/transaction history or node state. Minima also has a dedicated
`backup`/`restore`/`restoresync` command family that captures a much fuller
snapshot (seed phrase + private keys + coin proofs + key-use counters +
transaction history) to a `.bak` file and can restore it with an automatic
archive re-sync. This is the real "move this Pi's node, or recover it after
disk loss" mechanism, and it doesn't exist in the product yet.

`backup`/`restore`/`restoresync` are already present in the Minima RPC
console catalog (`minima-console.catalog.ts:158-161`) as generic disabled
"write" passthrough entries, but that only lets an admin type a raw command —
there's no way to actually retrieve the resulting `.bak` file (it's written
inside the `minima` container's own filesystem, which `backend` currently has
no volume access to) or upload one back in for a restore. This plan adds a
dedicated, narrow feature following the same pattern as `resyncMegammr()` /
`addMinimaPeers()`: a backend service + routes + a shared, purpose-scoped
volume, plus a frontend panel, so backup/restore becomes a first-class,
UI-driven operation instead of a raw-console-only capability.

**Decisions made with the user before writing this plan:**
- File-based only — no "view seed phrase" UI. `vault` stays fully
  hard-excluded exactly as `.claude/rules/minima.md` documents; no new
  exception is carved into it.
- Include a toggle for Minima's built-in unencrypted daily auto-backup
  (`backup auto:true`), clearly labeled as unencrypted.
- Restore always uses `restoresync` (restore + automatic archive/MegaMMR
  re-sync in one step), reusing the existing `megammrHost` setting
  (`getMinimaConfig()`) as the sync host — same host already used by
  `resyncMegammr()`. Plain `restore` (no resync) stays available only via the
  raw RPC console for advanced/offline use; not exposed in the new UI.
- No new DB table. The shared backups directory itself is the source of
  truth for the backup list (name, size, mtime), mirroring how
  `files.service.ts` treats `hostFilesRoot` as its source of truth. Only the
  auto-backup on/off intent is persisted, via `settings.repository` (same
  pattern as `minima_megammr_host`).
- No new env var. Reuse `MINIMA_DATA_DIR` — mount
  `${MINIMA_DATA_DIR:-./minima}/backups` into `backend` at a fixed,
  hardcoded container path (`/minima-backups`, same style as the existing
  hardcoded `/home/minima/data` in `minima.docker.ts`), so `minima` and
  `backend` share exactly that one subdirectory — never the full Minima data
  dir. This is the only new read-write host mount into `backend`, and it's
  deliberately narrow (one subfolder) rather than a general one.

**Rejected alternative:** exposing "view seed phrase" (`vault action:seed`)
in the UI as part of this feature — deferred so this stays purely file-based
and doesn't touch the hard-exclusion rule around `vault`.

**Needs verification against a real/test node before/while implementing**
(the Minima docs were fetched via automated page summarization and may not
exactly match the pinned `minimaglobal/minima` image version):
- Exact accepted params for `backup` (`password`, `file`, `auto`,
  `maxhistory`) and whether `file:` really accepts a relative subdirectory
  path like `file:backups/name.bak`.
- Whether `backup auto:false` (or some other command) actually turns the
  built-in auto-backup back off, since the fetched docs only described how to
  turn it on.
- Whether `restoresync` requires the node to already be freshly initialized
  (docs mention "requires original key creation completion" for `restore`)
  — i.e. whether restore can run against an already-running node in place or
  needs a fresh container first.

## Backend changes

**`docker-compose.yml`**
- `minima` service: no change needed — `backups/` will simply appear as a
  subdirectory under its existing `/home/minima/data` mount.
- `backend` service: add
  `- ${MINIMA_DATA_DIR:-./minima}/backups:/minima-backups`
  to `volumes:`.

**`backend/src/features/minima/minima-backup.service.ts`** (new)
- `listBackups()`: `fs.readdir` the backups dir, `fs.stat` each `*.bak` entry
  → `{ fileName, sizeBytes, createdAt }[]`. Reuse the resolve-then-realpath
  containment check from `files.service.ts:14-29` even though the root here
  is fixed (defense in depth for the delete/download-by-name path below).
- `createBackup({ password }: { password?: string })`: builds
  `backup file:<timestamp>.bak` (+ `password:...` `confirm:...` if provided),
  wraps with `beginMinimaOperation("backup")` / `endMinimaOperation()`
  (same try/finally shape as `resyncMegammr()` in `minima.service.ts:181-191`),
  calls `runMinimaPathCommand(command, 60000)` (backups may take longer than
  the 30s used for resync).
- `restoreBackup({ fileName, password }: { fileName: string; password?: string })`:
  validates `fileName` is a bare basename inside the backups dir (no path
  traversal), builds
  `restoresync file:${fileName} host:${megammrHost}` (+ `password:...`),
  reusing `getMinimaConfig().megammrHost` from `minima.service.ts:25-31`.
  Wraps with `beginMinimaOperation("restore")`/`endMinimaOperation()`.
- `deleteBackup(fileName)`: validated `fs.unlink`.
- `setAutoBackupEnabled(enabled: boolean)`: sends
  `backup auto:${enabled}` (pending the verification above on how disable
  actually works), then persists intent via
  `saveSetting("minima_auto_backup_enabled", ...)`.
- `getAutoBackupEnabled()`: reads that setting (default `false`).
- Multer upload handling for restore-by-upload: small local middleware
  mirroring `backend/src/features/integritas/upload.middleware.ts` (tmpdir
  dest), then move the uploaded file into the backups dir under its original
  or a generated name before calling `restoreBackup`.

**`backend/src/features/minima/minima-monitoring.ts`**
- Extend the operation-kind type (currently `"resync" | "restart"`, per
  `beginMinimaOperation`/`isMinimaOperationInProgress` usage in
  `minima.service.ts`) to also accept `"backup"` and `"restore"`, so
  `MinimaSummaryGrid`/status UI can show a "restoring…" state the same way it
  shows "restarting" today.

**`backend/src/features/minima/minima-console.catalog.ts` /
`minima-console.service.ts`**
- Per `.claude/rules/minima.md` ("where a whitelisted command already has a
  dedicated narrow action, the console dispatches to that same function"):
  add `dispatch: "backup"` / `dispatch: "restoresync"` entries (same shape as
  the existing `megammrsync.resync` / `peers.add` special-dispatch entries at
  `minima-console.catalog.ts:51-68`) so a raw `backup ...` / `restoresync ...`
  typed into the console reuses `createBackup`/`restoreBackup` instead of
  re-implementing the RPC call — keeps audit logging/error normalization
  single-sourced. Plain `restore` and `reset` stay as raw passthrough
  (unchanged, out of scope).

**`backend/src/features/minima/minima.routes.ts`**
- `GET /api/minima/backups` — list (admin).
- `POST /api/minima/backups` — create, body `{ password? }` (admin).
- `GET /api/minima/backups/:fileName/download` — stream file (admin +
  re-enter current password, same `verifyPassword`/`currentPassword` pattern
  as `updateConsoleWhitelist` at `minima.routes.ts:114-131`, since the file
  may contain unencrypted key material).
- `POST /api/minima/backups/restore` — body `{ fileName, password? }` for an
  existing server-side backup, OR multipart upload + fields for a new file
  (admin + re-enter current password, same reasoning as download).
- `DELETE /api/minima/backups/:fileName` — admin only, no re-auth (destroys
  nothing but a copy of already-recoverable data).
- `GET/POST /api/minima/backups/auto` — read/toggle the auto-backup setting
  (admin only, no re-auth — same tier as `saveMinimaConfig`).
- All mutating routes call `recordAuditEvent` (`minima.backup.created`,
  `minima.backup.downloaded`, `minima.backup.restored`,
  `minima.backup.deleted`, `minima.backup.auto_toggled`) — never include the
  password in audit detail (same rule as `wallet.service.ts:43-44`).

## Frontend changes

- `frontend/src/features/minima/MinimaBackupPanel.tsx` (new) — added to the
  Minima settings page alongside the existing `MinimaSettingsPanel.tsx`.
  Follows existing patterns: gate actions on `actionsBlocked` (node must be
  "running", same as other Minima actions), `useToast` for
  success/error, amber warning box for the restore action (same visual
  language as `WalletSettingsPanel.tsx`'s import-wallet warning).
  - Backup list: name, size, created time (local + UTC per frontend rules),
    Download / Restore / Delete per row.
  - "Backup now" button with optional password field.
  - "Enable automatic daily backups" toggle with an explicit "unencrypted"
    warning label.
  - Restore: pick an existing backup OR upload a `.bak` file, optional
    password, confirmation modal that requires re-entering the admin
    password before submitting (matches the backend re-auth requirement).
- `frontend/src/features/minima/minimaBackupApi.ts` (new) — thin fetch
  wrappers via `frontend/src/lib/api.ts` (`credentials: "include"`), same
  shape as the existing `minimaApi.ts`.

## Docs

- `README.md` — new "Node backup & restore" subsection under Minima
  documenting the UI flow, that backups are stored under
  `${MINIMA_DATA_DIR}/backups`, and that restore always re-syncs via the
  configured MegaMMR host. (Leave the existing stale `MINIMA_BACKUP_DIR`
  reference at README.md:114/145 alone — that's an unrelated leftover from
  the removed `update-agent` migration-backup feature per
  `docs/notes/minima-node-update-support.md`, not something this change
  touches or collides with.)
- `SECURITY.md` — document: backup files can contain unencrypted private
  keys/seed phrase if no password is set; the new `backend`↔`minima` shared
  read-write volume is scoped to one subdirectory only; download/restore
  require password re-confirmation; auto-backup writes unencrypted files on
  a timer if enabled.
- `CHANGELOG.md` — `Added` entry under `[Unreleased]` per
  `.claude/rules/documenting-work.md`.
- `.claude/rules/minima.md` / `.agents/rules/minima.md` (kept in sync) — add
  a line documenting the new `backup`/`restoresync` dedicated-action console
  dispatch, matching the existing description style for
  `megammrsync`/`peers`.

## Verification

1. `npm run check`, `npm --prefix backend run build`, `npm --prefix frontend
   run build`, `docker compose config`, `docker compose build` (compose
   volumes changed).
2. Manual, against a real Minima node (dev/test instance, not production
   wallet funds) before calling this done:
   - Confirm `backup file:backups/test.bak password:...` writes a file
     visible from the `backend` container at `/minima-backups/test.bak`.
   - Confirm `restoresync file:backups/test.bak password:... host:<megammr
     host>` succeeds end-to-end and the node's balance/history reappear.
   - Confirm the auto-backup toggle's on *and* off commands behave as
     expected (this is the biggest documentation-accuracy risk called out
     above).
3. Exercise the new panel in the browser: create a password-protected
   backup, download it, delete it from the list, re-upload it, restore it,
   and confirm the re-auth prompt is enforced on both download and restore.
4. `git status --short --untracked-files=all` before commit.
