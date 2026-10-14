# 0035: Hash Admin Credentials with scrypt

**Status:** Accepted
**Date:** 2026-10-13

## Context

The local admin PIN/password was hashed with the native `bcrypt` package (cost 12). That package
ships a compiled addon, so every install depends on node-gyp build tools or a matching per-platform
prebuilt binary. That is a fragile dependency for an app built for `linux/arm64` and
`linux/arm/v7`.

The backend runs on Node 22 (#886). Node 22 includes `crypto.scrypt`. Node's built-in Argon2
(`crypto.argon2`) needs Node 24.7+, and Node 24 has no `linux/arm/v7` image, so Argon2id has to wait
for the move that drops 32-bit support (#887). Existing installs hold bcrypt hashes in
`users.password`. The admin has no reset path outside the app, so those hashes must keep working.

## Decision

- New hashes use Node's built-in `crypto.scrypt` with OWASP's minimum parameters: N=2^14, r=8, p=5
  (about 16 MiB per derivation), a 16-byte random salt and a 32-byte key.
- Hashes are stored self-describing as `scrypt$<N>$<r>$<p>$<salt>$<key>` (base64url). Each hash
  carries its own parameters, so a parameter change needs no schema change. Verification uses the
  stored parameters.
- `verifyPassword()` picks the algorithm by prefix:
  - `scrypt$` hashes are parsed strictly (canonical numbers and base64url, exact salt/key lengths,
    N a power of two, `128·N·r` ≤ 64 MiB, `p` ≤ 16) and compared with `timingSafeEqual`.
  - `$2a$`/`$2b$`/`$2y$` hashes are checked with pure-JS `bcryptjs`.
  - Anything else, or anything malformed, returns `false`.
- `bcryptjs` is pinned to an exact version. A CI step warns when a newer release exists.
- After a fully successful login (password, and TOTP when enabled), a hash that is not current
  scrypt is replaced. The replacement is computed first. Then one SQLite transaction with no
  `await` re-reads the user and fails the login if the stored hash is no longer the verified one.
  Otherwise it applies the credential-type correction and the rehash, both compare-and-set against
  the verified hash, and creates the session. A credential change that lands during verification or
  rehashing therefore wins, and the overlapping login gets no session after the change revoked the
  others. This replaces the ADR 0031 behavior, which still created that session. Re-auth checks
  (password change, TOTP reset, Minima backup/console) only verify and never rehash.
- The unknown-user login path verifies against a dummy hash built at startup with the current
  parameters, so its cost tracks the real path.
- `bcryptjs`, the bcrypt verify branch and the CI warning are temporary. #887 removes them when it
  moves new hashes to Argon2id.

## Alternatives considered

- **Keep native `bcrypt`.** Rejected: the compiled addon and its build/prebuilt-binary dependency
  are the problem this change removes.
- **Native `argon2` package.** Rejected for the same reason. Argon2id comes from Node's built-in
  `crypto.argon2` in #887.
- **Wait for Node 24 and go straight to Argon2id.** Rejected: Node 24 drops `linux/arm/v7`, which is
  supported until April 2027.
- **`bcryptjs` for new hashes too.** Rejected: it is pure JS on the event loop and slower than
  native code at the same cost. It is used only to verify legacy hashes.
- **PBKDF2.** Rejected: it is not memory-hard. scrypt is OWASP's next choice after Argon2id.
- **Vendor `bcryptjs` into the repo.** Rejected: the same code without registry signatures,
  `npm audit` coverage or upstream fixes.
- **Force a credential reset for legacy hashes.** Rejected: there is no out-of-app reset path, so
  this would lock admins out.
- **Rehash on re-auth checks as well.** Rejected: login is the one path every admin takes, and one
  write site is enough.

## Consequences

- Each verification costs about 16 MiB of memory. Login is rate limited, so concurrent derivations
  stay bounded on a Pi.
- After a login migrates the hash, manually reinstalling an older bcrypt-only release locks the
  admin out. In-app updates are unaffected because update-agent rejects older manifests.
- An install whose admin never logs in on a release with this change keeps its bcrypt hash. After
  #887 removes `bcryptjs`, that admin cannot log in.
- The hash still lives in `users.password`; no schema change.

## Where this lives in code

- `backend/src/features/auth/password.service.ts`: `hashPassword()`, `verifyPassword()`,
  `needsRehash()`, `DUMMY_PASSWORD_HASH`.
- `backend/src/features/auth/auth.service.ts`: `login()` freshness check, rehash and session creation in one transaction.
- `backend/src/features/auth/auth.repository.ts`: `replaceUserPasswordHash()` compare-and-set.
- `.github/workflows/check-dev.yml`, `.github/workflows/check-main.yml`: "Check bcryptjs pin is
  current" warning.
