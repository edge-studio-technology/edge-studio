---
name: add-device-support
description: Use when adding support for a new device, sensor, input source, capture source, output target, or local device helper in Edge Studio. Guides backend data-source types, frontend device templates/forms/guides, automation integration, docs, security notes, and verification.
---

# Add Device Support

Use this skill to add a new supported device or integration end-to-end. Start by classifying the device, then make the smallest complete change across backend, frontend, guides, docs, and verification.

## Read First

Before editing, read the relevant project rules:

- `.agents/rules/project-shape.md`
- `.agents/rules/data-sources.md`
- `.agents/rules/backend.md` for backend changes
- `.agents/rules/frontend.md` for frontend changes
- `.agents/rules/automation.md` if workflows, listeners, or starter workflows are involved
- `.agents/rules/docker.md` if hardware access, helper services, install flags, or Docker Compose changes are involved
- `.agents/rules/verification.md` before finishing

Also check `docs/PROJECT.md`, `docs/TASKS.md`, and existing device guides under `docs/guides/` when the change is non-trivial.

## Classify The Device

Before coding, identify the role. If the role is unclear, ask one short clarifying question.

- Readable input source: the backend fetches current JSON data on demand or from a workflow. Examples: `HTTP JSON Source`, `BME280 Environmental Sensor`.
- Event input source: the backend receives or watches events only while enabled workflows listen. Examples: `Webhook Receiver`, `MQTT Subscriber`, `GPIO Input Pin`, `PIR Motion Sensor`.
- Capture source: a workflow captures media/data and hashes captured bytes or metadata. Example: `Raspberry Pi Camera`.
- Output target: workflows control the device or send commands to it. Examples: `GPIO LED`, `HTTP JSON Target`, `MQTT Publisher`.
- Local service/helper: infrastructure that supports devices, not a configured device itself. Examples: local MQTT broker, sensor helper, camera helper.

Keep these boundaries strict. Do not make an output target readable, a push/event source fetchable, or a local service appear as a configured device unless the user explicitly asks for that behavior.

## Backend Checklist

Backend data-source support commonly touches:

- `backend/src/features/data-sources/dataSources.service.ts` for config parsing and source behavior helpers.
- `backend/src/features/data-sources/dataSources.routes.ts` for API capabilities, create/update validation, manual reads, output tests, and route-level errors.
- `backend/src/features/automation/automation.service.ts` for workflow runtime behavior.
- `backend/src/features/automation/automation.validation.ts` for workflow draft/workflow validation.
- `backend/src/config/env.ts` if runtime flags, helper URLs, tokens, ports, or timeouts are needed.
- `docker-compose.yml`, `.env.example`, and `install.sh` if host hardware access or helper services are needed.

Backend implementation steps:

1. Add or extend the data-source type only if an existing type cannot represent the device correctly.
2. Define config parsing and validation. Reject invalid enum values, pins, URLs, topics, addresses, and modes early instead of silently defaulting, unless backward compatibility for persisted data requires a default.
3. Add manual read/test behavior when the role supports it.
4. Add automation behavior according to the device role:
   - Readable source -> `fetch_data_source`.
   - Event source -> event listener/start block integration.
   - Capture source -> capture block integration.
   - Output target -> `control_output`.
5. Preserve source previews, hashes, and structured errors consistently with existing source types.
6. If host hardware is involved, prefer a narrow opt-in host-side helper over broad backend container device mounts unless the existing pattern already proves otherwise.
7. If a helper or capability endpoint reports supported models/features, expose enough detail for the frontend to warn before a user hits a runtime failure.
8. If the installer creates helper state outside Docker, make it idempotent. Preserve helper virtualenvs, caches, generated tokens, and data directories across `download_app()` refreshes unless they must be regenerated.

## Frontend Checklist

Frontend device support commonly touches:

- `frontend/src/features/data-sources/dataSourceTypes.ts` for source/target type and config fields.
- `frontend/src/features/data-sources/DataSourceTemplates.tsx` for Add Device cards.
- `frontend/src/features/data-sources/DataSourceForm.tsx` for form fields and validation hints.
- `frontend/src/pages/DataSourcesPage.tsx` for form state, API input shaping, and guide/action wiring.
- `frontend/src/features/data-sources/DataSourcesList.tsx` for row labels, action buttons, and status display.
- `frontend/src/features/data-sources/deviceSetupGuides.tsx` for required setup guide content and guide actions.
- `frontend/src/features/automation/automationTypes.ts` only when a new workflow block/config shape is needed.
- `frontend/src/pages/AutomationPage.tsx` only when new automation UI is needed.

Frontend implementation steps:

