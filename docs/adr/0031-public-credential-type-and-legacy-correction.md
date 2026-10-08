# 0031: Public Credential Type and Legacy Correction

**Status:** Accepted
**Date:** 2026-10-08

## Context

OpenProject #283 needs a PIN or password input before the browser has an authenticated user.
The single local admin already has a `credential_type` column, and authenticated responses
already include it. Public setup status exposes whether the admin exists but omits its type.

The existing migration defaults pre-flag accounts to `password`. A six-digit PIN can therefore
have password metadata. Bcrypt hashes cannot distinguish these accounts from password accounts.
New setup and credential changes already infer the correct type from validated plaintext.

## Decision

- Extend public `GET /api/setup/status` with `credentialType: "pin" | "password" | null`.
  Read only `credential_type` through the auth repository and return null without a user.
  Set `Cache-Control: no-store` because a credential change can invalidate this input hint.
- Accept disclosure of the credential category within the existing trusted-LAN boundary.
  The DTO adds no user identity, hash, secret, or credential material. Authentication and
  existing rate limits remain authoritative.
- After successful password verification and TOTP verification when enabled, infer the type
  from the verified credential with the existing six-digit PIN classifier. Correct mismatches
  through a conditional update of only `credential_type`, matching user ID and verified hash.
  If a concurrent credential change replaced the hash, leave its type untouched and return
  the current stored type. Failed authentication does not correct metadata.
- Keep the migration default and existing unrestricted password entry. Do not enforce current
  creation strength rules during login. Later frontend steps use the generic password field
  for unknown metadata and for accounts still carrying the migration default.

## Alternatives considered

- **Add a separate public auth endpoint or another database flag.** Rejected because setup
  status is already fetched during bootstrap and the stored type already exists.
- **Expose the type only after authentication.** Cannot select the initial login input in a
  fresh browser; retaining a previous session's user also becomes stale after logout or changes.
- **Classify during migration from the hash.** Impossible with bcrypt without the plaintext.
- **Correct before checking every enabled factor or update by user ID alone.** Rejected because
  failed authentication could mutate metadata or an earlier login could overwrite a new type.

## Consequences

Anyone who can reach the public status route learns whether the local account uses a PIN.
Older PIN accounts can show password metadata until their first fully successful login;
frontend work must keep that input unrestricted. No schema or credential replacement is needed.
The hash condition protects metadata correction, without changing the existing login/session
behavior if a credential change overlaps asynchronous password verification.

## Where this lives in code

- `backend/src/features/auth/setup.routes.ts`: public status DTO and no-store response.
- `backend/src/features/auth/auth.repository.ts`: narrow metadata read and conditional correction.
- `backend/src/features/auth/auth.service.ts`: correction after all enabled factors pass.
- `backend/src/db/database.ts`: existing password-default credential-type migration.
