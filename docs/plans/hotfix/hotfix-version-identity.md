# Verified Version Identity Plan

**Status:** Done  
**Created:** 2026-10-05  
**Goal:** Report the installed release version only when the running images prove it, and give every build (release or dev) a baked version identity, without requiring users to rerun `install.sh`.

## Context

A co-worker's Pi showed `v0.42.1 → v0.42.1` on the Update page and "Version v0.42.1 is ready to install" in the sidebar after a release-channel reinstall. `install.sh` writes `last-applied-manifest.json` before `start_app`. If the pull or `compose up` then fails, the file claims the new release while the old containers keep running. `update-agent`'s `upToDate` check (running image reference vs manifest digest) is correct, but `currentVersion` comes from the unverified file, so the UI shows the file's version as both current and available. Clicking "Update now" already repairs such a device.

Branch: `hotfix/version-identity`, cut from `dev` and merged back to `dev`.

Decisions (rationale in `docs/adr/0029-verified-version-identity.md`, which amends ADR 0006):

- `currentVersion` is reported only when the running `frontend`/`backend` references match the digests recorded in the state file.
- Every image carries `org.opencontainers.image.version` / `.revision` labels. CI uses the tag and commit, and production tags must equal `v` + root `package.json` version. `DEV_MODE`/local builds use `v<package.json>-dev+<short sha>`.
- No SQLite source of truth. An update-history table is a possible follow-up, out of scope here.
- No forced rebuild every release. This PR touches all three service folders, so the next release labels all three images.
- Delivered entirely through the normal update (images, `update-agent` self-update). `install.sh` changes apply to the next install, since it is fetched from `main`.

## Build identity

- `frontend/Dockerfile`, `backend/Dockerfile`, `update-agent/Dockerfile`: in the runtime stage, after the `COPY` layers, add `ARG EDGE_STUDIO_VERSION=unknown`, `ARG EDGE_STUDIO_COMMIT=unknown`, and `LABEL org.opencontainers.image.version=$EDGE_STUDIO_VERSION org.opencontainers.image.revision=$EDGE_STUDIO_COMMIT`. `backend` also sets `ENV EDGE_STUDIO_BUILD_VERSION` / `EDGE_STUDIO_BUILD_COMMIT`.
- `.github/workflows/release.yml`:
  - Pass `build-args` (`EDGE_STUDIO_VERSION=${{ github.ref_name }}`, `EDGE_STUDIO_COMMIT=${{ github.sha }}`) to all three `docker/build-push-action` steps.
  - Add an early step that fails a tag without `-` unless it equals `v` + root `package.json` `version`.
- `docker-compose.yml`: add `build.args` for `frontend`, `backend`, and `update-agent` from `${EDGE_STUDIO_BUILD_VERSION:-unknown}` / `${EDGE_STUDIO_BUILD_COMMIT:-unknown}`. Mirror any needed change in `scripts/release/build-docker-compose.mjs`; release compose has no `build:`, so expect none.

## install.sh changes

- `main()`: move `record_applied_manifest` after `start_app`.
- `record_applied_manifest()`: also write `"images": { "frontend": "$FRONTEND_IMAGE", "backend": "$BACKEND_IMAGE" }`.
- `download_full_repo()` (`DEV_MODE`): read `git -C "$tmp_dir" rev-parse --short HEAD` before removing the checkout. Set `EDGE_STUDIO_BUILD_VERSION=v<package.json>-dev+<sha>` and `EDGE_STUDIO_BUILD_COMMIT`, and write both in `write_env_file()`.
- `DEV_MODE` cleanup in `start_app()`:
  - Delete `last-applied-manifest.json`.
  - Remove a leftover `update-agent` container (`compose --profile update-agent rm -sf update-agent`).
- `bash -n install.sh`. Extend `scripts/tests/install-bootstrap-trust-set.test.ts` or add an install-order test if a shell harness fits.

## update-agent changes

- `src/manifest/manifest-state.ts`:
  - `recordAppliedManifest(createdAt, version, images)`.
  - New `getLastAppliedManifest()` returns `{ createdAt, version, images | null }`.
  - Legacy files (no `images`) parse with `images: null`. Keep `getLastAppliedManifestTimestamp()` behavior.
