# Feedback Hosted Receiver Plan

**Status:** Not started (Integritas API repository)
**Created:** 2026-08-18
**Goal:** Implement `POST /api/feedback` in the Integritas API so Edge Studio's hosted feedback delivery has a receiver.

## Context

Edge Studio already sends feedback to `https://integritas.technology/api/feedback` with the device's Integritas API key and keeps a local JSON fallback; see [ADR 0038](../adr/0038-feedback-hosted-delivery-with-local-fallback.md). The sender lives in `backend/src/features/feedback/` (`feedback.remote.ts`). This document is the hand-off spec for the receiver, which lives in the Integritas API repository, not here. Delete it once the receiver ships.

The sender also includes `submission.operationalStatus` (`node`, `integritas`, with the app's header labels such as `Node online`) and strips its local `remoteDelivery` state before sending.

## Receiver guidance

The hosted endpoint implementation lives in the Integritas API repository, not in `edge-studio`. Before implementing it, review and follow the existing Integritas API repo conventions for:

- Route/module layout.
- Authentication middleware.
- API key validation and request-id handling.
- Request validation helpers or schema library.
- Error response shape.
- Logging and redaction rules.
- Rate limiting/throttling primitives.
- Database/repository patterns.
- Background job or queue patterns, if any already exist.

Do not introduce a parallel validation, auth, logging, queue, or persistence style if the Integritas API repo already has one.

Endpoint:

```http
POST /api/feedback
```

Expected authentication:

- Use the same Integritas API key header convention as the existing web/core API endpoints.
- Reject missing, invalid, disabled, or revoked API keys before parsing/storing feedback.
- Resolve the API key to the owning Integritas account/project/user using existing repo logic.
- Do not accept user identity from the Pi payload as authentication. Treat Pi-provided user metadata as diagnostic context only.

Expected request body:

```json
{
  "schemaVersion": 1,
  "metadata": {
    "app": {},
    "user": {},
    "device": {}
  },
  "submission": {
    "id": "pi-generated-submission-id",
    "submittedAt": "2026-07-14T12:00:00.000Z",
    "page": {},
    "area": {},
    "type": "bug",
    "description": "...",
    "bug": {},
    "featureRequest": {},
    "browser": {},
    "stats": {}
  }
}
```

Validation requirements:

- Require `schemaVersion = 1`.
- Require `submission.id`, `submission.submittedAt`, `submission.type`, `submission.description`, `submission.page.path`, and `submission.area.id`.
- Validate feedback type enum: `bug`, `ux_issue`, `feature_request`, `question`, `other`.
- Validate feedback area enum to match the Pi-side list where possible.
- Validate bug severity/reproducibility enums when `submission.type = "bug"`.
- Validate feature request priority enum when `submission.type = "feature_request"`.
- Enforce maximum lengths at least as strict as the Pi app for free-text fields.
- Reject or ignore unknown fields according to the Integritas API repo's existing request validation policy.
- Treat all text as untrusted user input. Never render it as HTML without escaping/sanitization.
- Validate timestamps are parseable ISO strings, but do not trust client timestamps for ordering or retention decisions. Store server `receivedAt` separately.
- Validate numeric stats and viewport values are finite numbers within reasonable bounds.
- Limit full request body size. The Pi app currently sends small JSON; the hosted API should not accept multi-megabyte feedback payloads.

Suggested hosted persistence fields:

```txt
id                  server-generated feedback id
created_at          server received timestamp
account_id          owner resolved from Integritas API key
api_key_id          API key id/fingerprint, if the repo tracks it
pi_submission_id    submission.id from the Pi
pi_device_id        metadata.device.id
pi_user_id          metadata.user.id
app_name            metadata.app.name
app_version         metadata.app.version
feedback_type       submission.type
feedback_area       submission.area.id
page_path           submission.page.path
status              new | triaged | ignored | duplicate | resolved, if triage workflow exists
payload_json        validated/redacted full payload
dedupe_key          computed duplicate grouping key
```

Storage guidance:

- Prefer the existing Integritas API repo database/repository style.
- Store the full validated payload as JSON for AI ingestion and future schema evolution.
- Also extract key query fields such as account, type, area, app version, device id, user id, and received time.
- Do not store raw API keys.
- Redact or reject any accidental secret-looking fields if the API repo already has redaction utilities.

Response shape:

```json
{
  "ok": true,
  "remoteId": "server-feedback-id",
  "receivedAt": "2026-07-14T12:00:00.000Z",
  "dedupeStatus": "created"
}
```

Possible `dedupeStatus` values:

```txt
created
appended
duplicate_ignored
```

Failure responses should follow the existing Integritas API error format. Suggested error cases:

- `unauthorized`: missing/invalid API key.
- `validation_error`: malformed request or unsupported schema.
- `payload_too_large`: request body exceeds limit.
- `rate_limited`: API key/account/device sent too many requests.
- `server_error`: unexpected server failure.

Abuse protection:

- Apply the existing Integritas API rate limiter if available.
- Rate-limit by API key/account.
- Also consider secondary limits by `metadata.device.id` and source IP to reduce damage from leaked API keys.
- Use conservative limits for V2 because feedback volume should be low.
- Reject oversized descriptions and oversized request bodies.
- Avoid expensive synchronous AI analysis in the request path.
- Do not let arbitrary payload fields affect database table names, file paths, URLs, or queries.
- Use parameterized queries/ORM-safe writes following the repo pattern.
- Log minimal request metadata only. Do not log full descriptions by default.

Duplicate handling and append strategy:

V2 should avoid creating excessive duplicate feedback rows when the same Pi retries or the same user submits repeated similar feedback.

Recommended dedupe layers:

1. Idempotency by `(account_id, pi_submission_id)`.
2. Soft grouping by a computed `dedupe_key`.

Idempotency rule:

- If the same `pi_submission_id` is received again for the same account, return the original `remoteId` instead of creating a new row.
- This makes Pi retries safe.

Suggested `dedupe_key` inputs:

```txt
account_id
metadata.device.id
metadata.user.id
submission.type
submission.area.id
submission.page.path
normalized description prefix or hash
```

Soft grouping rule:

- If the new feedback matches an open recent item from the same account/device/user/type/area/page and very similar description, append it as an occurrence/comment instead of creating a separate top-level issue.
- Keep the raw submission as a child event so no user input is lost.
- Return `dedupeStatus = "appended"`.

Do not over-dedupe:

- Different descriptions from the same page should remain separate unless clearly identical or near-identical.
- Bug reports and feature requests should not be grouped together.
- Feedback from different accounts should never be merged into one customer-visible item, though internal analytics can aggregate later.

Suggested data model if the Integritas API repo does not already have a feedback/triage model:

```txt
feedback_items
  id
  account_id
  status
  feedback_type
  feedback_area
  page_path
  title_or_summary
  dedupe_key
  created_at
  updated_at

feedback_events
  id
  feedback_item_id
  account_id
  pi_submission_id
  pi_device_id
  pi_user_id
  app_version
  received_at
  payload_json
```

This gives one triage item with many raw feedback events. If that is too much for the first hosted implementation, start with one table plus idempotency by `pi_submission_id`, then add grouping later.

Operational considerations:

- Add metrics/counters if the Integritas API repo already has observability: accepted, validation failed, unauthorized, rate limited, deduped, appended.
- Add admin/search tooling later; do not block initial ingestion on a full triage UI.
- Document retention policy before storing large volumes of user text.
- Make the endpoint safe to disable or roll back without affecting core Integritas stamping APIs.

Testing requirements for the hosted endpoint:

- Auth required: missing/invalid API key is rejected.
- Valid payload is accepted and persisted.
- Invalid schema/type/area is rejected.
- Oversized description/body is rejected.
- Same `pi_submission_id` retry returns original remote id.
- Rate limiter triggers under repeated requests.
- Payload with HTML/script text is stored as text and not executed/rendered unsafely.
- Payload containing suspicious secret-like fields is redacted or rejected according to repo policy.
- Requests from two accounts with the same `pi_submission_id` do not collide.

