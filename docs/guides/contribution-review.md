# Public requests and contribution review

Start with [CONTRIBUTING.md](../../CONTRIBUTING.md). This guide is for maintainers and contributors; private OpenProject access is not required. Edge Studio maintainers collectively own triage, review and these guides until individual owners are agreed. No new response-time commitment is made here.

## Request states

Use a short maintainer comment to record the current state and next action. The label names below are recommended; they are not auto-assigned by the forms and need not exist for submission to work. Create/configure labels deliberately in GitHub if the team adopts them.

| State | Maintainer action |
| --- | --- |
| Needs triage | Check public visibility, sensitivity, duplicates and scope; ask for missing details |
| Needs information | Say exactly what the requester can provide, including hardware/testing access |
| Ready for contribution | Write a small scope and observable acceptance result; invite help |
| In progress | Link the contributor/draft PR and coordinate overlapping work |
| Merged / awaiting release | Link the reviewed PR; do not say “released” yet |
| Released | Name the release containing the change and how to verify it |
| Closed / deferred / duplicate | Explain why; link the surviving issue or relevant decision |

A suggested implementation is not a promise or a requirement to accept code. A maintainer can decline an incompatible or unmaintainable integration. Avoid requiring an unfamiliar user to design the solution before their request can be considered.

## Public and private information

Issue forms publish only what the submitter enters. The app's feedback route remains separate. If private feedback suggests a useful task, a maintainer may write a new, sanitized problem statement containing the goal and acceptance criteria. Do not copy submissions, account/device identifiers, attachments or diagnostic archives. Do not identify or quote the original person without permission. Link internal records internally where public disclosure is inappropriate.

Move security concerns to the [private reporting route](../../SECURITY.md#reporting-a-vulnerability). If a secret was already posted publicly, remove the public exposure and arrange rotation/revocation privately; editing an issue is not proof the secret was never copied.

## Pull-request checklist

- Confirm contribution rights/terms before accepting external code. Licensing is an unresolved public-code launch gate; do not infer a license from a public repository or from a dependency's license.
- Confirm the feature PR targets upstream `dev`, solves a stated problem and has a Conventional title describing its result. Squash-merge features with that title; follow the [release guide](./releases.md) for merge promotions, release approval and main-to-dev synchronization.
- Check the affected backend, UI, helper, installer, workflow and saved-data paths using the relevant recipe. Evaluate tests and operator docs together.
- Require actual commands/results, including limitations. Request physical model/OS verification when accepting hardware claims. A mock, screenshot, AI explanation or passing linter is not a hardware result.
- Examine configuration migration, repeat installs, disable/re-enable, error/cancellation handling and shared dependencies where affected.
- Verify appropriate CI and human review. Do not supply secrets, production data or host privileges to run untrusted fork code. Build/test workflows use `pull_request` and read-only repository contents. The separate metadata checks use read-only `pull_request_target` with trusted base-SHA policy code only; never run contributor code in those jobs.
- Review generated/AI-assisted work to the same standard as manually authored code. The submitter remains responsible for understanding and verifying the change.
- Record approval/change requests/decline in the PR, then release accepted changes through the ordinary release process. Verify the release before closing with a “released” result.

The repository uses active rulesets for `dev` and `main`; branch protection can be implemented through rulesets rather than the older branch-protection API. Maintainers must check the current GitHub rules and required checks before merging. Local documentation does not grant merge privileges or replace those rules.

## Keeping forks current

Use a separate topic branch and keep the working tree clean or deliberately commit/stash work before updating. Fetch `upstream` and merge its `dev` into your topic branch; resolve conflicts and rerun affected checks. Never use a blanket reset/clean command from a guide to dispose of work you have not inspected. If GitHub squash-merges a PR, use a fresh branch from the new upstream `dev` for the next contribution rather than trying to replay the old branch wholesale.

## Public launch and evidence checklist

- [ ] Rights holders agree the project license and contribution terms; publish them and replace the pending notice in CONTRIBUTING.
- [ ] Maintainers accept triage, review and guide/skill maintenance responsibility, including security-report handling.
- [ ] Forms/config and guides reach default branch `main`; verify the actual chooser and each form in GitHub. A local schema check is useful but is not a rendering test.
- [ ] A non-developer tries a request form and can explain what becomes public.
- [ ] A clean fork PR runs appropriate checks without team secrets and receives real human review. Do not open dummy public issues/PRs or change repository settings without authorization.
- [ ] A disposable Pi runs the contributor's source change with recorded commit/model/OS; capture hardware behaviour, not only compilation.
- [ ] An independent contributor completes the [trial](./contributor-trial.md), and observed documentation/skill gaps are fixed.

Keep these checks open until their evidence exists. Do not change old ticket statuses merely because guidance has been written.
