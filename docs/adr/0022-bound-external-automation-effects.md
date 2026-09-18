# 0022: Bound External Automation Effects With Layered Retention, Redaction, and Run Budgets

**Status:** Accepted
**Date:** 2026-09-17

## Context

Webhook and MQTT ingestion cross an untrusted boundary into data-source recording and automation
execution. A token holder or publisher can continuously create `automation_runs`,
`automation_block_runs`, `automation_inbox_items`, and `data_source_reads`, while Docker's default
`json-file` logging has no configured size limit. On a Raspberry Pi, both paths can exhaust the SD
card.

The webhook bearer token is a URL path segment. `requestLogger` records `req.originalUrl`, nginx
records the request line, and `recordTriggerEvent()` stores the tokenised webhook URL in
`data_source_reads.source_url`. MQTT ingestion has the same persistence problem when
`config.brokerUrl` contains URL userinfo. Logs and read history therefore retain reusable
credentials outside their intended configuration boundary.

Event cooldown alone does not bound privileged workflow effects: transaction workflows currently
accept a zero cooldown, cooldown state is process-local, and a restart clears it. HTTP rate limits
also cannot protect MQTT or GPIO execution and reset with the backend process.

The schema declares `ON DELETE CASCADE` and `ON DELETE SET NULL` relationships. The original plan
assumed the shared connection left foreign keys off. Implementation showed otherwise:
`better-sqlite3` is compiled with `SQLITE_DEFAULT_FOREIGN_KEYS=1`, so `PRAGMA foreign_keys` is `1` on
the shared connection and the declared cascades and nullification are enforced. A test insert of a
read row referencing a missing data source fails with `FOREIGN KEY constraint failed`.

Workflow validation (`validateAutomationWorkflow()`) is advisory on create, update, and enable: only
`POST /api/automation/workflows/:id/run` refuses to run on validation errors. The workflow editor
also calls `POST /api/automation/workflows/validate-draft` on every draft change.

nginx error-log lines, such as an upstream resolution or connection failure, include the raw request
line, and their format cannot be configured. Update Agent recreates `frontend` and `backend` from
`docker inspect` output, copying selected `HostConfig` fields.

## Decision

- Apply two independent retention limits to automation runs, block runs, inbox items, and
  data-source reads: retain no more than 30 days and no more than the newest 10,000 rows. Delete the
  oldest eligible rows in batches of at most 500 per table, once after startup migrations and then
  hourly. Explicitly delete dependent block-run rows in the retention transaction before deleting
  their parent runs. The cascade would also remove them; the explicit delete keeps retention correct
  if a table is rebuilt without its foreign key. Block runs retain an independent cap.
- Replace persisted webhook and MQTT URLs with a credential-free stable source reference such as
  `data-source:<id>`. Remove the unused `sourceUrl` parameter from push automation recording and
  scrub historical read rows without logging their previous values. Credential-bearing MQTT URLs
  remain valid live connection configuration; they are excluded at the persistence boundary.
- Redact the webhook token path segment independently in backend request logging and nginx access
  logging. The nginx webhook location sets `error_log ... crit`, so upstream failures do not write
  the token into the error stream. Configure bounded Docker `json-file` rotation for every
  long-running Compose service, and copy `HostConfig.LogConfig` when Update Agent recreates a
  container so updated containers keep that rotation. Existing Docker logs are not rewritten.
- Reject workflow drafts that combine an enabled `send_transaction` block with an enabled event
  start whose `cooldownSeconds` is not a finite integer of at least one second. Enforce the same
  rule in `executeWorkflow()` for webhook, MQTT, and GPIO triggers
  (`WORKFLOW_TRANSACTION_COOLDOWN_REQUIRED`). Validation alone does not protect workflows that were
  saved or enabled before the rule existed, because save and enable do not run validation.
- Enforce a fixed, non-disableable budget of **10 runs per rolling hour per workflow** before the
  first enabled privileged block executes. The privileged set is `send_transaction`,
  `control_output`, `capture_camera`, and `stamp_integritas`. Stamping is included because an
  automation-triggered stamp bypasses the HTTP stamp limiter and consumes external service quota.
- Persist one timestamped budget reservation per workflow run in a dedicated SQLite ledger with a
  unique `run_id`. Reservation and rolling-window counting are atomic. A run containing multiple
  privileged blocks consumes once; a failed privileged action still consumes its reservation
  because its external effect may have happened before failure was observed.
- Explicitly delete workflow budget events in the workflow-deletion transaction, in addition to
  the declared cascade.
- Apply the budget to manual, scheduled, webhook, MQTT, and GPIO execution. Keep cooldown and
  in-memory concurrency guards as complementary controls.
- Add separate one-minute traffic-volume rate limiters: 60 webhook-ingestion requests per client
  and source, 30 automation mutation/manual-run requests per client, and 10 Integritas stamp-creation
  requests per client. Do not reuse the authentication limiter or apply these write-oriented
  policies to normal read/status polling or to draft validation.
- Configure Docker's `json-file` driver for every long-running service with `max-size: "10m"` and
  `max-file: "3"`, bounding retained JSON logs to approximately 30 MB per service.
