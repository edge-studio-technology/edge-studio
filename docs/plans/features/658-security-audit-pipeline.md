# Security Audit Pipeline on Release Candidates Plan

**Status:** Blocked — waiting on the pre-sprint blockers below
**Created:** 2026-10-16
**Goal:** Every `dev` → `main` release-candidate PR gets a read-only Codex Security scan of its diff, with findings kept private, alongside the free GitHub security tools (CodeQL, Dependabot, secret scanning).

## Progress

- [ ] Blockers cleared (see Blockers)
- [ ] GitHub settings: secret scanning + push protection, Dependabot alerts + security updates
- [ ] GitHub settings: protect `dev`, turn on CodeQL default setup
- [ ] .github/dependabot.yml (new)
- [ ] .github/workflows/security-audit.yml (new)
- [ ] Private report route wired and checked for public leakage
- [ ] Test runs (planted issue, docs-only skip, forced incomplete)
- [ ] Manual baseline scan run and findings triaged into tickets
- [ ] Docs
- [ ] Verification
- [ ] Pilot over 3 release candidates, decision recorded in the ADR

## Blockers

These need to be settled before the workflow work starts:

- [ ] **OpenAI account:** company-owned OpenAI account with billing, and Codex Security access confirmed. Use a dedicated project in it so it can have its own monthly spend limit and alert.
- [ ] **Product owner sign-off:** OK to send release-candidate diffs to OpenAI. The repo is already public, so the risk is low.
- [ ] **Private report route:** decide where the full findings go. Options are SARIF to the Security tab, a private repo, or an encrypted artifact. Actions logs and artifacts are public on this repo. SARIF upload needs `security-events: write` (more than `contents: read`), and code scanning can show alerts as PR check annotations. Confirm the chosen route does neither in a way the public can see.
- [ ] **Findings owner:** a named person who triages findings.

Not blocked, can go ahead before the blockers clear: secret scanning + push protection, Dependabot (settings + `dependabot.yml`), and CodeQL default setup (needs `dev` protected).

## Context

- Research and recommendation are in OpenProject #656. #657 (coverage and exit criteria) is merged into this ticket. Docker image and shell script scanning are #894. Parent feature: #274.
- `require-dev-to-main.yml` already makes every PR into `main` a `dev` → `main` release candidate, so `pull_request` on `main` is the trigger. The head branch is in the same repo (not a fork), so repo secrets are available without `pull_request_target`.
- `npm run audit:moderate` already runs in `npm run check` (both `check-dev.yml` and `check-main.yml`). Leave it as it is. Dependabot adds alerts and update PRs on top.
- The AI review covers only the diff. Static analysis, dependencies, and secrets are left to CodeQL, Dependabot, and secret scanning.
- Out of scope: fixing findings (one ticket each), Docker image/shell scanning (#894), Codex Security cloud/hosted PR review, paid tools (Snyk, Claude Security), SHA-pinning the existing workflows' actions, and buying licences.

## GitHub settings (manual, repo admin)

- Settings → Code security: turn on secret scanning, push protection, Dependabot alerts, and Dependabot security updates.
- Branch protection/ruleset for `dev`. CodeQL default setup only scans PRs into the default branch and protected branches.
- Code security → CodeQL → default setup.
- Repo secret `CODEX_SECURITY_API_KEY` (once the OpenAI account exists).
- Monthly spend limit and alert on the dedicated OpenAI project.

## Repo changes

### .github/dependabot.yml (new)

- `npm` for `/`, `/backend`, `/frontend`, `/update-agent`.
- `github-actions` for `/`.
- `docker` for each Dockerfile directory (`backend/`, `frontend/`, `update-agent/`, plus any others found under `**/Dockerfile`).
- `target-branch: dev` on every entry.

### .github/workflows/security-audit.yml (new)

Base it on OpenAI's official Codex Security Actions workflow (`@openai/codex-security` CLI). Check every flag below against the CLI's current docs before writing it.

- Triggers: `pull_request` on `branches: [main]` with `paths-ignore` for `docs/**`, `**/*.md`, images/assets, and lockfiles. Plus `workflow_dispatch` for the full baseline scan. Never `pull_request_target`.
- `permissions: contents: read` at workflow level. Widen only if the chosen report route needs it (for example `security-events: write` for SARIF), on that step's job only.
- `concurrency: { group: security-audit-${{ github.event.pull_request.number || github.run_id }}, cancel-in-progress: true }`.
- `runs-on: ubuntu-latest`, `timeout-minutes: 30` (the hard stop).
- Every action pinned to a commit SHA, with a version comment.
- Scan scope: diff `main`..`dev` on PRs, whole repo on `workflow_dispatch`. Paths: `backend/`, `frontend/`, `update-agent/`, `install.sh`, `bin/`, `scripts/`, `docker-compose.yml`, `**/Dockerfile`, nginx config, `.github/workflows/`.
- `--knowledge-base` with `SECURITY.md`, `docs/security/`, `docs/adr/`.
- `--max-cost` set low, tuned after the pilot.
- `OPENAI_API_KEY: ${{ secrets.CODEX_SECURITY_API_KEY }}` on the scan step only. No other secrets in this workflow (`MANIFEST_SIGNING_KEY` and the other release secrets stay in `release.yml`).
- Result step writes only the state (`clean` / `findings` / `incomplete`) and finding counts to `$GITHUB_STEP_SUMMARY`. Timeout, budget hit, or error → `incomplete`, never `clean`. Use `if: always()` so a failed scan still reports `incomplete`.
- No `--fail-on-severity` during the pilot (not merge-blocking). No PR comments, no auto-fix.
- Full report goes only to the private route chosen under Blockers.

## Docs

- New ADR (via the `adr` skill, next free number): report route, scan scope, limits (timeout, cost, monthly budget), and later the pilot results and merge-blocking decision.
- `SECURITY.md` and `docs/security/host-and-infrastructure.md` (or a new `docs/security/` page if that fits better): what code leaves the runner, to whom, and who can see the findings.
- `CHANGELOG.md` under `## [Unreleased] dev-task/658-security-audit-pipeline-on-release-candidates-codex-security-baseline-tools`: the new security audit workflow and Dependabot config.
- `docs/TASKS.md`: Next items for the pilot review and the merge-blocking decision once the workflow is merged.

## Verification

- `npm run lint` (includes `lint:docs`), `npm run check`.
- Validate the workflow YAML (`actionlint` if available).
- Test PR to `main` with a harmless planted issue in a scanned path → reported through the private route only; nothing in logs, summary, artifacts, or annotations. Close without merging.
- Docs-only PR → scan skipped.
- Very low `--max-cost` or `timeout-minutes` → run shows `incomplete`.
- Push twice to the same PR → the older run is cancelled.
- `workflow_dispatch` baseline scan → triage findings into tickets.
- Dependabot opens PRs against `dev`; CodeQL runs on PRs to `dev` and `main`.
- `git status --short --untracked-files=all` before committing.
- Pilot: next 3 release candidates (or 4 weeks). Record per run: cost, runtime, confirmed findings, false positives, findings the GitHub tools missed. Then decide keep/adjust/drop and merge-blocking.
