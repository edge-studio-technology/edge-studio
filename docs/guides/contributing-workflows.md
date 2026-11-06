# Add workflow steps and logic

Start with [CONTRIBUTING.md](../../CONTRIBUTING.md), the [quickstart](./contributor-quickstart.md) and [device roles](./contributing-devices.md). A workflow is the app's persisted ordered pipeline, not an arbitrary script. Reuse an existing block/provider or guide-created starter workflow when that already meets the need.

## Worked trace: Fetch data source

Use `fetch_data_source` as a harmless existing example of a block with validation, runtime and UI:

| Layer | Find and inspect |
| --- | --- |
| Shared frontend shape | `frontend/src/features/automation/automationTypes.ts`: block type and settings |
| Library/configuration | `frontend/src/features/automation/workflow/toolkit/WorkflowBlockLibrary.tsx`, `WorkflowBlockInspectors.tsx` and `workflowHelpers.ts`: available blocks, editor and initial configuration |
| Help and summaries | `workflowBlockHelp.ts`, `workflowBlockSummaries.ts` and canvas files in that workflow folder: readable labels, settings and validation states |
| Backend shape/storage | `backend/src/features/automation/automation.repository.ts`: serialized block/config and saved workflow handling |
| Validation | `automation.validation.ts`: readable-source requirements, missing device/helper and broken chain checks |
| Runtime | `automation.service.ts`: dispatch, source read, context/result, stored read and run/block history |
| Limits/security | `automation.policy.ts`: existing action budgets and constraints; use current helpers rather than bypassing them |
| Tests | `backend/tests/features/automation/` and `frontend/tests/features/automation/workflow/`: execution, invalid configuration, history, inspectors/help and workspace behaviour |

Paths without a prefix in the UI rows are under the frontend workflow folder; backend rows are under the backend automation folder. Read the actual callers: a new runtime handler alone does not make a complete usable block.

## Add or extend behaviour

1. Describe a concrete input, configuration and result. Classify it as trigger/start, data, logic or action. Prefer a safe preview/read example for initial development.
2. Trace the existing block shape through frontend types, library, editor, helper defaults, validation and backend persistence. Add only the necessary configuration/type changes; preserve saved workflows and explicitly handle unknown/old values.
3. Implement shared backend behaviour through the relevant service. If reading a device, respect its readable/event/capture/output role. Use safe egress helpers for operator URLs. If listening for events, attach/detach according to enabled workflow lifetime, not an everlasting listener created at app startup.
4. Integrate execution result/context, structured error, cancellation and run/block logging. Preserve source read references, media byte hashing and Integritas proof links. Do not treat a temporary UI summary as the authoritative execution result.
5. Add editor fields with safe defaults, field-level validation, help, summary and watch/inspection output. Reuse the existing canvas and layout; avoid a new render path for a single feature.
6. Preserve existing resource/action budgets. A timeout after a payment/output may mean its outcome is unknown; do not blindly retry irreversible effects. Do not run real payments or host actions as part of a generated example without explicit authorization.
7. Add focused validation/service/repository tests and relevant UI tests. Include missing device, disabled hardware, invalid settings, failure/cancellation and historical inspection. Run the shared checks and record physical/service verification separately.

## Example acceptance checklist

- [ ] The block appears in the right place and can be configured, saved, reopened and validated.
- [ ] A safe workflow executes the expected behaviour and records useful run/block results.
- [ ] Invalid/missing dependencies stop execution with an actionable error; no hidden work runs during preview.
- [ ] Existing workflows/history remain readable and representative existing flows still pass.
- [ ] Event subscriptions, cancellation, budget and side-effect handling are tested where relevant.
- [ ] Help/setup docs describe the feature and any unverified physical/service requirements honestly.

When a device can use existing Fetch/Record/Output behaviour, document that path rather than inventing a new block per device model. Future Module Builder may expose package contributions, but no such runtime contract is required for a source PR today.
