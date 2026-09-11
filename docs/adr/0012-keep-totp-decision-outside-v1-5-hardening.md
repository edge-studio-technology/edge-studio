# 0012: Keep the TOTP Product Decision Outside V1.5 Security Hardening

**Status:** Accepted
**Date:** 2026-09-07

## Context

ADR 0011 chose to remove the disabled TOTP implementation. The proposed removal was then threaded
through the V1.5 security-hardening plan, task tracking, risk register, and QA backlog as though it
were approved and scheduled work. That created a circular dependency: the hardening plan expected
removal before session-lifecycle work, while the removal plan was sequenced after that same work.

TOTP is currently disabled in the shipped UI and authentication flow through `TOTP_ENABLED = false`,
but its routes, services, schema, tests, and dependency remain. Whether that dormant implementation
should be retained, redesigned, re-enabled, or removed is a product and feature-lifecycle decision.
It is not required to decide that question in order to close the security findings assigned to
`task/272-security-hardening-v1-5`.

## Decision

V1.5 security hardening does not decide TOTP's future and does not remove its implementation.
ADR 0011 is superseded as an active decision.

The hardening branch may make only the security changes needed for the implementation that exists:

- Make all four TOTP setup/reset endpoints unavailable while the backend `TOTP_ENABLED` flag is
  false. The setup endpoints retain their existing first-admin guard as defense in depth.
- Revoke all sessions after both password changes and successful TOTP resets, because both
  credential-change paths exist in the current backend.
- Include stored TOTP secrets in any `APP_SECRET` migration while the schema remains present.
- Keep the onboarding QR retry-loop bug documented as dormant and require it to be resolved before
  TOTP can be re-enabled; fixing the feature behavior is not part of this hardening branch.

`docs/plans/remove-totp.md` remains only as prior analysis and a candidate implementation plan. It
is not approved, scheduled, or assigned to a branch. A future remove/retain/redesign decision needs
its own review and ADR; removal, if chosen, then gets its own ticket and branch.

## Alternatives considered

- **Remove TOTP in the V1.5 hardening branch.** Rejected because deletion changes authentication
  contracts, schema, dependencies, and coverage for reasons separate from the security findings.
- **Leave ADR 0011 accepted but postpone its implementation.** Rejected because active docs then
  continue to present removal as decided and scheduled, recreating the drift this ADR resolves.
- **Decide now to retain or re-enable TOTP.** Rejected because this decision establishes a scope
  boundary; it deliberately does not pre-empt the later product decision.

## Consequences

- The security-hardening plan can be implemented and reviewed without a feature-removal dependency.
- Dormant TOTP code remains maintenance surface after V1.5; Phase 8 is responsible for closing its
  routes while the feature is disabled.
- The database schema and `otpauth` dependency remain until a later decision explicitly changes them.
- Any future TOTP work starts from a fresh product decision rather than treating ADR 0011 or the
  existing removal plan as approval.

## Where this lives in code

This is currently a scope and planning decision; no production code implements it yet.

- `docs/plans/security/` — owns only the route gating and credential-session
  hardening required for V1.5.
- `docs/plans/remove-totp.md` — retained on hold as unapproved candidate analysis.
- `docs/qa/gaps.md` and `docs/security/auth-and-transport.md` — track the live dormant-route gap and
  its V1.5 mitigation.
- `docs/TASKS.md` — tracks a future TOTP product decision, not a removal implementation.
