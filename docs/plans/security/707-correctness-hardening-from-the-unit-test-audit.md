[← Back to security hardening index](./README.md)

# Task 707 — Correctness Hardening From The Unit-Test Audit Plan

**Status:** Done (2026-09-21)

**Created:** 2026-09-21
**Branch:** `dev-task/707-correctness-hardening-from-the-unit-test-audit`
**Goal:** Close three diagnosed production-contract gaps in Minima restart state cleanup, Minima destination validation, and Update Agent Docker stream timeouts without changing the graceful-restart design or expanding the V1 security sign-off scope.

## Context

This branch currently points at the same commit as `dev` (`7d470f6`) and has no ticket-specific
code changes. The focused existing suites pass, but they do not exercise the three reported failure
contracts:

```text
npm --prefix backend test -- tests/features/minima/minima.service.test.ts tests/shared/minima-address.test.ts
npm --prefix update-agent test -- tests/docker/docker.client.test.ts
```

The ticket is relevant, with one impact correction and one boundary clarification:

| Item | Current stage | Audit result |
| --- | --- | --- |
| Minima restart operation marker | Not implemented | A missing container already clears the marker, and background failures already clear it. A thrown container lookup or restart-baseline read does not. The marker is not a server-side mutex and self-expires after six minutes, so the defect is stale `restarting` UI/state rather than an indefinite API lock. |
| Minima address validation | Boundary wiring is partial; validation is not implemented | `isMinimaAddress()` accepts any trimmed value beginning with `Mx` or `0x`, and its tests currently bless truncated examples. Wallet and address-book routes call it, but automation calls `sendPayment()` directly, so the wallet service must also enforce the contract. |
| Update Agent stream timeout | Not implemented | `dockerRequestStream()` sets `settled = true` before `request.destroy(timeoutError)` emits `error`; the error handler then returns without rejecting. Existing stream tests only assert timeout registration and never fire the handler. |

These are unit-test-audit gaps, not external-review findings, and remain outside the V1 security
sign-off bar. The dormant onboarding TOTP QR retry-loop issue remains out of scope and must be
handled before any future TOTP re-enablement.

## Authoritative Minima Address Contract