- `src/docker/docker.service.ts`: add `inspectImage(imageId)` (`GET /images/{id}/json`), the only new Docker call, read-only. Read `Config.Labels` from it, never from the container (`createBodyFromInspect()` copies stale labels).
- `src/status/status.service.ts` `getUpdateStatus()`:
  - `currentVersion` = state `version` when the running `frontend`/`backend` `Image` equal state `images`.
  - Legacy state, or a missing file, whose running images equal the current manifest gets upgraded via `recordAppliedManifest(..., images)`. This extends the existing self-heal.
  - Otherwise `currentVersion: null`.
  - The `host-runtime` entry keeps comparing the state `version` (unverified on purpose; it has no digest).
  - Add `installedBuilds: Record<"frontend" | "backend" | "update-agent", { version: string; revision: string } | null>` from `inspectImage(container.ImageID)`. Missing labels or `unknown` give `null`.
- `src/status/status-poller.ts`: include `installedBuilds` in the cached snapshot.
- `src/update/apply.service.ts`: pass `{ frontend: manifest.frontend, backend: manifest.backend }` to `recordAppliedManifest()`.

## Frontend changes

- `frontend/src/pages/UpdatePage.tsx`:
  - Not up to date with `currentVersion`: `vX → vY`.
  - Not up to date without it: a warning alert "This installation doesn't match a release." followed by "Version vY is available." No per-service build list.
- `frontend/src/components/AppShell.tsx`:
  - Show the notice "Version vY is ready to install" only when `availableVersion !== currentVersion`. Otherwise use repair copy, e.g. "Installation doesn't match vY".
  - Sidebar version label: `currentVersion ??` the backend build from `/api/status/overview` (works in `DEV_MODE`, where `update-agent` is removed).

## Backend changes

- `backend/src/features/feedback/feedback.service.ts`:
  - Keep `app.version` from the state file.
  - Add `app.build` (`{ version, commit }` from `EDGE_STUDIO_BUILD_VERSION` / `EDGE_STUDIO_BUILD_COMMIT`, `null` when `unknown`). Update `FeedbackDocument` types.

## Tests

- `update-agent/tests/manifest/manifest-state.test.ts`: covers the new shape, legacy read, and write with `images`.
- `update-agent/tests/status/status.service.test.ts`:
  - Verified match.
  - Mismatch (the reported `v0.42.1 → v0.42.1` case gives `currentVersion: null`).
  - Legacy upgrade.
  - Labels present, missing, and `unknown`.
  - The `inspectImage` failure path.
- `update-agent/tests/docker/docker.service.test.ts`: `inspectImage`.
- `update-agent/tests/update/apply.service.test.ts`: `images` recorded on success, not on partial failure.
- `update-agent/tests/status/status-poller.test.ts`: snapshot carries `installedBuilds`.
- Frontend: `UpdatePage` and `AppShell` tests for verified, mismatched, and missing-field states.
- Backend: feedback metadata test for `app.build`.

## Docs

- ADR 0029 status flips to `Accepted` when merged. ADR 0006 already carries the amendment note.
- `CHANGELOG.md` under `## [Unreleased]`: verified version display, build identity in images, `install.sh` version recording order, `DEV_MODE` cleanup.
- `README.md`: update section (what "doesn't match a release" means), `DEV_MODE` build identity.
- `SECURITY.md`: `update-agent` gains a read-only image-inspect Docker call.
- `.agents/rules/update-agent.md`, `.claude/rules/update-agent.md`, `.cursor/rules/update-agent.mdc`: the state file now carries `images`, `currentVersion` is verified against running images, and labels are read from images. Apply identical changes to all three.
- `.agents/rules/docker.md`, `.claude/rules/docker.md`, `.cursor/rules/docker.mdc`: build args, if the state-dir bullet changes.
- `docs/SESSION.md` / `docs/TASKS.md` via the `session-notes` skill.

## Verification

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
docker compose build
bash -n install.sh
git status --short --untracked-files=all
```

- `docker image inspect` on locally built images shows the `-dev+<sha>` labels.
- Pi, upgrade path (no reinstall):
  1. On a device at `v0.42.1`, apply a dev-channel release containing this change.
  2. Confirm the old agent applies it, the new agent self-updates, and the legacy state file gains `images`.
  3. Confirm the sidebar shows the verified version.
- Pi, mismatch:
  1. Edit the state file `version` to the current manifest's version while older images run.
  2. Confirm the Update page shows the repair copy, not `vX → vX`.
  3. Confirm "Update now" repairs it.
- Pi, `DEV_MODE` install over a release install: no stale `update-agent`, no state file, sidebar shows `v<pkg>-dev+<sha>`.
