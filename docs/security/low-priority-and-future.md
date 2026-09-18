# Low Priority Or Future Risks

Related: [SECURITY.md](../../SECURITY.md) · [qa/gaps.md](../qa/gaps.md) · [plans/security/](../plans/security/README.md)

## Lack Of Rate Limiting

Risk: Endpoints can be called repeatedly.

Impact: Local DoS, Integritas quota consumption, log noise.

Controls: Login, setup, and `/api/auth/settings/*` are rate-limited (`authRateLimiter`, 5 requests
per 15 minutes, skipping successful requests). Phase 7 added one-minute traffic limiters with
`RateLimit-*` headers and JSON `429` responses: webhook ingestion (60 per client IP and source),
automation mutations and manual runs (30 per client; reads and draft validation are not limited),
and Integritas stamp creation (10 per client across `/stamp` and `/stamp-file`).

Limits: all HTTP limiters are in-memory and reset when the backend restarts. They cannot see MQTT or
GPIO events; those, and every other trigger, are bounded by the persisted per-workflow run budget
([wallet-and-tokens.md](./wallet-and-tokens.md#automated-wallet-transactions)). Files and other
admin-only endpoints remain unlimited.

Status: **Mitigated for the paths untrusted event sources can drive (Phase 7, GAP-10).**

## Error Response Detail

Risk: Backend may return upstream error bodies and detailed internal status.

Impact: Information disclosure, including secrets.

Controls: `shared/redact.ts` is the single redaction boundary. `structuredError()` redacts every
error's message, native message, and context at construction, so both sinks — API responses and
persisted error columns — carry the redacted form; `parseStoredError()` redacts on read so rows
written before this existed cannot resurface a secret; `sendApiError()` redacts the whole assembled
response body, including the `extra` object call sites spread into it. Covered patterns are secret
`key:value` command arguments in both raw and percent-encoded form, `Bearer` tokens, credentials in
a URL's userinfo (e.g. an MQTT broker URL), and values under secret-looking object keys.

Plan: Logs may keep more non-secret context than responses (call site, error class, non-secret
arguments); neither may keep a secret. Widen the covered patterns as new secret-bearing call sites
appear.

Status: Mitigated for the confirmed disclosure (the Minima backup password) and for the general
contract. Closed in Phase 1 of
[plans/security/phase-1-backup-password-leak.md](../plans/security/phase-1-backup-password-leak.md).

## Logging Sensitive Data

Risk: Request logging logs method and URL. Confirmed live: `requestLogger` logs `originalUrl`
unconditionally, so webhook bearer tokens land in Docker logs.

Impact: Secret leakage into Docker logs, and into `data_source_reads` where a workflow records the
trigger event.

Plan: Redact the webhook token segment; keep logs metadata-only. Never log API keys, request bodies,
canonical bytes, or proof payloads unless explicitly redacted.

Status: **Mitigated (Phase 7).** `requestLogger` passes URLs through `redactSecrets()`, which masks
the `/api/data-source-webhooks/<token>` segment and URL userinfo; nginx logs a masked request URI on
both servers and logs only critical errors for the webhook location. Docker `json-file` logs rotate
at 10 MB × 3 files per service, and Update Agent preserves that log configuration when it recreates
containers. Logs written before this change are not rewritten.

## Missing Security Tests

Risk: Security-sensitive behavior was manually verified.

Impact: Regressions may go unnoticed.

Status: **Largely closed (0.39.0).** Unit suites now cover every feature area of backend, frontend,
and Update Agent, with per-package coverage thresholds enforced by `npm run check`, plus a smoke test
asserting every non-public backend route requires a session. Path containment and crypto are covered.
Remaining gap is regression tests for the fixes in this hardening round — each phase in
[plans/security/](../plans/security/README.md) requires a test that fails
before its fix.
