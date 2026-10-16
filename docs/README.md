# Docs

`docs/` describes the codebase as it is now. Finished plans are deleted, not archived; git history
keeps them.

```
docs/
├── PROJECT.md                  goal, audience, constraints, success criteria
├── TASKS.md                    current and next work (read every session)
├── SESSION.md                  scratch log for the session in progress
├── frontend-design-system.md   frontend styling; ui/ vs patterns/ placement
├── adr/                        decision records — one current record per topic
├── guides/                     hardware and developer how-tos
├── plans/                      plans for active or upcoming work only
├── qa/gaps.md                  open QA, security, and test gaps
├── reports/                    point-in-time QA evidence and sign-offs (not maintained)
└── security/                   detailed security risk register (policy in ../SECURITY.md)
```

Agent rules and skills live outside `docs/`: `AGENTS.md`/`CLAUDE.md` at the repo root index the
per-topic rules in `.agents/rules/`, `.claude/rules/`, and `.cursor/rules/`.

## Lifecycle

- **Plans** (`plans/features/<ticket>-<slug>.md`, `plans/bugs/<ticket>-<slug>.md`) exist while
  their work is open. Before the PR into `dev`, rationale moves to an ADR, open items move to
  `TASKS.md` or `qa/gaps.md`, and the plan is deleted (`plan-doc` skill).
- **ADRs** are amended in place when a decision is refined; a new ADR is only for a new topic
  (`adr` skill). Merged ADR numbers are retired, never reused.
- **Reports** are evidence from a specific date and are not updated afterwards.
- **Drift check:** `npm run lint:docs` ([scripts/dev/check-docs.mjs](../scripts/dev/check-docs.mjs), run by
  `npm run lint` and CI) fails on dead links and paths, rule/skill mirrors that differ, and ADRs,
  plans, or top-level `docs/` entries missing from this file. Prose drift is caught by the
  rename/remove grep and the release read-through in the documenting-work rule.

## Plans

| Plan | Status |
| ---- | ------ |
| [plans/feedback-hosted-receiver.md](./plans/feedback-hosted-receiver.md) | Hand-off spec for the Integritas API repo; not started |

## Architecture decisions