- Keep the budget and retention policies as named backend constants for V1.5. Do not add API,
  frontend, or environment configuration for them.

The budget limits repetition; it does not validate transaction destination or amount. Those values
remain trusted workflow configuration.

## Alternatives considered

- **A configurable per-workflow budget.** Rejected for V1.5 because it adds schema, API, and
  frontend policy editing and lets workflow configuration weaken a security boundary. Operational
  evidence can justify a separate configurable-policy feature later.
- **A counter with `window_started_at`.** Rejected because it implements a fixed window and permits
  boundary bursts. Timestamped reservations implement the required rolling window directly.
- **Only cooldown or HTTP rate limiting.** Rejected because both are process-local, cooldown can be
  absent from non-event starts, and Express middleware cannot cover MQTT or GPIO triggers.
- **Budget only `send_transaction`.** Rejected because device output, camera capture, and stamping
  also cause physical, privacy, storage, or external-quota effects.
- **Reject MQTT URLs containing credentials.** Rejected because authenticated brokers legitimately
  require them; credentials should remain usable in configuration but must not enter read history.
- **One large startup cleanup.** Rejected because an unbounded deletion can hold SQLite write locks
  and delay startup on resource-constrained hardware.
- **Enable SQLite foreign-key enforcement in this feature.** Originally deferred on the assumption
  that it was off. It is already on through the `better-sqlite3` build default, so nothing is left
  to decide here.
- **Rely on validation alone for the transaction cooldown.** Rejected because create, update, and
  enable do not run validation, so an existing zero-cooldown transaction workflow would keep running.
  Making validation block save or enable was also rejected: it would couple saving to wallet and
  hardware availability checks.
- **Leave nginx error logging unchanged for webhooks.** Rejected because an unavailable backend,
  for example during an update, would log every delivery's token.
- **Global cross-workflow budgeting and wallet serialization.** Deferred to their own subsystem and
  ADR because they require global coordination beyond this per-workflow hardening task.
- **Webhook-token rotation.** Deferred while the token is only readable by the owning administrator
  and logs remain local. Revisit if logs are shipped off-device.

## Consequences

- Database and Docker-log growth become bounded, with large historical backlogs drained gradually
  rather than synchronously.
- Newly written read rows and request logs retain useful source/route identity without reusable
  webhook or broker credentials. Historical database rows are scrubbed, but pre-fix Docker logs
  may still contain webhook tokens and require operator-managed removal or expiry.
- Privileged workflow repetition remains bounded across backend restarts and across every trigger
  transport. A legitimate workflow that exceeds 10 privileged runs in one rolling hour waits until
  a reservation expires.
- Failed or partially executed privileged runs consume capacity conservatively, which can produce
  temporary false-positive blocking after operational failures.
- The timestamp ledger adds SQLite writes and requires expiry cleanup, but its bounded per-workflow
  query provides accurate rolling-window behavior.
- Retention and workflow deletion duplicate the enforced cascades with explicit deletes.
- Each hourly pass removes at most 500 rows per table. A sustained flood of events that do not
  reach privileged blocks, such as record-and-preview workflows with no cooldown, can add rows faster
  than retention removes them. Such rows are bounded only by the HTTP rate limits (webhooks) or by
  nothing (MQTT) until the pass rate or batch size changes.
- The webhook nginx location loses non-critical nginx error diagnostics.
- HTTP rate limiting remains process-local; the persisted workflow budget is the durable control.
- Global aggregate wallet risk and cross-workflow serialization remain unaddressed.

## Where this lives in code

- `backend/src/db/database.ts` — retention index, `scrubDataSourceReadSourceUrls()`, and the
  `automation_workflow_budget_events` ledger.
- `backend/src/features/retention/` and `backend/src/startup.ts` — bounded startup/hourly pruning.
- `backend/src/features/automation/automation.policy.ts` — budget constants, privileged block set,
  and the cooldown predicate.
- `backend/src/features/automation/automationBudget.repository.ts` —
  `reserveWorkflowRunBudget()`.
- `backend/src/features/automation/automation.service.ts` and
  `backend/src/features/automation/automation.validation.ts` — source references, budget reservation,
  and transaction cooldown validation and execution guard.
- `backend/src/features/automation/automation.repository.ts` — explicit workflow budget-event
  deletion without relying on a cascade.
- `backend/src/features/data-sources/mqttIngestion.service.ts` and data-source ingest routes — safe
  source recording for MQTT and webhooks.
- `backend/src/shared/redact.ts`, `backend/src/middleware/requestLogger.ts`, `frontend/nginx.conf`
  — webhook path and URL userinfo redaction.
- `backend/src/features/auth/rate-limit.middleware.ts` and affected route modules — scoped traffic
  limiters.
- `docker-compose.yml`, `scripts/release/build-docker-compose.mjs`,
  `update-agent/src/docker/docker.service.ts` (`createBodyFromInspect()`) — bounded container log
  rotation.
- `SECURITY.md` — operator-visible guarantees and residual exposure.
