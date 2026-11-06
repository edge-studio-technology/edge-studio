# Add hardware, device setup and guides

This is a source contribution recipe. Start with the [quickstart](./contributor-quickstart.md) and [architecture](./contributor-architecture.md). Do not create a runtime extension/package system to add a device.

## Choose the smallest correct integration

| Role | Existing example | Expected workflow behaviour |
| --- | --- | --- |
| Readable source | BME280/BME680 sensor, HTTP JSON Source | Fetch on demand through a readable-source block |
| Event source | PIR/GPIO input, webhook, MQTT subscriber | Listen only while enabled workflows need it; record the trigger event |
| Capture source | Raspberry Pi Camera | Explicitly capture media and hash the actual captured bytes |
| Output target | GPIO LED, HTTP JSON Target, MQTT publisher | Explicit output action; not a readable device |
| Infrastructure/helper | Camera/sensor helper, local MQTT broker | Hardware support prerequisite; not itself a configured device |

For example, a board publishing the existing JSON format over MQTT may need a template and guide rather than a new protocol or workflow block. A new I2C chip using a different driver needs backend/helper support too. Never label an unfamiliar model as supported merely because it resembles an existing chip.

## Worked trace: the existing BME sensor family

Trace the current implementation rather than inventing a fictional device:

1. In `backend/src/features/data-sources/dataSources.service.ts`, find `parseBmeSensorConfig`. It accepts the documented sensor model, bus and I2C address; unsupported sensor values are rejected. Inspect matching route/service tests under `backend/tests/features/data-sources/`.
2. Follow `sensorHelper.service.ts` in that backend folder into `sensor-helper/`. Check the driver's model-specific capabilities and responses. Host setup/prerequisites belong to the fixed Sensors capability, not a new generic install command endpoint.
3. Find the sensor cards/defaults in `frontend/src/features/data-sources/DataSourceTemplates.tsx` and the active alternate flow in `add-device-alt/AltAddDeviceFlow.tsx`. Trace fields through `AltDeviceForm.tsx`, `DataSourceForm.tsx`, `useDeviceFormFields.ts`, `buildDeviceConfig.ts` and `dataSourceTypes.ts` to the API input. Not every change needs every file, but all used routes must agree.
4. Read the Sensors path in `hardwareCapabilities.ts`, the saved-device page in `frontend/src/pages/DataSourcesPage.tsx` and the BME topics/actions in `deviceSetupGuides.tsx`. A guide must explain prerequisites, actual saved values, wiring/address, deliberate verification and troubleshooting; its setup action must not create duplicate devices/workflows.
5. Follow the existing readable-source execution through `backend/src/features/automation/automation.service.ts` and validation in `automation.validation.ts`. A model supported through the existing provider should not require a special execution branch in each workflow.
6. Read the operator-facing [BME guide](./bme280-sensor.md) and focused tests for templates, forms, setup guide and saved config. Reconcile any differing model claims rather than copying them unchanged.

## Implement a complete change

- Define the role, exact model/protocol, required services and expected observable result. Agree a large/new-driver scope before coding.
- Reuse an existing type when it accurately represents the device. Otherwise update backend/frontend type and validation owners together, including API error handling and saved configuration. Check repository/migration changes only when data shape actually changes.
- Implement read/event/capture/output behaviour at its owning provider/helper. Preserve previews/hashes, timeouts, cancellation and redaction. Event listeners must stop when no enabled workflows need them.
- Wire the visible template, fields/defaults, review/create input and saved-device editing. Invalid pins, models, addresses or modes need actionable validation rather than silent fallback. Respect the device naming rules.
- Add a complete in-app guide in `deviceSetupGuides.tsx`, plus an operator guide when detailed wiring/setup warrants it. Reuse Hardware support for enablement/prerequisites; don't duplicate shell instructions into unrelated capture settings.
- If host prerequisites change, update `host-agent/`, `install.sh`, `.env.example` and Compose wiring only as needed. Keep it opt-in, token protected and idempotent. Installer refresh must preserve generated helper tokens, virtualenvs/caches and state that are meant to survive.
- For a harmless starter workflow, use the existing guide-action pattern, default it disabled and avoid duplicate creation. Do not run outputs, capture or payment actions just because a template is selected.

## Evidence before support is claimed

Run the focused backend parser/provider/routes tests and frontend template/form/config/guide tests, then [the shared checks](./contributor-quickstart.md#before-proposing-a-change). Include invalid configuration, unavailable helper, partial/failure handling and existing saved-device behaviour. If helper/install behaviour changes, test repeat setup and retained state.

On an authorized test Pi, record exact device model, Pi/OS/architecture, wiring/settings, prerequisites, source commit, successful reading/event/capture/output, disable/re-enable and relevant failure behaviour. Do not connect unverified wiring or operate hardware without the owner's permission. Keep real payloads/identifiers/credentials out of public evidence. If no physical device is available, state that clearly; mocked tests alone do not justify marking the model verified.

Update relevant guides, README/runtime configuration and security documentation. Use a Conventional PR title for release-please's generated changelog; see the [release guide](./releases.md). Agent rules/skills must stay in sync across their repository mirrors when touched.
