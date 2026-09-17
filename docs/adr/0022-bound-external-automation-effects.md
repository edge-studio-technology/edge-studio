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

## Decision

- Apply two independent retention limits to automation runs, block runs, inbox items, and
  data-source reads: retain no more than 30 days and no more than the newest 10,000 rows. Delete the
  oldest eligible rows in batches of at most 500 per table, once after startup migrations and then
  hourly. Automation-run deletion continues to cascade to its block runs, but block runs retain an
  independent cap.
- Replace persisted webhook and MQTT URLs with a credential-free stable source reference such as
  `data-source:<id>`. Remove the unused `sourceUrl` parameter from push automation recording and
  scrub historical read rows without logging their previous values. Credential-bearing MQTT URLs
  remain valid live connection configuration; they are excluded at the persistence boundary.
- Redact the webhook token path segment independently in backend request logging and nginx access
  logging. Configure bounded Docker `json-file` rotation for every long-running Compose service.
  Existing Docker logs are not rewritten.
- Reject workflow drafts that combine an enabled `send_transaction` block with an enabled event
  start whose `cooldownSeconds` is not a finite integer of at least one second.
- Enforce a fixed, non-disableable budget of **10 runs per rolling hour per workflow** before the
  first enabled privileged block executes. The privileged set is `send_transaction`,
  `control_output`, `capture_camera`, and `stamp_integritas`. Stamping is included because an
  automation-triggered stamp bypasses the HTTP stamp limiter and consumes external service quota.
- Persist one timestamped budget reservation per workflow run in a dedicated SQLite ledger with a
  unique `run_id`. Reservation and rolling-window counting are atomic. A run containing multiple
  privileged blocks consumes once; a failed privileged action still consumes its reservation
  because its external effect may have happened before failure was observed.
- Apply the budget to manual, scheduled, webhook, MQTT, and GPIO execution. Keep cooldown and
  in-memory concurrency guards as complementary controls.
- Add separate traffic-volume rate limiters for webhook ingestion, automation mutations/manual
  runs, and Integritas stamp creation. Do not reuse the authentication limiter or apply these
  write-oriented policies to normal read/status polling.
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
- HTTP rate limiting remains process-local; the persisted workflow budget is the durable control.
- Global aggregate wallet risk and cross-workflow serialization remain unaddressed.

## Where this lives in code

- `backend/src/db/database.ts` — retention indexes, historical source scrub, and workflow budget
  ledger migration.
- `backend/src/features/retention/` and `backend/src/startup.ts` — bounded startup/hourly pruning.
- `backend/src/features/automation/automation.service.ts` and
  `backend/src/features/automation/automation.validation.ts` — source references, budget reservation,
  and transaction cooldown validation.
- `backend/src/features/data-sources/mqttIngestion.service.ts` and data-source ingest routes — safe
  source recording for MQTT and webhooks.
- `backend/src/middleware/requestLogger.ts`, `frontend/nginx.conf` — webhook path redaction.
- `backend/src/features/auth/rate-limit.middleware.ts` and affected route modules — scoped traffic
  limiters.
- `docker-compose.yml`, `scripts/release/build-docker-compose.mjs` — bounded container log rotation.
- `SECURITY.md` — operator-visible guarantees and residual exposure.
