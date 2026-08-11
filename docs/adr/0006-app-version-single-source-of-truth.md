# 0006: App Version Single Source of Truth (update-agent's Last-Applied Manifest)

**Status:** Accepted
**Date:** 2026-08-11

## Context

The Feedback service (`backend/src/features/feedback/feedback.service.ts`) records an `app.version`
field in every feedback submission's metadata. It read this from `INTEGRITAS_PI_VERSION`
(`docker-compose.yml`), falling back to the root `package.json`'s `version` if unset.

This was a second, independent notion of "app version" alongside `update-agent`'s own tracked
version (`update-agent/src/status/status.service.ts`'s `currentVersion`, sourced from
`getLastAppliedVersion()` in `update-agent/src/manifest/manifest-state.ts`). Nothing kept them in
sync: `docker-compose.yml`'s `INTEGRITAS_PI_VERSION` default (`0.15.0`) had already drifted stale
against the root `package.json` (`0.33.0`), and no script ever wrote `INTEGRITAS_PI_VERSION` from a
release process — it was a manually-set env var nobody was maintaining.

Separately, `install.sh` (`record_applied_manifest`) already writes
`${UPDATE_AGENT_STATE_DIR}/last-applied-manifest.json` (`{ createdAt, version }`) at install time,
straight from the signed manifest — before `update-agent`'s own container ever runs an apply. This
file was already the de facto canonical install/update record on every device; nothing outside
`update-agent` read it.

`update-agent` is the one component that signature-verifies the manifest (Ed25519, embedded public
key) before trusting any version/digest in it, making it the natural authority for "what version is
this device on" — the user's stated preference for resolving this drift.

## Decision

- `backend/src/features/feedback/feedback.service.ts`'s `getAppVersion()` now reads
  `/update-agent-state/last-applied-manifest.json`'s `version` field. If that file isn't present
  yet (native dev, a from-source build, or `update-agent` has never applied/recorded a manifest),
  it reports the literal string `"Unknown version"` rather than falling back to a `package.json`
  version. The original design fell back to `package.json`, but this was dropped after live-testing
  surfaced it as actively misleading in practice: it picked up `backend/package.json`'s own version
  (`0.1.1`, unrelated to any app release version) rather than the intended root `package.json`
  (`0.33.0`), so a from-source build silently showed a plausible-looking but meaningless version
  number instead of signaling "not a verified release." A tester seeing a real-looking version
  string on an unverified build is a worse outcome than one seeing an honest "Unknown version."
- `docker-compose.yml`: added a **read-only** bind mount on the `backend` service,
  `${UPDATE_AGENT_STATE_DIR:-./update-agent-state}:/update-agent-state:ro` — the same
  cross-container shared-directory pattern already used for `/minima-backups` (see
  `.claude/rules/minima.md`). `update-agent` keeps its own read-write mount of the same host
  directory at `/state`; it remains the sole writer. `backend` never writes to this path.
- Removed `INTEGRITAS_PI_VERSION` entirely (`docker-compose.yml`, `.env.example`) — it had no other
  readers and was the actual source of the drift.

## Alternatives considered

- **Backend calls `update-agent`'s `GET /status` live over HTTP** for each feedback build. Rejected:
  `update-agent` is optional (Compose profile, off by default), so backend would need a fallback
  path anyway; `/status` requires `requireAdmin`, which forwards the caller's session cookie to
  backend's own `GET /api/auth/me` — calling it from backend would mean backend round-tripping
  through `update-agent` back into itself just to authenticate a request it had already
  authenticated, plus added latency/timeout handling on every feedback submission.
- **Add a new unauthenticated internal-only endpoint on `update-agent`** (e.g. `GET /version`) for
  backend to call. Rejected: violates the explicit "no endpoints beyond `GET /status`, `POST
  /apply`, and its one static page" minimal-surface rule (`.claude/rules/update-agent.md`), and
  duplicates a value already sitting in a local file on disk.
- **Have `update-agent` push the version into backend's SQLite via an API call** after every apply.
  Rejected: adds a new write path and a new backend route for a value that's already durably
  persisted as a file `update-agent` (and `install.sh`) already maintain; a read-only mount is
  simpler and has no new failure mode to reconcile.

## Consequences

- `backend` now has a build-time-fixed, read-only dependency on a host directory it doesn't own the
  writer for. If that directory or file is ever absent, Feedback reports `"Unknown version"` instead
  of a real version — intentional (see Decision), but it means from-source/dev builds and
  update-agent-less installs can never show a real version number, only that one is unavailable.
- The two containers (`backend`, `update-agent`) now share one more host directory, matching the
  existing `/minima-backups` precedent rather than introducing a new pattern.
- Feedback's reported version is only as fresh as the last successful `install.sh` run or
  `update-agent` apply — it does not reflect an in-progress, not-yet-applied update.

## Where this lives in code

- `backend/src/features/feedback/feedback.service.ts` — `getAppVersion()`.
- `docker-compose.yml` — the `backend` service's `/update-agent-state:ro` mount and removal of
  `INTEGRITAS_PI_VERSION`.
- `install.sh` — `record_applied_manifest()` (pre-existing, unchanged), the original writer of
  `last-applied-manifest.json` at install time.
- `update-agent/src/manifest/manifest-state.ts` — `recordAppliedManifest()` (pre-existing,
  unchanged), the writer after every applied update.
- `.env.example`, `README.md`, `.claude/rules/docker.md` / `.cursor/rules/docker.mdc`,
  `.claude/rules/update-agent.md` / `.cursor/rules/update-agent.mdc` — documentation.
