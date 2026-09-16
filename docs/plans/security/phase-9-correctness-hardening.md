[← Back to index](./README.md)

# Phase 9 — Correctness hardening from the unit-test audit

**Covers:** three of the four non-review items from the archived
`high-risk-business-logic-hardening.md`. Its fourth — the onboarding TOTP QR retry loop — remains
dormant and is outside this branch. It must be fixed and tested before any future TOTP re-enablement.
These are not review findings; they are places where tests could not establish intended behavior
because the production contract was absent. Lower urgency than Phases 1-7, but they are already
diagnosed, so they are cheap.

1. **Minima restart operation lock** — `backend/src/features/minima/minima.service.ts`: every
   failure after the lock is acquired must clear it, including failures locating the container or
   reading its restart baseline before the background task starts. Preserve the graceful-restart
   contract from [adr/0001](../../adr/0001-minima-graceful-node-restart.md).
2. **Minima address validation** (WALLET-08) — establish the authoritative address grammar before
   changing `backend/src/shared/minima-address.ts`; do not infer length or character rules from
   examples. Then replace prefix-only acceptance, and apply the same validator at the wallet-payment
   and address-book boundaries.
3. **Update Agent stream timeout** — `update-agent/src/docker/docker.client.ts`:
   `dockerRequestStream()` must reject when its timeout fires, preserving the single-settlement
   guard without marking the request settled before the rejection path can run.
