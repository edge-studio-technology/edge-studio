# 0038: Feedback — Hosted Delivery With a Local Fallback

**Status:** Accepted
**Date:** 2026-08-11

## Context

Testers need a low-friction way to report bugs and requests from inside the app, with enough
context (page, device, version, connection state) to act on. The Pi may be offline or without an
Integritas key, and feedback must never carry secrets.

## Decision

- Authenticated users submit feedback from a sidebar modal through the backend; the browser never
  writes files or calls an external service.
- Every submission is saved locally first, in one aggregate JSON file at
  `DATA_DIR/feedback/feedback-submissions.json`, readable by a person and easy to ingest later.
  The backend keeps an export endpoint for operational recovery; the browser UI is submit-only.
- When an Integritas API key is configured, the backend also sends the submission to
  `https://integritas.technology/api/feedback` with that existing backend-only key, only after the
  user confirms consent for that submission. Delivery status (`sent`, `pending`, `failed`,
  `not_configured`) is recorded on the stored submission.
- Without a key, feedback is saved locally only.
- Content: page, area, type, details, description, browser context, non-secret app/user/device
  metadata, the connected Integritas account ID, node and Integritas connection status, lightweight
  usage stats, `app.version` from the update-agent state file and `app.build` from the backend
  image (ADR 0029). Never passwords, cookies, API keys, seed phrases, or encrypted secret values.

## Alternatives considered

- **A separate feedback API key or `.env` settings.** More secret handling and config for no gain
  over the existing Integritas key.
- **Hosted delivery without a local copy.** Loses feedback when offline or when the receiver fails.
- **A hosted on/off settings panel, manual download, and retry in the UI** (first V2 version).
  Removed to keep the UI submit-only; consent per submission is the control.
- **Browser-side file writing or direct calls to Integritas.** Breaks the backend-only API rule and
  would expose the key.

## Consequences

- The local file grows without automatic pruning.
- Hosted delivery depends on the receiver endpoint in the Integritas API, which is specified in
  `docs/plans/feedback-hosted-receiver.md` and not yet built.
- Submissions are only as identifying as the metadata listed above; anything more needs a new
  consent decision.