The implementation must follow Minima's parser and encoder rather than derive a fixed length from
examples. Research for this plan was pinned to Minima source commit
[`52542f25605a28a776e9b3b43b0808a05dceab01`](https://github.com/minima-global/Minima/commit/52542f25605a28a776e9b3b43b0808a05dceab01):

- [`BaseConverter.java`](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/utils/BaseConverter.java)
  defines case-insensitive hexadecimal decoding, permits odd hexadecimal digit counts by adding a
  leading zero nibble, and defines the `Mx` base-32 alphabet mapping.
- [`Address.java`](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/objects/Address.java)
  defines `Mx` as a marker byte (`1`), a two-byte payload length, the address bytes, and the first
  four bytes of the payload's SHA3-256 digest before base-32 encoding. Its decoder validates the
  marker and checksum.
- [`Command.java`](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/system/commands/Command.java)
  accepts both forms for address parameters and does not impose a fixed wallet-address length.
- Minima's official [wallet API documentation](https://github.com/minima-global/docs/blob/main/content/docs/user-guides/meg/meg-wallet-api.mdx)
  confirms that both `0x` and `Mx` destinations are supported and that `Mx` includes a checksum
  checked before transaction execution.

The Edge Studio validator should therefore accept a trimmed, case-insensitive `0x` value containing
one or more hexadecimal digits, including odd digit counts, without imposing a guessed byte length.
For `Mx`, decode the official alphabet, validate the marker and declared payload length, consume the
complete encoded structure, and compare the four checksum bytes with SHA3-256. Accept case variants
that the Minima decoder accepts, but do not accept a prefix-only, truncated, non-alphabet, malformed,
or checksum-invalid value. Use a real matching `0x`/`Mx` pair from the official documentation as the
positive fixture and corrupt that fixture for negative cases.

This is an upstream protocol-compatibility rule, not a new local architecture choice, so no new ADR
is expected. ADR 0001 remains the controlling decision for graceful restart behavior.

## Backend Changes

### 1. Clear the Minima operation marker on restart setup failures

Update `restartMinimaContainer()` in
`backend/src/features/minima/minima.service.ts`:

- Keep `beginMinimaOperation("restart")` before container discovery.
- Wrap the awaited setup phase—`getComposeServiceContainer("minima")`, the missing-container
  check, and `getContainerRestartBaseline(container.Id)`—so every thrown setup error calls
  `endMinimaOperation()` and is rethrown.
- Do not clear the marker after successful background dispatch. Preserve ADR 0001's immediate
  `{ state: "restarting" }` response and let the existing status observation clear successful
  operations.
- Keep the existing background `.catch(...)` cleanup and logging for failures after dispatch.
- Do not change the five-minute graceful wait, the six-minute operation window, `quit compact:true`,
  Docker restart-cycle detection, or the forceful fallback.

Extend `backend/tests/features/minima/minima.service.test.ts` with regressions for a rejected
container lookup and a rejected restart-baseline read. Each must reject with the original error,
leave `isMinimaOperationInProgress()` false, and avoid starting the background graceful restart.
Keep the existing tests that pin ADR 0001's ordering and timeout values.

### 2. Replace prefix-only destination validation

Update `backend/src/shared/minima-address.ts` with the smallest local parser needed to implement the
contract above. Reuse the existing SHA3-256 primitive from `backend/src/shared/crypto.ts`; do not add
a dependency or duplicate a frontend validator.

Update `backend/tests/shared/minima-address.test.ts`:

- Replace truncated strings currently treated as valid with the official matching `0x` and `Mx`
  fixtures.
- Cover trimmed and case-insensitive valid input, valid odd-length hexadecimal, and the accepted
  variable-length `0x` contract.
- Reject prefix-only values, non-hexadecimal `0x`, invalid `Mx` alphabet/structure, truncation, and a
  one-character checksum corruption.

Keep the existing route checks in:

- `backend/src/features/wallet/wallet.routes.ts`, with the error changed from “must start with” to a
  format-accurate message;
- `backend/src/features/address-book/address-book.routes.ts`, for both create and update, with the
  same format-accurate message.

Also call `isMinimaAddress()` inside `sendPayment()` in
`backend/src/features/wallet/wallet.service.ts` before building the RPC command. This makes the
wallet service the invariant boundary for both direct HTTP sends and automation's
`send_transaction` path, while the route-level check continues to return a client validation error
rather than a dependency error.

Add focused regressions:

- `backend/tests/features/wallet/wallet.service.test.ts`: a malformed but prefix-matching recipient
  rejects before `runMinimaPathCommand()`.
- `backend/tests/features/wallet/wallet.routes.test.ts`: the same direct-send input returns `400`
  and does not call `sendPayment()`.
- `backend/tests/features/address-book/address-book.routes.test.ts`: create and update reject the
  malformed recipient before repository mutation.

Use minimal Express router harnesses and mock the owned service/repository boundary, following the
existing backend route-test pattern. Do not migrate or silently rewrite existing address-book rows;
that is separate data-remediation work if malformed stored entries are found in real deployments.

## Update Agent Changes

### 3. Settle Docker stream timeouts exactly once

Update `dockerRequestStream()` in `update-agent/src/docker/docker.client.ts` so the timeout path
rejects the returned promise with `Docker API POST <path> timed out` and destroys the request.
Centralize the existing settled check in a small local reject-once path, or reject directly in the
timeout callback before/while marking it settled; do not set `settled` and then rely on the guarded
request `error` listener to perform the rejection.

Preserve current behavior for successful completion, HTTP errors, Docker progress errors,
non-JSON progress lines, and request errors. Do not change the default pull timeout or Docker API
surface.

Extend `update-agent/tests/docker/docker.client.test.ts` by firing the captured stream timeout
handler and asserting:

- the promise rejects with the timeout error;
- `request.destroy()` is called;
- a subsequent request `error` and response `end` cannot change the outcome or produce a second
  rejection/settlement.

Use the existing HTTP mock and explicit timeout-handler invocation; fake wall-clock waiting is not
needed.

## Docs

When implementation is complete:

- Add branch-named `Fixed`/`Security` entries under
  `## [Unreleased] dev-task/707-correctness-hardening-from-the-unit-test-audit` in `CHANGELOG.md`.
- Mark WALLET-08 complete in `docs/qa/gaps.md` and record that validation mirrors Minima's source
  grammar rather than a fixed example-derived length.
- Update `docs/security/wallet-and-tokens.md` to mention server-side destination validation at the
  wallet and address-book boundaries.
- Mark this plan and Phase 9 complete, update the security-hardening index, and use the
  `session-notes` skill to reconcile `docs/SESSION.md` and `docs/TASKS.md`.
- Update `SECURITY.md` only if implementation changes its policy-level security guidance; no
  README or API workflow change is expected.

## Verification

Focused regressions:

```bash
npm --prefix backend test -- tests/features/minima/minima.service.test.ts tests/shared/minima-address.test.ts tests/features/wallet/wallet.service.test.ts tests/features/wallet/wallet.routes.test.ts tests/features/address-book/address-book.routes.test.ts
npm --prefix update-agent test -- tests/docker/docker.client.test.ts
```

Required repository checks:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix update-agent run build
docker compose config
git diff --check
git status --short --untracked-files=all
```

Review the final diff to confirm that the graceful restart still responds before the background
quit/wait/fallback sequence completes, malformed destinations never reach Minima RPC, and the Docker
stream timeout has only one settlement owner. No Pi, real-wallet send, or real Docker pull is
required for these deterministic failure paths.

## Completion Criteria

- Every synchronous/awaited failure after starting a Minima restart clears the operation marker,
  while successful graceful restart behavior remains identical to ADR 0001.
- Both official destination forms validate according to Minima's source contract; malformed
  prefix-matching values fail at address-book, direct wallet, and wallet-service boundaries.
- A stalled Docker stream rejects on timeout exactly once and cannot hang its caller.
- Focused tests, the full coverage suite, all three package builds, Compose validation, and final
  worktree checks pass.

## Completion Record

- Minima restart setup failures now clear the operation marker and preserve the original error;
  successful background restart behavior and timing remain unchanged.
- Wallet sends and address-book create/update operations now enforce Minima's source-defined `0x`
  and checksummed `Mx` grammar, including the wallet service boundary used by automation.
- Docker stream timeouts now reject and destroy the request through one guarded settlement path.
- Focused regressions and `npm run check` passed, as did all three package builds,
  `docker compose config`, `git diff --check`, and the final worktree check.

## Estimate

About **3–4 engineering hours**.

## Out Of Scope

- The dormant onboarding TOTP QR retry-loop bug or any TOTP re-enablement decision.
- Changing the graceful-restart timing, restart detection, or forceful fallback.
- Frontend-only address grammar duplication or address canonicalization.
- Repairing pre-existing malformed address-book data.
- Broader Docker client refactoring.