| ADR | Decision |
| --- | -------- |
| [0001](./adr/0001-minima-graceful-node-restart.md) | Minima restart: `quit compact:true`, Docker `RestartCount` baseline detection, 5-minute forceful fallback |
| [0002](./adr/0002-update-page-split.md) | Update page split: frontend owns `/update`, `update-agent` owns `/update/` (apply progress) |
| [0003](./adr/0003-update-dry-run.md) | Dev-only `UPDATE_DRY_RUN` simulates a successful apply without touching containers |
| [0005](./adr/0005-modal-mount-gate-removal.md) | `Modal`'s `mounted` render gate removed to stop modal-swap flicker |
| [0007](./adr/0007-release-channels-and-compose-generation.md) | Folder-per-channel releases on `main` with generated per-channel Compose and `.env.example` |
| [0009](./adr/0009-manifest-fallback-to-github-raw.md) | Manifest delivery: own domain primary, GitHub raw fallback, signature as the trust boundary |
| [0010](./adr/0010-security-review-audit-verdict.md) | Audit of the external V1.5 security review: re-rating, missed SSRF, fix order |
| [0013](./adr/0013-secret-redaction-boundary.md) | Single redaction boundary: `redactDeep()` vs `redactStrings()`, write-time redaction |
| [0014](./adr/0014-egress-url-policy-for-operator-supplied-urls.md) | Operator-supplied URLs validated at save and fetch, DNS pinned, redirects re-checked |
| [0015](./adr/0015-minima-console-mutating-subcommands.md) | Minima console catalog classifies by argument shape; mutating forms default disabled |
| [0016](./adr/0016-install-time-bootstrap-trust-set.md) | Install-time trust chain: embedded key and verifier, pinned verifier image, bundle bound to the signed manifest |
| [0017](./adr/0017-outbound-and-upload-resource-limits.md) | Clamped egress, upload, and MQTT limits; nginx upload limit derived from backend settings |
| [0019](./adr/0019-hardware-access-through-host-helpers.md) | Hardware via host helpers and a root host agent with fixed per-capability actions |
| [0021](./adr/0021-app-secret-fail-closed-without-migration.md) | Backend refuses an empty `APP_SECRET`; no public default, no secret migration |
| [0022](./adr/0022-bound-external-automation-effects.md) | Automation effects: credential redaction, retention by record purpose, 1,000 privileged runs/hour budget |
| [0024](./adr/0024-responsive-layout-strategy.md) | Responsive layout: 768 floor, container queries, sidebar overlay below 1024, sticky table actions |
| [0025](./adr/0025-error-state-scope-tiers.md) | Error presentation by scope: content state, alert, toast, field error |
| [0027](./adr/0027-static-guided-tour.md) | Static first-visit guided tour, seen flag per browser, replay from Settings |
| [0029](./adr/0029-verified-version-identity.md) | Installed version reported only when running images match the recorded manifest; build labels on every image |
| [0030](./adr/0030-app-owned-local-address-book-contact.md) | App-owned local address-book contact that follows wallet replacement |
| [0031](./adr/0031-public-credential-type-and-legacy-correction.md) | Public setup credential hint and hash-conditional metadata correction |
| [0032](./adr/0032-cache-update-changelog-in-update-agent.md) | Update page changelog cached by `update-agent`, rendered as React elements |
| [0033](./adr/0033-persist-synced-wallet-history.md) | Wallet history synced into SQLite, marked by wallet, cleared only with re-auth |
| [0034](./adr/0034-observe-resync-after-client-timeout.md) | Resync timeout is uncertainty, not failure; backend-owned observation and recovery |
| [0035](./adr/0035-hash-admin-credentials-with-scrypt.md) | Admin credentials hashed with scrypt; legacy bcrypt verified and rehashed on login |
| [0036](./adr/0036-remove-dead-code-and-unused-features.md) | Dead code, seed import, token creation, TOTP, unused routes, and `/setup` removed |
| [0037](./adr/0037-minima-backups-own-scheduler-and-stored-password.md) | Minima backups: one stored password, own nightly scheduler, shared folder, rolling cap of 20 |
| [0038](./adr/0038-feedback-hosted-delivery-with-local-fallback.md) | Feedback saved locally, sent to Integritas with the existing key after per-submission consent |
| [0039](./adr/0039-workflow-canvas-and-watch-mode-interaction.md) | Workflow canvas routes and click controls; watch mode follow-live, replay, and summaries |

### Retired ADRs

Merged into the surviving record on 2026-10-15. Numbers are not reused.

| Retired | Now in |
| ------- | ------ |
| 0004 Update page changelog preview | [0032](./adr/0032-cache-update-changelog-in-update-agent.md) |
| 0006 App version single source of truth | [0029](./adr/0029-verified-version-identity.md) |
| 0008 Manifest served from GitHub raw | [0009](./adr/0009-manifest-fallback-to-github-raw.md) |
| 0011 Remove unused TOTP | [0036](./adr/0036-remove-dead-code-and-unused-features.md) |
| 0012 Keep TOTP decision outside V1.5 | [0036](./adr/0036-remove-dead-code-and-unused-features.md) |
| 0018 Nginx upload request limit | [0017](./adr/0017-outbound-and-upload-resource-limits.md) |
| 0020 Bind installer runtime to signed manifest | [0016](./adr/0016-install-time-bootstrap-trust-set.md) |
| 0023 Classify stored records before retention | [0022](./adr/0022-bound-external-automation-effects.md) |
| 0026 Preserve workflow run history | [0022](./adr/0022-bound-external-automation-effects.md) |
| 0028 Raise workflow run budget | [0022](./adr/0022-bound-external-automation-effects.md) |

0019 was retitled from "I2C Prerequisite Setup Action" when it absorbed the host-agent decision.

## Security

