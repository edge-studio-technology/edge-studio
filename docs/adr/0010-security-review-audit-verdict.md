# 0010: Second-Opinion Audit Verdict on the V1.5 Security Review

**Status:** Accepted
**Date:** 2026-09-04

## Context

An external security model (Daybreak Blue) produced a static review of the repository at
`571ba70`, recorded in `.temp/security/security-review-2026-09-03.md`: 14 findings, rated
2 high / 11 medium / 1 low. Before acting on it we ran a second-opinion audit — every finding
re-derived from current source rather than taken on trust — because a report that is wrong in
either direction is expensive: false positives burn hardening budget on non-issues, and an
inflated severity mix hides the findings that actually matter.

Verified during the audit, against source rather than against the report's own claims:

- **All 14 findings are factually accurate.** Every affected line reference resolves to the code
  the report describes. No fabricated findings, no stale line numbers. The report is grounded.
- **Three findings are understated by the report itself.** They are real as written, but the
  write-up misses part of their own reach:
  - The backup password leaks on *three* paths, not one. `createBackup()` returns
    `runMinimaPathCommand`'s result verbatim, and that object carries both `command`
    (`backup file:... password:"<plaintext>"`) and `source` (the same string percent-encoded
    into a URL). `POST /api/minima/backups` returns it on success; the failure branch also
    returns it, because `dependencyUnavailable(res, ..., result)` spreads `extra` into the error
    body via `sendApiError`; and `POST /api/minima/console/run` with a whitelisted `backup`
    returns the same object again.
  - The webhook token reaches the database, not only the request log. Ingest writes
    `sourceUrl: "/api/data-source-webhooks/<token>"` into `data_source_reads`.
  - The runtime-bundle finding is not a duplicate of the `curl | sudo bash` finding, and the
    distinction matters — see below.
- **Two findings are overrated.**
  - The wallet-drain finding assumes an attacker can move funds. They cannot choose the
    destination: the recipient is a pre-existing address-book entry and the amount is fixed in
    block config. Repeated triggering is denial-of-funds to an address the admin already
    trusted, not theft.
  - The `APP_SECRET` fallback is rated likelihood medium. `install.sh` generates
    `openssl rand -hex 32` on every supported install path, so real exposure is confined to
    hand-rolled `docker compose up`.
- **One issue the review missed outranks most of its mediums.** `parseJsonApiConfig` applies no
  scheme, host, or private-range validation to `config.url` — it accepts any string.
  `POST /api/data-sources/:id/read` fetches that URL and returns the parsed response body as
  `result.preview`. `minima` sits on the shared `integritas` Compose network with
  `minima_rpcenable: "true"` and no RPC password. An HTTP JSON Source pointed at
  `http://minima:9005/vault` or `http://minima:9005/keys` therefore returns wallet key material
  in the API response and persists it to read history. This defeats the console catalog's
  hard-exclusion of `vault`/`keys`/`sendfrom` and the whitelist re-auth requirement — the exact
  controls `.claude/rules/minima.md` cites as the reason no generic Minima proxy is allowed.
  The same primitive is reachable through `http-output` targets, whose response body is also
  returned. It is not exploitable to `file://`; undici's `fetch` does not implement that scheme.
  Minima's RPC port is bound to `127.0.0.1` on the host, which is precisely why a
  container-network-internal bypass is the interesting path.
- **The bundle-trust finding is worse than the report's own "medium".** `install.sh` downloads
  `edge-studio-runtime.tar.gz` from a URL derived from `MANIFEST_URL` and extracts it with no
  signature or digest check. That archive supplies both `scripts/verify-manifest.mjs` and
  `update-agent/manifest-public-key.pem` — the verifier and the trust anchor — and the same
  origin serves the manifest they are meant to authenticate. ADR 0009 states the Ed25519 check
  keeps ADR 0008's trust boundary unchanged; that holds for `update-agent` at runtime, whose key
  is baked into its image by `update-agent/Dockerfile`, but it does not hold for `install.sh`.
  At install time a compromise of `edgestudio.technology` alone is sufficient: the attacker's key
  validates the attacker's manifest, which pins the attacker's `update-agent` image, which ships
  the attacker's key. The compromise is persistent, and GitHub compromise is not required.

## Decision

- Accept the review as a valid basis for hardening work. Do not re-audit it further.
- Record the audit's re-rating rather than the report's original severity mix as the ordering we
  act on. The report's own severity field is left as-is in `.temp/security/`; this ADR is the
  reconciliation.
- Treat the missed SSRF as a first-class finding alongside the report's 14, at a severity above
  every medium in the original set. It shares the report's own threat model (stolen or misused
  admin session) and produces the worst outcome of any finding in it.
