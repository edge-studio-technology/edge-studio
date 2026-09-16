[← Back to index](./README.md)

# Phase 7 — Retention, redaction, budgets

**Covers:** [11], [14], [8], GAP-10.

1. Retention/pruning for `automation_runs`, block runs, inbox items, and `data_source_reads`.
   Unbounded growth from untrusted push events on a Pi's SD card. Concrete, not "add retention":
   per-table age cap (30 days) and row cap (10 000 rows, oldest first), whichever hits first;
   pruned in batches of 500 on an hourly scheduler tick so a large backlog never holds a long write
   lock; plus one prune pass at startup after migrations, since a Pi that was powered off for a
   month gets no ticks in the interim. Configurable with hard maxima, same pattern as Phase 5.
2. The webhook token is a URL path segment, so it is written verbatim to **two** log streams on
   every delivery: `backend/src/middleware/requestLogger.ts` logs `req.originalUrl`, and the
   `frontend` nginx logs the full request line (`frontend/nginx.conf` sets no `access_log`, and it
   is installed as a server-block include, so the `nginx:1.25-alpine` default stays active). Both
   go to stdout and land in Docker's json-file logs on the Pi. Redact the token segment in the
   backend logger and set an nginx `log_format` that masks it. **`docker-compose.yml` configures no
   `logging:` block anywhere**, so json-file rotation is unbounded and these never age out — set
   `max-size`/`max-file` as part of this phase, since it is the same retention concern as (1).
3. The token also reaches `data_source_reads.sourceUrl` — but only via `recordTriggerEvent`, which
   derives it through `sourceUrlForRecord` from `config.webhookToken`. Store a source reference
   instead of the tokenised URL. (While here: the `sourceUrl` argument threaded through
   `recordPushAutomationPayload` is never read — `executeWorkflow` re-derives it. Dead param;
   remove it with this change, not separately.)
4. Same bug in a narrower blast radius: `mqttIngestion.service.ts:92` and `:101` build `sourceUrl`
   as `` `${config.brokerUrl} ${config.topic}` ``, and `parseMqttConfig`
   (`dataSources.service.ts:134-139`) accepts any non-empty string as a broker URL — so
   `mqtt://user:pass@host:1883` is legal and its credentials land in the read row. They reach the
   **database only**, never a log: `brokerUrl` arrives in a request body, and neither logger in (2)
   logs bodies. Cover it with (3) rather than as a separate item.
5. **Fixing the writers does not un-leak what is already stored.** Scrub the historical
   `data_source_reads` rows carrying a token or broker credential, and note in `SECURITY.md` that
   Docker logs predating this change are not rewritten. **Rotating** existing webhook tokens is
   *not* part of this phase by default: the DB and API side are only readable by the admin who
   already owns the token, so the exposure that would justify a breaking rotation is Pi-local
   Docker logs. Revisit at the [pre-merge decision pass](./README.md#pre-merge-decision-pass); rotate if those
   logs are shipped off-box by then, and say so plainly in the changelog because it invalidates
   every configured sender.
6. [8]: workflow cooldown defaults to `0` (disabled). An attacker cannot choose a payment
   destination or amount, but can trigger repeated payments to an already-trusted address and
   repeated GPIO/network actions. **Decided, so this is implementable:** reject `cooldownSeconds`
   of `0` at validation time (`automation.validation.ts:228`) for any workflow containing a
   `send_transaction` block, and add a per-workflow run budget (max runs per rolling window)
   enforced in `automation.service.ts` *before* the first privileged block executes. The counter
   must be persisted, not in-memory — the report's test is explicitly that a backend restart does
   not reset it, which means a schema change, so scope it as one. A **global** cross-workflow
   budget and global wallet serialization are the report's other two asks; both are a new
   subsystem, and both are deferred with an ADR rather than half-built here. Do not present any of
   this as fixing fund theft — it never was.
7. GAP-10: rate limiting currently covers login, setup, and `/api/auth/settings/*` only. Extend to
   the stamp, automation, and webhook ingest paths, which are the ones an untrusted event source
   can drive. HTTP rate limiting does not reach MQTT or GPIO events — those are covered by (6)'s
   per-workflow budget, which is enforced centrally, after any transport.