| Doc | Purpose |
| --- | ------- |
| [../SECURITY.md](../SECURITY.md) | Security policy: supported use, guidelines, vulnerability reporting |
| [security/auth-and-transport.md](./security/auth-and-transport.md) | LAN access, TLS trust, API keys, `APP_SECRET` |
| [security/host-and-infrastructure.md](./security/host-and-infrastructure.md) | Docker socket, path traversal, SQLite permissions, supply chain, installer |
| [security/wallet-and-tokens.md](./security/wallet-and-tokens.md) | Destination validation, local address book, automated transactions, history clear |
| [security/data-sources-and-automation.md](./security/data-sources-and-automation.md) | Minima RPC, data source URLs, webhooks, MQTT, GPIO, camera, Integritas proxy |
| [security/low-priority-and-future.md](./security/low-priority-and-future.md) | Rate limiting, error detail, logging hygiene, missing security tests |
| [security/external-review-2026-09-03.md](./security/external-review-2026-09-03.md) | External static review of `571ba70`, kept verbatim; audited in [ADR 0010](./adr/0010-security-review-audit-verdict.md) |

## QA and reports

| Plan | Status |
| ---- | ------ |
| [plans/security/](./plans/security/README.md) | In progress — Phases 1-5 done and in review; owns all V1.5 security work |
| [plans/remove-totp.md](./plans/remove-totp.md) | Superseded — TOTP removed in #686 (ADR 0036) |
| [plans/block-automation-workflows.md](./plans/block-automation-workflows.md) | In progress |
| [plans/workflow-redesign.md](./plans/workflow-redesign.md) | In progress |
| [plans/esp32-mqtt-sensor-onboarding.md](./plans/esp32-mqtt-sensor-onboarding.md) | In progress |
| [plans/pir-motion-sensor-workflows.md](./plans/pir-motion-sensor-workflows.md) | In progress |
| [plans/host-agent-capability-management.md](./plans/host-agent-capability-management.md) | Not started |
| [plans/feedback.md](./plans/feedback.md) | V1 implemented; hosted receiver required |
| [plans/minima-node-backup-restore.md](./plans/minima-node-backup-restore.md) | Implemented; needs verification against a real node |
| [plans/bme-environmental-sensor-support.md](./plans/bme-environmental-sensor-support.md) | Implemented |
| [plans/device-guide-starter-workflows.md](./plans/device-guide-starter-workflows.md) | Implemented |
| [plans/replace-openssl-manifest-verification.md](./plans/replace-openssl-manifest-verification.md) | Implemented |
| [plans/manifest-deploy-pull-model.md](./plans/manifest-deploy-pull-model.md) | Superseded — see [adr/0008](./adr/0008-manifest-served-from-github-raw.md) |

Completed and superseded plans move to [plans/archive/](./plans/archive/); they are kept for
context, not updated. `security-checklist.md` and `high-risk-business-logic-hardening.md` were
archived on 2026-09-04 and folded into the hardening plan above.

---

## Architecture decisions

Non-obvious "why" behind a specific implementation — timing constants, rejected alternatives,
things verified empirically rather than documented upstream. Source comments point here instead
of carrying the full rationale inline.

