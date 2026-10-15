# 0017: Outbound and Upload Resource Limits

**Status:** Accepted
**Date:** 2026-09-09

## Context

External security review findings [3] and [13]:

- **[3]** Outbound HTTP reads (`readJsonApiSource`, `sendHttpOutput`, `sendMultipartMediaOutput`)
  buffered whole responses with no byte ceiling and no concurrency limit. A slow, huge, or highly
  compressible upstream could exhaust the Pi's heap or pin every workflow run.
- **[13]** Both `multer` instances had no `limits`, so an authenticated client could fill `/tmp`,
  and `/stamp-file` returned on a missing Integritas key before the `try/finally` that removes the
  temp file.

MQTT ingestion had the same shape as [3]: `JSON.parse` on any payload size.

The data-source rule forbids arbitrary app-level limits unless required for safety. These are, but
the rule still sets the bar: generous defaults, configurable, never smaller than the product needs.

Separately, browser uploads pass through the frontend nginx, whose default 1 MB body limit
rejected ordinary uploads with an HTML `413` before Multer saw them.

## Decision

- **One egress path holds the limits.** `fetchExternalJson()` (`shared/http.ts`), already the only
  egress path for operator-supplied URLs (ADR 0014), enforces every outbound limit.
  `fetchJsonWithTimeout()` stays uncapped: it serves deployment-config callers (Minima RPC,
  Integritas, host helpers, status) whose responses are legitimately larger.
- **Count decoded bytes mid-stream.** `Content-Length` is rejected up front when it already exceeds
  the cap but is not trusted. The body is read chunk by chunk after undici decompression and
  aborted once the total passes the cap, so a gzip bomb or chunked response never fully buffers.
- **Global semaphore with a bounded queue** (`shared/egress-limiter.ts`). Past the concurrency
  limit callers queue; past the queue limit they get `EgressQueueFullError` immediately. The
  deadline covers queue wait plus the request, so wall time can't reach queue depth × timeout.
- **Configurable, clamped.** Every limit reads `.env` through `boundedNumber()`, which clamps to a
  hard range; non-numeric values fall back to the default.

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

  Upload size has no ceiling: stamping arbitrary files is the product. The floor keeps stamping
  usable.
- **Upload errors are JSON.** `middleware/uploadErrors.ts` maps `LIMIT_FILE_SIZE` to `413` and
  other `MulterError`s to `400` via `sendApiError`.
- **Cleanup covers early returns.** `/stamp-file` and `/verify-proof-file` enter `try/finally`
  before the API-key check.
- **nginx derives its limit; no second setting.** The frontend container reads
  `UPLOAD_MAX_FILE_BYTES` and `UPLOAD_MAX_FIELDS`, normalises them to the backend's ranges, and
  allows file bytes + 1 MB per non-file field + 16 KiB headers per part + 64 KiB framing, on the
  three upload locations only. The backend stays the authoritative boundary. `server_tokens` is
  off.

## Alternatives considered

- **Cap by `Content-Length` alone.** Useless against chunked or lying responses.
- **Per-source limits.** Exhaustion is a property of the Pi; per-source caps times sources is not
  a bound.
- **Unbounded queue.** Turns one slow upstream into an ever-growing backlog.
- **Start the deadline after acquiring a slot.** Lets total wait reach queue depth × timeout.
- **Cap `fetchJsonWithTimeout` too.** Breaks Minima RPC and Integritas responses.
- **nginx at the exact file limit.** Multipart overhead would reject files at the boundary.
- **A separate nginx setting.** Two values drift.
- **No nginx limit, or a larger limit on all of `/api`.** Unbounded unauthenticated buffering, or
  large bodies on routes that don't need them.

## Consequences

- An upstream over 5 MB fails with an explicit size error; operators can raise it to 50 MB.
- Under load, runs can fail with "outbound request queue is full" instead of queueing forever.
- Uploads over 100 MB return `413`; MQTT messages over 256 KB record `invalid_payload`.
- Changing `UPLOAD_MAX_FILE_BYTES` needs both frontend and backend recreated.
- nginx may still reject a malformed multipart body whose overhead exceeds the allowance, and can
  buffer the file size plus bounded overhead before authentication.
- Defaults are reasoned, not measured on a Pi under load; tracked in `docs/qa/gaps.md`.

## History

- 2026-09-15: nginx upload request limit derived from the backend settings (was ADR 0018).
