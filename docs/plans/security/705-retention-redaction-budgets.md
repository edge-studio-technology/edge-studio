# Retention, Redaction, And Workflow Budgets Plan

**Status:** Not started

**Created:** 2026-09-17

**Goal:** Bound untrusted-event storage and repeated privileged workflow execution while removing webhook and MQTT credentials from logs and persisted read history.

## Context

This branch implements Phase 7 of the V1.5 security hardening work and covers external-review findings [11], [14], [8], and QA gap GAP-10. A webhook token holder or MQTT publisher can currently create automation runs, block runs, inbox items, and data-source reads without retention limits. The same inputs can repeatedly execute configured wallet or device actions because event cooldown is optional and held only in memory.

The audit confirmed the credential paths described by the ticket:

- `backend/src/middleware/requestLogger.ts` logs `req.originalUrl`, including `/api/data-source-webhooks/:token`.
- `frontend/nginx.conf` inherits nginx's access log, whose request line contains the same token.
- `recordTriggerEvent()` in `backend/src/features/automation/automation.service.ts` persists the tokenised webhook URL returned by `sourceUrlForRecord()`.
- `backend/src/features/data-sources/mqttIngestion.service.ts` persists `brokerUrl + topic` for successful and failed MQTT ingestion; `parseMqttConfig()` accepts credential-bearing MQTT URLs.
- `recordPushAutomationPayload()` accepts a `sourceUrl` argument that none of its execution logic reads.
- `docker-compose.yml` has no json-file rotation policy, and the release Compose generator must mirror any source Compose change.

The existing session cleanup service provides the startup-plus-hourly scheduler pattern to reuse. Automation run deletion cascades to block runs, while inbox references become null; pruning must still cap all four named tables independently and physically remove soft-deleted inbox rows.

The ticket deliberately excludes a global cross-workflow budget, global wallet serialization, and webhook-token rotation. Record those rejected alternatives and the selected per-workflow design in an ADR during implementation. Token rotation remains unjustified while exposure is local to an admin-readable database and Pi-local Docker logs; Docker logs created before this fix will not be rewritten.

## Decisions Required Before Implementation

The ticket specifies a persisted rolling-window budget but not its policy values or complete privileged-block set. Confirm these before coding:

- Recommended default: **10 budgeted runs per rolling hour per workflow**, enforced for `send_transaction`, `control_output`, and `capture_camera`. These are the current money-moving or device-affecting blocks.
- Decide whether `stamp_integritas` also consumes the workflow budget. It spends an external service quota but is separately covered by HTTP stamp rate limiting; an externally triggered automation can still reach it without that HTTP path.
- Decide whether max-runs/window are fixed server policy or persisted workflow settings. Recommended V1 scope is fixed, non-disableable policy with only consumption events persisted; configurable per-workflow values would also require API and frontend editing UX not requested by the ticket.

Whichever values are selected, name them constants, document them in `SECURITY.md`, and lock them with tests. Do not claim that the budget prevents destination or amount selection: those values are already fixed by trusted workflow configuration.

## Backend Changes

### 1. Retention repository and scheduler

- Add a small retention repository/service in `backend/src/features/retention/` rather than spreading deletion SQL across the automation and data-read repositories.
- For `automation_runs`, `automation_block_runs`, `automation_inbox_items`, and `data_source_reads`, delete the oldest eligible rows using both rules:
  - rows older than 30 days;
  - rows outside the newest 10,000 rows;
  - the union is capped to 500 rows per table per pass.
- Use `(timestamp, id)` ordering for deterministic oldest-first deletion. Prune automation runs before block runs so foreign-key cascades reduce the remaining block-run work; cap block runs independently afterward.
- Physically delete eligible inbox rows, including rows already soft-deleted through `deleted_at`.
- Add/confirm timestamp indexes needed by the bounded selects; `automation_block_runs.started_at` currently lacks its own age/cap index.
- Add `startRetentionScheduler()` / `stopRetentionScheduler()` following `features/auth/session.service.ts`: run one guarded pass immediately after migrations, then hourly, log only a static failure message plus redacted error detail, and make start/stop idempotent for tests.
- Wire start/stop into `backend/src/startup.ts`. A startup pass remains bounded to 500 rows per table; subsequent hourly ticks drain a larger backlog without holding a long write lock.

### 2. Source references and historical scrub