| ADR                                                                                     | Decision                          |
| ---------------------------------------------------------------------------------------- | ---------------------------------- |
| [adr/0001-minima-graceful-node-restart.md](./adr/0001-minima-graceful-node-restart.md)   | Minima restart: `quit` + Docker `RestartCount` baseline detection + 5-min forceful fallback |
| [adr/0002-update-page-split.md](./adr/0002-update-page-split.md)                         | Update page split: frontend owns `/update` (status/check/start), `update-agent` owns `/update/` (apply progress) |
| [adr/0003-update-dry-run.md](./adr/0003-update-dry-run.md)                               | Dev-only `UPDATE_DRY_RUN`: simulates a successful apply without touching any container |
| [adr/0004-update-page-changelog.md](./adr/0004-update-page-changelog.md)                 | Update page changelog preview: rendered as React elements (no HTML injection); client-side GitHub fetch superseded by 0032 |
| [adr/0005-modal-mount-gate-removal.md](./adr/0005-modal-mount-gate-removal.md)           | Removed `Modal`'s SSR-pattern `mounted` render gate: unneeded in this client-only SPA, was causing a blank-frame flicker on modal-to-modal swaps |
| [adr/0006-app-version-single-source-of-truth.md](./adr/0006-app-version-single-source-of-truth.md) | Feedback's app version now reads `update-agent`'s last-applied-manifest file (read-only mount) instead of a separate, drifted `INTEGRITAS_PI_VERSION` env var |
| [adr/0007-release-channels-and-compose-generation.md](./adr/0007-release-channels-and-compose-generation.md) | Release workflow: branch-per-channel replaced with folder-per-channel on `main`, plus generated per-channel `docker-compose.yml`/`.env.example` |
| [adr/0008-manifest-served-from-github-raw.md](./adr/0008-manifest-served-from-github-raw.md) | Default manifest delivery: `raw.githubusercontent.com` on the public manifest repo, replacing the never-finished VPS pull-based plan |
| [adr/0009-manifest-fallback-to-github-raw.md](./adr/0009-manifest-fallback-to-github-raw.md) | Default manifest delivery switched to our own domain, with `update-agent` falling back to `raw.githubusercontent.com` on fetch failure |
| [adr/0010-security-review-audit-verdict.md](./adr/0010-security-review-audit-verdict.md) | Second-opinion audit of the external V1.5 security review: all 14 findings confirmed, one likelihood downgrade, one missed SSRF-to-Minima-RPC finding, and the resulting fix ordering |
| [adr/0011-remove-unused-totp.md](./adr/0011-remove-unused-totp.md) | Superseded proposal to remove the dormant TOTP implementation |
| [adr/0012-keep-totp-decision-outside-v1-5-hardening.md](./adr/0012-keep-totp-decision-outside-v1-5-hardening.md) | V1.5 hardens the dormant implementation without deciding whether TOTP is later retained, redesigned, re-enabled, or removed; superseded by ADR 0036 |
| [adr/0013-secret-redaction-boundary.md](./adr/0013-secret-redaction-boundary.md) | Single redaction boundary: `redactDeep()` vs `redactStrings()` split, write-time redaction, fail-closed depth limit, and the `isSecretKey()` KISS simplification |
| [adr/0018-nginx-upload-request-limit.md](./adr/0018-nginx-upload-request-limit.md) | Nginx derives bounded multipart headroom from the backend upload settings instead of carrying a second operator-configured limit |
| [adr/0019-i2c-prerequisite-setup-action.md](./adr/0019-i2c-prerequisite-setup-action.md) | I2C prerequisite setup: fixed Raspberry Pi OS host-agent action with manual fallback |
| [adr/0020-bind-installer-runtime-to-signed-manifest.md](./adr/0020-bind-installer-runtime-to-signed-manifest.md) | Release installer verifies the runtime bundle against the signed manifest before replacing application files |
| [adr/0021-app-secret-fail-closed-without-migration.md](./adr/0021-app-secret-fail-closed-without-migration.md) | Backend refuses an empty `APP_SECRET`, `dev-change-me` default removed, no secret migration; operator owns custom values |
| [adr/0022-bound-external-automation-effects.md](./adr/0022-bound-external-automation-effects.md) | External automation hardening: initial retention scope, bounded logs, credential-free source history, and a persisted privileged-workflow budget |
| [adr/0023-classify-stored-records-before-applying-retention.md](./adr/0023-classify-stored-records-before-applying-retention.md) | Retention follows record purpose: bound workflow diagnostics, preserve product and evidence records, and purge user-deleted inbox items |
| [adr/0024-responsive-layout-strategy.md](./adr/0024-responsive-layout-strategy.md) | Responsive layout: 768 floor, container queries where sidebar width matters, sidebar overlay below 1024, sticky table actions |
| [adr/0025-error-state-scope-tiers.md](./adr/0025-error-state-scope-tiers.md) | Error presentation by scope: `ErrorContentState` for empty regions, `ErrorAlert` for degraded slices, toasts for transient actions, field errors for validation |
| [adr/0026-preserve-workflow-run-history.md](./adr/0026-preserve-workflow-run-history.md) | Workflow runs and block runs are preserved as Watch-mode history until a lifecycle policy bounds them per workflow |
| [adr/0027-static-guided-tour.md](./adr/0027-static-guided-tour.md) | First-visit guided tour is a static single modal, marked seen per browser in `localStorage`, and replayed from Settings → Behaviour |
| [adr/0028-raise-workflow-run-budget.md](./adr/0028-raise-workflow-run-budget.md) | Per-workflow run budget raised from 10 to an interim 1,000 privileged runs per rolling hour |
| [adr/0029-verified-version-identity.md](./adr/0029-verified-version-identity.md) | Installed release version reported only when running image digests match the recorded manifest; images carry a baked build identity for dev and mismatched builds |
| [adr/0030-app-owned-local-address-book-contact.md](./adr/0030-app-owned-local-address-book-contact.md) | Separate app-owned local contact; check/create only; manual contacts stay untouched and may share its destination |
| [adr/0031-public-credential-type-and-legacy-correction.md](./adr/0031-public-credential-type-and-legacy-correction.md) | Public setup credential hint and hash-conditional metadata correction after successful authentication |
| [adr/0032-cache-update-changelog-in-update-agent.md](./adr/0032-cache-update-changelog-in-update-agent.md) | Update page changelog cached by update-agent in its state dir, synced on manifest checks; browser no longer fetches GitHub |
| [adr/0033-persist-synced-wallet-history.md](./adr/0033-persist-synced-wallet-history.md) | Wallet history synced from Minima `history` into SQLite, marked by wallet fingerprint, cleared only with admin re-auth, confirmation time from the block |
| [adr/0034-observe-resync-after-client-timeout.md](./adr/0034-observe-resync-after-client-timeout.md) | Resync transport uncertainty, automatic-restart observation, separate budgets, and recovery evidence |
| [adr/0035-hash-admin-credentials-with-scrypt.md](./adr/0035-hash-admin-credentials-with-scrypt.md) | Admin credentials hashed with built-in scrypt; legacy bcrypt verified via pinned `bcryptjs` and rehashed on login until #887 |
| [adr/0036-remove-dead-code-and-unused-features.md](./adr/0036-remove-dead-code-and-unused-features.md) | Dead code, seed import, token creation, TOTP (schema dropped), debug and unused API routes, and the `/setup` page removed; supersedes ADR 0012 |
| [adr/0037-separate-portable-history-from-device-migration.md](./adr/0037-separate-portable-history-from-device-migration.md) | Portable history is a read-only, secret-redacted archive; encrypted configuration/secrets transfer belongs to a later device migration feature |

