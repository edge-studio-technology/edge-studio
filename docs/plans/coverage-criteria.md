# Coverage Criteria Plan

**Status:** In Progress
**Created:** 2026-09-01
**Goal:** Define a concrete, enforced way to know when backend/frontend/update-agent unit test coverage is "enough," now that `@vitest/coverage-v8` is wired into all three packages.

## Context

`backend-unit-tests.md`/`frontend-unit-tests.md`/`update-agent-unit-tests.md` already track completeness per feature/module via a Progress table (Done/Partial/Skipped + notes on what's covered and why anything is excluded). That stays the primary signal for "is this module tested" — it's qualitative and already forces a written reason for every gap.

What was missing: a way to know the suite as a whole isn't quietly regressing, and a number to point at instead of re-deriving "how much of the app is tested" by hand each time (see this session's earlier manual file-by-file audit). Raw coverage % isn't a good target on its own here: `*.routes.ts`, `*.types.ts`, bootstrap (`index.ts`/`app.ts`), and `config/*` are deliberate, already-documented non-goals (see each plan's "Out of scope" line and the routes decision in `backend-unit-tests.md`), and counting them drags every package's number down without meaning anything — first full run showed backend at a misleading 56.7% lines.

Rejected alternative: a single global % target (e.g. "80% everywhere"). Rejected because it would either force testing thin wiring that adds no value (routes, types) or get gamed by excluding real gaps (the `data-sources` hardware services, `minima-backup*`/`minima-console*`) alongside legitimate ones. Scoping the denominator to in-scope files only, then setting a floor, keeps the number meaningful.

## Criteria (two tiers)

1. **Scope-based completion (primary).** A feature/module is "done" when its Progress-table row in `backend-unit-tests.md`/`frontend-unit-tests.md`/`update-agent-unit-tests.md` says Done, with a one-line reason for every Skipped/out-of-scope file. This is unchanged — it's how "correct/useful" gets judged, not just "how much."
2. **Numeric floor (regression guard, not a target).** Each package's `vitest.config.ts`/`vite.config.ts` now has `coverage.exclude` matching that package's already-documented out-of-scope files, plus `coverage.thresholds` set a few points below the current in-scope achieved number. `npm run test:coverage` (and `npm run check`, which now calls it) fails the build if coverage drops below the floor. It is not meant to be chased upward for its own sake — see Known Gaps below for where the number should legitimately rise as a side effect of closing real gaps, not by testing routes/types to inflate it.

### Current in-scope numbers vs. floor

| Package | In-scope lines (2026-09-01) | Threshold floor (lines) |
|---|---|---|
| backend | 78.09% | 75% |
| frontend | 90.91% | 88% |
| update-agent | 99.09% | 96% |

Statements/branches/functions floors are set the same way (a few points below measured); see each `coverage.thresholds` block.

## Quality bar (already implicit in the existing plans' Conventions sections, consolidated here)

- Mock at the real I/O boundary the module owns (`global.fetch`, `node:http`, the DB harness) — not the module under test itself.
- Cover error/branch paths, not just the happy path — a passing assert on every branch a `Partial`/`Done` row claims to cover.
- Time-dependent logic uses `vi.useFakeTimers()`/`vi.setSystemTime()`, restored in `afterEach`.
- No lingering `.skip`/`.todo` tests committed — a skipped test is a gap, tracked as Partial in the Progress table instead.
- One test file mirrors one source file (existing `backend/tests/features/<feature>/<module>.test.ts` / `frontend/tests/.../<Component>.test.tsx` layout).

## Known gaps (why backend's floor is lower, and what closes them)

- `data-sources`: `gpioIngestion`/`gpioOutput`/`mqttIngestion`/`mqttOutput`/`cameraCapture`/`sensorHelper` services are untested (hardware/MQTT/host-helper boundaries) — already flagged `Partial` in `backend-unit-tests.md`.
- `minima-backup.service.ts`, `minima-backup-scheduler.service.ts`, `minima-console.service.ts`, `minima-console.catalog.ts` are untested and **not yet tracked** in `backend-unit-tests.md`'s Progress table at all (added after that plan's last update) — these are security-sensitive per `.claude/rules/minima.md` (backup password encryption, console whitelist hard-exclusions) and should be prioritized ahead of the hardware services above.
- `totp.service.ts` is partial (64%) — already a documented, deliberate skip (dead code, `TOTP_ENABLED = false`).
- Routes stay permanently excluded from coverage (thin wiring, per the routes decision) rather than closed. The cheap alternative already proposed in `backend-unit-tests.md`'s "Future Hardening" — one supertest smoke test asserting every non-public route 401s without a session — is still the right way to catch the one failure mode that matters (`requireAuth` missing from a route) without turning every route into a test target. Not built yet.

## Changes made this session

- Added `coverage.exclude` (matching each plan's documented out-of-scope files) and `coverage.thresholds` to `backend/vitest.config.ts`, `frontend/vite.config.ts`, `update-agent/vitest.config.ts`.
- Root `package.json`: `check` now runs `test:coverage` (threshold-enforced) instead of plain `test`; `typecheck`/`test`/`audit:moderate` now include `update-agent` (previously silently skipped by root `test`/`check`, so its suite/typecheck/audit were never actually gated by `npm run check`).

## Follow-up (not done yet)

- Add Progress rows for `minima-backup*`/`minima-console*` to `backend-unit-tests.md` and write their tests; this is real, prioritized work, not just documentation.
- Once those land, revisit the backend threshold floor upward to lock in the gain.
- Decide whether to build the supertest 401-smoke-test from `backend-unit-tests.md`'s "Future Hardening".
- `.claude/rules/verification.md` (and `.agents/`/`.cursor/` counterparts) still list `npm --prefix backend run build`/`npm --prefix frontend run build` without an `update-agent` build step — separate pre-existing gap, out of scope here, flagged for a future pass.

## Docs

- `docs/TASKS.md` — add an In Progress line pointing here.
- `backend-unit-tests.md` — add the missing `minima-backup*`/`minima-console*` rows next time that plan is picked up.

## Verification

- `npm run check` (root) — typecheck, threshold-enforced `test:coverage` across all three packages, `audit:moderate`.
- `npm --prefix backend run test:coverage` / `npm --prefix frontend run test:coverage` / `npm --prefix update-agent run test:coverage` individually.
