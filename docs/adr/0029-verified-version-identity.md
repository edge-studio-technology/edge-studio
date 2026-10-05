# 0029: Verified Version Identity (Running Images Over Recorded Claims)

**Status:** Proposed
**Date:** 2026-10-05

Amends [ADR 0006](./0006-app-version-single-source-of-truth.md): the state file remains the
record, but it is no longer trusted without checking the running images.

## Context

ADR 0006 made `last-applied-manifest.json` (`{ createdAt, version }`) the single source of truth
for "what version is this device on". The file is a claim, written separately from what actually
runs, and the claim drifts:

- `install.sh` calls `record_applied_manifest` **before** `start_app` (`main()` order). If the
  pull or `compose up` fails or is interrupted afterwards, the file names the new release while the
  old containers keep running. Observed on a co-worker's Pi after a release-channel reinstall
  (`v0.42.1`): the Update page showed `v0.42.1 → v0.42.1` and the sidebar notice said "Version
  v0.42.1 is ready to install".
- The two halves of the update status come from different sources. `currentVersion` comes from
  the file. `upToDate` compares each running container's image reference against the manifest
  digest (`update-agent/src/status/status.service.ts`). When they disagree, the UI renders the
  file's version as "current" next to a correct "update available" verdict.
- `DEV_MODE` installs build `edge-studio-*:dev` images, skip writing the file, and leave any
  previous file and any previous `update-agent` container in place. Dev builds carry no version at
  all, so they report "Unknown version" in Feedback (ADR 0006) or a stale release version.

Verified empirically, so the digest comparison itself is sound:

- Docker 29 with the containerd image store reports `/containers/json` `Image` as the exact
  `repo@sha256:…` reference a container was created from, for both `docker run` and
  `docker compose up`. A normal install matches the manifest string-for-string.
- No release or development manifest has ever been re-published under an existing version
  (`edge-studio-manifests` history), so "same version, different digests" is not the cause.

Release facts the design has to respect:

- Production tags are `v` + the root `package.json` version (`v0.42.1` ↔ `0.42.1`).
  Development-channel tags are not (`v0.50.0-dev.9` was built from `package.json` `0.39.0`).
- `release.yml` rebuilds only services whose folder changed since the previous tag; unchanged
  services keep the previous manifest's digest. A release version describes the manifest (a set
  of digests), not each image.
- `update-agent`'s container swap (`createBodyFromInspect()`) copies the old container's
  `Config.Labels`. Container labels override image labels, so a container's labels carry stale
  image metadata after an update. Image metadata has to be read from the image.
- Existing devices must get this without rerunning `install.sh`. The first update that ships it
  is applied by the **old** `update-agent` (self-update runs last in `applyUpdates()`), so the old
  agent writes the old state-file shape one more time.

## Decision

The installed release version is reported only when the running images prove it. Otherwise the
device reports the build identity baked into its images.

1. **Build identity baked into every image.** `frontend`, `backend`, and `update-agent`
   Dockerfiles take `ARG EDGE_STUDIO_VERSION` / `ARG EDGE_STUDIO_COMMIT` (default `unknown`) in the
   runtime stage, after the expensive layers, and set
   `LABEL org.opencontainers.image.version` / `org.opencontainers.image.revision`. `backend` also
   exposes them as env vars for self-reporting.
   - `release.yml` passes the tag (`github.ref_name`) and `github.sha`. For production tags (no
     `-`), the workflow fails unless the tag equals `v` + root `package.json` version.
   - `DEV_MODE` / local builds pass `v<root package.json version>-dev+<short sha>`
     (`+unknown` without git metadata) through `docker-compose.yml` `build.args`. `install.sh`
     records the sha from its `git clone` before discarding the temp checkout.
2. **State file records digests.** `last-applied-manifest.json` becomes
   `{ createdAt, version, images: { frontend, backend } }`. `update-agent`'s
   `recordAppliedManifest()` writes `images` after a successful apply. `install.sh` writes it only
   after `start_app` succeeds.
3. **`currentVersion` is verified.** `getUpdateStatus()` reports `currentVersion` only when the
   running `frontend`/`backend` references equal the state file's `images`. A legacy file
   (no `images`) is upgraded in place when the running references equal the current manifest's and
   its `version` matches, the same self-heal pattern that already exists for a missing file.
   Otherwise `currentVersion` is `null`. `createdAt` keeps its downgrade-guard role unchanged.
