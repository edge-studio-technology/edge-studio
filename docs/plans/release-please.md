# Release Please Adoption Plan

**Status:** Local implementation complete; GitHub activation pending
**Created:** 2026-11-06
**Goal:** Automate application versions, release notes and production tags while retaining contributions to `dev` and the signed release pipeline.

## Progress

- [x] Resolve the existing Minima restore regression-test failure: normalize the test's redirected backup root on Windows; all 18 route tests and all 1,495 backend tests now pass. Ubuntu CI remains the publication gate.

- [x] Configure one root application release starting after stable `v0.43.0`.
- [x] Add authenticated release automation and PR title/source checks with regression tests.
- [x] Document feature squash merges, production promotion, release approval and main-to-dev synchronization.
- [x] Update contributor/AI guidance and mirrored changelog/commit rules.
- [ ] Configure GitHub App credentials and repository rules; verify actual bot PR checks and a maintainer-approved release.
- [x] Docs: amend the release ADR, index the guide and record remaining activation work.
- [x] Verification: 29 policy/docs tests, upstream schema, actionlint, offline release generation, lint/Knip/typechecks, three builds and package audits pass. Full check stops at the pre-existing Minima restore test; see [verification](../reports/release-please-2026-11-06/README.md).

## Context

The team approved release-please and retained `dev` for both external and internal contributions. Module Builder remains deferred and untouched. Stable `v0.43.0` points to `d379d2e9265e108708cc3dd716bc802dec4ac721`; newer `v0.50.0-dev.*` tags are development builds, not the stable baseline. Root `package.json` is the app version; service package versions remain independent implementation metadata.

## Implementation

- Add `release-please-config.json` and `.release-please-manifest.json` for the root Node release, retaining `vX.Y.Z` tags and existing changelog history.
- Add `.github/workflows/release-please.yml` on main pushes using a dedicated GitHub App token. Do not fall back to GITHUB_TOKEN: its generated tags would not trigger the existing release workflow.
- Preserve `.github/workflows/release.yml` image, runtime, signing and manifest publication behavior.
- Extend `.github/workflows/require-dev-to-main.yml` only for same-repository release-please branches authored by the configured bot. Add a read-only Conventional PR title check and fixture tests in `scripts/tests/`.
- Keep feature PRs squash-only into `dev`. Promote `dev` to `main` with a merge commit; merge the generated release PR only after review. Bring `main` back into `dev` through a reviewed merge PR, preserving ancestry.

## Docs

Add a maintainer release guide, amend ADR 0007, and update CONTRIBUTING, PR template, review guide, README, TASKS, SESSION and all three mirrored commit/contributor skills and documenting-work rules. Generated release notes replace branch-specific manual changelog entries for new work; preserve existing unreleased notes for migration review.

## Verification

Test Conventional titles, promotion/sync exceptions, bot identity and same-repository checks, including hostile fork/ref/title inputs. Validate configuration against the upstream schema and workflows with actionlint where available. Run docs lint, script tests and relevant required checks. Inspect live rules without weakening them; stage settings changes until workflows exist on the target branches. Actual publication requires a maintainer-approved release PR and functioning App credentials; do not create a production tag as a test.
