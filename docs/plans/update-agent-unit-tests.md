# Update Agent Unit Tests Plan

**Status:** In Progress (first module completed)
**Created:** 2026-08-21
**Goal:** Build vitest unit test coverage across `update-agent/src/*`, one module at a time. Prioritize core business logic (manifest verification, service updates, state management) over exhaustive coverage — pure-logic and state-management functions first, thin route wiring last (or skipped where it's just composition).

**Scope:** `update-agent/src/docker/*`, `update-agent/src/manifest/*`, `update-agent/src/update/*`, `update-agent/src/status/*`, `update-agent/src/self-update/*`. Out of scope: `config/env.ts` (env parsing with no branching logic), `auth/auth.middleware.ts` (thin request validation glue), `index.ts` (bootstrap), `app.ts` (route registration).

## Setup

Already in place: `vitest`, `update-agent/vitest.config.ts` (environment: `"node"`, `include: ["tests/**/*.test.ts"]`), `npm run test` script.

Add to start this plan:

- Test helpers in `update-agent/tests/helpers/` for common fixtures (manifest files, mocked Docker responses).
- `update-agent/tests/` directory structure mirroring `src/`.

## Conventions

- Test files live in `update-agent/tests/<mirror-of-src-path>.test.ts`, mirroring `update-agent/src/<path>.ts`.
- Use `node:assert/strict` + vitest's `describe`/`it` (not `expect`) — matches backend conventions.
- Import source with `.js` extension (NodeNext ESM resolution).
- Pure-function modules (parsing, validation) need no setup.
- Network-calling modules: mock at the boundary.
  - Modules that own the actual `fetch` call (e.g. `manifest.service.ts`): stub `global.fetch` with `vi.stubGlobal("fetch", vi.fn())`.
  - Modules that depend on Docker socket I/O (e.g. `docker.client.ts`): mock `node:http` at the boundary with `vi.mock("node:http", ...)`.
  - Modules one level up (e.g. `apply.service.ts`) that depend on already-tested lower modules: mock the dependency module itself with `vi.mock()`.
- Modules with mutable state (e.g. `status-poller.ts`): `vi.resetModules()` in `beforeEach` so tests don't leak state.
- Time-dependent logic (polling intervals, retry backoff): use `vi.useFakeTimers()` + `vi.advanceTimersByTime()`.
- Routes (`*.routes.ts`) are **not** unit-tested directly — treat as thin wiring over already-tested service functions.

## Progress

| Module | Status | Notes |
|---|---|---|
| `docker/docker.types.ts` | Out of Scope | Types only, no runtime logic. |
| `docker/docker.client.ts` | Done | HTTP socket client for Docker Engine API. Comprehensive test coverage for `dockerRequest` (GET/POST/DELETE, success/error/timeout paths) and `dockerRequestStream` (chunked JSON, error handling, progress callbacks). 25 tests total. |
| `docker/pull-progress.ts` | Done | In-memory pull progress state machine. `vi.resetModules()` per test per plan convention. Covers start/clear/record, multi-layer summing, layer replace-not-double-count, missing id/progressDetail/non-numeric guards. 13 tests. |
| `docker/docker.service.ts` | Done | Orchestrates Docker API calls; `docker.client.ts` mocked at the module boundary via `vi.mock()`. Covers compose service discovery, inspect/create/start/stop/remove/rename, `createBodyFromInspect` option combinations (port bindings, extraEnv/cmd, oneShot, label stripping), `isContainerHealthy`/`waitForHealthy` (fake timers, transient-error retry, deadline timeout), image listing/filtering/sorting, and best-effort `pruneOldImages`. 32 tests. |
| `manifest/manifest-state.ts` | Done | Reads/writes `last-applied-manifest.json` (createdAt + version) for replay/downgrade guarding. Real temp dir via `mkdtemp` + `STATE_DIR_IN_CONTAINER` override + `vi.resetModules()` per test (env is computed at import time). Covers missing file, missing/invalid `createdAt`, missing `version`, invalid JSON, directory auto-create, overwrite-on-repeat. 12 tests. |
| `manifest/manifest.service.ts` | Done | Fetches and Ed25519-verifies manifests. `config/env.ts` and `manifest-state.js` fully mocked via `vi.mock()` (the real public key on disk has no matching test private key), real generated Ed25519 keypair signs fixtures, `global.fetch` stubbed per URL. Covers missing config, successful fetch/verify, `.sig` URL construction with query strings, manifest/signature HTTP failures, primary→fallback-URL fallback (success and double-failure), no-retry when primary already is the fallback URL, bad signature, missing fields, unparseable `createdAt`, and the replay/downgrade timestamp guard (older/equal/newer). 14 tests. |
| `update/update.types.ts` | Out of Scope | Types only, no runtime logic. |
| `update/service-update.ts` | Not Started | Pure state machine for one service's update (pull → create → health-check → start → success/failure). Cover state transitions, per-service health checks, rollback conditions. |
| `update/apply.service.ts` | Not Started | Orchestrates full update flow (fetch manifest → validate → pull images → swap services → self-update if needed). Mock `manifest.service.ts`, `docker.service.ts`, `service-update.ts`. Cover manifest validation, per-service update sequencing, health checks, self-update gating, dry-run mode. |
| `update/apply.job.ts` | Not Started | Background job runner for applies (polling, persistence). Mock `apply.service.ts`, `manifest.service.ts`. Cover job lifecycle (queued → running → done), idempotent starts, crash recovery from persisted state. |
| `status/status.service.ts` | Not Started | Derives overall system readiness and update status from manifest/service states. Mock `manifest.service.ts`, `docker.service.ts`. Cover availability checks, update-available determination, version extraction, fallback paths. |
| `status/status-poller.ts` | Not Started | Periodically fetches manifest status. Mock `manifest.service.ts` (or `status.service.ts` depending on module coupling). Cover interval re-polling (fake timers), error handling, caching. |
| `status/status.routes.ts` | Out of Scope | Thin route wiring; `GET /status` returns `statusService.getStatus()`. Service itself tested above. |
| `self-update/self-update.service.ts` | Not Started | Updates the update-agent container itself. Mock `docker.service.ts`, `manifest.service.ts`. Cover image pull, old container removal, new container start, error recovery. |
| `self-update/orchestrator.ts` | Not Started | Orchestrates self-update as part of the overall apply flow. Mock `self-update.service.ts`, `apply.service.ts`. Cover decision logic (should self-update?), sequencing, state preservation. |
| `auth/auth.middleware.ts` | Out of Scope | Route-level auth validation (forward to `backend`'s `GET /api/auth/me`, check role). Thin request guard, not worth unit testing standalone. |
| `apply.routes.ts` | Out of Scope | Route wiring; `POST /apply` calls `apply.job.start()` and returns `{ status }`. Job/service logic tested above. |

## Verification

- `npm --prefix update-agent run test` (vitest)
- `npm --prefix update-agent run typecheck`

Keep this file updated as work progresses — flip rows to Done and add newly-covered modules to the Notes as they land.
