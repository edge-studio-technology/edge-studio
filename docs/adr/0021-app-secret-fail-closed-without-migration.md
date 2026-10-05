# 0021: Fail Closed on a Missing `APP_SECRET` Without a Secret Migration

**Status:** Accepted
**Date:** 2026-09-16

## Context

`backend/src/shared/crypto.ts` derives the AES-256-GCM key for every stored secret as
`sha256(APP_SECRET)`. The encrypted values are `users.totp_secret`, `setup_pending.totp_secret`,
`integritas_auth.access_token_enc`/`refresh_token_enc`/`api_key_enc`, and the
`minima_backup_password_enc` setting.

External review finding [12] (`docs/security/external-review-2026-09-03.md`) reported that the
backend (`config/env.ts`), `docker-compose.yml`, and the release Compose generator
(`scripts/release/build-docker-compose.mjs`) fall back to the public value `dev-change-me`, and that
startup only warns. The review scopes reachability to deployments that bypass the installer's secret
generation.

The original Phase 6 plan also asked `install.sh` to detect existing `.env` files carrying
`dev-change-me` and, when encrypted rows exist, run a transactional re-encryption migration with
operator approval, crash recovery across SQLite and `.env`, and a named recovery path.

Verified against repository history: `ensure_app_secret` in `install.sh` has generated
`openssl rand -hex 32` when no value is supplied since it was introduced, keeps any supplied or
existing value, and no revision of `install.sh` ever wrote `dev-change-me` or copied `.env.example`
into `.env`. The installer therefore never produces an install on the public default.

## Decision

- `APP_SECRET` stays optional for operators. `install.sh` keeps generating a random secret when
  none is supplied and keeps any existing or supplied value unchanged.
- The backend requires a non-empty `APP_SECRET`. `config/env.ts` has no fallback value, and
  `index.ts` exits with a non-zero status before migrations, schedulers, ingestion, or
  `app.listen` when the value is absent or empty. There is no development bypass; native
  development sets a value explicitly.
- `dev-change-me` is removed as a default from every shipped path: `config/env.ts`,
  `docker-compose.yml`, `.env.example`, the generated release Compose file, the generated
  `.env.example`, and `README.md`.
- Any non-empty value, including `dev-change-me` if an operator sets it deliberately, is accepted.
  Choosing a custom secret, and its strength, is the operator's responsibility.
- No secret migration, re-encryption, or rotation is implemented.
- Digest-pinning third-party images (finding [6]) is split into its own task; it shares no code or
  dependency with the secret change.

The empty check is kept while a literal-value check is not: an empty secret is not an operator
choice but a missing configuration, and `sha256("")` is the same public key on every such device —
equivalent to shipping a default.

## Alternatives considered

- **Refuse `dev-change-me` specifically, with a development-mode exception.** Rejected. Once no
  shipped path emits the value, anyone running it set it on purpose, so blocking one string adds no
  protection over accepting any other operator-chosen value. A bypass flag would also be a second
  way to run on a weak key; reusing `DEV_MODE` would additionally conflate the installer's
  build-from-source mode with a runtime security exception.
- **One-shot transactional re-encryption of `dev-change-me` installs.** Rejected. It protects a state
  the installer never produced, while requiring a cross-file crash-consistency protocol, approval
  handling for non-interactive `curl | bash` installs, and recovery tooling — the highest-risk code
  in the hardening plan for no reachable case.
- **Regenerate the secret unconditionally in `install.sh`.** Rejected because it makes every stored
  ciphertext undecryptable.
- **Minimum-length or strength check on `APP_SECRET`.** Rejected because an existing install with a
  short operator-chosen secret would fail to boot with no migration path to a stronger one.

## Consequences

- Installer-based installs and upgrades are unaffected.
- A deployment that bypasses the installer without setting `APP_SECRET` refuses to start instead of
  running on a public key.
- An operator who changes `APP_SECRET` still loses access to stored secrets and must re-link
  Integritas Connect and set the Minima backup password again. Secret rotation and recovery remain
  unaddressed and need a separate product decision.
- Operator-chosen weak secrets are not detected.
- Production secret storage (keyring, TPM, age/sops, passphrase-derived keys) remains out of scope.

## Where this lives in code

- `backend/src/config/env.ts` — `appSecret` without a fallback.
- `backend/src/index.ts` — startup refusal before `runMigrations()`.
- `backend/src/shared/crypto.ts` — `encryptionKey()` derivation (unchanged).
- `install.sh` — `ensure_app_secret()` (unchanged).
- `docker-compose.yml`, `.env.example` — no `APP_SECRET` default.
- `scripts/release/build-docker-compose.mjs` — generated Compose and `.env.example` without a default.
