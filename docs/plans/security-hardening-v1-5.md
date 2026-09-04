# Security Hardening V1.5

**Status:** Not started
**Created:** 2026-09-04
**Branch:** `task/272-security-hardening-v1-5`
**Goal:** Close the findings from the external V1.5 security review, in the order the audit
established, without widening scope into a general security rewrite.

**Related:** [adr/0010](../adr/0010-security-review-audit-verdict.md) (triage record and severity
reconciliation) · [security/external-review-2026-09-03.md](../security/external-review-2026-09-03.md)
(the report, verbatim) · [plans/high-risk-business-logic-hardening.md](./high-risk-business-logic-hardening.md)
(overlaps — see below) · [plans/security-checklist.md](./security-checklist.md) (V1 TLS/auth
sign-off, separate workstream) · [SECURITY.md](../../SECURITY.md)

---

## Scope

15 items: the review's 14 findings plus the SSRF-to-Minima-RPC issue the audit added. ADR 0010 is
the authority on severity — where the report and the audit disagree, the ADR's rating is what this
plan orders by.

Two items are **not** patches and are deliberately excluded from the phases below: the
unauthenticated first-boot admin claim [2] and anonymous MQTT [5]. Both are accurately described
and both need a product decision about the appliance's provisioning and device-authentication
model first. See [Product decisions](#product-decisions).

### Overlap with `high-risk-business-logic-hardening.md`

That plan already owns two things this one needs:

- **Session revocation on credential change** — its "Authentication Changes" section is Phase 3
  here. Do not implement it twice. Whichever branch lands first carries it; the other drops it.
- **Outward error sanitization** — its "Outward Error Sanitization" section is the systemic fix
  for the same `extra`-spreading that leaks the backup password in Phase 1. Phase 1 is the narrow,
  immediate fix (stop returning the secret at all); that plan's work is the general boundary.
  Phase 1 must not wait on it.

---

## Finding map

| # | Finding | ADR 0010 rating | Phase |
| --- | --- | --- | --- |
| SSRF | Unvalidated data-source URL reaches internal Minima RPC | above every medium, below the two highs | 2 |
| 1 | Unsigned runtime bundle supplies its own verifier and trust key | high (confirmed) | 4 |
| 2 | Unauthenticated first client can claim sole administrator authority | high (confirmed) | product decision |
| 3 | Outbound HTTP reads buffer unbounded responses, one path has no deadline | medium | 5 |
| 4 | Documented installer streams mutable remote code into a root shell | medium | 4 |
| 5 | Optional LAN MQTT broker permits anonymous publishing | medium | product decision |
| 6 | Minima and MQTT use mutable image tags outside the signed manifest | medium | 6 |
| 7 | Backup creation response exposes the stored backup password | medium, understated (three paths) | 1 |
| 8 | External events can repeatedly execute wallet and device actions | medium (scope clarified, not downgraded) | 7 |
| 9 | Credential changes do not revoke existing sessions | medium | 3 |
| 10 | Default-enabled Minima console verbs include mutating subcommands | medium | 2 |
| 11 | Untrusted events grow persistent automation data without retention | medium | 7 |
| 12 | Supported Compose paths silently accept a public encryption secret | medium, likelihood overrated | 6 |
| 13 | Multipart upload endpoints lack limits and can leave temp files | medium | 5 |
| 14 | Webhook bearer tokens written to request logs (and conditionally to the DB) | low, understated (DB path) | 7 |

---

## Phase 1 — Stop returning the backup password

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

**Tests:** extend `backend/tests/features/minima/minima-backup.service.test.ts` — assert the
success DTO, the failure-path body, and the console-run body each contain neither the plaintext
password nor a percent-encoded form of it. Assert on the serialized response, not the object shape.

---

## Phase 2 — Close the Minima RPC bypass

**Covers:** SSRF, and tightens [10].

**Blocked on a decision, and needs its own ADR.** Validation over operator-supplied URLs is a
behavioral change for anyone legitimately pointing a data source at another LAN host. Decide
before writing code:

- **Option A — block private ranges by default, with an opt-in escape.** Preserves the common LAN
  case only if the escape is easy, which weakens it.
- **Option B — deny-by-default allowlist of hosts.** Strongest; most operator friction.
- **Option C — block only the Compose-internal network and container names.** Narrowest; closes
  the documented bypass and nothing else. Cheapest, and defensible for a LAN appliance.

Recommendation: **C now, with the decision recorded so B stays open.** The finding is that internal
service names are reachable, not that LAN access is wrong in general.

1. New `backend/src/shared/url-policy.ts` — one validator, so the rule is not re-implemented per
   call site. Enforce scheme (`http`/`https` only) unconditionally, regardless of which option wins.
2. `backend/src/features/data-sources/dataSources.service.ts` — `parseJsonApiConfig` and
   `parseHttpOutputConfig` call it at parse time, so bad URLs are rejected on save, not on fetch.
3. Re-validate at fetch time in `readJsonApiSource`/`sendHttpOutput`. Config rows predate the
   validator and DNS answers change between save and fetch.
4. `backend/src/features/data-sources/dataSources.routes.ts` — `GET /:id/health` has no
   `requireRole("admin")` while `POST /:id/read` does, on the same fetch primitive. Align them.
5. [10]: `minima-console.catalog.ts` — `parseVerb` whitelists on the first token only, so a
   read-enabled `tokens`/`cointrack`/`maxcontacts` entry accepts its mutating subcommand forms.
   Either constrain the accepted argument shape per entry, or default those three to disabled.
   Constraining is better; disabling is acceptable if it is recorded as a deliberate V1.5 call.

**Tests:** `http://minima:9005/vault` rejected at save and at fetch; `file://`, `gopher://`,
redirect-to-internal, and DNS-name-resolving-to-internal all rejected; an ordinary external HTTPS
URL still accepted. Add a console test per catalog entry changed.

---

## Phase 3 — Revoke sessions on credential change

**Covers:** [9]. See the overlap note above — this is
`high-risk-business-logic-hardening.md`'s "Authentication Changes" section. `deleteAllUserSessions`
already exists in both repository and service layers and is already unit-tested; it has zero
production call sites. Wire it into `changePassword` and `verifyTotpReset` in
`backend/src/features/auth/auth.service.ts`, per that plan's stated default (revoke everything,
including the caller's session, and require a fresh login).

---

## Phase 4 — Fix the install-time trust chain

**Covers:** [1] (high), [4].

These are distinct failures with distinct fixes; ADR 0010 explains why collapsing them loses the
more persistent one.

- **[1] The bundle supplies its own verifier and trust anchor.** `install.sh` extracts
  `edge-studio-runtime.tar.gz` with no signature or digest check, and that archive ships both
  `scripts/verify-manifest.mjs` and `update-agent/manifest-public-key.pem`. Compromise of
  `edgestudio.technology` alone is then sufficient and persistent. Two candidate fixes:
  1. **Embed `manifest-public-key.pem` in `install.sh` itself** — the key stops travelling with
     the artifact it authenticates. Small, and it makes the bundle's integrity verifiable.
  2. **Sign the bundle** and verify before extraction — but the verifier must not come from the
     bundle, so this needs (1) or an equivalent anchor regardless.
  Do (1) first; it is the load-bearing change. Then (2).
  Coordinate with `plans/replace-openssl-manifest-verification.md` before touching the verifier.
- **[4] `curl | sudo bash`.** Unfixable as a pattern; mitigate by publishing a checksum and
  documenting a download-inspect-run path in `README.md` alongside the one-liner.

**Verification:** `bash -n install.sh`, plus a real install against a staging manifest. This phase
is the one most likely to break installs — do not merge it on static checks alone.

---

## Phase 5 — Resource limits

**Covers:** [3], [13].

1. `readJsonApiSource` (`dataSources.service.ts:244`) uses bare `fetch` — no deadline, no cap. The
   shared `fetchJsonWithTimeout` in `backend/src/shared/http.ts` already implements the timeout;
   route through it and add a byte cap by reading the stream rather than `response.text()`.
2. Same cap on the health-check path and `sendHttpOutput`.
3. `mqttIngestion.service.ts` — `handleMqttMessage` has no payload size check.
4. `limits` on both multer instances: `backend/src/features/integritas/upload.middleware.ts` and
   `backend/src/features/minima/minima-upload.middleware.ts`.
5. `integritas.routes.ts` `/stamp-file` returns on a missing API key *before* entering the
   `try/finally`, so the temp file is orphaned. Move the check inside, or clean up on that path.
   `/verify-proof-file` already has correct `finally` cleanup — the report's claim is broader than
   the code; only `/stamp-file` needs the fix.

Caps must be configurable, not hardcoded — `.agents/rules/data-sources.md` says not to impose
arbitrary app-level limits unless required for safety. These are required for safety; the defaults
still need to be generous and documented in `.env.example`.

---

## Phase 6 — Fail closed on weak config

**Covers:** [12], [6].

1. `backend/src/index.ts` warns on a default `APP_SECRET` but starts anyway. Refuse to start when
   `APP_SECRET` is absent or `dev-change-me`, except in an explicit dev mode.
2. `install.sh`'s `ensure_app_secret` early-returns on any non-empty value, so a supplied or
   pre-existing `.env` carrying `dev-change-me` survives an install. Treat the known-default value
   as empty and regenerate.
3. Digest-pin `minimaglobal/minimacore` (currently untagged) and `eclipse-mosquitto:2` in
   `docker-compose.yml`. Note these sit outside the signed manifest, so pinning is the only
   control; record how the pins get updated.

**Verification:** `docker compose config` and a real `docker compose up` on a clean `DATA_DIR`
— (1) is a startup-path change and a mistake here bricks boot.

---

## Phase 7 — Retention, redaction, budgets

**Covers:** [11], [14], [8].

1. Retention/pruning for `automation_runs`, block runs, inbox items, and `data_source_reads`.
   Unbounded growth from untrusted push events on a Pi's SD card.
2. `backend/src/middleware/requestLogger.ts` logs `req.originalUrl` including webhook tokens.
   Redact the token segment.
3. The token also reaches `data_source_reads.sourceUrl` — but only via `recordTriggerEvent`, which
   derives it through `sourceUrlForRecord` from `config.webhookToken`. Store a source reference
   instead of the tokenised URL. (While here: the `sourceUrl` argument threaded through
   `recordPushAutomationPayload` is never read — `executeWorkflow` re-derives it. Dead param;
   remove it with this change, not separately.)
4. [8]: workflow cooldown defaults to `0` (disabled). An attacker cannot choose a payment
   destination or amount, but can trigger repeated payments to an already-trusted address and
   repeated GPIO/network actions. Require a non-zero cooldown for `send_transaction` blocks, or
   add a per-workflow execution budget. Do not present this as fixing fund theft — it never was.

---

## Product decisions

Not scheduled. Each needs a call before any code, and each should get an ADR recording it.

- **[2] Unauthenticated first-boot admin claim (high).** Whoever reaches the appliance first
  becomes admin. Real, and severe if the Pi is powered on in an untrusted network before setup.
  Options: a printed/derived enrollment code, a physical-presence requirement, or accepting it
  with the LAN threat model documented. ADR 0010's ordering assumes a managed single-admin LAN;
  this finding is the one that moves furthest up if that assumption ever changes.
- **[5] Anonymous MQTT (medium).** `mosquitto.conf` has `allow_anonymous true` on
  `listener 1883 0.0.0.0`. Off by default and profile-gated, but unauthenticated when on.
  Needs a device-authentication model, not a config tweak.

---

## Verification

Per phase, not once at the end. Every phase runs:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

Plus, where the phase touches those surfaces: `docker compose build` (5, 6), `bash -n install.sh`
(4, 6), and a live install/boot on a clean `DATA_DIR` (4, 6).

Security fixes need tests that fail before the fix. A phase is not done because the app still
starts.

## Documenting

- `SECURITY.md` and the relevant `docs/security/*.md` page, per fix — the risk register should
  track what is closed, not just what is open.
- `CHANGELOG.md` under `## [Unreleased] task/272-security-hardening-v1-5`, `### Security`.
- ADRs for: the Phase 2 URL policy, and each product decision if taken.
