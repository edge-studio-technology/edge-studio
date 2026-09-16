[← Back to index](./README.md)

# Phase 1 — Stop returning the backup password

**Status: done** (2026-09-07).

**Covers:** [7]. Active secret disclosure; smallest fix in the set. Do this first.

The password reaches clients on three paths, all because `createBackup()` returns
`runMinimaPathCommand`'s result verbatim and that object carries `command`
(`backup file:... password:"<plaintext>"`) and `source` (the same string percent-encoded).

1. `backend/src/features/minima/minima-backup.service.ts` — `createBackup()` returns a purpose-built
   result object (file name, size, created-at, trigger source), never the RPC result. Same for any
   other function in this file that spreads an RPC result outward.
2. `backend/src/features/minima/minima.routes.ts` — `POST /backups` returns that DTO.
3. The failure branch leaks too: `dependencyUnavailable(res, message, detail, result)` spreads
   `extra` into the error body via `sendApiError`. Pass a redacted context object, not `result`.
4. `POST /api/minima/console/run` returns the same object for a whitelisted `backup`. The console
   dispatches to `createBackup()` per `.agents/rules/minima.md`, so fixing (1) fixes this — add a
   test that pins it rather than assuming.

**Then the systemic fix** (from the archived high-risk plan — same root cause, one step out):

5. Define a client-safe error contract in `backend/src/shared/api-error.ts` and
   `structured-error.ts` rather than forwarding arbitrary native error messages and context.
   Secrets, credential-bearing URLs, tokens, headers, and sensitive filesystem paths reach neither
   responses **nor logs**. "Detailed errors stay in server logs" is the wrong boundary for this
   finding: the leaking string is `backup file:... password:"<plaintext>"`, and a Pi's Docker logs
   are readable by anything that can reach the socket. Redact where the command string is built,
   then let both sinks carry the redacted form. Logs may keep more *context* than responses (call
   site, error class, non-secret arguments); neither may keep the secret.
6. Review call sites that attach sensitive context — MQTT broker URLs especially — so redaction is
   a boundary, not something every caller must remember.

Steps 1-4 must not wait on 5-6.

**How it landed.** `backend/src/shared/redact.ts` is the one boundary. `createBackup()` and
`restoreBackup()` return purpose-built DTOs; `runMinimaPathCommand()` redacts its `command`,
`source`, and `body` and rethrows errors with a redacted message and no cause chain, so the raw
command exists only for the fetch itself; `structuredError()` redacts message/native message/context
at construction (covering both the response and the persisted-error sink, including the MQTT
broker-URL call site of step 6), `parseStoredError()` redacts on read so pre-existing rows cannot
resurface a secret, and `sendApiError()` redacts the assembled body including `extra`. The backup
routes also pass explicit redacted context instead of the result object.

**Tests:** extend `backend/tests/features/minima/minima-backup.service.test.ts` — assert the
success DTO, the failure-path body, and the console-run body each contain neither the plaintext
password nor a percent-encoded form of it. Assert on the serialized response, not the object shape.
Extend `backend/tests/shared/api-error.test.ts` and `structured-error.test.ts` with secret-bearing
inputs, asserting both safe client output and retained diagnostics.
