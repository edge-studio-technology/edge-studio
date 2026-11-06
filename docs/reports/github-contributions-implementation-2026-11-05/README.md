# GitHub Contributions implementation verification

**Date:** 2026-11-05
**Branch:** `github-contributions`
**Scope:** Local implementation and verification of the [contribution plan](../../plans/github-contributions.md), not completed public launch or independent hardware acceptance.

## Delivered in the branch

- Root [CONTRIBUTING.md](../../../CONTRIBUTING.md) explains public requests, private feedback/security reporting, contribution terms, source development, PR review and release.
- Four public issue forms and a chooser; PR template and maintainer triage/review guidance. Forms do not depend on new labels or assign individuals automatically.
- Three fixed GitHub links in the feedback dialog, independent of private feedback contents or hosted-feedback availability.
- Seven public guides: local/fork-to-Pi quickstart, architecture, devices/wizards/guides, workflow behaviour, review, optional AI skill and independent trial.
- Mirrored `edge-studio-contributor` skill; existing add-device-support guidance now points at the public journey and current alternate wizard/configuration owners.
- Native-development instructions corrected from port 5173 to the configured Vite port 3030; official signed-release defaults are unchanged.
- GitHub private vulnerability reporting was found disabled, enabled and read back as enabled. Public Issues were already enabled. Existing branch rulesets were inspected, not changed.

## Verification results

| Check | Result and limits |
| --- | --- |
| Feedback regression tests | All 13 passed, including fixed destinations, safe external-link attributes, no private values in links and no submission side effect |
| Full frontend suite/coverage | 190 files and 1,838 tests passed; line coverage 92.31% |
| Full check | Lint, docs, Knip and typechecking passed. Backend stopped at the existing Minima restore fallback assertion (HTTP 502 instead of 200); 1,494 backend tests passed. This is not a passing full check |
| Production builds | Backend, frontend and update-agent builds passed; normal frontend chunk-size warning remains |
| Package audits | Required backend/frontend/update-agent audits each reported zero vulnerabilities. Isolated fresh root installation reported ten moderate advisories; the root package is outside the existing audit script and needs separate review |
| Isolated installer route | Three behavioural tests passed: source-versus-runtime selection, source-mode manifest bypass versus official verification, and build/pull/updater/release-marker behaviour. No real host install was performed |
| Docs-checker regression tests | All 14 passed; repository docs/mirror check and diff whitespace checks passed |
| Issue forms | YAML parse and local checks passed for names/descriptions/fields, supported field types, unique IDs, required public-visibility acknowledgement and chooser configuration. Actual GitHub rendering is still pending default-branch publication |
| AI skill | Bundled skill-creator format validator passed. Relative public references and three mirrors checked. This does not establish automatic loading in every harness or a fresh independent harness trial |
| Browser preview | Hidden Chrome at 1440, 768 and 390 px showed three public links without horizontal overflow; zero runtime errors or API writes. Only synthetic feedback responses were used; no real submission was sent |
| Clean local setup | Isolated local clone plus implementation changes, no copied `.env`/`.env.local`, fresh `npm install`, backend/frontend build, and new native SQLite database. Changed frontend bundle contains the public-request UI; backend health and initial setup status returned 200 |
| Docker | Compose configuration passed with unset-image warnings for the development environment. Docker Desktop Linux daemon was unavailable after the permission retry; no container build or Pi deployment is claimed |

Browser evidence: [desktop](feedback-1440.png), [phone](feedback-390.png), [structured layout/link results](browser-results.json). The browser preview is an isolated rendering harness, not a production deployment or GitHub form-rendering trial.

## Remaining acceptance gates

1. Rights holders choose/publish project licensing and contribution terms. The guide explicitly retains that gate; no license, CLA or DCO was selected.
2. Maintainers accept ongoing triage/review/docs/skill ownership; no individual or response-time commitment was invented.
3. Merge/release forms and guides to default branch `main`, then check the real GitHub chooser/forms, public guide URLs and a non-developer walkthrough. Publishing only to a feature branch or `dev` does not complete this check.
4. A real external fork PR exercises CI, required approvals and human review without private credentials. Existing workflows remain read-only; no dummy public submission or ruleset relaxation was made to claim success.
5. Run the source-build and physical integration on an authorized disposable Pi, recording model/OS/commit and actual results. The existing team Pi was not used.
6. A fresh supported AI harness loads the skill and an independent contributor completes the documented trial. These cannot be replaced by format checks or the implementation author's own walkthrough.
7. Investigate the already-tracked Minima restore test failure and separately review root-package audit coverage/advisories.

No Module Builder runtime/marketplace was added, its branch was not merged and its tickets were not changed. New contribution tickets were not marked Done on the strength of local documentation/testing alone.
