# 0022: Bound External Automation Effects — Redaction, Retention, and Run Budgets

**Status:** Accepted
**Date:** 2026-09-17

## Context

Webhook and MQTT ingestion cross an untrusted boundary into data-source recording and automation
execution. A token holder or publisher can continuously create workflow runs, block runs, inbox
items, and data-source reads, while Docker's default `json-file` logging is unbounded. On a Pi,
either can fill the SD card.

The webhook bearer token is a URL path segment, so `requestLogger`, nginx's request line, and
`data_source_reads.source_url` all retained it. MQTT had the same problem with broker URL userinfo.

Event cooldown doesn't bound privileged effects: transaction workflows accepted a zero cooldown,
cooldown state is process-local, and HTTP rate limits can't see MQTT or GPIO.

Verified during implementation: `better-sqlite3` is built with `SQLITE_DEFAULT_FOREIGN_KEYS=1`, so
declared cascades are enforced on the shared connection. Workflow validation is advisory on
create/update/enable; only manual run refuses on errors. nginx error-log lines include the raw
request line and their format can't be configured.

The stored tables are not one kind of data. Runs and block runs drive Watch mode history; inbox
items are user-visible output; data-source reads are product data and may be linked to proofs;
Integritas history is evidence. A security limit should not decide their product meaning.

## Decision

**Credentials and logs**

- Push-source reads store `data-source:<id>` as `source_url`, never a webhook or broker URL;
  historical rows are scrubbed without logging old values. Credential-bearing MQTT URLs stay valid
  as live configuration.
- Backend request logging and nginx access logging redact the webhook token independently. nginx
  matches its normalised `$uri` case-insensitively for masking and routing, omits query strings and
  trailing segments, and logs the webhook location's errors at `crit` only.
- Every long-running Compose service uses `json-file` with `max-size: "10m"`, `max-file: "3"`, and
  `update-agent`'s `createBodyFromInspect()` applies the same fixed policy when it recreates a
  container, including legacy ones. Existing installs need one installer rerun to recreate the
  services image-only updates don't touch.

**Run budget and cooldown**

- Every workflow has a fixed budget of **1,000 privileged runs per rolling hour**, reserved before
  the first enabled `send_transaction`, `control_output`, `capture_camera`, or `stamp_integritas`
  block, for every trigger type. Stamping is included because automation stamps bypass the HTTP
  stamp limiter and spend external quota.
- Reservations are timestamped rows in a SQLite ledger, unique per run, reserved and counted
  atomically. A run consumes once however many privileged blocks it has, and a failed action still
  consumes, since its effect may have happened. Workflow deletion deletes its ledger rows
  explicitly as well as by cascade.
- Event-started workflows with an enabled `send_transaction` block need a finite integer cooldown
  of at least 1 second, enforced in draft validation and in `executeWorkflow()`
  (`WORKFLOW_TRANSACTION_COOLDOWN_REQUIRED`), so pre-existing workflows are covered too.
- Separate one-minute limiters: 60 webhook requests per client and source, 30 automation
  mutation/manual-run requests per client, 10 stamp creations per client. Not applied to reads,
  status polling, or draft validation.
- Expensive proof file operations, history archive imports/exports, and Minima backup
  downloads/restores share a separate 30-request/minute budget per client across those routes.
  Unlike list/status reads, file downloads perform disk and export work. The shared ceiling bounds
  client traffic across features without interfering with ordinary polling. It is an interim
  conservative limit, not a measured Pi capacity.
- Archive export and backup download/restore also use the existing five-failures/15-minute
  authentication limiter shared by credential-confirmation routes. Traffic limiting runs first,
  then credential limiting, then multipart upload parsing, so rejected clients cannot spend disk
  or password-hashing work. Successful credential requests do not consume the failure budget.
- Budget and limits are named backend constants; no API, UI, or env configuration. The budget
  limits repetition only; destinations and amounts remain trusted workflow configuration.

**Retention by record purpose**

| Record | Policy |
| --- | --- |
| Workflow runs, block runs | Preserved (Watch mode history) |
| Visible inbox items | Preserved (user content) |
| Deleted inbox items | Purged by the retention sweep |
| Data-source reads | Preserved until a lifecycle decision |
| Integritas history | Kept until explicit user deletion; outside the scheduler |

- The sweep runs after startup migrations and hourly, in batches of at most 500 rows per table,
  yielding between batches until drained, never overlapping, cancelled on shutdown.
- Categories are explicit in `RETENTION_POLICIES`. The generic age/count prune machinery (30 days,
  10,000 rows, active-execution protection, explicit block-run deletion before parents) and its
  indexes stay implemented and tested for a future lifecycle policy.

## Alternatives considered

- **One 30-day / 10,000-row limit for every table** (first version). Treated diagnostics and user
  data alike and would delete existing data on the first sweep.
- **Bound runs and block runs as diagnostics** (second version). The global oldest-first cap let one
  busy workflow evict every other workflow's history, block runs hit their own cap before their
  runs and orphaned them, and rarely run workflows lost all history. A per-workflow bound with
  cascading block runs fixes this but is deferred to the lifecycle follow-up.
- **Comment out deletion, or an env flag for it.** Commented code drifts; a hidden switch allows
  irreversible deletion without a product explanation.
- **Budget of 10 runs per hour** (first version). Not derived from usage; ordinary event-driven
  workflows hit it within an hour. 1,000 is an interim ceiling until usage data supports a measured
  value.
- **Configurable or per-block-type budgets.** Configuration could weaken a security boundary; no
  usage data shows where per-type limits should sit.
- **A counter with `window_started_at`.** A fixed window allows boundary bursts.
- **Cooldown or HTTP rate limiting only.** Process-local, and can't cover MQTT or GPIO.
- **Budget only `send_transaction`.** Outputs, camera, and stamping have physical, privacy, storage,
  or quota effects too.
- **Reject MQTT URLs with credentials.** Authenticated brokers need them.
- **Rely on validation for the cooldown, or make validation block save.** Save/enable don't
  validate; blocking would couple saving to wallet and hardware checks.
- **One large startup deletion transaction.** Holds SQLite write locks on constrained hardware.
- **Protect rows by persisted `running` status.** Crashed runs would be protected forever; only
  this process's active runs are.
- **Preserve inspected logging options on recreation.** Legacy installs would keep unbounded logs.
- **Global cross-workflow budget and wallet serialization; webhook-token rotation.** Deferred.

## Consequences

- A leaked webhook token or hostile MQTT publisher can still cause up to 1,000 payments, outputs,
  captures, or stamps per hour per workflow. Webhook and manual-run limiters allow more than that,
  so the budget is the binding limit.
- Failed runs consume budget, which can briefly block after operational failures.
- Run, block-run, and data-source-read storage grows without bound until the lifecycle follow-up;
  disk capacity is an explicit availability risk.
- Pre-fix Docker logs may still contain webhook tokens until they rotate or are removed.
- The webhook nginx location loses non-critical error diagnostics.
- HTTP rate limiting stays process-local; the persisted budget is the durable control.

## History

- 2026-10-29: Bounded proof/history/backup file operations and added missing credential-confirmation limits after release CodeQL triage.
- 2026-09-23: Retention classified by record purpose; inbox and data-source reads preserved (was
  ADR 0023).
- 2026-09-25: Workflow runs and block runs preserved for Watch mode (was ADR 0026).
- 2026-10-02: Run budget raised from 10 to 1,000 per rolling hour (was ADR 0028).