---

## QA

| Doc                        | Purpose                                      |
| -------------------------- | -------------------------------------------- |
| Doc | Purpose |
| --- | ------- |
| [qa/gaps.md](./qa/gaps.md) | Open QA, security, and test gaps (all areas) |
| [reports/v1-auth-sign-off.md](./reports/v1-auth-sign-off.md) | V1 auth and security production Compose sign-off (2026-09-18) |
| [reports/536-resync-lifecycle.md](./reports/536-resync-lifecycle.md) | Disposable-node resync timings and timeout behaviour (fixtures in `backend/tests/fixtures/minima/`) |
| [reports/536-resync-end-to-end.md](./reports/536-resync-end-to-end.md) | #536 Pi, disposable-node, and browser resync QA |
| [reports/283-credential-input-pi-verification.md](./reports/283-credential-input-pi-verification.md) | #283 PIN/password input and backup restore Pi QA |
| [reports/206-completed-branch-pi-deployment.md](./reports/206-completed-branch-pi-deployment.md) | #206 local address-book contact Pi QA |

## Guides

| Doc | Purpose |
| --- | ------- |
| [guides/gpio-device-settings.md](./guides/gpio-device-settings.md) | Tested and suggested GPIO input/output settings by device type |
| [guides/esp32-mqtt-sensors.md](./guides/esp32-mqtt-sensors.md) | Flashing and testing ESP32 MQTT board firmware |
| [guides/bme280-sensor.md](./guides/bme280-sensor.md) | BME280/BME680 I2C sensor setup |
| [guides/tester-device-workflows.md](./guides/tester-device-workflows.md) | Short tester matrix for Pi and PC device/workflow tests |
| [guides/pi-benchmark.md](./guides/pi-benchmark.md) | Benchmarking Edge Studio on a Pi for the wiki hardware page |
| [guides/minima-testnet.md](./guides/minima-testnet.md) | Dev-only private Minima testnet on a dev Pi for wallet testing |
