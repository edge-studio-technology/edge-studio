# High-Risk Business Logic Hardening Plan

> **Archived 2026-09-04 — superseded by [security-hardening-v1-5.md](../security-hardening-v1-5.md).**
> Session revocation became that plan's Phase 3, outward error sanitization its Phase 1, and the
> four remaining items its Phase 9. Kept for the audit context that produced them. Do not add new
> work here.

**Status:** Archived (superseded)  
**Created:** 2026-09-02  
**Goal:** Address production-behavior gaps identified by the high-risk unit-test audit without mixing those changes into the unit-test branch.

## Context

The `test/unit-tests-and-ci` audit found several places where stronger tests alone cannot establish the intended security or recovery behavior because the production contract is absent or incomplete. This branch should remain limited to unit-test improvements, so the behavior changes below are deliberately deferred to a separate branch.

Test-only work may characterize behavior that already exists. It must not encode the gaps below as accepted behavior or modify production code merely to make a new test pass.

## Authentication Changes

- Update `backend/src/features/auth/auth.service.ts` so a successful password change invalidates existing sessions through `session.service.ts`.
- Apply the same invalidation policy after a successful TOTP reset; otherwise a stolen session remains valid after either credential changes.
- Default decision for implementation: revoke all sessions, including the session that performed the change, and require a fresh login. If retaining the current session is preferred, first extend the service/route contract so the current token can be identified explicitly.
- Extend `backend/tests/features/auth/auth.service.test.ts` and route/session coverage to verify invalidation, audit events, and the selected current-session policy.

## Outward Error Sanitization

- Define a client-safe error contract in `backend/src/shared/api-error.ts` and `backend/src/shared/structured-error.ts` rather than forwarding arbitrary native error messages or context.
- Keep detailed native errors available to server-side logs while removing secrets, credential-bearing URLs, tokens, headers, and sensitive filesystem paths from API responses.
- Review callers that attach sensitive context, including MQTT broker URLs, so the sanitization boundary is consistent and not dependent on every call site remembering to redact.
- Extend `backend/tests/shared/api-error.test.ts` and `backend/tests/shared/structured-error.test.ts` with representative secret-bearing inputs and assertions for both safe client output and retained diagnostic logging.

## Minima Restart Recovery

- Update `backend/src/features/minima/minima.service.ts` so every failure after the restart operation lock is acquired clears that lock, including failures while locating the container or reading its restart baseline before the background restart task starts.
- Preserve the existing graceful-restart contract: issue `quit compact:true`, detect an autonomous container cycle, and use forced Compose restart only as the timeout fallback.
- Extend `backend/tests/features/minima/minima.service.test.ts` to verify cleanup for both pre-background and background failures.

## Minima Address Validation

- Establish the authoritative accepted Minima address grammar before changing `backend/src/shared/minima-address.ts`; do not infer length or character rules from examples alone.
- Once confirmed, replace prefix-only acceptance with validation that rejects malformed `Mx` addresses while preserving any supported `0x` token/address forms at their actual call sites.
- Apply the same validator consistently to wallet payment and address-book boundaries, then add service/route tests for valid, truncated, malformed, and mixed-format inputs.

## Onboarding TOTP QR Retry Loop

- `frontend/src/features/setup/OnboardingWizard.tsx`'s QR-code effect guards on `qrCode`/`loadingQr` but not `qrError`, so a failing `initTotp()` clears the error and re-requests on every render — an unbounded retry loop against the setup endpoint, with the error message never staying on screen.
- Only reachable while `TOTP_ENABLED` is `true`, so it is currently dead code; fix before re-enabling TOTP.
- Add an attempt guard (or a retry control) and assert both the surfaced error message and a single request in `frontend/tests/features/setup/OnboardingWizard.test.tsx`, replacing the deliberately narrow assertion left there.

## Update Agent Stream Timeout Settlement

- Update `update-agent/src/docker/docker.client.ts` so `dockerRequestStream()` explicitly rejects when its timeout fires.
- Preserve the single-settlement guard, but do not mark the request settled before the timeout error can reach the promise rejection path.
- Extend `update-agent/tests/docker/docker.client.test.ts` to invoke the registered timeout callback and verify both request destruction and promise rejection.

## Docs

- Update `SECURITY.md` and the relevant file under `docs/security/` for the credential-invalidation and outward-error contracts.
- Update `docs/qa/gaps.md` when each known gap is resolved.
- Add a concise `CHANGELOG.md` entry for user-visible session invalidation or API error behavior changes.
- Reconcile `docs/TASKS.md` and `docs/SESSION.md` after implementation.

## Verification

- Run the focused auth, shared-error, Minima, wallet, address-book, and Update Agent Docker-client unit suites.
- Run `npm run check` from the repository root.
- Run `npm --prefix backend run build` and `npm --prefix frontend run build`.
- Run `docker compose config`.
- Manually confirm that changing a password or TOTP requires a fresh login under the selected session policy.
- Manually exercise a representative backend failure and verify the response is safe while server logs retain actionable diagnostics.
