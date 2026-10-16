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
| [plans/features/658-security-audit-pipeline.md](./plans/features/658-security-audit-pipeline.md) | Security audit pipeline on release candidates (#658); blocked |

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
