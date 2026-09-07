# 0013: Secret Redaction Boundary

**Status:** Accepted
**Date:** 2026-09-07

## Context

`backend/src/shared/redact.ts` keeps secrets (backup passwords, seed phrases, API keys,
URL-embedded credentials) out of API responses, persisted error rows, and logs. Motivating
case: the Minima backup command (`backup file:... password:"<plaintext>"`), built as an RPC
command string — a Pi's Docker logs are as much a sink as an HTTP response body.

A Codex audit of the first implementation found 5 defects, all fixed: blanket key-blanking
corrupting Minima RPC bodies, a spaced password only partially redacted in encoded form,
wallet seed phrases not covered, persisted string errors bypassing redaction, and a fail-open
depth limit. Fixing them changed the module's shape (below).

## Decision

**One shared boundary, not per-call-site redaction.** Every sink reads through `redact.ts`.

**`redactDeep()` vs `redactStrings()`.** `redactDeep()` blanks secret-looking keys and scrubs
strings, for objects we own (error contexts, response bodies, persisted rows). `redactStrings()`
only scrubs strings, for third-party payloads like Minima RPC bodies, whose keys (`tokenid`,
`token`) are data, not credentials. Split after `redactDeep()` on a Minima body blanked
`tokenid`, breaking wallet balances and token creation — a bug the wallet/token test suites
couldn't catch because they mock `minima.rpc.js` wholesale. `minima.rpc.test.ts` now mocks only
`global.fetch` and pipes recorded bodies through the real parsers.

**`serializeStructuredError()` redacts at write time, not just `parseStoredError()` at read
time.** Some callers persist a bare `error.message` directly, bypassing `structuredError()`.

**`walk()` returns `TRUNCATED` past `maxDepth` instead of the original subtree.** Fail closed:
an uninspected subtree crossing the boundary is the one thing this exists to prevent.

**`isSecretKey()` is one flat list, substring-matched against a normalized key**, replacing an
earlier three-structure version (exact-word set + prefix/suffix compound list + a camelCase
tokenizer). Substring match is a strict superset of that coverage, so this can only over-redact
more, never leak less — confirmed by the existing test suite passing unmodified. Bare `token`
stays excluded: it's a Minima token id here, not a credential, and no matching strategy can
derive that automatically.

## Alternatives considered

- **Per-call-site redaction.** Rejected — the same command/URL shapes recur across backup,
  restore, and console commands; scattering the logic multiplies the same bug class.
- **One `redactDeep()`-only function, special-cased at each call site.** Rejected in favor of
  two named functions with a documented contract, so the right one is picked by name.
- **Exact-match allowlist of full key names** instead of substring matching. Rejected — it
  requires hand-enumerating every variant of `password` (`adminPassword`, `oldPassword`, ...).

## Consequences

- One list (`secretKeyWords`) to update for a new secret field, not three.
- Substring matching over-redacts a key that merely contains a listed fragment; accepted since
  the failure direction is safe.
- `redactStrings()` vs `redactDeep()` is a contract, not a runtime check — a future caller can
  still pick wrong for a new payload shape.

## Where this lives in code

- `backend/src/shared/redact.ts`, `backend/src/shared/structured-error.ts`
- `backend/src/features/minima/minima.rpc.ts` — the call site needing `redactStrings()`
- `backend/tests/shared/redact.test.ts`, `structured-error.test.ts`,
  `backend/tests/features/minima/minima.rpc.test.ts`
