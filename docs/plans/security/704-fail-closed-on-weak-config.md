# Fail Closed On Weak Config Plan

**Status:** Not started  
**Created:** 2026-09-15  
**Goal:** Reject missing/default application secrets outside explicit development, safely migrate existing weak-secret ciphertext, and remove mutable image tags from every deployment Compose path.

## Context

The backend currently defaults `APP_SECRET` to `dev-change-me` and only warns before starting. `install.sh` preserves any non-empty existing value, including that default, while the release Compose generator emits it literally. Because `backend/src/shared/crypto.ts` derives its AES-256-GCM key as `sha256(APP_SECRET)`, simply replacing the value makes existing ciphertext undecryptable.

This work covers security findings 12 and 6 and QA gap GAP-04. It has two independent hardening tracks:

1. Fail closed on an absent or known-default `APP_SECRET`, with an explicit development-only exception.
2. Digest-pin the remaining third-party images used by the source/install and generated release Compose paths.

The secret migration is the critical path. The encrypted-value inventory currently includes:

- `users.totp_secret` and `setup_pending.totp_secret` (including placeholder or pending TOTP values).
- `integritas_auth.access_token_enc`, `refresh_token_enc`, and nullable `api_key_enc`.
- The `settings` value whose key is `minima_backup_password_enc`.

The dormant/commented legacy Integritas API-key setting is not an active ciphertext location. Implementation must re-audit this inventory immediately before coding and keep the migration's closed-world registry beside its tests so a newly added encrypted field cannot be silently omitted.

Unconditional regeneration is rejected because it destroys access to stored ciphertext. Updating SQLite and then casually rewriting `.env` is also rejected: those are separate durability domains, so a SQLite transaction by itself cannot prevent a crash from leaving the database on the new key and `.env` on the old one. The recovery and crash-consistency protocol must be decided and recorded in an ADR before implementation.

## Assumptions And Decisions To Record

The implementation starts by creating a dedicated ADR with the `adr` skill. The ADR must settle and test these points before migration code is written:

- The one-shot migration entry point and invocation contract. Preferred shape: a backend-owned command in the released backend image, invoked by `install.sh` while application services are stopped; secret material must not be placed in command-line arguments or logs.
- The exact crash-safe handoff between the committed SQLite transaction and atomic `.env` replacement. The design must include a recoverable database backup/journal or equivalent marker protocol, validate both secrets before cleanup, and define recovery for interruption at every boundary.
- How the installer obtains operator approval when encrypted rows exist, including deterministic non-interactive behavior. Declining or failing must leave the old secret and old ciphertext usable and stop installation before `docker compose up`.
- A named recovery command/path that is safe to repeat, reports state without printing secrets, and identifies the values that may require re-entry: Integritas Connect access/refresh/API-key material, the Minima backup password, and user/pending TOTP secrets.
- Whether expired `setup_pending` ciphertext is re-encrypted or deleted through an already-valid cleanup rule. Default: re-encrypt it; do not broaden this task into data cleanup.
- The explicit development exception. Default: reuse `DEV_MODE=true`, expose it to the backend in the source Compose path, and never enable it in generated release Compose output. Do not introduce a second weak-secret bypass unless the ADR finds a concrete need.

No implementation should proceed while any failure point can produce a database/`.env` key mismatch without a deterministic rollback or resume path.

## Installer And Backend Changes

### 1. Fail-closed startup validation

- Change `backend/src/config/env.ts` so `appSecret` no longer silently defaults to `dev-change-me`; preserve enough configuration state to distinguish a missing value from a supplied value.
- Add a small startup validation boundary used by `backend/src/index.ts` before database migrations, device initialization, schedulers, ingestion, or `app.listen`.
- Reject an absent, empty, or literal `dev-change-me` secret with a clear operator-facing error and non-zero exit outside explicit development mode. The message must name the installer migration/recovery path without exposing secret values.
- Permit the weak/missing value only when the chosen explicit development flag is true, and emit a conspicuous development warning.
- Pass the development flag into the backend only on the checked-in/source Compose path. The release generator must not provide a production bypass.
- Add focused tests for missing, empty, default, strong, and explicit-development cases, including proof that rejection happens before any database mutation or background service starts.

### 2. Backend-owned secret rotation

- Refactor `backend/src/shared/crypto.ts` minimally so rotation code can encrypt/decrypt with an explicitly supplied key while normal runtime callers continue using `env.appSecret`.
- Add a backend migration service/command that inventories all active encrypted locations listed above, validates every ciphertext under the old secret before writing anything, encrypts each plaintext under the candidate secret, and updates every row inside one SQLite transaction.
- Treat malformed JSON, authentication-tag failure, an unknown/unsupported ciphertext shape, or a changed row count as a hard failure. Roll back the transaction and never substitute blank values or clear a Connect link during migration.
- Verify the newly written ciphertext can be decrypted with the candidate secret before commit. Never log plaintext, keys, ciphertext, or token fragments.
- Make the command distinguish `no database`, `database with no encrypted rows`, `rotation completed`, `rotation declined/not authorized`, and `recovery required` outcomes with stable exit codes that `install.sh` can handle.
- Implement the ADR's backup/marker protocol around the transaction so interruption between database commit and `.env` replacement remains recoverable and repeatable.