- Fix in this order, highest value per unit of work first:
  1. Backup password in API responses — active secret disclosure, and the fix is a purpose-built
     response DTO rather than returning the RPC result object.
  2. URL validation on data-source and HTTP-output configs — closes the Minima RPC bypass.
  3. Session revocation on password change — `deleteAllUserSessions` already exists in both the
     repository and service layers, and is already unit-tested, with zero production call sites.
  4. Sign the runtime bundle, or move `manifest-public-key.pem` into `install.sh` itself — until
     one of these lands, the manifest signature protects against GitHub compromise but not
     against compromise of the host that serves the bundle.
  5. Timeout and byte cap on `readJsonApiSource`; `limits` on both multer instances.
  6. Fail closed on a missing or `dev-change-me` `APP_SECRET`; digest-pin `minima` and
     `mosquitto`.
  7. Retention/pruning for automation runs, block runs, inbox items, and data-source reads;
     webhook token redaction in `requestLogger`.
- Classify the unauthenticated first-boot admin claim and anonymous MQTT as product decisions,
  not patches. Both are accurately described and both need a deliberate call on the appliance's
  provisioning and device-authentication model before any code changes.
- Leave the review's four "no issue found" surfaces closed. Path containment in
  `files.service.ts` correctly double-checks via `realpath`, and `SameSite=Strict` with
  JSON/multipart-only bodies is an adequate CSRF posture here.

## Alternatives considered

- **Take the report's severity ordering as-is.** Rejected: it would have put the wallet-drain
  finding above the backup-password disclosure, and would have left the SSRF unrecorded
  entirely, since the report never identified it.
- **Reject or heavily discount the report.** Rejected — it earned its confidence. Precise line
  references, no hallucinated findings, and correct negative results on the surfaces it cleared.
  Discounting it wholesale would have cost more than auditing it.
- **Fold the audit into `SECURITY.md` instead of an ADR.** Rejected: `SECURITY.md` documents the
  security boundaries and accepted risks of the product as it stands. This is the reasoning
  behind a triage ordering and a disagreement with an external assessment — it dates, and it
  belongs with the other decision records. Individual findings still land in `SECURITY.md` as
  they are fixed or explicitly accepted.
- **Open the findings as issues and skip the written rationale.** Rejected: the two severity
  downgrades in particular need their justification preserved. Without it, the next reader sees
  a security finding that was silently deprioritized.

## Consequences

- The ordering above is calibrated to this repo's stated threat model — a managed single-admin
  LAN appliance. Public-internet or multi-tenant exposure invalidates it, most sharply for the
  first-boot claim window and the anonymous MQTT broker, both of which move well up the list.
- Nothing was changed in response to this audit. Every finding in the report and the SSRF
  identified here remain live in the codebase as of this ADR.
- The SSRF fix is a validation layer over user-supplied URLs, which is a behavioral change for
  operators who legitimately point a data source at another host on the LAN. Whatever shape it
  takes — deny-by-default with an allowlist, or private-range blocking — it needs a deliberate
  decision about which internal destinations stay reachable, and its own ADR if the answer is
  not obvious.
- The audit was static, same as the review. Neither covers dependency advisories, live host and
  network configuration, CI and registry protections, or Minima's own command-parser semantics.
  The review's open questions on those points stand unchanged.

## Where this lives in code

Nothing here is implemented yet; these are the sites the decision refers to.

- `.temp/security/security-review-2026-09-03.md` — the reviewed report.
- `backend/src/features/minima/minima-backup.service.ts` — `createBackup` returns the
  password-bearing RPC result.
- `backend/src/features/minima/minima.rpc.ts` — `runMinimaPathCommand`'s `command`/`source`
  fields.
- `backend/src/features/minima/minima.routes.ts` — `POST /backups`, `POST /console/run`.
- `backend/src/shared/api-error.ts` — `dependencyUnavailable`/`sendApiError` `extra` spreading.
- `backend/src/features/data-sources/dataSources.service.ts` — `parseJsonApiConfig` (no URL
  validation), `readJsonApiSource` (no timeout, no byte cap), `sendHttpOutput`.
- `backend/src/features/data-sources/dataSources.routes.ts` — `POST /:id/read`, `GET /:id/health`
  (admin-gated read vs. non-admin health, on the same fetch primitive).
- `docker-compose.yml` — `minima` on the `integritas` network with RPC enabled and no password;
  untagged `minimaglobal/minimacore`; `eclipse-mosquitto:2`; `APP_SECRET` fallback.
- `backend/src/features/auth/session.service.ts` — `deleteAllUserSessions`, currently uncalled.
- `backend/src/features/auth/auth.service.ts` — `changePassword`, which does not revoke.
- `install.sh` — `download_runtime_bundle` (unverified extraction), `fetch_and_verify_manifest`
  (uses the key that archive supplied).
- `scripts/release/runtime-bundle-files.json` — ships the verifier and the public key.
- `backend/src/features/minima/minima-console.catalog.ts` — verb-granular entries whose own
  descriptions admit mutating forms (`tokens`, `cointrack`, `maxcontacts`).
- `backend/src/features/integritas/upload.middleware.ts`,
  `backend/src/features/minima/minima-upload.middleware.ts` — multer without `limits`.
- `backend/src/features/integritas/integritas.routes.ts` — `/stamp-file`'s missing-API-key return
  precedes the cleanup `finally`.
- `backend/src/middleware/requestLogger.ts` — logs `originalUrl`, including webhook tokens.
