# 0017: Outbound And Upload Resource Limits

**Status:** Accepted
**Date:** 2026-09-09

## Context

The V1.5 external security review, findings [3] and [13]:

- **[3]** Outbound HTTP reads buffered whole responses into memory. `readJsonApiSource`,
  the `healthStatusUrl` check, `sendHttpOutput`, and `sendMultipartMediaOutput` all read the full
  body — the last via `response.json()` — with no byte ceiling, and nothing limited how many such
  requests could be in flight at once. A configured remote service that answers slowly, or with a
  very large or highly compressible body, could exhaust the Pi's heap or pin every workflow run
  open at once. The report asked for a global outbound concurrency limit by name, and made its own
  severity rating conditional on one.
- **[13]** Both `multer` instances were constructed with `dest` and no `limits`, so an
  authenticated client could write an arbitrarily large file into the container's `/tmp` before any
  handler ran. `/stamp-file` then returned on a missing Integritas API key *before* entering the
  `try/finally` that removes the file, orphaning it.

MQTT ingestion had the same shape as [3] on a different transport: `handleMqttMessage` called
`JSON.parse` on whatever a publisher sent, with no size check.

This runs against `.agents/rules/data-sources.md`: *"Do not impose arbitrary app-level file/data
limits unless required for safety."* These are required for safety, so the rule's exception applies
— but it still sets the bar for how the limits are chosen: generous defaults, configurable, and
never a smaller number than the product needs.

## Decision

### One egress path, one place the limits live

`fetchExternalJson()` in `backend/src/shared/http.ts` was already the single egress path for
operator-supplied URLs (ADR 0014). It is now also where every outbound limit is enforced, rather
than each of the four call sites carrying its own. `fetchJsonWithTimeout()` is deliberately left
alone: it serves deployment-config callers (Minima RPC, Integritas, the camera/sensor helpers,
status), whose URLs are not API-writable and whose responses — a Minima `coins` listing, for
instance — have no business being cut off at a data-source-sized cap.

### Count decoded bytes, mid-stream

The cap is applied by reading `response.body` chunk by chunk and aborting the moment the running
total passes it, not by reading the body and then checking its length. Three properties follow, and
all three were required:

- **`Content-Length` is checked but not trusted.** It is rejected up front when it already exceeds
  the cap, but it is absent on chunked responses and a hostile server can simply understate it.
- **The count is of decoded bytes.** undici decompresses before the chunks reach us, so a small
  gzip body that inflates past the cap is cut off mid-stream. Counting encoded bytes would have
  left the compression-ratio version of the same attack open.
- **Nothing oversized is ever fully buffered.** Checking after `response.text()` would mean the
  heap exhaustion had already happened by the time the check ran.

### A global semaphore with a bounded queue

`backend/src/shared/egress-limiter.ts` holds one process-wide semaphore over every outbound request
to an operator-supplied URL. Past `EGRESS_MAX_CONCURRENT` in flight, callers queue; past
`EGRESS_QUEUE_LIMIT` queued, they are rejected immediately with `EgressQueueFullError`.

The queue is bounded on purpose. An unbounded queue converts one slow upstream into an
ever-growing backlog of pending workflow runs, which is the failure the concurrency limit exists to
prevent, just deferred. Rejecting fast is the honest answer.

The request deadline covers the queue wait as well as the request itself. The alternative — start
the clock once a slot is acquired — makes each individual request's timeout mean what it says, but
lets total wall time reach queue depth × timeout, so a saturated limiter would hold callers far
longer than any configured deadline suggests.

### Configurable, with hard maxima the operator cannot exceed

Every limit reads from `.env` through `boundedNumber()` in `config/env.ts`, which **clamps** rather
than honours an out-of-range value. An operator can tune a limit; they cannot configure it away.
A non-numeric value falls back to the default rather than to zero.

| Control | Env var | Default | Hard max |
| --- | --- | --- | --- |
| Decoded response bytes | `EGRESS_MAX_RESPONSE_BYTES` | 5 MB | 50 MB |
| Outbound request deadline | `EGRESS_TIMEOUT_MS` | 5 s | 60 s |
| Global outbound concurrency | `EGRESS_MAX_CONCURRENT` | 4 | 16 |
| Outbound queue length | `EGRESS_QUEUE_LIMIT` | 32 | 256 |
| Upload file size | `UPLOAD_MAX_FILE_BYTES` | 100 MB | none (floor 1 MB) |
| Upload file count | `UPLOAD_MAX_FILES` | 1 | 8 |
| Upload non-file fields | `UPLOAD_MAX_FIELDS` | 8 | 64 |
| MQTT payload bytes | `MQTT_MAX_PAYLOAD_BYTES` | 256 KB | 4 MB |

The upload size cap is the one row with no ceiling. Stamping arbitrary files is the product; a
hard maximum there would be the app telling the operator what they are allowed to notarise. It
keeps a floor so it cannot be set to something that breaks stamping entirely.

`HttpOutputConfig.timeoutMs` already validated to 100–60000 at save time. The clamp in
`fetchExternalJson` is a second line for config rows that predate that validation.

### Upload errors get a real response

Multer signals an over-limit upload by passing a `MulterError` to `next()`. With no error
middleware registered, Express answered with an HTML 500 — indistinguishable to a client from a
server fault. `backend/src/middleware/uploadErrors.ts` maps `LIMIT_FILE_SIZE` to `413` and every
other `MulterError` to `400`, through the same `sendApiError` contract as the rest of the API.

### Cleanup covers early returns

`/stamp-file` and `/verify-proof-file` now capture `req.file` and enter the `try/finally` before
the Integritas-API-key check, so the missing-key path removes the temp file too. The report named
only `/stamp-file`, and the plan repeated that, but `/verify-proof-file` had the identical early
return above its `finally` — the report's broader claim was right about the class even where it was
wrong about which route.

## Alternatives considered

- **Cap by `Content-Length` alone.** Cheapest, and useless against a chunked response or a lying
  server. Rejected.
- **Per-source limits instead of global ones.** More precise, but the exhaustion this guards
  against is a property of the Pi, not of any one source. A per-source cap multiplied by the number
  of enabled sources is not a bound.
- **Unbounded queue behind the semaphore.** Rejected above.
- **Extend the caps to `fetchJsonWithTimeout` as well.** Rejected: it would put a data-source-sized
  ceiling on Minima RPC and Integritas responses, which is a functional regression dressed as
  hardening.

## Consequences

- A data source whose upstream returns more than 5 MB now fails the read with an explicit
  size error instead of succeeding. Operators who need more raise `EGRESS_MAX_RESPONSE_BYTES`,
  up to 50 MB.
- Under load, workflow runs can fail with "outbound request queue is full" rather than queueing
  indefinitely. That is the intended, visible behaviour of the bound.
- Uploads over 100 MB now return `413` where they previously succeeded.
- MQTT publishers sending more than 256 KB per message get a recorded `invalid_payload` read
  failure rather than a silent parse of an arbitrarily large payload.

## Open

**The default values are reasoned, not measured.** They were chosen against the shape of the
workloads (a JSON sensor reading is kilobytes; a stamped file is the one thing that is legitimately
large) and against a Pi's memory budget, but no throughput or memory measurement was taken on real
hardware. Every value is configurable and clamped, so a wrong default is a tuning problem rather
than a security one — but this ADR should be revisited with real numbers when V1.5 is exercised on
a Pi under load. Recorded in `docs/qa/gaps.md` rather than left implicit here.
