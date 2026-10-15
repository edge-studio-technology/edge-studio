# 0010: Second-Opinion Audit Verdict on the V1.5 Security Review

**Status:** Accepted
**Date:** 2026-09-04

## Context

An external model (Daybreak Blue) statically reviewed the repository at `571ba70`
(`docs/security/external-review-2026-09-03.md`, kept verbatim): 14 findings, 2 high / 11 medium /
1 low. We re-derived every finding from source before acting, since a wrong report in either
direction is expensive.

Verified during the audit:

- **All 14 findings are accurate**, with correct line references and correct negative results.
- **Two are understated.** The backup password leaked on three paths (backup success, backup
  failure via `sendApiError`'s `extra`, and a whitelisted console `backup`), not one. The webhook
  token also reached `data_source_reads`, but only for workflows with a record-trigger-event block.
- **One likelihood is overrated.** `install.sh` generates a random `APP_SECRET`, but preserves a
  supplied `.env` carrying `dev-change-me`, so exposure is narrower than medium but not zero.
  The wallet-action finding can't redirect funds (recipient and amount are fixed config); medium
  stands as denial-of-funds.
- **One finding was missed and outranks every medium.** HTTP JSON Source URLs had no validation, so
  `http://minima:9005/vault` over the shared Compose network returned seed/key material in the
  API response and read history, bypassing the console's hard exclusions and re-auth. HTTP JSON
  Targets had the same primitive.
- **The bundle-trust finding is high and distinct from `curl | sudo bash`.** The unverified runtime
  bundle shipped the verifier and the key, so compromising the manifest host alone gave a
  persistent, root-level compromise at install time.

Daybreak Blue reviewed this audit, accepted it, and corrected four statements in the first draft;
each was re-verified and folded in.

## Decision

- Accept the review as the basis for V1.5 hardening, with this audit's re-rating as the order of
  work and the missed SSRF as a first-class finding below the two highs.
- Fix order: backup password DTO; operator-URL validation (ADR 0014); session revocation on
  credential change; bundle signing and embedded trust set (ADR 0016); egress and upload limits
  (ADR 0017); fail closed on weak `APP_SECRET` (ADR 0021) and image pinning; retention and webhook
  redaction (ADR 0022).
- The unauthenticated first-boot admin claim and anonymous MQTT are product decisions, not
  patches. Both are provisionally accepted under the single-admin trusted-LAN threat model and
  still need a confirmed decision.
- The four surfaces the review cleared stay closed: `realpath` path containment, and
  `SameSite=Strict` with JSON/multipart bodies as the CSRF posture.

## Alternatives considered

- **Use the report's own ordering.** Puts wallet repetition above active secret disclosure and
  omits the SSRF.
- **Discount the report.** It earned its confidence.
- **Record the triage in `SECURITY.md`.** That file states the product's current boundaries; a
  dated triage and disagreement with an external assessment is a decision record. Individual
  findings land in `SECURITY.md` as fixed or accepted.

## Consequences

- The ordering assumes a managed single-admin LAN. Public or multi-tenant exposure moves the
  first-boot claim and anonymous MQTT sharply up.
- Both review and audit were static: dependency advisories, live host/network config, CI/registry
  protections, and Minima's command parser were not covered.

## History

- 2026-09-21: All ordered fixes landed except third-party image digest pinning (finding [6]) and
  the two product decisions.
