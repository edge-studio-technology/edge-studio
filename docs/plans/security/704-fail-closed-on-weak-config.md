# Fail Closed On Missing APP_SECRET Plan

**Status:** Not started  
**Created:** 2026-09-15  
**Revised:** 2026-09-16 — scope reduced; see `docs/adr/0021-app-secret-fail-closed-without-migration.md`  
**Goal:** Remove the public `dev-change-me` default from every shipped path and make the backend refuse to start without an `APP_SECRET`.

## Context

`backend/src/config/env.ts` falls back to `dev-change-me`, `backend/src/index.ts` only warns about it, and both `docker-compose.yml` and the release Compose generator repeat the fallback. `backend/src/shared/crypto.ts` derives the AES key for all stored secrets from `APP_SECRET`, so a deployment that bypasses the installer runs on a public key.

`install.sh` already generates a random secret when none is supplied and preserves existing values. No revision of the installer ever wrote `dev-change-me`, so no installer-created install needs migrating.

Covers external review finding [12] and QA gap GAP-04.

## Scope Changes From The Original Plan

- **Dropped:** the four-case installer migration, transactional re-encryption, crash recovery, operator approval flow, and development-mode bypass. Rationale in ADR 0021.
- **Split out:** digest-pinning `minimaglobal/minimacore`, `eclipse-mosquitto:2`, `minimaglobal/minima:dev`, and `alpine:3.20` (finding [6]) is a separate task.
- **Out of scope:** secret rotation and recovery after an `APP_SECRET` change (pending a separate product decision), and production secret storage (keyring/TPM/age/sops/passphrase).

## Decisions

- `APP_SECRET` is optional for operators; the installer generates it.
- The backend refuses to start when `APP_SECRET` is absent or empty. No bypass flag.
- Any non-empty value is accepted, including `dev-change-me` when set deliberately. The operator owns custom values.
- `install.sh` is not changed.

## Changes

### 1. Backend startup

- `backend/src/config/env.ts`: remove the `?? "dev-change-me"` fallback; an absent value becomes empty.
- `backend/src/index.ts`: replace the warning with a check that logs a clear error (without any secret value) naming `install.sh` or setting `APP_SECRET`, and exits non-zero. It runs before `runMigrations()`, `ensureDeviceId()`, schedulers, ingestion, and `app.listen`.
- Extract the check into a small function so it can be unit-tested without importing the entrypoint.
- Give the backend test environment an explicit test `APP_SECRET` if any suite relied on the old fallback.

### 2. Configuration files

- `docker-compose.yml`: `APP_SECRET: ${APP_SECRET:-}` with no default.
- `.env.example`: `APP_SECRET=` empty, with a comment that the installer generates it and the backend will not start without it.
- `scripts/release/build-docker-compose.mjs`: remove the Compose fallback and write an empty `APP_SECRET=` with the same comment into the generated `.env.example`.
- Update `scripts/tests/release/build-docker-compose.test.ts` to assert `dev-change-me` is absent from both generated artifacts.

### 3. Documentation

- `README.md`: remove the `dev-change-me` example and note that native `npm run dev` requires `APP_SECRET` to be set.
- `docs/security/auth-and-transport.md` and `docs/qa/gaps.md` (GAP-04): update status to reflect fail-closed startup and the dropped installer regeneration.
- `docs/plans/security/phase-6-fail-closed-on-weak-config.md` and `docs/plans/security/README.md`: point to this plan and ADR 0021 and note the pinning split.
- `CHANGELOG.md`: entries under `## [Unreleased] dev-task/704-fail-closed-on-weak-config`.
- On completion, use the `session-notes` skill to reconcile `docs/SESSION.md` and `docs/TASKS.md`.

## Testing

### Automated

- Startup check: absent, empty, `dev-change-me`, and a strong value — only absent/empty are rejected.
- Rejection happens before any database or background-service call.
- Generator output: no `dev-change-me` in generated Compose or `.env.example`.

### Manual

1. `docker compose config` with and without `APP_SECRET` in `.env`.
2. Real `docker compose up` on a clean `DATA_DIR` with a generated `.env`; backend and frontend become healthy.
3. Same with `APP_SECRET` empty; backend exits with the error message and no database file is created.
4. Upgrade an existing install via `install.sh`; `APP_SECRET` is unchanged and a stored Integritas Connect link still works.

### Baseline

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
bash -n install.sh
docker compose config
docker compose build
git status --short --untracked-files=all
```

## Estimate

About **2-3 engineering hours**.

## Milestones

- [x] Re-audit the encrypted-value inventory and record the scope decision in ADR 0021.
- [ ] Backend startup check and tests.
- [ ] Remove defaults from Compose, `.env.example`, and the generator; update generator test.
- [ ] Manual Docker verification.
- [ ] Documentation, changelog, session notes, and tasks.
