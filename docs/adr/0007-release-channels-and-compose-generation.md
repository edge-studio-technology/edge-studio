# 0007: Release Channels and Per-Channel Docker Compose Generation

**Status:** Accepted
**Date:** 2026-08-12

## Context

The release workflow (`.github/workflows/release.yml`, `manifest` job) previously pushed every
signed manifest to a single hardcoded location: the `qa` folder on a manifest-repo git branch
chosen by tag suffix (`-test.` -> `test` branch, `-dev.` -> `dev` branch, else `main` branch). This
conflated two different axes — which manifest-repo git branch to commit to, and which release
"channel" a build belongs to — into one branch-selection `case` statement, with no `canary` concept
and only one folder (`qa`) regardless of branch.

Testers and early installs also had no self-service way to stand up a given channel: the only
documented install path was `install.sh` against a repo checkout, or hand-building
`docker-compose.yml` from the checked-in template plus a manually-chosen `MANIFEST_URL`/
`RELEASE_CHANNEL`. There was no artifact that paired a channel's digest-pinned images with a
matching `docker-compose.yml`/`.env.example` a tester could drop into a folder and run.

## Decision

- Replaced the branch-selection `case` with a channel-selection `case` (`manifest` job, step
  `Detect release channel from tag`): `*-dev.*` -> `development`, `*-canary.*` -> `canary`, else ->
  `release`. This is a distinct classification from the pre-existing, unchanged `changes` job's
  `prev-tag`/`filter` steps, which still key off `-test.`/`-dev.`/plain tags for a different purpose
  (finding the previous release tag to diff changed service folders against, for build skipping).
- The manifest repo (`integritas-manifests`) is now always checked out and pushed to `main`
  (`ref: main`, `git push origin HEAD:main`) instead of branch-per-channel. Channel identity now
  lives entirely in the folder path — `integritas-pi/<channel>/manifest.json(.sig)` — so `main`
  stays the single source of truth for every channel's current manifest, and adding a channel is a
  new folder, not a new git branch with its own protection rules/history to manage.
- Added `scripts/release/build-docker-compose.mjs`, run after signing, taking the freshly built
  `manifest.json` and the detected channel as input. It generates a `docker-compose.yml` with
  images pinned to the manifest's resolved digests (`${manifest.backend}`, `${manifest.frontend}`,
  `${manifest.updateAgent}`, no `build:` context) and a matching `.env.example` with
  `MANIFEST_URL`/`RELEASE_CHANNEL` pre-filled to that channel's manifest URL — both published to
  `docker/<channel>/` in the same manifest repo, same `main`-branch/push-if-changed pattern as the
  manifest itself.
- The generated compose file hardcodes `name: integritas-pi` (the Compose project name) regardless
  of the folder a tester unzips it into, because `update-agent`'s container discovery is pinned to
  that project name (see `.claude/rules/update-agent.md`) — every real install already lives in a
  folder literally named `integritas-pi`, but a channel-distribution artifact can land anywhere, so
  the project name has to be forced rather than left to Compose's folder-name default.
- The generated compose file also adds a one-shot `cert-init` service (Alpine + `openssl`) that
  generates the self-signed HTTPS cert on first run. The checked-in `docker-compose.yml` used by
  `install.sh` doesn't need this because `install.sh` generates the cert itself before ever running
  `docker compose up`; a channel tester pulling only `docker-compose.yml` + `.env.example` (no repo
  checkout, no `install.sh`) has nothing else to generate it.

## Alternatives considered

- **Keep branch-per-channel, add a `canary` branch.** Rejected: branches require repo-level setup
  (protection rules, default-branch assumptions in other tooling) per channel, and conflated "which
  branch" with "which channel" for no benefit — nothing reads the manifest repo's branch name today
  except this workflow's own checkout step.
- **Have testers/operators hand-edit the checked-in root `docker-compose.yml` to point at a
  channel's manifest.** Rejected: that file is the `build:`-based, source-checkout install path
  (`install.sh`, `.claude/rules/update-agent.md` notes this is a known, accepted gap), not a
  digest-pinned distribution artifact; hand-editing it per channel is error-prone and gives no
  record of which images a given tester is actually running.
- **Generate the docker-compose output as a build-workflow artifact only (`actions/upload-artifact`),
  not pushed to the manifest repo.** Rejected: workflow artifacts expire and require a GitHub login
  to download; the manifest repo is already the durable, always-current distribution point for
  signed manifests, so channel compose files belong next to them.

## Consequences

- Adding a fourth channel is a one-line change to the `channel` step's `case` statement plus new
  folders appearing under `integritas-pi/<channel>/` and `docker/<channel>/` on first push — no new
  manifest-repo branch or workflow duplication needed.
- The manifest repo's `main` branch now receives commits from every channel interleaved
  (`integritas-pi/development/...`, `integritas-pi/canary/...`, `integritas-pi/release/...`, plus
  the matching `docker/<channel>/...` compose commits), rather than each channel having its own
  branch history — channel history is now separated by path, not by branch/ref.
- `docker/<channel>/docker-compose.yml` is a generated, distribution-only artifact that duplicates
  structure from the checked-in root `docker-compose.yml` (services, env vars, volumes). The two are
  not the same file and are not kept in sync automatically; a service/env change in one must be
  applied to `build-docker-compose.mjs`'s template by hand if it should also apply to channel
  installs.
- Channel testers installing from `docker/<channel>/` never run `install.sh`, so they get the
  `cert-init` service instead of a host-generated cert — a second, parallel way the HTTPS cert can
  come into existence, scoped only to this distribution path.

## Where this lives in code

- `.github/workflows/release.yml` — `manifest` job: `Detect release channel from tag`,
  `Checkout manifest repo`, `Deploy manifest (push to private manifest repo)`,
  `Generate docker-compose files`, `Deploy docker-compose (push to private manifest repo)`.
- `scripts/release/build-docker-compose.mjs` — compose/`.env.example` template generation.
