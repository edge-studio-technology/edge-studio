# Backend Unit Tests Plan

**Status:** In Progress
**Created:** 2026-07-22
**Goal:** Build vitest unit test coverage across `backend/src/features/*`, one feature folder at a time. Prioritize security-critical and business-critical logic over exhaustive coverage — pure-logic and DB-backed service/repository behavior first, thin route wiring last (or skipped where it's just glue).

**Scope:** `backend/src/features/*` (see Progress table) plus `backend/src/shared/*` (cross-cutting, tracked as its own row below). Out of scope: `config/` (`env.ts`/`loadEnv.ts` — env parsing with no branching logic worth testing), `middleware/requestLogger.ts` (thin logging glue), `db/database.ts`/`db/ensureDatabaseDirectory.ts` (schema/migrations exercised indirectly by every DB-harness test; a dedicated migration test can be added later if migrations grow more complex than additive `CREATE TABLE IF NOT EXISTS`/`ALTER TABLE`).

## Conventions

- Test files live in `backend/tests/features/<feature>/<module>.test.ts`, mirroring `backend/src/features/<feature>/<module>.ts`.
- Use `node:assert/strict` + vitest's `describe`/`it` (not vitest's `expect`) — matches the pre-existing `minima.parse.test.ts`/`tokens.parse.test.ts`.
- Import source with the compiled `.js` extension (NodeNext ESM resolution), e.g. `../../../src/features/auth/password.service.js`.
- Pure-function modules (parsing, validation) need no setup.
- DB-backed modules (repositories, services that hit `db`) use `backend/tests/helpers/testDatabase.ts` — sets `DATABASE_PATH` to a unique temp file, dynamically imports `db/database.js` so the singleton binds to it, runs `runMigrations()`, and returns `{ db, teardown }`. Dependent modules (repository/service) must also be dynamically imported inside `beforeAll`, after the DB is set up, since they statically import the `db` singleton.
- Network-calling modules: mock at the boundary closest to the module under test, not further down the stack.
  - For the module that owns the actual `fetch` call (e.g. `minima.rpc.ts`), stub `global.fetch` with `vi.stubGlobal("fetch", vi.fn())` in `beforeEach`/`afterEach` (`vi.unstubAllGlobals()` after) — this exercises the module's own URL-building/parsing logic for real, only the network I/O is faked.
  - For modules one level up that *depend on* an already-tested lower module (e.g. `minima.service.ts` depends on `minima.rpc.ts`/`minima.docker.ts`), mock the dependency module itself with `vi.mock("<relative-path-from-the-test-file>.js", factory)`. Because `vi.mock` calls are hoisted above imports, any mock function referenced in the factory must be declared via `vi.hoisted(() => ({ ... }))` first, or you'll hit a "Cannot access before initialization" error.
  - Modules with module-level mutable state (e.g. `minima-monitoring.ts`'s in-memory snapshot) should `vi.resetModules()` and re-`import()` fresh in `beforeEach` so tests don't leak state into each other; this also gives a clean way to re-read `env` after changing `process.env` for a specific test (see `minima-poll.service.test.ts`'s `MINIMA_AUTO_RESYNC` toggle).
  - Time-dependent logic (cooldowns, expiry) uses `vi.useFakeTimers()` + `vi.setSystemTime()`, restored with `vi.useRealTimers()` in `afterEach`.
- Routes (`*.routes.ts`) are **not** unit-tested directly. Decision: treat them as thin wiring — pull input off `req`, call an already-tested service function, map the result/error to a response — and consider service/repository coverage sufficient. Revisit for a specific route only if it grows real logic beyond that. See "Future Hardening" for the gap this leaves.

## Progress

| Feature | Status | Notes |
|---|---|---|
| `auth` | Done | Covered: `password.service.ts`, `session.service.ts`, `auth.service.ts` (`login`/`changePassword`), `auth.repository.ts` setup-pending lifecycle, `audit.service.ts`, `auth.middleware.ts` (`requireAuth`/`requireRole`), `setup.service.ts` (admin-creation/setup-complete state machine, `completeSetup`, guarded TOTP error paths). Deliberately skipped: `totp.service.ts` (dead code, `TOTP_ENABLED = false`) and the happy-path "valid TOTP code" branches of `verifySetupTotp`/`initSetupTotp` (same reason — not worth the investment). Also skipped: `rate-limit.middleware.ts` (trivial `express-rate-limit` config, no logic) and `integritas-validation.service.ts` (fully commented out, no live exports). `auth.routes.ts`/`setup.routes.ts` intentionally out of scope — see the routes decision above and "Future Hardening" below. |
| `minima` | Done | Covered: `minima.parse.ts` (pre-existing), `minima.errors.ts` (pure), `minima.rpc.ts` (global `fetch` stubbed via `vi.stubGlobal` — established the network-mocking pattern), `minima-monitoring.ts` (stall detection, cooldown via `vi.useFakeTimers`/`vi.setSystemTime`, snapshot state via `vi.resetModules()` per test), `minima.docker.ts` (`getMinimaContainerStats` with `../status/docker.service.js` mocked via `vi.mock`, `getMinimaStorageInfo` pure), `minima.service.ts` (full orchestration — `getMinimaNodeStatus`'s state derivation, block/peers fallback-and-failure paths, config, peers/wallet/resync/restart — with `minima.rpc.js`/`minima.docker.js`/`status/docker.control.js` mocked via `vi.mock`+`vi.hoisted`, DB harness for settings), `minima-poll.service.ts` (`pollMinimaHealth`'s concurrency guard, stall/no-stall, auto-resync gate/cooldown/success/failure — mocking `minima.service.js`/`minima-monitoring.js`, `vi.resetModules()` + `process.env.MINIMA_AUTO_RESYNC` to flip `env` per describe block). Not covered: `minima.routes.ts` — out of scope per the routes decision above. |
| `tokens` | Done | Covered: `tokens.parse.ts` (pre-existing), `tokens.repository.ts` (DB harness), `tokens.service.ts` (`wallet.service.js`/`minima.rpc.js` mocked via `vi.mock`+`vi.hoisted`; validation, insufficient-balance short-circuit, RPC failure, Minima error mapping, create+dedupe, `listWalletTokens` merge/fallback). `tokens.routes.ts` intentionally out of scope. |
| `automation` | Not started | `automation.validation.ts` (323 lines, pure When/Condition/Then rule validation) is the highest-value/lowest-friction next target — no DB/network. `automation.service.ts`/`automation.repository.ts`/`automationRuns.repository.ts` need the DB harness. |
| `wallet` | Not started | `wallet.parse.ts` is a pure-function module, same shape as `minima.parse.ts`/`tokens.parse.ts` — cheap next target. `wallet.service.ts` likely needs Minima RPC mocking. |
| `data-reads` | Not started | `dataReads.repository.ts`/`dataReads.service.ts` — DB harness, similar shape to `automationRuns.repository.ts`. |
| `data-sources` | Not started | `dataSources.service.ts`/`dataSources.repository.ts` need the DB harness; `gpioIngestion.service.ts`/`gpioOutput.service.ts`/`mqttIngestion.service.ts`/`mqttOutput.service.ts`/`cameraCapture.service.ts`/`sensorHelper.service.ts` need hardware/MQTT/host-helper mocking — lower priority. |
| `integritas` | Not started | `integritas.service.ts`/`integritas.repository.ts` need DB harness + HTTP client mocking; `integritas-poll.service.ts` similar. |
| `integritas-auth` | Not started | `integritas-auth-crypto.service.ts` is small and pure — cheap target. Rest needs HTTP/device-identity mocking. |
| `settings` | Not started | `secrets.service.ts`/`settings.repository.ts` — DB harness. |
| `status` | Not started | `docker.control.ts`/`docker.service.ts` need Docker-socket mocking; `device.service.ts` may be simpler — check before scoping. |
| `address-book` | Not started | `address-book.repository.ts` — DB harness. |
| `feedback` | Not started | `feedback.service.ts` (339 lines) — check for DB/network dependencies before scoping. `feedback.remote.ts` (hosted-delivery HTTP client) needs `fetch` mocking, same pattern as `minima.rpc.ts`. |
| `files` | Not started | `files.service.ts` — host filesystem access, needs a fixture/sandbox strategy. |
| `debug`, `health` | Not started | Thin route wiring — likely low priority, may skip. |
| `shared` | Not started | Cross-cutting, not feature-scoped, but in scope for this plan. `crypto.ts` (`encryptSecret`/`decryptSecret`, `APP_SECRET`-keyed — security-critical, used by Integritas token storage and Minima backup password) is the highest-priority target. `list-query.ts`, `minima-address.ts`, `format.ts` are pure-function modules, cheap to cover. `api-error.ts`/`structured-error.ts` are mostly shape/mapping helpers — check for real branching logic before scoping. `http.ts` needs `fetch` mocking if it owns request logic. |

## Future Hardening

Routes are deliberately unit-test-free (see the decision above), which means nothing today directly verifies HTTP-layer-only behavior: per-route input guards (e.g. `typeof req.body?.password === "string" ? ... : ""`), error-to-status-code mapping in each route's `catch` block, cookie serialization (`res.cookie(name, token, sessionCookieOptions())`), and — the one that actually matters for security — that `requireAuth`/`requireRole` are wired onto the right routes in `app.ts`. A route unit test would catch these; a service test structurally cannot.

Considered and rejected for now: full supertest coverage per route file (`*.routes.test.ts` mirroring every route module) — high cost (new `supertest` dependency, real middleware stack per request, `authRateLimiter`'s in-memory 5-req/15min limiter needs a reset/mock strategy to avoid tests 429ing each other) for low marginal value once handlers stay thin.

Cheaper alternative, not yet started: a single supertest-based smoke test that walks `app.ts`'s route table and asserts every non-public `/api/*` route returns 401 without a session cookie (public routes per `backend.md`: `GET /api/health`, `GET /api/setup/status`, `POST /api/setup/*`, `POST /api/auth/login`). Written once, catches the one failure mode — a route missing `requireAuth` — that matters most, without turning every route file into an integration-test target.

## Verification

- `npm --prefix backend run test` (vitest)
- `npm --prefix backend run typecheck`

Keep this file updated as work progresses — flip rows to Partial/Done and resolve Open Questions as decisions are made.
