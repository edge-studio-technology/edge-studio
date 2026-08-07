# Docs

```
docs/
├── PROJECT.md   goal, audience, constraints, success criteria
├── frontend-design-system.md   frontend styling; ui/ vs patterns/ placement
├── TASKS.md     current work items (read every session)
├── SESSION.md   scratch log for the session in progress
├── security/    detailed security risk register (see SECURITY.md for the policy)
├── plans/       active or upcoming work
├── adr/         architecture decision records — why, not what; code comments point here
├── qa/          open gaps and hardening backlog
└── reports/     point-in-time audits (not maintained after creation)
```

Project-specific agent rules live outside `docs/`, in `.agents/rules/` at the repo root (agent-config, not human documentation) — see below.

---

## Agent context

| Doc                                                      | Purpose                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| [PROJECT.md](./PROJECT.md)                               | Goals, audience, non-goals, constraints, success criteria     |
| [frontend-design-system.md](./frontend-design-system.md) | Frontend styling; `components/ui/` vs `patterns/` placement   |
| [TASKS.md](./TASKS.md)                                   | Current focus / in progress / next / done                     |
| [SESSION.md](./SESSION.md)                               | Scratch notes for the session in progress — reset per session |

`AGENTS.md` at the repo root holds behavioral guidelines (loaded every session by every tool) and indexes the project-specific rules below. `.cursor/rules.mdc` is a tool-specific pointer to it.

| Doc                                                                          | Purpose                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [../.agents/rules/project-shape.md](../.agents/rules/project-shape.md)       | Architecture, core principles, what to read before editing    |
| [../.agents/rules/backend.md](../.agents/rules/backend.md)                   | Backend feature folders, route/schema conventions, auth rules |
| [../.agents/rules/frontend.md](../.agents/rules/frontend.md)                 | Frontend feature folders, API usage, styling conventions      |
| [../.agents/skills/frontend-design-system/SKILL.md](../.agents/skills/frontend-design-system/SKILL.md) | Place new shared UI in `ui/` vs `patterns/` (migrate later) |
| [../.agents/rules/cli.md](../.agents/rules/cli.md)                           | CLI conventions and constraints                               |
| [../.agents/rules/minima.md](../.agents/rules/minima.md)                     | Minima RPC command rules                                      |
| [../.agents/rules/integritas.md](../.agents/rules/integritas.md)             | Integritas stamping/proof rules                               |
| [../.agents/rules/data-sources.md](../.agents/rules/data-sources.md)         | Data source types and rules                                   |
| [../.agents/rules/automation.md](../.agents/rules/automation.md)             | Automation workflow rules                                     |
| [../.agents/rules/docker.md](../.agents/rules/docker.md)                     | Docker / Raspberry Pi deployment rules                        |
| [../.agents/rules/verification.md](../.agents/rules/verification.md)         | Commands to run before finishing changes                      |
| [../.agents/rules/documenting-work.md](../.agents/rules/documenting-work.md) | Task summaries, doc updates, changelog policy                 |

---

## Security

| Doc                                                                                  | Purpose                                                                                   |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [../SECURITY.md](../SECURITY.md)                                                     | Security policy: supported use, guidelines, vulnerability reporting                       |
| [security/auth-and-transport.md](./security/auth-and-transport.md)                   | LAN access, TLS trust, API keys, `APP_SECRET`                                             |
| [security/host-and-infrastructure.md](./security/host-and-infrastructure.md)         | Docker socket, file browser, path traversal, SQLite permissions, supply chain, installer  |
| [security/wallet-and-tokens.md](./security/wallet-and-tokens.md)                     | Seed phrase import, automated transactions, debug clears, token creation                  |
| [security/data-sources-and-automation.md](./security/data-sources-and-automation.md) | Minima RPC/resync/restart/peers, data source URLs, webhooks, MQTT, GPIO, Raspberry Pi Camera, Integritas proxy |
| [security/low-priority-and-future.md](./security/low-priority-and-future.md)         | Rate limiting, error detail, logging hygiene, missing security tests                      |

---

## Active plans

| Plan                                                                                                     | Status                     |
| -------------------------------------------------------------------------------------------------------- | -------------------------- |
| [plans/automation-inbox-and-preview-block.md](./plans/automation-inbox-and-preview-block.md)             | V1 implemented             |
| [plans/block-automation-workflows.md](./plans/block-automation-workflows.md)                             | In progress                |
| [plans/device-configuration-and-mqtt-broker.md](./plans/device-configuration-and-mqtt-broker.md)         | V1 implemented             |
| [plans/feedback.md](./plans/feedback.md)                                                                 | V1 implemented; V2 planned |
| [plans/security-checklist.md](./plans/security-checklist.md)                                             | In progress                |
| [plans/workflow-variables-and-output-templating.md](./plans/workflow-variables-and-output-templating.md) | V1 implemented             |
| [plans/manifest-deploy-pull-model.md](./plans/manifest-deploy-pull-model.md)                             | In progress                |
| [plans/workflow-runs-pagination.md](./plans/workflow-runs-pagination.md)                                 | Implemented                |
| [plans/pir-motion-sensor-workflows.md](./plans/pir-motion-sensor-workflows.md)                           | Planned                    |
| [plans/esp32-mqtt-sensor-onboarding.md](./plans/esp32-mqtt-sensor-onboarding.md)                         | Planned                    |

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

---

## QA

| Doc                        | Purpose                                      |
| -------------------------- | -------------------------------------------- |
| [qa/gaps.md](./qa/gaps.md) | Open QA, security, and test gaps (all areas) |

---

## Hardware

| Doc                                                  | Purpose                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| [guides/gpio-device-settings.md](./guides/gpio-device-settings.md) | Tested and suggested GPIO input/output settings by device type |
| [guides/esp32-mqtt-sensors.md](./guides/esp32-mqtt-sensors.md) | Flashing and testing ESP32 MQTT board firmware |
| [guides/bme280-sensor.md](./guides/bme280-sensor.md) | BME280/BME680 I2C sensor setup |
| [guides/tester-device-workflows.md](./guides/tester-device-workflows.md) | Short tester matrix for Pi and PC device/workflow tests |
