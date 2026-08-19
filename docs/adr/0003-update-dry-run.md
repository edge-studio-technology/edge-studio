# 0003: Dev-Only Update Dry Run

**Status:** Accepted
**Date:** 2026-08-07

## Context

`update-agent`'s status check (`GET /update/status`) compares each service's running image digest
against the signed manifest's target digest. In local dev, `frontend`/`backend`/`update-agent` are
built from source (`docker-compose.yml`'s `build:`), not pulled by digest — so they never match a
real manifest, and the Update page (`docs/adr/0002-update-page-split.md`) always reports "update
available." That's a feature, not a bug: it means the flow is always exercisable in dev. What was
missing was a safe way to actually click "Update now" and watch it through to success/failure
without the real consequence — pulling a real prod-tagged image by digest and swapping it in for a
locally-built dev container, which would silently break the dev environment (and, for
`update-agent` itself, replace the very container serving the flow).

## Decision

- Added `UPDATE_DRY_RUN` (`update-agent/src/config/env.ts`, parsed `=== "true"` like every other
  boolean env var in this repo). Default `false` everywhere, including the shared
  `docker-compose.yml` (`UPDATE_DRY_RUN: ${UPDATE_DRY_RUN:-false}`) — `install.sh` never writes it.
- `applyUpdates()` (`update-agent/src/update/apply.service.ts`) checks it first: if set, it waits
  `DRY_RUN_DELAY_MS` (4s, long enough for the waitroom's 3s poll loop to observe a `running` state
  at least once) and returns synthetic `ServiceUpdateResult`s — `updated: true, reason: "dry run —
  no changes applied"` for anything out of date, `already up to date` for anything that already
  matches — without calling `updateService()` or `launchSelfUpdate()` at all. The job state
  machine (`apply.job.ts`) is untouched: a dry run goes through the exact same `idle` → `running` →
  `succeeded`/`failed` transitions a real apply does, so it's a faithful rehearsal of the UI/UX,
  not a special-cased response.
- Dry run deliberately never calls `recordAppliedManifest()`. This is the point, not an oversight:
  it keeps `GET /update/status` reporting "available" after a dry run, so the same manifest can be
  used to re-trigger the flow repeatedly during a dev session instead of going stale after one run.
- Dry run skips `update-agent`'s own self-update path entirely (no synthetic result for it either,
  matching the real loop, which also never includes `update-agent` in its returned results —
  self-update is fire-and-forget and reported separately). Simulating a self-swap of the very
  container running the simulation isn't meaningful, and `launchSelfUpdate` doing anything at all
  in dry-run mode would still touch Docker for real.
- Logged loudly in two places, not just one: once at startup (`update-agent/src/index.ts`, so it's
  visible in `docker compose logs` for the whole time the flag is on) and once per apply
  (`apply.service.ts`, `console.warn`), so it can never be silently active.

## Alternatives considered

- **A separate dev-only build/image with the apply logic stubbed out**, instead of a runtime flag
  in the real image. Rejected: doubles the code path to maintain and test, for a service whose
  whole reason to exist is being trustworthy-by-construction; a single well-guarded flag in the one
  real code path is less risk than two divergent implementations.
- **Simulating occasional failures too**, to exercise the failure UI path. Rejected for now as
  unrequested scope — the real failure path already returns the same result shape from
  `updateService()`, so the waitroom's failure rendering is already exercised by that code, just
  not by the dry-run path specifically. Can be added later if actually needed.
- **Gating via `MANIFEST_URL` pointing at a fake/local manifest** instead of a dedicated flag.
  Rejected: still does real pulls/swaps against whatever that manifest points to, doesn't avoid the
  actual risk (mutating dev containers), and adds an extra manifest-hosting concern to dev setup.

## Consequences

- A second, narrower trust boundary now exists inside `update-agent`'s otherwise
  signature-verified, digest-pinned apply path. It's off by default, never written by `install.sh`,
  and documented as a guideline in `SECURITY.md` — but it is still a real bypass switch that must
  stay dev-only by convention and review, not by any technical inability to set it in production.
- A dry run reports success even for services `update-agent` never actually checked reachability
  or health for — it's a UI/flow rehearsal, not a test of the real pull/health-check/swap
  machinery. `service-update.ts`'s actual logic still needs real (non-dry-run) testing before a
  release.

## Where this lives in code

- `update-agent/src/config/env.ts` — `dryRun`.
- `update-agent/src/update/apply.service.ts` — the dry-run branch in `applyUpdates()`.
- `update-agent/src/index.ts` — startup warning log.
- `docker-compose.yml` — `UPDATE_DRY_RUN` passthrough with a safe default.
- `.env.example`, `README.md`, `SECURITY.md` — documentation and the security guideline.