- Add a stable, credential-free source reference helper for push reads, preferably `data-source:<id>`, and use it for webhook, MQTT, and GPIO event records instead of reconstructing config URLs.
- Change `recordTriggerEvent()` to derive the reference once for both `createDataSourceRead()` and `context.data.sourceUrl`.
- Remove `sourceUrl` from `recordPushAutomationPayload()` and update webhook, MQTT, and GPIO callers and tests.
- Change both MQTT success and `recordMqttIngestFailure()` persistence to use the source reference; keep broker URL/topic available only in the live MQTT client configuration.
- Do not reject credential-bearing MQTT URLs as part of this ticket: credentials may be required to connect, and the leak is fixed at the persistence boundary.
- Add an idempotent migration in `backend/src/db/database.ts` that scrubs existing `data_source_reads.source_url` values:
  - replace rows that can be joined to webhook/MQTT/GPIO sources with the stable source reference;
  - sanitize recognizable `/api/data-source-webhooks/<token>` paths and URL userinfo for orphaned rows whose source was deleted;
  - never log the old value or credential during migration.
- Reuse or extend `backend/src/shared/redact.ts` for orphan-row sanitization so URL-userinfo handling has one implementation.

### 3. Webhook log redaction

- Extract a small URL-path redactor used by `backend/src/middleware/requestLogger.ts`; replace only the token segment under `/api/data-source-webhooks/` with a fixed marker while preserving method, route identity, query shape, and unrelated URLs.
- Configure an nginx `log_format` in `frontend/nginx.conf` whose logged URI is derived from a `map` that masks the webhook token segment. Apply that format explicitly to `access_log`; cover both the HTTPS request and the HTTP-to-HTTPS redirect server so neither stream records the token.
- Add focused backend logger tests by spying on `console.log`. Validate exact, query-string, trailing-path, and unrelated routes without asserting or printing a real credential in failure output.
- Add a config-level nginx regression check that sends a webhook request through the built frontend container and inspects captured access output for the marker and absence of the supplied token.

### 4. Persisted rolling-window workflow budget

- Add a dedicated `automation_workflow_budget_events` table in `backend/src/db/database.ts` with `workflow_id`, unique `run_id`, and `consumed_at`, plus an index on `(workflow_id, consumed_at)`. A timestamp ledger implements a true rolling window and survives restart; a single `window_started_at/count` pair would only implement a fixed window.
- Cascade budget events when a workflow is deleted. Budget-event retention can delete entries older than the configured window during reservation and does not need operator-facing history.
- Add a repository transaction that, immediately before the first privileged block in a run:
  1. removes expired events for that workflow;
  2. counts events inside the rolling window;
  3. rejects at the maximum with a typed `WORKFLOW_RUN_BUDGET_EXHAUSTED` error and next-available timestamp;
  4. otherwise inserts one event keyed by `run_id`.
- In `executeWorkflow()`/`executeBlock()`, reserve the budget once per run immediately before its first enabled privileged block executes. Start/record/data/condition/wait blocks may run first, but no privileged side effect may occur before a successful atomic reservation.
- A failed privileged action still consumes its reservation because the external side effect may have occurred before an error was observed. Retries are new runs and require a new reservation.
- Apply the same budget to manual, scheduled, webhook, MQTT, and GPIO triggers so changing transport cannot bypass it. Keep the existing in-memory concurrency and cooldown guards as complementary controls.
- Map budget exhaustion consistently in manual automation HTTP responses and push-ingestion handlers; webhook should return a non-success throttling response, and MQTT/GPIO should treat the typed rejection as an expected skip without logging secrets.

### 5. Transaction cooldown validation

- Extend `validateAutomationWorkflowDraft()` in `backend/src/features/automation/automation.validation.ts`: if any enabled `send_transaction` block exists, every enabled event-start block must have a finite integer `cooldownSeconds >= 1`.
- Emit a stable validation code/message on the start block so create, update, enable, and draft-validation routes all use the same rule. Manual/schedule starts have no cooldown field and rely on the persisted budget.
- Keep the frontend capable of entering zero for non-transaction workflows; surface the backend validation issue through the existing workflow validation UI rather than creating a separate client-only rule.

### 6. HTTP rate limiting

- Keep `authRateLimiter` unchanged for credential attempts; its `skipSuccessfulRequests` behavior is not suitable for traffic-volume controls.
- Add purpose-specific limiters in `backend/src/features/auth/rate-limit.middleware.ts` (or a renamed shared rate-limit module) with standard `RateLimit-*` headers and JSON `429` responses:
  - webhook ingestion, keyed by client IP and source identity without storing/logging the raw token;
  - automation mutation/manual-run endpoints, applied to POST/PATCH/DELETE routes rather than read polling;
  - Integritas stamp creation (`/stamp` and `/stamp-file`), without throttling proof/status reads.
- Set explicit windows/maxima as named constants and document them. Ensure proxy-aware IP keys remain correct under the existing `app.set("trust proxy", 1)` and nginx forwarding headers.
- Rate limiting is process-local and resets on restart; the durable workflow budget is the restart-safe control for privileged automation and covers MQTT/GPIO paths that Express middleware cannot see.

## Docker And Release Changes

