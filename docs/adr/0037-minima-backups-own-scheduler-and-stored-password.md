# 0037: Minima Backups — Own Scheduler and One Stored Password

**Status:** Accepted
**Date:** 2026-07-29

## Context

A Minima `.bak` file holds the seed phrase, private keys, coin proofs, and transaction history.
Verified against Minima's source (`minima-global/Minima`) and a live node:

- `backup` always AES-encrypts, but falls back to the public default password `"minima"` when none
  is given.
- Minima's built-in daily auto-backup (`Main.java`) always runs a bare, hardcoded `backup`: no
  password, no `file:`. It can never use a real password or write where the backend can see it.
- Minima resolves the `file:` argument of `backup`/`restoresync` relative to `/home/minima`, not
  `/home/minima/data`. Without a mount there, a backup lands in the container's ephemeral layer and
  is lost on restart.

Two earlier designs shipped and were replaced: an optional per-backup password, and an
encrypted/unencrypted split that still relied on Minima's auto-backup, whose runs stayed invisible.

## Decision

- **One admin-chosen backup password**, stored encrypted with `encryptSecret()` (keyed by
  `APP_SECRET`, same as Integritas tokens), never returned by any API, used for every backup.
  Setting, changing, or removing it requires re-entering the admin PIN/password. Removing it turns
  off automatic backups.
- **Our own scheduler** (`minima-backup-scheduler.service.ts`, started from `index.ts`) calls
  `createBackup({ auto: true })` at a fixed 00:30 on the backend container's clock (`TZ`, default
  UTC), recomputing the next run each time rather than using a rolling interval from boot.
  Minima's `backup auto:true` is not used.
- **One shared folder.** `${MINIMA_DATA_DIR}/backups` is mounted read-write into `backend` at
  `/minima-backups` (the only shared Minima directory) and into `minima` at `/home/minima/backups`.
- **One rolling list** of manual and automatic backups capped at 20 (`MAX_BACKUPS`), oldest deleted
  past the cap. Filenames keep the trigger (`minima-manual-<ts>.bak` / `minima-auto-<ts>.bak`) for
  operators reading the folder.
- **Restore always uses `restoresync`** against the configured Megammr host. Plain `restore` and
  `reset` stay console-only. Listed backups restore with the stored password; an uploaded foreign
  `.bak` can supply its own.
- Downloading or restoring requires re-auth, since the file's only protection is the stored
  password.
- **Optional automatic restart** (opt-in, off by default) rides the same nightly tick: after the
  backup, if at least 48 hours have passed since the last one (persisted, so redeploys don't reset
  it), it calls the same graceful restart as the manual button (ADR 0001). It is preventive, not
  fault-driven. **Currently disabled**: the call and the UI toggle are commented out until
  automations handle a node restart mid-run; settings, routes, and service functions stay for
  re-enabling.

## Alternatives considered

- **Minima's built-in auto-backup.** Can't take a password or location; runs are invisible.
- **Per-backup or optional passwords** (v1), **encrypted/unencrypted split** (v2). Left a weaker
  class of backup and kept the invisible built-in schedule.
- **Ask for the password on every backup.** Blocks unattended backups.
- **Encrypt backup file contents with `APP_SECRET`.** Makes `APP_SECRET` a standing, unrotatable
  key for the file data. Here it only protects a small setting at rest; the file stays protected by
  the admin's password once it leaves the device. Database access already implies host access,
  which is outside the threat model.
- **Separate manual and automatic lists or caps.** Unneeded once both share one password.
- **A rolling 24-hour interval.** Runs at whatever hour the container booted.

## Consequences

- Every backup, manual or automatic, is equally protected and downloadable.
- "Nightly" means local night only if `TZ` is set to the Pi's timezone.
- Losing the stored password and `APP_SECRET` together makes stored backups unrecoverable without
  the admin remembering the password.
- With auto-restart disabled, node restarts are manual or resync-driven only.
