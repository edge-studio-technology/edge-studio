# Lint CI Pipeline Plan

**Status:** Not started
**Created:** 2026-10-13
**Branch:** `task/524-lint-ci-pipeline`
**Goal:** Add TypeScript-aware ESLint to `backend`, `frontend`, and `update-agent`, run it from a root `npm run lint`, and make it part of `npm run check` so CI runs it.

## Progress

- [ ] Tooling 1: root ESLint deps + shared `eslint.config.mjs`
- [ ] Tooling 2: `lint` script in each package
- [ ] Tooling 3: root `lint` script, wired into `check`
- [ ] Baseline: run lint, record violation counts per package/rule
- [ ] Cleanup: fix or deliberately suppress every existing violation
- [ ] Docs
- [ ] Verification

## Context

[OpenProject #524](https://openproject.privateprivate.org/work_packages/524), "Lint CI Pipeline", is a task under #364 "Automated Testing & CI". The ticket has no comments.

Acceptance criteria (ticket custom field):

- ESLint config added for `backend`, `frontend`, `update-agent` (consistent rules, TS-aware)
- `lint` script added to each subpackage `package.json`
- Root `npm run lint` runs all three
- Root `npm run check` includes lint
- CI (`check-dev.yml`, `check-main.yml`) runs lint via `npm run check`, no separate job needed
- Existing codebase passes lint clean (or pre-existing violations fixed/suppressed deliberately, not globally disabled)
- `.claude/rules/verification.md` updated to include lint command

Current state:

- No ESLint install, config, or script anywhere. Root `devDependencies` already has `eslint-config-prettier` (added with the Prettier setup) but nothing uses it.
- Root `check` is `typecheck && test:coverage && audit:moderate`. Both CI workflows run `npm install` (root `postinstall` installs all three packages) then `npm run check`, so no workflow edits are needed.
- Each package has its own `node_modules` and `package-lock.json`; root `package.json` holds shared dev tooling (`prettier`, `vitest`, `concurrently`).
- All three packages are ESM (`"type": "module"`), TypeScript 5.9.3, `strict: true`. `frontend` is React + Vite (`jsx: react-jsx`); `backend`/`update-agent` are Node (`NodeNext`).
- About 700 `.ts`/`.tsx` files across the three packages' `src` and `tests`. `update-agent/public/app.js` is plain browser JS served by the update page.
- Four existing `eslint-disable` comments reference `react-hooks/exhaustive-deps` (3, frontend) and `@typescript-eslint/no-explicit-any` (1, backend test). Those plugins must be loaded or ESLint reports "rule not found" on them.

Decisions:

- **One shared root config.** `eslint.config.mjs` at the repo root, with `eslint` and plugins in root `devDependencies` next to `prettier` and `eslint-config-prettier`. Each package's `lint` script runs `eslint .`, and ESLint finds the root config by walking up from the package dir. This gives one rule set for all three packages, as the ticket asks. Rejected: a config and deps in each package, which means three copies of the rules kept in sync by hand.
- **Non-type-checked rules.** `typescript-eslint`'s `recommended` (parser + TS rules, no type information). It meets "TS-aware" without a `parserOptions.project` setup across three tsconfigs or the slower type-aware run. Type-checked rules (`no-floating-promises`, `no-misused-promises`) are a possible follow-up.
- **React: hooks rules only.** `eslint-plugin-react-hooks` `rules-of-hooks` and `exhaustive-deps` for `frontend`, matching the existing disable comments. No `react-refresh` or other React plugins.
- **Prettier owns formatting.** `eslint-config-prettier` goes last in the config to turn off stylistic rules. Lint does not run Prettier.
- **Warnings fail the build.** Scripts use `--max-warnings=0`, so a warning can't pile up unnoticed in CI.
- **Scope is the three packages.** Root `scripts/` (`.mjs` release scripts, `scripts/tests`), `camera-helper`, `sensor-helper`, and `host-agent` are out of scope.

Known limitation: `audit:moderate` audits the three packages only, not root `devDependencies`, so the new ESLint deps aren't covered by the audit in `check`. Not changed here.

## Tooling changes

1. Root `package.json` `devDependencies`: add `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `globals`. Use the newest versions that are compatible with each other (`typescript-eslint` and `react-hooks` peer ranges on `eslint`), and the TS 5.9 range for `typescript-eslint`.
2. New root `eslint.config.mjs` (flat config):
   - Global ignores: `**/node_modules`, `**/dist`, `**/coverage`.
   - Base: `@eslint/js` `recommended` + `typescript-eslint` `recommended` for `**/*.{ts,tsx}`.
   - `backend/**`, `update-agent/src/**`, `update-agent/tests/**`: `globals.node`.
   - `frontend/**`: `globals.browser`, `react-hooks` `rules-of-hooks` (error) and `exhaustive-deps` (warn, which fails via `--max-warnings=0`).
   - `update-agent/public/**/*.js`: `globals.browser`, JS rules only.
   - Package-root config files (`vite.config.ts`, `vitest.config.ts`): `globals.node`.
   - `eslint-config-prettier` last.
   - `linterOptions.reportUnusedDisableDirectives: "error"`, so stale disable comments fail too.
3. `backend`, `frontend`, `update-agent` `package.json`: `"lint": "eslint . --max-warnings=0"`. Confirm `npm --prefix <pkg> run lint` resolves the root `eslint` binary (npm adds ancestor `node_modules/.bin` to `PATH`) and the root config. If it doesn't, call it as `eslint --config ../eslint.config.mjs`.
4. Root `package.json`:
   - `"lint": "npm --prefix backend run lint && npm --prefix frontend run lint && npm --prefix update-agent run lint"` (same shape as `typecheck`).
   - `"check": "npm run lint && npm run typecheck && npm run test:coverage && npm run audit:moderate"`. Lint goes first because it's the fastest to fail.
5. No edits to `.github/workflows/check-dev.yml` / `check-main.yml`; confirm they still run only `npm install` + `npm run check`.

## Existing-violation cleanup

1. Baseline: run `npm run lint` and record counts per package and per rule in this doc before fixing anything.
2. Fix mechanical violations (unused vars/imports, `prefer-const`, etc.) directly. Keep each fix behavior-neutral and don't refactor nearby code.
3. Where a violation is intentional, use a line-level `// eslint-disable-next-line <rule> -- <reason>`. No file-wide or global rule disables.
4. If one rule produces a large, mostly-intentional volume (e.g. `no-explicit-any` in test mocks, or `exhaustive-deps` across many components), stop and agree with the user whether to fix, line-suppress, or scope that rule (e.g. off for `**/tests/**`) before going further. A narrow scoped override is a deliberate config decision; a global disable is not allowed.
5. Behavior-affecting fixes (e.g. adding a missing hook dependency changes when an effect runs) are listed here and covered by existing or new tests, not slipped in as lint cleanup.

## Docs

- `.claude/rules/verification.md`, `.agents/rules/verification.md`, `.cursor/rules/verification.mdc`: add `npm run lint` (kept identical per the sync notice).
- `README.md` development/check section (~line 535): mention `npm run lint` and that `npm run check` includes it.
- `CHANGELOG.md` under `## [Unreleased] task/524-lint-ci-pipeline`, `Added`: ESLint for all three packages via `npm run lint`, run as part of `npm run check` and CI.
- `docs/TASKS.md` / `docs/SESSION.md` via `session-notes` when done.
- No ADR: the decisions above are tooling choices with no runtime or security impact, and this doc records them.
- No `SECURITY.md` change (dev-only tooling, no runtime exposure).

## Verification

- `npm run lint` passes clean from the repo root; each `npm --prefix <pkg> run lint` passes on its own.
- Negative check: temporarily add an unused variable in each package, plus a conditional hook call in `frontend`, and confirm lint fails (and so does `npm run check`), then revert.
- The four existing `eslint-disable` comments raise no "rule not found" or "unused directive" errors.
- Fresh-install check: `rm -rf node_modules */node_modules && npm install && npm run check` (mirrors CI).
- `npm run check`, `npm --prefix backend run build`, `npm --prefix frontend run build`, `docker compose config`. Docker builds are not affected (no lint in the Dockerfiles, and the new deps are root-only), so `docker compose build` is optional.
- `git status --short --untracked-files=all` before committing.
- After pushing: confirm the PR's `Check (dev)` run shows the lint output.