### 3. Four installer cases

Update `install.sh` around `load_existing_config`, `ensure_app_secret`, application shutdown/download, `.env` writing, and `start_app` to handle these cases explicitly:

1. **Fresh install, no existing `.env`:** generate a cryptographically random 32-byte hex secret, write it with the rest of the new config, and boot normally.
2. **Existing `.env`, no database or no encrypted rows:** generate a replacement for an absent/default secret without running ciphertext rotation; preserve all unrelated `.env` values.
3. **Existing `.env` with `dev-change-me` and encrypted rows:** stop application services, obtain the required approval, create the ADR-defined recovery material, run the backend-owned one-shot rotation using the release image, validate the result, atomically replace only `APP_SECRET`, and then start normally.
4. **Rotation failed or was declined:** do not rewrite `APP_SECRET`, do not start any service, retain/restore the old database state, print the named recovery command and affected secret categories, and exit non-zero.

Additional installer requirements:

- Never infer that a database is empty merely from file existence; query the backend-owned encrypted-row inventory.
- Keep secret values out of stdout/stderr, process arguments, generated recovery instructions, and temporary filenames. Any secret handoff or recovery artifact must have restrictive permissions and guaranteed cleanup only after successful cross-checking.
- Make rerunning `install.sh` after an interruption safe. It must detect and resume/roll back the recorded state rather than starting a second rotation.
- Continue preserving a strong existing `APP_SECRET` unchanged.
- Run `bash -n install.sh` and add shell/integration coverage for the case dispatch where practical; keep encryption and transaction assertions in backend tests rather than reproducing crypto logic in shell.

## Compose And Release Changes

- In `docker-compose.yml`, remove the `${APP_SECRET:-dev-change-me}` fallback, require the supplied `APP_SECRET`, pass through the selected explicit dev flag for source development, and pin `minimaglobal/minimacore` and `eclipse-mosquitto:2` by immutable digest.
- In `scripts/release/build-docker-compose.mjs`, remove the backend's weak fallback and stop writing `APP_SECRET=dev-change-me` into the generated `.env.example`. Use a non-secret placeholder/instruction that causes startup to fail until an operator generates a real value; do not ship a shared literal secret.
- Digest-pin the generator's `alpine:3.20` cert-init image and `minimaglobal/minima:dev` image.
- Resolve and record registry digests at implementation/release time, verifying that each selected manifest supports the deployment architectures (at minimum Raspberry Pi ARM64 and the supported local/CI architecture). A tag plus `@sha256:<digest>` is acceptable for readability; the digest is authoritative.
- Update generator tests or add a focused fixture/snapshot check proving all four third-party image references contain `@sha256:` and neither generated artifact contains `dev-change-me`.
- Update the release documentation with the manual digest-refresh procedure, including architecture verification and regenerating/diffing each channel's Compose output.

The checked-in and generated Compose files represent different deployment paths: the checked-in file owns `minimaglobal/minimacore` and Mosquitto, while the generated release file owns Minima `:dev` and Alpine cert-init. They need not duplicate services that do not exist in that path, but every third-party image reference present in either output must be immutable.

## Recovery And Operator Experience

The final operator flow must be explicit and boring:

```txt
weak secret detected
  -> encrypted-row inventory is empty -> generate and continue
  -> encrypted rows exist -> stop services and request/require migration approval
       -> rotation + cross-resource handoff verified -> continue startup
       -> declined, failed, or interrupted -> keep/restore old state, print recovery path, stop
```

The recovery output must state:

- Why startup is blocked.
- Whether the database is confirmed on the old key, confirmed on the new key awaiting `.env` finalization, or requires recovery inspection.
- The exact recovery command/path from the ADR.
- Which secret categories may need manual re-entry if recovery cannot validate/decrypt them.

It must never print either application secret or any decrypted stored value.

## Testing

### Automated tests

- Startup policy: missing/empty/default/strong secrets with development mode off and on; production rejection occurs before `runMigrations()` and all scheduler/ingestion startup.
- Crypto primitives: explicit old/new key round trips, wrong-key and tamper failures, and no regression to normal runtime encryption.
- Rotation inventory: zero, one, nullable, and multiple rows across every encrypted column/key; pending and user TOTP values; Connect token/API-key values; Minima backup password.
- Transactionality: inject failure during each decrypt, encrypt, write, and post-write verification stage and prove every row remains decryptable under the old secret with no partial new-key rows.
- Crash/recovery protocol: exercise every durable boundary between backup/marker creation, transaction commit, atomic `.env` replacement, verification, and cleanup; prove reruns converge safely.
- Installer case dispatch: fresh install, empty existing install, encrypted weak-secret upgrade accepted, declined, failed, and interrupted/resumed; strong secrets remain byte-for-byte unchanged.
- Generator output: all present third-party images are digest-pinned and weak defaults are absent from Compose and `.env.example`.

