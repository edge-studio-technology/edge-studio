[← Back to index](./README.md)

# Phase 6 — Fail closed on weak config

**Covers:** [12], [6], GAP-04.

1. `backend/src/index.ts` warns on a default `APP_SECRET` but starts anyway. Refuse to start when
   `APP_SECRET` is absent or `dev-change-me`, except in an explicit dev mode.
2. **`install.sh` must not silently regenerate `APP_SECRET`.** `ensure_app_secret`
   (`install.sh:249`) early-returns on any non-empty value, so a pre-existing `.env` carrying
   `dev-change-me` survives an install — but regenerating unconditionally is *worse* than leaving
   it, because `shared/crypto.ts:18` derives the AES key as `sha256(APP_SECRET)`. A new secret
   makes every stored ciphertext undecryptable: the Integritas Connect API key and refresh token
   (`integritas_auth.api_key_enc`), the Minima backup password — the only thing protecting every
   `.bak` file in `${MINIMA_DATA_DIR}/backups` — and the stored TOTP secrets. Four
   cases, decided explicitly:
   - **Fresh install, no `.env`** — generate a strong secret. Current behavior; keep it.
   - **Existing `.env`, no database or no encrypted rows** — treat `dev-change-me` as empty and
     regenerate. Nothing to lose.
   - **Existing `.env` with `dev-change-me` and encrypted rows** — do not regenerate silently.
     Re-encrypt: decrypt each row under the old secret, generate the new one, re-encrypt, write
     every row in one transaction, and only then update `.env`. This belongs in a backend one-shot
     migration, not in shell.
   - **Re-encryption fails or is declined** — stop with a named recovery path: keep the old secret,
     print which secrets need re-entry (Connect relink, backup password reset), and never start on
     a half-migrated database.
   This needs its own ADR. It is the one step in the plan that can destroy operator data.
3. Digest-pin every image the deployment pulls, in **both** compose files — the checked-in
   `docker-compose.yml` *and* the generated production one, which is what installed appliances
   actually run:
   - `docker-compose.yml`: `minimaglobal/minimacore` (currently untagged) and `eclipse-mosquitto:2`.
   - `scripts/release/build-docker-compose.mjs`: `minimaglobal/minima:dev` (line 150) and
     `alpine:3.20` (line 31) — the latter is the init container that creates `/data/certs` and
     `chown`s the data directories, so it runs as root before anything else starts.
   - Same file, lines 81 and 221: the generated compose defaults `APP_SECRET` to `dev-change-me`
     and the generated `.env` writes it literally. Step 1 catches that at boot, but the generator
     should not emit it at all.
   These sit outside the signed manifest, so pinning is the only control; record how the pins get
   updated.

**Verification:** `docker compose config` and a real `docker compose up` on a clean `DATA_DIR`
— (1) is a startup-path change and a mistake here bricks boot. For (2), also run an upgrade over an
existing install that has both a `dev-change-me` `.env` and a stored Connect token, and confirm the
token still decrypts afterwards. For (3), diff the generated compose.
