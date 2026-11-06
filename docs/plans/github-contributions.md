# GitHub Contributions Plan

**Status:** In progress — forms, guides, review process and AI skill published on main; app links await operator release. Licensing/ownership, human form/external-fork checks, independent harness/contributor and physical Pi acceptance remain open.
**Created:** 2026-11-04  
**Branch:** `github-contributions`, created from the fetched `origin/dev`.  
**Goal:** Help users request improvements publicly, develop capabilities in their own repository copy, and contribute tested changes for the team to review and release.

## Progress

- [ ] 1. Agree contribution rules, public/private request handling and licensing/contribution terms (A1): CONTRIBUTING and review guidance implemented; rights-holder agreement and explicit ownership acceptance remain open.
- [x] 2. Provide approachable public GitHub issue forms (A2): four forms/chooser added and locally validated. Live rendering requires publication to default branch `main` and a user walkthrough.
- [x] 3. Link Edge Studio to public requests and contribution guidance (A3): fixed destinations, privacy regression and responsive browser checks pass; public guide/form availability follows release to `main`.
- [ ] 4. Define and verify community pull-request review and release handling (A4): PR template/process implemented and existing read-only workflows/rulesets inspected; real external-fork CI/review trial pending.
- [ ] 5. Verify and document development and fork-to-Pi setup (B1): clean local dependency install/build/backend health and isolated source-mode installer tests pass; physical disposable-Pi trial pending, Docker daemon unavailable locally.
- [x] 6. Publish a contributor architecture guide (B2): implemented in this branch with validated source links; public release pending.
- [x] 7. Publish complete hardware/device/wizard/guide integration recipes (B3): implemented with existing BME family trace and physical-evidence requirements; public release pending.
- [x] 8. Publish workflow block, execution and event integration recipes (B4): implemented with Fetch data source trace and validation/runtime/history boundaries; public release pending.
- [ ] 9. Provide a portable contribution AI skill backed by the public guides (B5): entry skill and mirrors implemented, format and references verified; a fresh supported-harness trial remains pending.
- [ ] 10. Prove the complete contribution journey with a new contributor (B6): trial checklist provided; no independent human or physical integration trial has taken place.
- [ ] Docs: public entry points and skill mirrors implemented; ownership/licensing notices must be finalized before launch.
- [ ] Verification: local privacy/browser/forms/skill/build/clean-checkout checks pass; external/hardware acceptance gates remain open.

**Implementation evidence:** [2026-11-05 verification record](../reports/github-contributions-implementation-2026-11-05/README.md). Checked items describe branch implementation, not completed public-launch or independent-contributor acceptance.

## Context and scope