### Required integration verification

Use disposable directories and never point these checks at operator data:

1. Generate a clean `DATA_DIR` and `.env`, run `docker compose config`, then perform a real `docker compose up` and wait for backend/frontend health. Confirm the generated secret is non-default and survives a restart.
2. Prepare an existing install with `APP_SECRET=dev-change-me` and real encrypted fixtures for at least an Integritas Connect access/refresh token. Include a Minima backup password and TOTP row as well so the full inventory is exercised. Run the upgrade path and prove all values decrypt to their exact pre-upgrade plaintext afterward.
3. Inject a rotation failure and separately decline rotation. Confirm `.env` retains the old secret, the database remains decryptable under it, no application service starts, and the recovery message names the correct path/categories.
4. Interrupt at each ADR-defined handoff boundary and rerun the installer/recovery command to prove deterministic convergence without data loss.
5. Generate release Compose output from a fixture manifest and diff it against the expected artifact. Run `docker compose config` on both checked-in and generated Compose files and confirm every deployment image is digest-pinned.

Baseline repository checks:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
bash -n install.sh
docker compose config
docker compose build
git status --short --untracked-files=all
```

## Documentation

- Create a dedicated ADR in `docs/adr/` before implementation, covering transaction scope, cross-file crash consistency, operator approval, secret handoff, stable states/exit codes, rollback/resume behavior, and the named recovery path.
- Update `README.md` with required `APP_SECRET` behavior, explicit development mode, upgrade prompt/non-interactive behavior, and recovery instructions.
- Update `SECURITY.md` to replace the current blanket “preserve APP_SECRET” guidance with the supported one-shot weak-secret migration and fail-closed behavior.
- Update `docs/security/host-and-infrastructure.md` with the resolved image pins and residual manual pin-refresh risk.
- Update the relevant release documentation for manual third-party digest bumps and generated Compose verification.
- Add operator-facing entries under `CHANGELOG.md`'s `## [Unreleased] dev-task/704-fail-closed-on-weak-config` `Security` section.
- On completion, use the `session-notes` skill to reconcile `docs/SESSION.md` and `docs/TASKS.md`.

## Estimate

Estimated implementation effort: **12-16 engineering hours**, assuming the released backend image can expose the one-shot command without release-pipeline redesign and suitable multi-architecture image digests are available.

| Workstream | Estimate |
|---|---:|
| ADR, encrypted-data inventory, crash/recovery state design | 2-3 h |
| Backend fail-closed policy and focused tests | 1-2 h |
| Transactional rotation command and failure-injection tests | 3-4 h |
| Installer four-case orchestration, approval, resume/recovery | 3-4 h |
| Compose/generator pins and output tests | 1-2 h |
| Real clean-install/upgrade/failure verification and docs | 2-3 h |

The ticket's 8-12 hour size is plausible only if the ADR selects a very small recovery protocol and Docker integration passes first time. The safer working estimate includes explicit interruption testing because that is what demonstrates the migration cannot strand encrypted operator data.

## Milestones

### Milestone 1: Safety Design

- [ ] Re-audit and test the complete encrypted-value inventory.
- [ ] Write and accept the dedicated secret-rotation/recovery ADR.
- [ ] Define stable migration states, exit codes, and interruption recovery.

### Milestone 2: Backend Policy And Rotation

- [ ] Add fail-closed startup validation with the explicit development exception.
- [ ] Add explicit-key crypto helpers without changing normal runtime behavior.
- [ ] Implement and unit-test the transactional one-shot rotation/inventory command.

### Milestone 3: Installer Migration Flow

- [ ] Implement all four install/upgrade cases.
- [ ] Add approval, non-interactive failure, atomic `.env` update, and named recovery behavior.
- [ ] Prove failed, declined, and interrupted rotations retain a recoverable old state and never start services.

### Milestone 4: Immutable Deployment Inputs

- [ ] Pin Minima and Mosquitto in the checked-in Compose file.
- [ ] Pin Minima and Alpine in generated release Compose output.
- [ ] Remove all emitted/default `dev-change-me` values and test generated artifacts.

### Milestone 5: End-To-End Verification And Docs

- [ ] Complete clean-install Docker startup verification.
- [ ] Complete encrypted existing-install upgrade and failure/recovery verification.
- [ ] Run the full repository checks and generated-output diff.
- [ ] Update security, release, operator, changelog, session, and task documentation.

## Out Of Scope

- Replacing `APP_SECRET` storage with a keyring, TPM, age/sops, or passphrase-derived production key management.
- General-purpose or recurring secret rotation after the one-shot known-default migration.
- Automatically tracking or bumping third-party image digests; releases continue to update them manually.
- Clearing encrypted values as a substitute for a successful migration.
