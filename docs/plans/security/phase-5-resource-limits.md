[← Back to index](./README.md)

# Phase 5 — Resource limits

**Status: done** (2026-09-09). Limit values recorded in
[adr/0017](../../adr/0017-outbound-and-upload-resource-limits.md).

**Covers:** [3], [13].

1. `readJsonApiSource` (`dataSources.service.ts:244`) uses bare `fetch` — no deadline, no cap. The
   shared `fetchJsonWithTimeout` in `backend/src/shared/http.ts` already implements the timeout;
   route through it and add a byte cap by reading the stream rather than `response.text()`.
2. Same cap on the health-check path, `sendHttpOutput`, and `sendMultipartMediaOutput` — the last
   awaits `response.json()` with no cap at all and is the report's `dataSources.service.ts:310`.
   Every outbound egress path routes through one wrapper; none keeps a bare `fetch`.
3. **Abort while streaming, on decoded bytes.** Reject an oversized `Content-Length` up front but
   do not trust it — count bytes as they arrive and abort the request on overflow, counting
   *after* decompression so a small gzip body that inflates past the cap is still cut off.
4. **Global outbound-request concurrency.** The report asks for this by name and its
   severity-lowering condition depends on it; the first draft of this plan dropped it. One shared
   semaphore around every outbound egress call, with a bounded queue — reject fast past the queue
   length instead of growing an unbounded backlog of pending workflow runs.
5. `mqttIngestion.service.ts` — `handleMqttMessage` has no payload size check.
6. `limits` on both multer instances: `backend/src/features/integritas/upload.middleware.ts` and
   `backend/src/features/minima/minima-upload.middleware.ts`.
7. `integritas.routes.ts` `/stamp-file` returns on a missing API key *before* entering the
   `try/finally`, so the temp file is orphaned. Move the check inside, or clean up on that path.
   `/verify-proof-file` already has correct `finally` cleanup — the report's claim is broader than
   the code; only `/stamp-file` needs the fix.

**Defaults and hard maxima.** Caps must be configurable, not hardcoded —
`.agents/rules/data-sources.md` says not to impose arbitrary app-level limits unless required for
safety. These are required for safety; the defaults still need to be generous. Every row goes in
`.env.example`, with the hard maximum enforced in `config/env.ts` so an operator cannot configure
the limit away:

| Control | Default | Hard max |
| --- | --- | --- |
| Decoded response bytes (JSON read / health / output) | 5 MB | 50 MB |
| Outbound request deadline | 5 s (existing `timeoutMs`) | 60 s |
| Global outbound concurrency | 4 | 16 |
| Outbound queue length | 32 | 256 |
| Upload file size | 100 MB | operator-raisable; stamping is the product |
| Upload file count / non-file fields | 1 / 8 | — |
| MQTT payload bytes | 256 KB | 4 MB |

These numbers are a proposal, not measured. Pin them in the phase's ADR against what the Pi
actually sustains.

**How it landed.** `fetchExternalJson()` is where every outbound limit is enforced, not the four
call sites — it was already the one egress path from Phase 2. Bodies are read as a stream and the
request is aborted the moment the running total passes the cap; `Content-Length` is rejected up
front when already oversized but is not trusted, since it is absent on chunked responses and can
understate the body. undici decompresses before the chunks reach us, so the count is of decoded
bytes and a small gzip body that inflates past the cap is cut off mid-stream.
`fetchJsonWithTimeout()` is deliberately left uncapped: it serves deployment-config callers whose
responses (a Minima `coins` listing) are legitimately larger than any data-source-sized cap.

The global semaphore is `backend/src/shared/egress-limiter.ts`, with the bounded queue rejecting
fast past its length. Its deadline covers the queue wait as well as the request — starting the
clock only once a slot is acquired would let total wall time reach queue depth × timeout, so a
saturated limiter would hold callers far longer than any configured deadline suggests.

Every value reads through `boundedNumber()` in `config/env.ts`, which **clamps** rather than
honours an out-of-range setting, so an operator can tune a limit but cannot configure it away. The
upload size cap is the one row with a floor and no ceiling: stamping arbitrary files is the product.

Multer needed an error handler as well as `limits` — it signals an over-limit upload by passing a
`MulterError` to `next()`, and with nothing registered Express answered with an HTML 500 that a
client could not tell from a server fault. `backend/src/middleware/uploadErrors.ts` maps
`LIMIT_FILE_SIZE` to `413` and the rest to `400`.

Step 7's claim that "only `/stamp-file` needs the fix" was wrong: `/verify-proof-file` has the
identical missing-API-key early return above its `finally`, so it orphaned the temp file on that
path too. Both are fixed. `/backups/restore` was checked and is genuinely clean —
`saveUploadedBackup()` removes the multer temp file on the success path, and the `catch` removes it
otherwise.

**The defaults remain reasoned, not measured.** No Pi throughput or memory measurement was taken.
Tracked as **DEVICE-IO-09** in `docs/qa/gaps.md` rather than left implicit in the ADR.
