# Replace Native bcrypt with scrypt Plan

**Status:** Not started
**Created:** 2026-10-13
**Branch:** `task/216-change-bcrypt-deps-to-something-more-stable`
**Goal:** Hash new admin credentials with Node's built-in `crypto.scrypt`, verify existing bcrypt hashes with pure-JS `bcryptjs`, and rehash legacy hashes to scrypt on the next successful login.

## Progress

- [ ] Step 1: dependencies — swap `bcrypt`/`@types/bcrypt` for `bcryptjs`
- [ ] Step 2: `password.service.ts` — scrypt hash/verify, legacy bcrypt verify, `needsRehash()`, dummy hash + tests
- [ ] Step 3: `auth.service.ts` — scrypt dummy hash, rehash on successful login (compare-and-set) + tests
- [ ] Docs
- [ ] Verification

## Context

[OpenProject #216](https://openproject.privateprivate.org/work_packages/216), "Change `bcrypt` deps to something more stable", is a task under "Authentication". It depended on #886 (Node 22 for update-agent, frontend build and installer verifier), which is merged into `dev` and into this branch.

The native `bcrypt` package needs a node-gyp build or a per-platform prebuilt binary. Decision in the ticket: Node 22 + `crypto.scrypt` now, which keeps 32-bit (`linux/arm/v7`) support. Argon2id follows with the Node 24 upgrade in #887. Native `bcrypt`/`argon2` packages are rejected.

Current state:

- `backend/src/features/auth/password.service.ts`: `hashPassword()` = `bcrypt.hash(plain, 12)`, `verifyPassword()` = `bcrypt.compare`.
- `backend/src/features/auth/auth.service.ts:25`: `DUMMY_HASH = bcrypt.hashSync(..., 12)`, used by `login()` when no user exists so the unknown-user path costs the same as a real verify.
- Verify-only callers: `login()`, `changePassword()`, `initTotpReset()` (`auth.service.ts`), `minima-backup.service.ts:28`, `minima-console.service.ts:50`.
- Hash callers: `setup.service.ts:115`, `changePassword()`. Both go through `hashPassword()`, so they produce scrypt with no change.
- The hash lives in `users.password`; no schema change.
- `updateUserCredentialType()` (`auth.repository.ts:143`) already uses compare-and-set on the verified hash; the rehash write follows the same pattern.
- `backend/Dockerfile` keeps `python3 make g++` — `better-sqlite3` still needs them.

## Backend changes

### Step 1: dependencies

- `backend/package.json`: remove `bcrypt` and `@types/bcrypt`, add `bcryptjs` (v3 ships its own types). Update `backend/package-lock.json` via `npm --prefix backend install`.

### Step 2: `password.service.ts`

- Constants: `SCRYPT_N = 2 ** 14`, `SCRYPT_R = 8`, `SCRYPT_P = 5` (OWASP minimum, ~16 MiB), 16-byte salt, 32-byte key.
- Stored format: `scrypt$<N>$<r>$<p>$<salt>$<hash>`, salt and hash base64url.
- `hashPassword(plain)`: random salt, promisified `crypto.scrypt`, returns the formatted string.
- `verifyPassword(plain, hash)`:
  - `scrypt$` prefix: parse strictly (integer params, N a power of two, params within sane bounds, salt/hash decode to the expected lengths); malformed returns `false`. Derive with the stored params and compare with `crypto.timingSafeEqual`.
  - `$2a$`/`$2b$`/`$2y$` prefix: `bcryptjs.compare`.
  - Anything else: `false`.
- `needsRehash(hash)`: `true` for bcrypt, and for scrypt whose params differ from the current constants; `false` for current scrypt.
- `DUMMY_PASSWORD_HASH`: built once at module load with the current params (sync scrypt), so the unknown-user path always matches the current cost.

Tests (`backend/tests/features/auth/password.service.test.ts`):

- scrypt round trip; wrong password; output matches the format with the current params.
- A legacy bcrypt hash (fixed `$2b$12$...` fixture made by `bcryptjs`) verifies, and a wrong password against it fails.
- Unknown prefix, empty string, malformed scrypt strings (bad params, wrong salt/hash length, bad encoding) return `false`.
- `needsRehash()`: bcrypt `true`, outdated scrypt params `true`, current scrypt `false`.
- `DUMMY_PASSWORD_HASH` is a current scrypt hash.

### Step 3: `auth.service.ts` + `auth.repository.ts`

- Drop the `bcrypt` import; `login()` uses `DUMMY_PASSWORD_HASH`.
- After every login check passes (password, and TOTP when enabled), if `needsRehash(user.password)`: hash the plaintext and write it with a new compare-and-set repository function, `replaceUserPasswordHash(userId, verifiedPasswordHash, newHash)` (`UPDATE users SET password = ? WHERE id = ? AND password = ?`), so a concurrent password change is never overwritten. Run it after the existing credential-type correction, which uses the old hash for its own compare-and-set.
- Re-auth callers (`changePassword`, `initTotpReset`, Minima backup/console) only verify. No rehash there.

Tests (`backend/tests/features/auth/auth.service.test.ts`):

- Login with a legacy bcrypt hash succeeds and stores a current scrypt hash that still verifies.
- Failed login (wrong password, and wrong TOTP when enabled) leaves the legacy hash unchanged.
- Login with a current scrypt hash does not rewrite it.
- Unknown user still runs the dummy verify and fails.
- Rehash compare-and-set does not overwrite a hash changed in between (repository-level test).

## Docs

- `SECURITY.md:25`: bcrypt → scrypt (parameters, legacy bcrypt verified and migrated on login). Add the downgrade lockout: after a login migrates the hash, manually reinstalling an older bcrypt-only release locks the admin out; in-app updates are unaffected because update-agent rejects older manifests.
- `README.md:447`: "only its bcrypt hash" → scrypt.
- `CHANGELOG.md`: entries under `## [Unreleased] task/216-change-bcrypt-deps-to-something-more-stable` (Changed, Security), folded into the shared `## [Unreleased]` before the PR.
- New ADR `docs/adr/0035-...` (number checked against `origin/dev` when written): scrypt now, Argon2id with Node 24 (#887), rejected native `bcrypt`/`argon2`, OWASP params, self-describing format, rehash on login only. Add it to the `docs/README.md` table.
- `docs/qa/gaps.md` GAP-14: point at #887.
- GitHub user wiki, updating/reinstalling page: downgrade lockout warning (confirm with the user who edits the wiki).
- `docs/SESSION.md` / `docs/TASKS.md`.

## Verification

- Unit tests above; `auth/` at the 90% coverage bar.
- `npm run lint`, `npm run check`, `npm --prefix backend run build`, `npm --prefix frontend run build`, `docker compose config`, `docker compose build`. arm64 and arm/v7 images via the release workflow.
- `grep -rn "bcrypt" backend/src` only shows the `bcryptjs` legacy-verify path.
- Pi (existing install with a bcrypt hash): deploy from the branch, check the stored prefix without printing the hash (`SELECT substr(password, 1, 7) FROM users`), log in with the old PIN/password, confirm the prefix is now `scrypt$`, log in again, then do a re-auth action (console whitelist save or backup download).
