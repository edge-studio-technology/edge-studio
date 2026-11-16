# Help & feedback verification — 2026-11-16

Implemented on feat/help-feedback from dev. The chooser offers direct GitHub bug/device/workflow/improvement forms, private vulnerability reporting, request browsing and contribution guidance. Quick feedback retains the existing private form, including general questions, Integritas availability and consent. Back preserves an unfinished draft and is disabled during submission.

## Verification

- 44 focused modal/sidebar/app-shell tests passed: exact safe links, no chooser API calls, draft preservation, Question submission, disabled Back during submission, consent, availability, delivery failures and existing payload behavior.
- Frontend lint, typecheck and production build passed. Existing Vite native-config/chunk-size warnings remain.
- Isolated frontend Chrome preview at 1440/768/390 pixels passed without horizontal overflow or runtime errors. No private API reads occurred in the chooser; opening quick feedback made exactly the two mocked metadata/config reads. Back restored the chooser, and no API writes occurred.
- Screenshots were visually reviewed. Mobile GitHub options scroll independently while Quick feedback remains visible. All preview data is synthetic; no GitHub issue or real feedback submission was created.
- Temporary preview source files and servers were removed/stopped. A mistaken initial root dev command briefly started the local backend; it was stopped before browser verification, which used the frontend-only server and intercepted API responses. No feedback was submitted.
- Full npm check passed lint/docs, Knip, all typechecks and application coverage suites: backend 1,495, frontend 1,840 and update-agent 194 tests. It then failed the previously documented Windows/POSIX/CRLF root script tests (37 failures, 54 passes, three skipped). Audits were not reached; no dependencies changed. The full command is not reported as passed, and Ubuntu CI remains the merge gate.

## Screenshots

- [Desktop chooser](./chooser-desktop.png)
- [Mobile chooser](./chooser-mobile.png)
- [Mobile private form](./quick-mobile.png)
- [Browser results](./browser-results.json)

No backend delivery logic, contribution permissions or GitHub settings changed. There is no GitHub Discussions route; general questions remain private quick feedback. No deployment was performed.
