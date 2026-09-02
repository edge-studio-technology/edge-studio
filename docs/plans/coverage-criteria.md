# Coverage Criteria Plan

**Status:** In Progress
**Created:** 2026-09-01
**Goal:** Define a concrete, enforced way to know when backend/frontend/update-agent unit test coverage is "enough," now that `@vitest/coverage-v8` is wired into all three packages.

The durable policy this plan rolls out — target tiers (60% floor / 70-80% general / 90% high-risk) and the "useful test" quality bar — now lives in `.claude/rules/testing.md` (synced to `.agents/rules/testing.md`/`.cursor/rules/testing.mdc`). This doc tracks the current per-package numbers, exclude lists, and open gaps against that policy; once the gaps below are closed it can be archived like `backend-unit-tests.md`'s siblings.

## Context

`backend-unit-tests.md`/`frontend-unit-tests.md`/`update-agent-unit-tests.md` already track completeness per feature/module via a Progress table (Done/Partial/Skipped + notes on what's covered and why anything is excluded). That stays the primary signal for "is this module tested" — it's qualitative and already forces a written reason for every gap.

What was missing: a way to know the suite as a whole isn't quietly regressing, and a number to point at instead of re-deriving "how much of the app is tested" by hand each time (see this session's earlier manual file-by-file audit). Raw coverage % isn't a good target on its own here: `*.routes.ts`, `*.types.ts`, bootstrap (`index.ts`/`app.ts`), and `config/*` are deliberate, already-documented non-goals (see each plan's "Out of scope" line and the routes decision in `backend-unit-tests.md`), and counting them drags every package's number down without meaning anything — first full run showed backend at a misleading 56.7% lines.

Rejected alternative: a single global % target (e.g. "80% everywhere"). Rejected because it would either force testing thin wiring that adds no value (routes, types) or get gamed by excluding real gaps (the `data-sources` hardware services, `minima-backup*`/`minima-console*`) alongside legitimate ones. Scoping the denominator to in-scope files only, then setting a floor, keeps the number meaningful.

## Criteria (two tiers)

1. **Scope-based completion (primary).** A feature/module is "done" when its Progress-table row in `backend-unit-tests.md`/`frontend-unit-tests.md`/`update-agent-unit-tests.md` says Done, with a one-line reason for every Skipped/out-of-scope file. This is unchanged — it's how "correct/useful" gets judged, not just "how much."
2. **Numeric floor (regression guard, not a target).** Each package's `vitest.config.ts`/`vite.config.ts` now has `coverage.exclude` matching that package's already-documented out-of-scope files, plus `coverage.thresholds` set a few points below the current in-scope achieved number. `npm run test:coverage` (and `npm run check`, which now calls it) fails the build if coverage drops below the floor. It is not meant to be chased upward for its own sake — see Known Gaps below for where the number should legitimately rise as a side effect of closing real gaps, not by testing routes/types to inflate it.

### Current in-scope numbers vs. floor

| Package | In-scope lines (2026-09-02) | Threshold floor (lines) |
|---|---|---|
| backend | 92% | 81% |
| frontend | 90.91% | 88% |
| update-agent | 99.09% | 96% |

Backend rose 78.09% → 84.21% after `minima-backup*`/`minima-console*` got test coverage (floor raised 75%→81% to lock that in), then 84.21% → 92% after the `data-sources` hardware services below got covered too. Floor is still 81% — see Follow-up.

Statements/branches/functions floors are set the same way (a few points below measured); see each `coverage.thresholds` block.

## Quality bar (already implicit in the existing plans' Conventions sections, consolidated here)

- Mock at the real I/O boundary the module owns (`global.fetch`, `node:http`, the DB harness) — not the module under test itself.
- Cover error/branch paths, not just the happy path — a passing assert on every branch a `Partial`/`Done` row claims to cover.
- Time-dependent logic uses `vi.useFakeTimers()`/`vi.setSystemTime()`, restored in `afterEach`.
- No lingering `.skip`/`.todo` tests committed — a skipped test is a gap, tracked as Partial in the Progress table instead.
- One test file mirrors one source file (existing `backend/tests/features/<feature>/<module>.test.ts` / `frontend/tests/.../<Component>.test.tsx` layout).

## Known gaps (why backend's floor is lower, and what closes them)

- `totp.service.ts` is partial (64%) — already a documented, deliberate skip (dead code, `TOTP_ENABLED = false`).
- Routes stay permanently excluded from coverage (thin wiring, per the routes decision) rather than closed. The cheap alternative proposed in `archive/backend-unit-tests.md`'s "Future Hardening" — a supertest smoke test asserting every non-public route 401s without a session — is now built: `backend/tests/app.401-smoke.test.ts`.

## Changes made this session

- Added `coverage.exclude` (matching each plan's documented out-of-scope files) and `coverage.thresholds` to `backend/vitest.config.ts`, `frontend/vite.config.ts`, `update-agent/vitest.config.ts`.
- Root `package.json`: `check` now runs `test:coverage` (threshold-enforced) instead of plain `test`; `typecheck`/`test`/`audit:moderate` now include `update-agent` (previously silently skipped by root `test`/`check`, so its suite/typecheck/audit were never actually gated by `npm run check`).

## Follow-up (not done yet)

- `data-sources` hardware services now have tests (backend rose 84.21% → 92% lines) — revisit the backend threshold floor upward again (currently 81%) to lock in this gain too.
- `.claude/rules/verification.md` (and `.agents/`/`.cursor/` counterparts) still list `npm --prefix backend run build`/`npm --prefix frontend run build` without an `update-agent` build step — separate pre-existing gap, out of scope here, flagged for a future pass.

## Docs

- `docs/TASKS.md` — add an In Progress line pointing here.

## Verification

- `npm run check` (root) — typecheck, threshold-enforced `test:coverage` across all three packages, `audit:moderate`.
- `npm --prefix backend run test:coverage` / `npm --prefix frontend run test:coverage` / `npm --prefix update-agent run test:coverage` individually.
