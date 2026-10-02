# Automation Rules

- Automation workflows are ordered block pipelines. V1 supports start blocks, data/capture blocks, variables, conditions, output control, wallet transaction, and attached Integritas stamping blocks.
- Each rule follows When / Condition / Then. Keep rules atomic; chain rules instead of adding multiple unrelated actions to one rule.
- Data/capture blocks either record an event trigger, fetch an HTTP JSON Source, or capture Raspberry Pi Camera media.
- The backend scheduler owns HTTP polling execution; webhook/MQTT/GPIO collect rules are triggered by incoming data while enabled.
- Workflow variables are per-run only. `Set variable` can save custom JSON or field values from trigger/latest data/context for later conditions and output interpolation.
- `Show preview` writes durable local Automation inbox items for operator-facing text, JSON, links, and image references.
- Store `last_run_at`, `next_run_at`, `last_hash`, `last_proof_id`, and `last_error`.
- Save `last_hash` after successful data fetch or push ingestion even if Integritas stamping fails.
- Raspberry Pi Camera capture blocks hash the captured media file bytes, not only the JSON metadata preview.
- Surface detailed upstream errors where possible without leaking secrets.
- Runs reaching `send_transaction`, `control_output`, `capture_camera`, or `stamp_integritas` reserve one slot of the persisted per-workflow budget (`automation.policy.ts`, 10 runs per rolling hour) before the side effect, for every trigger type; add new side-effecting block types to that set. Event-started workflows with a payment block need a cooldown of at least 1 second, enforced in both validation and `executeWorkflow()`. Workflow runs, block runs, visible inbox items, and data-source reads are preserved, deleted inbox items are purged, and Integritas history requires explicit deletion. See `docs/adr/0022-bound-external-automation-effects.md`, `docs/adr/0023-classify-stored-records-before-applying-retention.md`, and `docs/adr/0026-preserve-workflow-run-history.md`.

## Frontend naming

- **Automation** is the feature area (`features/automation/`, nav, API, inbox, runs).
- **Workflow** is one ordered block pipeline inside automation.
- Prefer `automation*` for feature-wide domain/API/runs (`automationTypes`, `automationApi`, run tables).
- Prefer `workflow*` for one-pipeline build/edit logic and UI (`workflowHelpers`, `workflowWorkspaceUi`, workspaces).
- Keep graph visuals in `workflow-canvas/` only; do not put canvas layout in `workflowWorkspaceUi`.