1. Add frontend type fields that match backend config exactly.
2. Add an Add Device template or manual option with user-facing naming that follows `.agents/rules/data-sources.md`.
3. Add form fields with safe defaults and clear labels. Use BCM numbering for GPIO.
4. Shape create/update input in `DataSourcesPage.tsx` without leaking unrelated config fields.
5. Add list actions only when they are valid for the role: manual read, test output, setup guide, edit, delete.
6. Add a setup guide for every configured device/source/target type. Do not add a supported device without a guide.
7. Use backend/helper capabilities in templates and guides where available. If a specific device model needs an optional dependency, show that missing support before manual read/workflow execution fails.

## Setup Guide Requirements

Every supported configured device/source/target must have a guide in `frontend/src/features/data-sources/deviceSetupGuides.tsx`.

A guide should include:

- Requirements, including required `ENABLE_*` install flags or helper services.
- Saved settings such as URL, topic, GPIO pin, I2C address, mode, or timeout.
- Wiring, endpoint, topic, or command details.
- Verification steps the operator can perform.
- Security, privacy, or safety warnings where relevant.
- A guide action when there is an obvious safe next step.

For hardware wiring sections, prefer inline schematic expansion over popups. If adding assets, import them through the frontend source graph instead of relying on brittle root public paths.

## Starter Workflow Actions

If the device has an obvious safe workflow, add a guide action through the guide action pattern in `deviceSetupGuides.tsx`.

Common starter workflows:

- Readable source: `manual_start -> fetch_data_source -> show_preview`.
- Camera/capture source: `manual_start -> capture_camera -> show_preview`.
- Webhook/MQTT/GPIO event source: event start -> `record_trigger_event` -> `show_preview`.
- GPIO LED: `manual_start -> control_output` with a short safe pulse.
- HTTP/MQTT output target: only add if a harmless sample payload is reasonable.

Starter workflows should default to `enabled: false` unless there is a clear reason to enable them immediately. After creation, guide action buttons should avoid duplicate creation where possible and offer navigation to the created workflow.

## Docs And Rules

Update only docs that are directly affected:

- `CHANGELOG.md` for user-facing behavior.
- `README.md` if operator setup, runtime flags, or install behavior changes.
- `docs/guides/<device>.md` for detailed setup beyond the in-app guide.
- `docs/TASKS.md` if a plan/task is added, completed, or deferred.
- `.agents/rules/data-sources.md`, `.claude/rules/data-sources.md`, and `.cursor/rules/data-sources.mdc` if supported source/target rules change.
- `.agents/rules/docker.md`, `.claude/rules/docker.md`, and `.cursor/rules/docker.mdc` if install/runtime/hardware rules change.
- `SECURITY.md` or `docs/security/host-and-infrastructure.md` if the device adds host access, network exposure, camera/microphone/location capture, credentials, external calls, or safety-sensitive behavior.

Keep `.agents/`, `.claude/`, and `.cursor/` counterparts synchronized when the top-level sync notice requires it.

Before finishing, verify mirrored files did not drift:

- For `.agents/` and `.claude/` markdown counterparts, compare hashes or inspect the full diff until the body is identical.
- For `.cursor/rules/*.mdc`, verify the rule body matches the `.agents/rules/*.md` counterpart, allowing only Cursor frontmatter differences.
- If a mirrored file was already stale before the change, either fix the drift as part of the touched rule set or call it out explicitly.

## Verification

Run the smallest relevant set, but device support usually requires:

1. `npm run typecheck`
2. `npm --prefix backend run build`
3. `npm --prefix frontend run build`

If install/runtime config changed, inspect:

- `docker-compose.yml`
- `.env.example`
- `install.sh`

For installer changes, check idempotency explicitly:

- Re-running `install.sh` should not reinstall helper dependencies unnecessarily.
- Any helper virtualenv/cache/state directory under `APP_DIR` must be protected from the installer refresh/delete step.
- Existing generated tokens and persisted runtime data must survive reinstall/update runs.

If hardware/helper behavior changed, include a manual verification note for Raspberry Pi hardware or the relevant external service. If `npm run check` is blocked by known audit advisories, say so explicitly and list the successful verification commands.

## Avoid

- Do not add abstractions for a single device unless they clearly support a device family.
- Do not add backend support without frontend guide coverage.
- Do not add a frontend template without backend validation/runtime support.
- Do not mount broad host devices into the backend container when a narrow helper is safer.
- Do not enable hardware, camera, network listener, or broker access by default.
- Do not run event listeners forever when only enabled workflows need them.
- Do not expose secrets in URLs, guide text, logs, previews, errors, or example commands.
- Do not make speculative compatibility layers unless persisted data, external consumers, or explicit user requirements need them.
- Do not silently coerce unknown device/model enum values to a default. Reject them so bad configs are visible.
- Do not create installer-managed helper environments under `APP_DIR` without also preserving them during app refresh.

## Final Response

When done, summarize:

- Device role and supported behavior.
- Key backend/frontend/docs files changed.
- Verification commands run and their results.
- Any manual hardware/service verification still needed.
- Any mirrored rule/skill files checked for sync, especially if `.agents/`, `.claude/`, or `.cursor/` files changed.
