# Independent contribution trial

This is an evidence checklist, not a completed trial. It verifies that the [public contribution journey](../../CONTRIBUTING.md) works for someone outside the core implementation team. Source edits and fork builds are expected; the deferred Module Builder's installable packages are not required.

## Before starting

- Settle the public-code contribution terms and confirm who can review the PR.
- Select an available physical device and a small public issue with a concrete result and related workflow behaviour. The maintainer and hardware owner agree scope and safe test actions.
- Use a disposable Pi/SD card and the contributor's own accounts. No team credentials, private feedback or internal planning access should be needed.

## Record the journey

| Step | Evidence to record |
| --- | --- |
| Request | A non-developer can find and complete the correct public form; record confusion and what becomes public |
| Checkout | Fork/branch/source commit, platform/prerequisites and guide version |
| Local build | Commands, real results and a harmless visible change proving the modified build runs |
| Integration | Backend, UI, setup guide and workflow changes; why existing types could/could not be reused |
| Physical verification | Pi/OS/architecture/device model, wiring/settings, source commit and actual readings/events/outputs; no private identifiers |
| Tests | Focused/full checks, actual output, failures/unrun checks and their reasons |
| AI (if used) | Harness/version, matching skill, loading/routing result, changes/checks and human corrections; no private prompt transcripts |
| Review | Real focused fork PR, CI/approval behaviour, requested changes and decision |
| Improvement | Where the contributor needed private help; corrected public guide/skill and the retest result |

If the integration author does not use AI, perform a separate clean-harness exercise against a small existing device/workflow example. If nobody outside the team has tried the guides, leave independent validation incomplete; another automated lint run does not substitute for it.

Acceptance is a reproducible, reviewed contribution ready for the normal release decision. Do not force a production merge to complete a trial. Record release evidence later if accepted and released. Keep original failures and remaining hardware/service limitations visible in the PR or a sanitized dated report.