Time constraints defer the Full Module Builder. Its plan/documentation stays on the `module-builder` branch for later retrieval, and its OpenProject epics [#1081](https://openproject.privateprivate.org/work_packages/1081) and [#1082](https://openproject.privateprivate.org/work_packages/1082) remain the future delivery backlog. This work does not merge that branch, replace those tickets, alter their status or implement its runtime.

The two contribution paths can coexist. This path changes Edge Studio source in a fork, with human review before inclusion in official releases. Future Module Builder adds independently installed packages. Documentation, examples and community knowledge may help both; existing source contributions are not automatically portable module packages and do not become installable modules through this plan.

Three user journeys are required:

1. A non-developer describes a problem or desired capability in a public GitHub issue; others can discover it and offer help.
2. A developer forks/clones Edge Studio, modifies it locally, builds and tests that modified version, and optionally runs it on a test Pi.
3. A contributor submits a pull request against the supported development branch; the team reviews it, requests changes or declines it, and releases accepted changes through the normal release process.

Private feedback remains private. Public issues contain deliberately submitted public information or a separately written, reviewed problem statement. There is no automatic publication of private submissions, diagnostic archives, personal information or secrets.

The core team accepts the review/release workload for this path. A submitted request is not a delivery commitment. Public GitHub issues/PRs are the community conversation and contribution record; OpenProject remains internal delivery planning, with manually linked records where useful. Do not build synchronization as part of this scope.

## Delivery backlog

**Created OpenProject records:** [Two epics, ten features and verified acceptance criteria](../reports/github-contributions-openproject-2026-11-04/README.md).

Two new epics are placed alongside the existing Module Builder epics in Integritas Team, tagged as Edge Studio and clearly named GitHub Contributions. The existing Module Builder bucket is the shared view requested for placement, not an implication that this work depends on Module Builder. Keep all new records New, unassigned and unscheduled; do not invent estimates or change existing tickets.

| Key | Epic / feature | Observable outcome |
| --- | --- | --- |
| [EA #1249](https://openproject.privateprivate.org/work_packages/1249) | GitHub Contributions: Let users request improvements and share fixes | People can express needs publicly and submit changes through a maintained review route |
| [A1 #1251](https://openproject.privateprivate.org/work_packages/1251) | Agree contribution rules and how public requests are handled | Contributors know scope, rights, privacy boundaries, triage and review expectations |
| [A2 #1252](https://openproject.privateprivate.org/work_packages/1252) | Give users simple forms for public requests | Non-developers can report bugs and request hardware, workflow or general improvements |
| [A3 #1257](https://openproject.privateprivate.org/work_packages/1257) | Link Edge Studio to public requests and contribution guides | Users can discover the public route from the app while retaining private feedback |
| [A4 #1258](https://openproject.privateprivate.org/work_packages/1258) | Review community changes and release accepted contributions | A fork PR can pass suitable CI, receive human review and enter a normal release |
| [EB #1250](https://openproject.privateprivate.org/work_packages/1250) | GitHub Contributions: Help people build and test new capabilities | Public documentation and AI guidance support complete source contributions |
| [B1 #1253](https://openproject.privateprivate.org/work_packages/1253) | Help contributors run their own version of Edge Studio | A clean fork can run locally and a modified build can be proven on a test Pi |
| [B2 #1254](https://openproject.privateprivate.org/work_packages/1254) | Explain how Edge Studio works for contributors | A public architecture map identifies component responsibilities and where changes belong |
| [B3 #1255](https://openproject.privateprivate.org/work_packages/1255) | Show how to add hardware, devices and setup guides | Contributors can complete hardware/backend/UI/wizard/guide changes together |
| [B4 #1256](https://openproject.privateprivate.org/work_packages/1256) | Show how to add workflow steps and logic | Contributors can add workflow behaviour without breaking execution/history/security rules |
| [B5 #1259](https://openproject.privateprivate.org/work_packages/1259) | Provide an AI skill that guides complete contributions | A supported AI harness can follow public docs, edit, verify and prepare a focused PR |
| [B6 #1260](https://openproject.privateprivate.org/work_packages/1260) | Prove a new contributor can complete a real integration | An independent contributor follows the complete public request-to-reviewed-PR journey |

### Existing work to coordinate

- [#690 — Contribution rules and style guide](https://openproject.privateprivate.org/work_packages/690): reuse existing conventions and remaining work in A1/A4; do not commission a second conflicting ruleset.
- [#692 — AI configs and skills](https://openproject.privateprivate.org/work_packages/692): coordinate B5's public packaging, discoverability and verification with the existing internal guidance work.
- [#618 — Contribution tab discovery](https://openproject.privateprivate.org/work_packages/618): reuse its entry-point investigation in A3; a new sidebar tab is not a requirement if a clear existing entry point suffices.
- [#953 — Legacy module submission/review](https://openproject.privateprivate.org/work_packages/953) concerns marketplace module publication, not source pull requests. It does not define this review process.

References do not reparent, close, reassign or change the scope/status of these existing tickets. New features coordinate public-facing outcomes; implementation should reuse already completed work.

## 1. Contribution policy and request handling — A1

Create a root CONTRIBUTING.md as the public starting point and a concise public review/triage guide under `docs/guides/`. Reuse `AGENTS.md`, the mirrored project rules and existing code conventions. Document accepted contribution types, small focused changes, branch/PR targets, review evidence and release expectations. Distinguish optional discussion for small changes from early agreement for large or architectural changes; do not require private OpenProject access.

Define public request states such as needs information, ready for contribution, in progress and released/closed, with a small label set and a named maintainer triage responsibility. Keep duplicates linked, explain decisions, and show what help a contributor or hardware owner can provide. Do not promise response times without an agreed owner/capacity.

Agree the project license and contributor rights/terms with the rights holders before actively launching public code contributions. No license is selected by this plan. Provide a separate private security-reporting route using `SECURITY.md`. Clarify the GitHub-account requirement for submitting issues/PRs and the difference between public posts and private app feedback.

Acceptance: a reader can determine where to report a bug, propose a feature, report a security concern, keep a local fork or submit a PR; public launch has agreed licensing/terms and triage/review owners.

## 2. Public issue forms — A2

Add proposed files under .github/ISSUE_TEMPLATE/: `bug-report.yml`, `device-support.yml`, `workflow-request.yml`, `improvement.yml` and `config.yml`. Use GitHub's native forms rather than a custom submission backend. Validate forms in the target repository, including required existing labels; a local YAML parse alone does not prove GitHub renders them correctly.

Use plain English. Ask for the user's problem and desired outcome, app version/environment when relevant, reproduction steps for bugs, hardware model/documentation and available testing help for hardware, and a concrete desired workflow for workflow requests. Screenshots and carefully sanitized excerpts are optional. Do not require code or automatically attach feedback exports/log archives. Include a short public-visibility warning and redirect security reports privately.

Acceptance: a non-developer can complete each form, public requests are browsable by outsiders, duplicate/triage guidance is discoverable, and no private feedback data is submitted automatically.

## 3. App discovery links — A3

Inspect and reuse `frontend/src/features/feedback/FeedbackModal.tsx` and the existing app navigation/help entry points in `frontend/src/app/`. Add clear actions to browse community requests, submit a public request and read contribution guidance. Use the smallest suitable existing surface; avoid assuming a new page/tab is necessary. Explain that the public route opens GitHub and requires an account to submit.

Preserve existing feedback behaviour in `backend/src/features/feedback/feedback.routes.ts`, `feedback.service.ts` and `feedback.remote.ts`. Add no automatic feedback-to-issue bridge and pass no form contents, device metadata, account details or credentials in external link parameters. A maintainer may manually write a sanitized issue from a private theme, without exporting the underlying submission or attributing a person without permission.

Acceptance: external links resolve from desktop/mobile app views, public/private routes are clearly distinguished, existing feedback still works and no private values appear in outgoing links or public issues.

## 4. Pull-request review and release — A4

Add .github/PULL_REQUEST_TEMPLATE.md and public review guidance. Require an explanation of the problem/change, related public issue where applicable, affected surfaces, tests performed, hardware/environment evidence, remaining limitations and documentation updates. AI-assisted work must meet the same review/testing bar; AI output is not verification evidence.

Reuse `.github/workflows/check-dev.yml`, `check-main.yml`, `require-dev-to-main.yml` and `release.yml`. Verify fork PRs can run appropriate checks with existing approvals and read-only permissions, without repository secrets or privileged execution. Do not run untrusted fork code in a privileged/secrets-bearing workflow to make CI pass. Add workflow changes only where the fork trial identifies a specific gap.

Document contribution into `dev` and normal promotion/release through `main`, after confirming current repository branch protection. A custom fork remains unofficial; merging is not an immediate production deployment or promise of support for every target. Define who reviews, who can merge and how hardware-test gaps affect acceptance. Explain how contributors keep forks current and avoid accidental overwrite of their local changes during updates.

Acceptance: a fork PR passes appropriate checks without private credentials, receives a recorded human decision and has a documented path to an official release; no automatic acceptance is implied.

## 5. Development and fork-to-Pi quickstart — B1

Create docs/guides/contributor-quickstart.md, linked from `README.md` and CONTRIBUTING.md. Document supported prerequisites, dependency installation, local frontend/backend development, optional helpers/Minima and verification commands. Use real values from `package.json`, service configs and CI rather than stale branch-specific examples. Explain which checks require Pi hardware, Docker, POSIX tools or an external service.

Inspect `install.sh`, `docker-compose.yml`, `.env.example`, runtime-bundle/release scripts and Docker build contexts. The installer currently accepts `APP_REPO_URL`, `APP_BRANCH` and `DEV_MODE`; document and test the exact source-build route so a fork's changes actually run. Do not claim that selecting a branch alone replaces official prebuilt images. Explain development-mode signature/update differences and preserve official signed-release defaults.

Prove a harmless visible source change locally and on a disposable test Pi; identify the running source/commit. Include data protection, update/reinstall behaviour, helper state preservation and return-to-official-release instructions with stated limitations. Fix a specific reproducibility blocker if found, without introducing a general deployment platform.

Acceptance: a clean checkout and a test Pi run the contributor's own modified build using the published steps; no private team credentials are required and no production Pi is used for the trial.

## 6. Contributor architecture guide — B2

Create docs/guides/contributor-architecture.md with a small system diagram and file/component map. Cover React UI, Express backend, SQLite, workflow validation/execution/history, the root host agent and narrow helper interfaces, Docker/installer, update agent, Minima and Integritas boundaries. Separate configured devices, hardware enablement, protocol variants and workflow blocks.

Reference actual code, `docs/PROJECT.md`, `docs/adr/0019-hardware-access-through-host-helpers.md` and relevant project rules. Define frontend/backend ownership, persistence/migrations, configuration/secrets, opt-in hardware and error/reporting behaviour. The current fixed-action/narrow-helper model remains in force. The deferred arbitrary privileged extension runtime is not part of this work.

Acceptance: a contributor can identify which components/files need changing for each integration type and which behaviours must remain compatible; all code links resolve on the supported contribution branch.

## 7. Hardware, device, wizard and guide recipes — B3

Create docs/guides/contributing-devices.md, with an existing complete implementation as a worked example. Start with classifying readable input, event input, capture source, output target or local helper; reuse an existing protocol/type when appropriate.

Map the actual backend work in `backend/src/features/data-sources/`, `backend/src/features/host-capabilities/`, `backend/src/config/env.ts` and `host-agent/`. Map frontend types/templates/configuration in `frontend/src/features/data-sources/`, including `DataSourceTemplates.tsx`, `DataSourceForm.tsx`, `buildDeviceConfig.ts`, `add-device-alt/AltAddDeviceFlow.tsx`, `AltDeviceForm.tsx`, `deviceSetupGuides.tsx` and `frontend/src/pages/DataSourcesPage.tsx`. Check each current owner before documenting edits; do not copy an outdated checklist blindly.

Cover validation/defaults, saved-device editing, capability visibility, lifecycle/error handling, credential protection, setup-guide content, safe starter workflows, helper prerequisites, repeatable install and physical verification. Link existing hardware guides. Require a complete frontend/backend/guide/test change rather than a device card that cannot execute or a backend type users cannot configure.

Acceptance: a worked example explains every required change, operator setup and verification; hardware limitations and tested models/OS are explicit; current host boundaries and source/hash semantics are preserved.

## 8. Workflow recipes — B4

Create docs/guides/contributing-workflows.md. Explain when to reuse a current block/provider, add a template or introduce new runtime behaviour. Trace a block from `frontend/src/features/automation/automationTypes.ts` through workflow library/help/inspectors/summaries/canvas code to backend `automation.validation.ts`, `automation.service.ts`, `automation.policy.ts` and persistence under `backend/src/features/automation/`.

Cover start/data/action roles, settings validation, event listener lifetime, outputs/errors, cancellation, run/block history, media/hash/proof relationships, existing budgets and irreversible actions such as payments. Explain migration/compatibility for saved workflows. Use a harmless example and focused tests; do not introduce a new module contract or redesign the engine.

Acceptance: contributors can make a complete block/event change with UI, validation, runtime, history and tests aligned, with manual Pi/service verification recorded where needed.

## 9. Public contribution AI skill — B5

Provide one discoverable public entry skill, provisionally `edge-studio-contributor`, in the supported repository skill locations. Use the skill-creator workflow when implementing it. Reuse/refine `.agents/skills/add-device-support/SKILL.md`, `AGENTS.md` and existing skills/rules; keep `.claude`/`.cursor` counterparts synchronized according to repository conventions. Human guides are the source of truth for contribution expectations, not a second incompatible AI-only rulebook.

The skill must classify requests, inspect a relevant example, identify all affected surfaces, make a focused source change, update relevant guides/tests, run checks, report physical-test limitations and prepare a useful PR description. It must preserve current security boundaries, private feedback and release safeguards. It must not assume access to internal OpenProject tickets, `.env.local`, private AI accounts, the team's Pi or a hosted Module Builder.

Document installation/update/version matching for a contributor's supported AI harness, repository-local discovery and a manual route for other tools. No particular paid AI vendor or automatic account connection is required. AI is optional: the same journey must be possible with the human documentation alone.

Acceptance: a clean contributor environment loads the guidance, follows public references, prepares a coherent change and records real check results rather than claiming tests/hardware actions were performed. Internal ticket comments or contributor-specific machine paths are not dependencies.

## 10. Independent contribution trial — B6

After the request route and guides are usable, ask someone outside the core implementation team to pick or submit a public hardware/workflow need, fork/clone the repo, follow the docs (optionally with the skill), and develop a real device integration with relevant workflow behaviour. Run the changed build on a second/test Pi with actual hardware and submit a PR. Unlike future Module Builder's package-only proof, source edits and a fork build are expected here.

Record prerequisites, app/source version, environment/hardware, check commands/results, intervention needed, PR review and documentation corrections. Review the PR through A4; merge/release a suitable contribution only after normal approval. The trial's acceptance is a real, reproducible, reviewed contribution ready for normal release, not a forced production merge. Include a non-developer issue-form walkthrough and a separate clean AI-guided documentation/change exercise if the trial author did not use AI.

Acceptance: the contributor completes the public journey without private team tools; identified guide/skill gaps are corrected; code review, real hardware evidence and outstanding limitations are visible.

## Sequencing and decision gates

Start A1 and B1/B2 together. A2 depends on A1's request/privacy policy; A3 depends on working public destinations and B1's contributor entry point. B3/B4 use the verified architecture/quickstart. B5 follows the guides and refines them through a clean trial. A4 coordinates the rules, CI and evidence expectations. B6 is the final combined journey gate.

Before public launch, name maintainers for triage, review, docs and skills, settle licensing/contribution terms, confirm repository visibility/issues settings and branch targets, and agree minimum hardware evidence for accepted support. Choose an initial physical example with available hardware during implementation, not by inventing a new supported device in this plan.

Success measures: every public route works; every documented source path/check is verified; clean local and fork-to-Pi builds show the contributor's change; one independent contribution passes the review journey; a non-developer can submit a useful public request; no private submission is exposed. Do not invent commercial/adoption targets or delivery estimates before work is sized.

## Non-goals

- Implementing, merging, deleting or rewriting the deferred Module Builder branch/tickets.
- Installing runtime extension packages, extracting default modules, a module SDK/runtime, in-app code editor, marketplace, ratings, commerce or paid-module entitlements.
- Automatically publishing private feedback or synchronizing GitHub and OpenProject.
- Replacing the current security model with full-host extension execution.
- A mandatory GitHub CLI or AI subscription, automated PR approval, or a new public issue-hosting backend.
- Publishing a standalone docs website before repository-hosted guides prove sufficient.

## Docs

Implementation will add/update CONTRIBUTING.md, `README.md`, public guides and their `docs/README.md` index, issue/PR templates, relevant skill/rule mirrors, and `SECURITY.md` where public reporting/development guidance needs clarification. Add a public code-of-conduct/support pointer if required by the agreed community policy. Record durable ownership/security decisions through the ADR process when agreed; this plan does not select them.

Keep this plan, `docs/TASKS.md` and `docs/SESSION.md` current. Use Conventional PR titles for generated release notes under the release-please process. Retire completed plan work according to the plan-doc lifecycle; retain lasting guidance, decision rationale and verification evidence in their proper locations.

## Verification

The planning task validated plan links, backlog counts/hierarchy/acceptance coverage and live OpenProject read-back and preserved the original `module-builder` branch and tickets. Implementation was subsequently authorized on 2026-11-05. No production Pi deployment is implied by that authorization.

During implementation: run docs/template validation, mirror checks and targeted tests for app links/privacy. Run relevant lint, Knip, typechecks, backend/frontend/update-agent builds and tests according to affected code; run full required CI before merge. Verify real fork PR workflows without secret access. Validate installer/source builds on a disposable Pi and document platform-specific check limitations rather than hiding them. Test issue-form rendering and every external app link in the actual public repository. Preserve the private feedback flow.
