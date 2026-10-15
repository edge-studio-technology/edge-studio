# 0029: App Version Identity — Verified Against Running Images

**Status:** Accepted
**Date:** 2026-08-11

## Context

Feedback submissions report an `app.version`. It originally came from `INTEGRITAS_PI_VERSION`, a
hand-maintained env var that had already drifted (`0.15.0` against a root `package.json` of
`0.33.0`). Meanwhile `install.sh` and `update-agent` both wrote
`UPDATE_AGENT_STATE_DIR/last-applied-manifest.json` from the signed manifest, which made it the
de facto install record. `update-agent` is the only component that verifies the manifest
signature.

That file is still a claim, written separately from what runs, and it drifted too:

- `install.sh` recorded the manifest **before** starting the app, so an interrupted install named
  the new release while the old containers kept running. Seen on a Pi after a `v0.42.1` reinstall:
  the Update page showed `v0.42.1 → v0.42.1`.
- `currentVersion` came from the file while `upToDate` compared running images to the manifest,
  so the two halves of the status could disagree.
- `DEV_MODE` builds carried no version at all.

Verified empirically: Docker 29 with the containerd image store reports a container's `Image` as
the exact `repo@sha256:…` it was created from, for `docker run` and `docker compose up`, so a
digest comparison against the manifest is reliable. No manifest has ever been re-published under
an existing version.

Release facts that constrain the design: production tags equal `v` + root `package.json`;
development tags don't. `release.yml` rebuilds only changed services, so a release version
describes a set of digests, not each image. `createBodyFromInspect()` copies container labels
across swaps, so container labels go stale.

## Decision

The state file is the record; the running images are the proof.

1. **State file.** `last-applied-manifest.json` is
   `{ createdAt, version, images: { frontend, backend } }`. `update-agent` writes it after a
   successful apply; `install.sh` writes it only after `start_app` succeeds. `createdAt` is also
   the replay/downgrade guard.
2. **Verified `currentVersion`.** Reported only when the running `frontend`/`backend` references
   equal the file's `images`; otherwise `null`. A legacy file without `images` is upgraded in place
   when the running images match the current manifest and its version matches.
3. **Build identity.** Every image carries `org.opencontainers.image.version`/`.revision` labels
   from build args: the tag and commit in CI (production tags must equal `v` + `package.json`), and
   `v<package.json>-dev+<sha>` for local/`DEV_MODE` builds. `installedBuilds` reads them from the
   image (read-only image inspect), never the container.
4. **Backend reads the file** through a read-only mount at `/update-agent-state`; `update-agent`
   stays the sole writer. Feedback's `app.version` comes from it (`"Unknown version"` if absent,
   never a `package.json` fallback) plus `app.build` from the backend's own build identity.
   `INTEGRITAS_PI_VERSION` is removed.
5. **UI.** With `currentVersion`: `vX → vY`. Without it: a warning that the installation doesn't
   match a release, then "Version vY is available." The sidebar falls back to the backend's build
   version.
6. **`DEV_MODE`** removes the stale state file and any leftover `update-agent` container.

## Alternatives considered

- **Hand-maintained `INTEGRITAS_PI_VERSION`.** The original source; nothing kept it in sync.
- **Fall back to `package.json`** when the file is missing. It picked up `backend/package.json`
  (`0.1.1`), so unverified builds showed a plausible but meaningless version.
- **Backend calls `update-agent` `GET /status`**, or a new internal `/version` endpoint, or
  `update-agent` pushes the version into SQLite. `update-agent` is optional, `/status` would
  round-trip auth back into the backend, the endpoint cap forbids new routes, and the value is
  already on disk.
- **Store the version in SQLite.** Another written claim that drifts the same way.
- **Only reorder `install.sh`**, or **only fix the UI copy**. Each fixes one symptom and leaves the
  other drift paths.
- **Rebuild every image each release** so labels match the release. Swaps every service on every
  update for no functional gain.
- **Read labels from the container.** Stale after the first swap.

## Consequences

- Images built before this change have no labels; `installedBuilds` reports `null` for them.
- Images unchanged across releases keep their original build label (a `v0.43.0` release may run a
  backend labelled `v0.42.1`); the release version is reported separately.
- From-source and update-agent-less installs never show a release version, only a build identity.
- Feedback's version reflects the last successful install or apply, not an in-progress update.

## History

- 2026-10-05: State file records image digests and `currentVersion` is verified against running
  images; build labels added (was ADR 0006 plus this record).