4. **Builds are reported alongside.** Status gains `installedBuilds` (`frontend`, `backend`,
   `update-agent` → `{ version, revision }` or `null`), read from image labels through one new
   read-only Docker call (`GET /images/{id}/json`).
5. **UI copy follows the verified state.** With `currentVersion` set: `vX → vY`. Without it, the
   Update page shows a warning that the installation doesn't match a release, followed by
   "Version vY is available." Per-service build labels are not listed there: an unchanged image
   keeps its original label, so a list would show older versions next to a correct release. The sidebar notice says "Version vY is ready to install" only
   when `availableVersion` differs from `currentVersion`. The sidebar version label falls back to
   the backend's own build version (from `/api/status/overview`, so it works without
   `update-agent`). New status fields are optional in the frontend, so a new frontend
   tolerates an old `update-agent` during the first update.
6. **`DEV_MODE` cleans up.** `install.sh` removes the stale state file and any leftover
   `update-agent` container, since no signed release describes a from-source build.
7. **Feedback** keeps `app.version` from the state file (ADR 0006) and adds `app.build` from the
   backend's baked identity, so dev builds are identifiable.

Nothing requires an `install.sh` rerun. Images, `update-agent`, and the frontend copy arrive
through the normal update. `install.sh` is fetched from `main` on every run, so its fixes apply to
the next install. The PR that adds the build args touches all three service folders, so the next
release rebuilds and labels all three images without a special step.

## Alternatives considered

- **Store the version in SQLite.** Rejected as the source of truth: it is another written claim
  that drifts exactly like the state file, and `backend` cannot observe what `update-agent`
  applied. An append-only update-history table (backend records a changed build identity at
  startup) is useful for audit and stays a possible follow-up, not part of this decision.
- **Only reorder `install.sh`.** Fixes the observed cause on new installs but leaves every other
  drift path (interrupted installs on old scripts, manual `compose build`, `DEV_MODE`) rendering
  `vX → vX`, and dev builds still have no identity.
- **Only fix the UI copy** (detect `currentVersion === availableVersion && !upToDate`). Hides the
  symptom while the sidebar and Feedback keep reporting an unproven version.
- **Rebuild every image on every release** so each image label equals the release version.
  Rejected: every update would then swap every service, adding download time and swap risk for no
  functional gain. The release version comes from the manifest match instead.
- **Read labels from the container.** Rejected: `createBodyFromInspect()` copies old labels onto
  the swapped container, so they go stale after the first update.
- **Use the root `package.json` version as the label for development-channel CI tags.** Rejected:
  those tags do not follow `package.json`, so the label would disagree with the manifest it
  ships in. CI labels use the tag; only local/`DEV_MODE` builds derive from `package.json`.

## Consequences

- Images already on devices have no labels. Until replaced, `installedBuilds` reports `null` for
  them. This only shows when the running images also fail to match the state file.
- After the first update to a release containing this change, the state file is in legacy shape
  (written by the old agent) until the new agent's first status poll upgrades it.
- Images unchanged across releases keep their original build label (e.g. a `v0.43.0` release may
  run a backend labelled `v0.42.1`). This is accurate per image; the release version is reported
  separately.
- `update-agent` gains one read-only Docker Engine call (image inspect).
- A from-source build always reports `currentVersion: null` with a `-dev+<sha>` build identity
  instead of a release version.

## Where this lives in code

- `frontend/Dockerfile`, `backend/Dockerfile`, `update-agent/Dockerfile` — build args and labels.
- `.github/workflows/release.yml` — build args and the production tag/`package.json` guard.
- `docker-compose.yml` — `build.args` for local/`DEV_MODE` builds.
- `install.sh` — `record_applied_manifest()` after `start_app()`, digests in the state file,
  `DEV_MODE` build identity and cleanup.
- `update-agent/src/manifest/manifest-state.ts` — state file shape and legacy read.
- `update-agent/src/status/status.service.ts` — verified `currentVersion`, legacy upgrade,
  `installedBuilds`.
- `update-agent/src/docker/docker.service.ts` — image inspect.
- `update-agent/src/update/apply.service.ts` — records `images` on success.
- `frontend/src/pages/UpdatePage.tsx`, `frontend/src/components/AppShell.tsx` — copy.
- `backend/src/features/feedback/feedback.service.ts` — `app.build`.
