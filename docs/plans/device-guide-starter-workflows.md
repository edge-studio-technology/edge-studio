# Device Guide Starter Workflows Plan

**Status:** Implemented
**Created:** 2026-07-30
**Goal:** Let setup guides offer reusable one-click starter workflows, starting with a basic readable-source workflow for BME280 and other fetchable devices.

## Context

Device setup guides now exist for every configured device/source/target type. Some guides currently end with instructions such as:

- Click manual read in Devices and confirm a JSON preview appears.
- Use the source in an Automation `Fetch data source` block, then attach `Stamp data` if you want Integritas proofs.

For BME280 and other readable sources, the next natural step is a button in the guide: `Create basic workflow for this device`. The first implementation should create this workflow:

1. `manual_start`
2. `fetch_data_source` with the guide's selected device as `sourceId`
3. `show_preview` with `contentMode: "latest_data"` and `previewFormat: "json"`

This should be implemented as a reusable guide-action pipeline, not as BME-specific special-case UI, so future guides can expose starter workflows for cameras, GPIO events, webhooks, MQTT, and output targets.

## Frontend Changes

**`frontend/src/features/data-sources/deviceSetupGuides.tsx`**:

- Extend `DeviceSetupGuide` with optional actions:
  ```ts
  actions?: DeviceGuideAction[];
  ```
- Add a reusable action type:
  ```ts
  type DeviceGuideAction = {
    key: string;
    label: string;
    description?: string;
    kind: "create_workflow";
    workflow: DeviceGuideWorkflowTemplate;
  };
  ```
- Add a reusable workflow-input shape matching existing `createAutomationWorkflow()` input blocks:
  ```ts
  type DeviceGuideWorkflowInput = { name: string; enabled: boolean; blocks: GuideWorkflowBlock[] };
  ```
- Add helper builders instead of duplicating block arrays in each guide:
  - `readableSourcePreviewWorkflow(source)` for `manual_start -> fetch_data_source -> show_preview`.
  - Later: `cameraCapturePreviewWorkflow(source)`, `gpioEventPreviewWorkflow(source)`, `webhookPreviewWorkflow(source)`, `mqttPreviewWorkflow(source)`, and output-target test/control workflows.
- In `bme280Guide()` and `httpJsonSourceGuide()`, add the first guide action: `Create basic workflow for this device`.
- Optionally add it for any existing readable source type accepted by `fetch_data_source`: `json-api`, `internal-json-api`, `bme-sensor`.

**`frontend/src/pages/DataSourcesPage.tsx`**:

- Import `createAutomationWorkflow` from `frontend/src/features/automation/automationApi.ts`.
- Pass a guide-action handler into `StandardDeviceSetupGuide` when needed.
- On action click:
  1. Build workflow input from the selected source/action.
  2. Call `createAutomationWorkflow()`.
  3. Show success toast with the workflow name.
  4. Refresh devices/workflow usage metadata if needed.
  5. Keep the guide open, or optionally close it after success. Prefer keeping it open and showing toast for the first version.
- Disable the action button while the request is in flight.

**`frontend/src/features/data-sources/DataSourcesList.tsx`**:

- No direct changes expected. The guide button already opens the generic guide for any device with a registered guide.

## Backend Changes

No new backend route is required for the first version. Reuse the existing `POST /api/automation/workflows` route via `createAutomationWorkflow()`.

The backend already validates:

- `manual_start` block shape.
- `fetch_data_source` source compatibility via `isReadableDataSource()`.
- `show_preview` config through existing block validation.

If future guide actions need more backend-owned conventions, add a dedicated starter-workflow route later, but do not add it for this first button.

## Initial Workflow Template

For `BME280 Environmental Sensor` and `HTTP JSON Source`, generate:

```ts
{
  name: `${source.name} preview`,
  enabled: false,
  blocks: [
    { type: "manual_start", config: {}, clientId: "start" },
    { type: "fetch_data_source", config: { sourceId: source.id }, clientId: "fetch" },
    {
      type: "show_preview",
      config: {
        title: `${source.name} latest data`,
        previewFormat: "json",
        contentMode: "latest_data"
      },
      clientId: "preview"
    }
  ]
}
```

`enabled: false` is intentional: this is a manual starter workflow, so it should not start background subscriptions/polling or surprise the operator.

## Future Device Actions

After the first readable-source action works, add guide actions by device type:

- `Raspberry Pi Camera`: manual start -> capture camera -> show preview image/latest data.
- `GPIO Button` / `PIR Motion Sensor`: GPIO event start -> record trigger event -> show preview trigger payload.
- `Webhook Receiver`: webhook event start -> record trigger event -> show preview trigger payload.
- `MQTT Subscriber` / `ESP32 MQTT Board`: MQTT event start -> record trigger event -> show preview trigger payload.
- `GPIO LED`: manual start -> control output pulse.
- `HTTP JSON Target`: manual start -> control output send_request with a sample body.
- `MQTT Publisher`: manual start -> control output publish with a sample body.

Each should be represented as a guide action generated by the registry, not as one-off code in `DataSourcesPage.tsx`.

## Docs

Update as part of implementation:

- `CHANGELOG.md` — note the new guide action for starter workflows.
- `README.md` only if the workflow-creation behavior needs operator-level documentation beyond in-app guides.
- `docs/TASKS.md` — move this plan to Done after implementation.

## Verification

1. `npm run typecheck`
2. `npm --prefix frontend run build`
3. Browser check:
   - Open a BME280 setup guide.
   - Click `Create basic workflow for this device`.
   - Confirm a new disabled workflow appears in Automation.
   - Open the workflow and confirm the blocks are `Manual run`, `Fetch data source`, `Show preview`.
   - Run it manually and confirm the preview uses latest data as JSON.
4. Regression check:
   - HTTP JSON Source guide creates the same starter workflow pattern.
   - Non-readable guides do not show the readable-source workflow action until they get their own action templates.