- Add the same Docker json-file `logging.options` policy to every long-running service in `docker-compose.yml` (`max-size` and `max-file`, values stored as strings). Applying it consistently prevents a different noisy service from retaining unbounded logs.
- Mirror the policy in `scripts/release/build-docker-compose.mjs` and extend its tests so installed runtime bundles cannot drift from source Compose.
- Keep rotation limits fixed unless the implementation intentionally adds documented environment variables with hard bounds; configurability is not required by this ticket.

## Tests

- New retention repository/service tests with fake time and an isolated SQLite database:
  - 30-day age cutoff, including exact-boundary behavior;
  - 10,000-row cap with deterministic oldest-first deletion;
  - union of age and count eligibility without double counting;
  - at most 500 direct deletions per table/pass;
  - automation-run cascades, independent block-run cap, physical inbox deletion, and idempotent repeated passes;
  - immediate startup pass, hourly tick, error isolation, and clean stop using fake timers.
- Database migration tests for live webhook/MQTT/GPIO sources, deleted-source orphan rows, already-safe URLs, idempotency, and absence of original tokens/userinfo after migration.
- Update `automation.service`, GPIO ingestion, MQTT ingestion, data-source route, and data-read tests to assert stable source references and the removed dead argument.
- Request-logger and nginx/container tests proving a sentinel webhook token appears in neither log stream while unrelated routes remain useful.
- Workflow validation tests for zero, missing, negative, fractional, and positive cooldowns with enabled/disabled transaction and event-start blocks.
- Budget tests for below/at/over limit, independent workflows, exact rolling-window expiry, atomic concurrent reservations, one charge per run with multiple privileged blocks, failed actions consuming a charge, non-privileged workflows, all trigger types, and persistence after closing/reopening the test database.
- Route tests proving `429` plus rate-limit headers on stamp, automation-write/manual-run, and webhook paths, with normal GET/status paths unaffected.
- Release generator tests and `docker compose config` assertions for log rotation on every service.

## Docs

- `SECURITY.md`: summarize retention, source-reference storage, log redaction/rotation, cooldown validation, budget semantics, and the residual fact that pre-fix Docker logs are not rewritten.
- `docs/security/data-sources-and-automation.md`, `docs/security/wallet-and-tokens.md`, and `docs/security/low-priority-and-future.md`: close findings [11], [14], [8], and GAP-10 accurately, including HTTP-vs-MQTT/GPIO rate-limit scope.
- `docs/qa/gaps.md`: mark GAP-10 covered with the new regression tests.
- `docs/plans/security/phase-7-retention-redaction-budgets.md` and `docs/plans/security/README.md`: point to this task plan and update status when complete.
- Add an ADR for the per-workflow ledger/policy and the explicit deferral of global cross-workflow budgeting and wallet serialization.
- `README.md` and `.env.example`: update only if retention, budget, rate-limit, or log-rotation settings become operator-configurable.
- `CHANGELOG.md`: add operator-facing Security/Changed entries under `## [Unreleased] dev-task/705-retention-redaction-budgets`.
- On completion, use the `session-notes` skill to reconcile `docs/SESSION.md` and `docs/TASKS.md`.

## Verification

Focused checks during implementation:

```bash
npm --prefix backend test -- --run
npm run test:scripts -- --run
docker compose config
```

Baseline before handoff:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
docker compose build
git diff --check
git status --short --untracked-files=all
```

Manual/container checks:

1. Send a webhook containing a unique sentinel token through frontend nginx; verify the backend and frontend container logs contain the redacted marker but not the sentinel.
2. Trigger webhook and credential-bearing MQTT reads; inspect SQLite and verify `source_url` contains only the stable source reference.
3. Upgrade a database seeded with historical tokenised webhook URLs and MQTT userinfo; verify migration removes the credentials without changing unrelated read rows.
4. Seed each retained table beyond age/count limits, restart the backend, and verify only one bounded batch per table is removed at startup and later hourly passes drain the backlog.
5. Exhaust a privileged workflow's budget, restart the backend, and verify the next run remains blocked until the rolling window expires.
6. Confirm Docker reports the configured log rotation options for every Compose service.

## Implementation Order

1. Confirm budget policy and privileged-block set; write the ADR.
2. Add schema/migrations for budget events and historical source-url scrub.
3. Add source references and remove the dead push-ingestion argument.
4. Add retention repository/scheduler and startup wiring.
5. Add persisted budget enforcement and cooldown validation.
6. Add backend/nginx redaction, Docker rotation, and release-generator parity.
7. Add scoped rate limiters.
8. Complete focused tests, baseline verification, security docs, changelog, and session/task reconciliation.

## Estimate

About **8-16 engineering hours**, excluding a Pi soak test or changes required if configurable per-workflow budget controls are selected.
