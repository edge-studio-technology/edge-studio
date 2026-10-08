# #283 credential input Pi verification

**Date:** 2026-10-08 · **Build:** `v0.42.2-dev+e78caec`, DEV_MODE source build on Raspberry Pi 5 ARM64.
**Result:** Implementation and in-scope QA passed; OpenProject remains Testing for operator review.

## Accounts

Used four disposable SQLite databases, with the production backend applying startup migrations.

- Pre-flag leading-zero PIN: migration defaulted to Password; failed login left metadata unchanged; successful login repaired it to PIN. Public/authenticated types agreed; repair survived backend startup, logout, and reload.
- Pre-flag weak password: existing password remained accepted without creation-strength validation. Failed/successful login, logout, and reload retained Password mode.
- Fresh PIN/password: null hint before account creation, confirmation mismatch blocking, Enter setup, new-password semantics, correct persisted type/session, and reload/onboarding resume passed. Both accounts subsequently logged in successfully; fresh password logout returned the correct field.
- All four databases passed SQLite integrity checks. A completion marker was set only in the disposable PIN fixture for backup UI access; no additional Integritas account was linked.

## Disposable backup/restore

Temporarily used `/opt/op283-qa` for app/node mounts; original data directories stayed intact.

- Set backup encryption password in both admin modes and created an encrypted node backup (2,177,296 bytes).
- PIN/password downloads rejected incorrect credentials and retained drafts; successful downloads were byte-identical and matched the saved backup size.
- Stored and uploaded restores passed in both modes: four real `restoresync` operations. Wrong admin credentials were rejected before dispatch; uploads used multipart requests and an ordinary encryption-password override.
- After every restore, verified unlocked node recovery, the same 64-address wallet identity using a digest of sorted public addresses, and cleared app/local-contact verification state. Temporary uploaded files were cleaned up.
- Backup password removal passed in both modes; partial PIN blocked removal, password mode rejected incorrect credentials, and successful removal left automatic backups off. PIN removal disabled previously enabled automatic backups.
- Changed the disposable admin account from PIN to password through Settings for password-mode actions.

QA setup initially created the shared backup directory as root; uploaded restore failed with a permission error until ownership matched the installer's UID 1000 setup. This was a fixture correction, not an application change.

Minima reports version `1.1.2.6`. One password-mode stored restore lingered during shutdown with RPC unavailable and required a manual container restart; identity/readiness passed afterward. Other restores restarted automatically. Unattended node recovery is not guaranteed by this result. The row Restore menu initially opened outside the viewport; centering the row and using 1440×1000 allowed the action. No menu implementation changed.

## Restoration and scope

Restored original `/opt/edge-studio/data` and `/opt/edge-studio/minima` mounts. Verified backend/frontend health, original PIN login, original wallet/contact ownership, Integritas connection, and database integrity. Left one visible browser window authenticated on the original dashboard. Removed disposable databases/node data and downloaded backups; retained `/home/devpi5/edge-studio-pre-283-backup.tgz` (app/database, excluding Minima data).

The operator excluded actual password-manager/native autofill and physical mobile keyboards from #283. Posted a comment mentioning Rowel Malmström proposing a separate compatibility ticket; none was created.

This verifies source installation and live flows, not a signed release/update-agent rollout. Prior verification passed 279 focused frontend and 3,452 full-suite tests, builds, coverage, audits, and Compose validation. Application code was unchanged during QA; full suites were not rerun for documentation-only reconciliation.
