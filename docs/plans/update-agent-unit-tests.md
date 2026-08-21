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
| `update/service-update.ts` | Done | Pull → create-candidate → health-check → swap flow for one service. `docker.service.ts` and `pull-progress.ts` mocked at the module boundary via `vi.mock()`; `vi.resetAllMocks()` (not `clearAllMocks`) per test since several tests set `mockRejectedValue` implementations that must not leak. Covers no-running-container/already-up-to-date short circuits, pull failure propagation with progress cleanup, stale-candidate removal, failed health check with best-effort candidate cleanup, no-port-binding swap, port-binding recreate-after-freeing-port path, restore-previous-container-on-failure path, and best-effort cleanup + rethrow on unexpected failure. 9 tests. |
| `update/apply.service.ts` | Done | Orchestrates the full apply flow. `config/env.ts`, `manifest-state.ts`, `status.service.ts`, `self-update.service.ts`, and `service-update.ts` all mocked at the module boundary via `vi.mock()`; `mockEnv.dryRun` toggled per test. Covers dry-run simulation (fake timers, update-agent excluded, no side effects), skipping already-up-to-date services, update-agent never routed through `updateService`, recording the manifest + launching self-update only when nothing failed, withholding both on a failed service update, and the fire-and-forget self-update launch failure being caught and logged rather than thrown. 6 tests. |
| `update/apply.job.ts` | Done | In-memory job state machine wrapping `applyUpdates()`. `pull-progress.ts`, `status-poller.ts`, and `apply.service.ts` mocked via `vi.mock()`; `vi.resetModules()` + dynamic import per test since job state is module-level. Covers idle initial state, immediate transition to running with live pull-progress passthrough, refusing a second concurrent start, success/failure transitions (generic error message on failure, real error still logged), `refreshCachedStatus` firing in both cases, and starting a fresh run once the previous one finished. 6 tests. |
| `status/status.service.ts` | Done | Builds per-service update status from the manifest and running containers. `manifest.service.ts`, `manifest-state.ts`, and `docker.service.ts` mocked via `vi.mock()`. Covers the frontend/backend/update-agent status entries (image match/mismatch, `currentImage: null` when no container is running), returning an already-recorded version without self-healing, self-healing a missing recorded version once frontend+backend are up to date, withholding self-heal when either is behind, and self-heal still firing when update-agent itself is behind (excluded from the check). 7 tests. |
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
