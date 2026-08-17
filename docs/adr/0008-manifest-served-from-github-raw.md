# 0008: Manifest Served Directly from GitHub Raw, Not a VPS

**Status:** Accepted
**Date:** 2026-08-17

## Context

`docs/plans/manifest-deploy-pull-model.md` designed a VPS pull-based delivery path: CI pushes the
signed manifest to a private manifest repo via a GitHub App, a VPS cron job pulls that repo, and
nginx serves the manifest folder over HTTPS. That plan's CI/GitHub-App side was finished, but the
VPS-side pull script, cron job, and nginx config were never built — the plan sat at "VPS-side setup
not started" through the `integritas-technology` -> `edge-studio-technology` org migration.

During that migration the manifest repo (renamed `integritas-manifests` -> `edge-studio-manifests`)
was confirmed to already be a **public** GitHub repo, and the release workflow (`.github/workflows/release.yml`,
`manifest` job) already pushes `manifest.json`, `manifest.json.sig`, and `edge-studio-runtime.tar.gz`
into it on every release. A public repo's raw file contents are directly fetchable over HTTPS via
`raw.githubusercontent.com` with no server of our own required.

## Decision

- Default `MANIFEST_URL` now points straight at the manifest repo's raw content instead of a VPS
  origin: `https://raw.githubusercontent.com/edge-studio-technology/edge-studio-manifests/main/edge-studio/release/manifest.json`
  (`install.sh`'s `DEFAULT_MANIFEST_URL`, and the comment in `.env.example`).
- The Ed25519 signature check in `update-agent` (embedded public key, verifies `.sig` against
  `manifest.json`) remains the actual trust boundary and is unchanged by this decision — moving the
  transport from a VPS to `raw.githubusercontent.com` is not a security downgrade or upgrade, since
  the manifest was never trusted based on where it was fetched from.
- `docs/plans/manifest-deploy-pull-model.md` is marked superseded by this ADR rather than deleted,
  since it still accurately records why the original SSH-push design was rejected (firewalled VPS
  SSH, GitHub-hosted runners' rotating IPs) and why a GitHub App was chosen over a deploy key.

## Alternatives considered

- **Finish the original VPS pull-based plan.** Rejected: requires standing up and maintaining a
  cron job, a pull script, and nginx config on a VPS for a job `raw.githubusercontent.com` already
  does, with no security or functional benefit — the manifest repo being public removes the only
  reason a private-repo pull/serve step existed.
- **Keep the manifest repo private and serve it through GitHub's authenticated contents API.**
  Rejected: would require `update-agent` and `install.sh` to hold a GitHub credential just to read a
  file whose integrity is already independently verified by its signature; the repo has no secrets
  in it (images are content-addressed by digest, already public on GHCR), so there is nothing
  privacy-sensitive to protect by keeping it private.

## Consequences

- No VPS, cron job, or nginx config is needed for manifest delivery; one less piece of
  infrastructure to provision, monitor, or lose SSH access to.
- Manifest availability now depends on GitHub's/`raw.githubusercontent.com`'s uptime and caching
  instead of infrastructure we control. `raw.githubusercontent.com` caches responses for a few
  minutes at its CDN edge, which is acceptable for `update-agent`'s polling cadence
  (`STATUS_POLL_INTERVAL_MS`, default 30 minutes) but means a just-pushed manifest may not be
  visible immediately.
- `raw.githubusercontent.com` does not serve Git LFS content (only pointer files) and has a
  practical blob-size ceiling around 100MB; this is fine today since `manifest.json`/`.sig` are
  tiny and `edge-studio-runtime.tar.gz` is well under that ceiling, but a much larger runtime bundle
  in the future would need a different distribution point.
- Existing installs with an explicit `MANIFEST_URL` already set (env file, `.env`) are unaffected —
  this only changes the default a fresh install falls back to when `MANIFEST_URL` is unset.

## Where this lives in code

- `install.sh` — `DEFAULT_MANIFEST_URL`.
- `.env.example` — `MANIFEST_URL` comment.
- `README.md` — `MANIFEST_URL` configuration description.
- `docs/plans/manifest-deploy-pull-model.md` — marked superseded.
