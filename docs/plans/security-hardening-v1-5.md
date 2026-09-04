# Security Hardening V1.5

**Status:** Not started
**Created:** 2026-09-04
**Branch:** `task/272-security-hardening-v1-5`
**Goal:** Close the findings from the external V1.5 security review, plus the V1 security sign-off
remainder and the production-behaviour gaps from the unit-test audit, in one ordered workstream.

**Related:** [adr/0010](../adr/0010-security-review-audit-verdict.md) (triage record and severity
reconciliation) · [security/external-review-2026-09-03.md](../security/external-review-2026-09-03.md)
(the report, verbatim) · [security/](../security/) (risk register — the living record of what is
open vs. closed) · [qa/gaps.md](../qa/gaps.md) (broader QA backlog) · [SECURITY.md](../../SECURITY.md)

---

## Scope

This plan is the single owner of security work for V1.5. It absorbs two earlier plans, both now in
[archive/](./archive/):

- **`security-checklist.md`** (V1 sign-off, 2026-06-25) — its remaining live items are Phase 8, its
  manual TLS checks are [Verify once](#verify-once-manual), its scope boundaries are
  [Out of scope](#out-of-scope-for-v15).
- **`high-risk-business-logic-hardening.md`** (2026-09-02) — session revocation is Phase 3, error
  sanitization is Phase 1, and its non-review items are Phase 9 (bar the TOTP one, which
  [remove-totp.md](./remove-totp.md) deletes).

TOTP removal was briefly a phase here and has been split out to
[plans/remove-totp.md](./remove-totp.md) on its own branch — it is a feature removal with a one-way
schema migration, not a review finding, and it edits the same auth files as Phase 3. Two items below
are deferred on the assumption it lands; neither was fixed, so nothing is wasted if it slips.

They were folded in because all three documents had begun to describe the same work with different
numbering, which is how a fix gets done twice or not at all.

The ordering is ADR 0010's. Where the report and the audit disagree on severity, the ADR's rating
is what this plan orders by.

Two review findings are **not** patches and are excluded from the phases: the unauthenticated
first-boot admin claim [2] and anonymous MQTT [5]. Both are accurately described and both need a
product decision first. See [Product decisions](#product-decisions).

---

## Finding map

Review findings (15 = the report's 14 plus the SSRF the audit added):

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

Absorbed items, with their original IDs so the register and QA backlog stay traceable:

| Source | Item | Phase |
| --- | --- | --- |
| GAP-07 / checklist 1 | Security headers on nginx | 8 |
| GAP-05 / checklist 4 | TOTP secret returned by `*/totp/init` | deferred — [remove-totp.md](./remove-totp.md) deletes the routes |
| GAP-03 / checklist 6 | Manual auth E2E on fresh `DATA_DIR` | 8 |
| GAP-06 / checklist 5 | CSRF posture — decide and document | 8 |
| GAP-08 | `deleteExpiredSessions()` never scheduled | 3 |
| GAP-10 | Rate limits beyond login/setup | 7 |
| GAP-12 / MINIMA-06 / MINIMA-07 | Routes gated on session but not `requireRole("admin")` | 2 |
| DEVICE-IO-06 | Output egress controls (URL allowlists) | 2 |
| WALLET-08 | No server-side Minima address validation | 9 |
| high-risk plan | Minima restart operation-lock cleanup | 9 |
| high-risk plan | Onboarding TOTP QR retry loop | deferred — [remove-totp.md](./remove-totp.md) deletes the step |
| high-risk plan | Update Agent stream timeout never settles | 9 |

Already closed since the register was last written, and not carried here: **GAP-02** (auth
automated tests — shipped in 0.39.0 with the non-public-route smoke test) and the "Missing Security
Tests" entry in `security/low-priority-and-future.md`.

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

**Then the systemic fix** (from the archived high-risk plan — same root cause, one step out):

5. Define a client-safe error contract in `backend/src/shared/api-error.ts` and
   `structured-error.ts` rather than forwarding arbitrary native error messages and context.
   Detailed errors stay in server logs; secrets, credential-bearing URLs, tokens, headers, and
   sensitive filesystem paths do not reach responses.
6. Review call sites that attach sensitive context — MQTT broker URLs especially — so redaction is
   a boundary, not something every caller must remember.

Steps 1-4 must not wait on 5-6.

**Tests:** extend `backend/tests/features/minima/minima-backup.service.test.ts` — assert the
success DTO, the failure-path body, and the console-run body each contain neither the plaintext
password nor a percent-encoded form of it. Assert on the serialized response, not the object shape.
Extend `backend/tests/shared/api-error.test.ts` and `structured-error.test.ts` with secret-bearing
inputs, asserting both safe client output and retained diagnostics.

---

## Phase 2 — Close the Minima RPC bypass

**Covers:** SSRF, [10], GAP-12, MINIMA-06/07, DEVICE-IO-06.

**Blocked on a decision, and needs its own ADR.** Validation over operator-supplied URLs is a
behavioral change for anyone legitimately pointing a data source at another LAN host. Decide
before writing code:

- **Option A — block private ranges by default, with an opt-in escape.** Preserves the common LAN
  case only if the escape is easy, which weakens it.
- **Option B — deny-by-default allowlist of hosts.** Strongest; most operator friction. This is
  what DEVICE-IO-06 originally asked for.
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
4. Admin-gate asymmetries on the same primitives: `GET /api/data-sources/:id/health` has no
   `requireRole("admin")` while `POST /:id/read` does. Same pattern in
   `POST /api/minima/megammrsync/resync` and `POST /api/minima/config` (MINIMA-06/07), and across
   Integritas stamp/history routes (GAP-12). Audit all of `app.ts`'s mounts and align them; this is
   one review pass, not four separate tickets.
5. [10]: `minima-console.catalog.ts` — `parseVerb` whitelists on the first token only, so a
   read-enabled `tokens`/`cointrack`/`maxcontacts` entry accepts its mutating subcommand forms.
   Either constrain the accepted argument shape per entry, or default those three to disabled.
   Constraining is better; disabling is acceptable if it is recorded as a deliberate V1.5 call.

**Tests:** `http://minima:9005/vault` rejected at save and at fetch; `file://`, `gopher://`,
redirect-to-internal, and DNS-name-resolving-to-internal all rejected; an ordinary external HTTPS
URL still accepted. Add a console test per catalog entry changed, and extend the existing
non-public-route smoke test to assert the admin-role matrix.

---

## Phase 3 — Session lifecycle

**Covers:** [9], GAP-08, GAP-17.

`deleteAllUserSessions` already exists in both repository and service layers and is already
unit-tested; it has zero production call sites.

1. Wire it into `changePassword` and `verifyTotpReset` in `backend/src/features/auth/auth.service.ts`.
2. Policy (decided in the archived high-risk plan, carried forward): revoke every session including
   the caller's, and require a fresh login. Keeping the current session alive would first require
   extending the service/route contract so the current token can be identified explicitly.
3. GAP-08: `deleteExpiredSessions()` exists but is never scheduled. Start it from
   `backend/src/index.ts` after migrations, same pattern as the other schedulers.

**Tests:** extend `backend/tests/features/auth/auth.service.test.ts` and the session/route suites —
invalidation on both credential paths, the audit events, and the current-session policy.

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

**Covers:** [12], [6], GAP-04.

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

**Covers:** [11], [14], [8], GAP-10.

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
5. GAP-10: rate limiting currently covers login, setup, and `/api/auth/settings/*` only. Extend to
   the stamp, automation, and webhook ingest paths, which are the ones an untrusted event source
   can drive.

---

## Phase 8 — V1 sign-off remainder

**Covers:** GAP-07, GAP-06, GAP-03. From the archived `security-checklist.md`, minus what has since
shipped or been decided. GAP-05 (TOTP secret in API) is not here — [remove-totp.md](./remove-totp.md)
deletes the routes that return it rather than hardening them.

1. **Security headers** (GAP-07) — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
   and a minimal CSP on nginx.
2. **CSRF** (GAP-06) — ADR 0010 already assessed `SameSite=Strict` plus JSON/multipart-only bodies
   as an adequate V1 posture. Remaining work is to write that down as an accepted risk in
   `SECURITY.md`, not to add tokens.
3. **Manual auth E2E** (GAP-03) — on a fresh `DATA_DIR`: wizard with and without an Integritas key,
   reload persistence, logout, generic login errors, setup cannot re-run, CLI 401 documented. Run
   this after [remove-totp.md](./remove-totp.md) lands, so it exercises the wizard as shipped rather
   than a flow being deleted.

---

## Phase 9 — Correctness hardening from the unit-test audit

**Covers:** three of the four non-review items from the archived
`high-risk-business-logic-hardening.md`. Its fourth — the onboarding TOTP QR retry loop — is deleted
rather than fixed, by [remove-totp.md](./remove-totp.md).
These are not review findings; they are places where tests could not establish intended behavior
because the production contract was absent. Lower urgency than Phases 1-7, but they are already
diagnosed, so they are cheap.

1. **Minima restart operation lock** — `backend/src/features/minima/minima.service.ts`: every
   failure after the lock is acquired must clear it, including failures locating the container or
   reading its restart baseline before the background task starts. Preserve the graceful-restart
   contract from [adr/0001](../adr/0001-minima-graceful-node-restart.md).
2. **Minima address validation** (WALLET-08) — establish the authoritative address grammar before
   changing `backend/src/shared/minima-address.ts`; do not infer length or character rules from
   examples. Then replace prefix-only acceptance, and apply the same validator at the wallet-payment
   and address-book boundaries.
3. **Update Agent stream timeout** — `update-agent/src/docker/docker.client.ts`:
   `dockerRequestStream()` must reject when its timeout fires, preserving the single-settlement
   guard without marking the request settled before the rejection path can run.

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
  Needs a device-authentication model, not a config tweak. DEVICE-IO-04 (broker auth) and
  DEVICE-IO-05 (TLS, topic ACLs, bind controls) are the concrete work once that call is made.

---

## Out of scope for V1.5

Carried from the archived checklist. Do not let these expand the branch:

- HSTS, Let's Encrypt, domains, DNS.
- Caddy or an external reverse proxy as the default path.
- Private CA and per-device certificate trust.
- CLI session auth (GAP-16) — 401 today, documented.
- Replacing the Docker socket mount.
- Argon2id (GAP-14), `__Host-` cookie prefix (GAP-15), pen test / ZAP scan (GAP-18).

---

## Verify once (manual)

Carried from the archived checklist; still unrun. Do these on a Pi or `docker compose` deploy.

- [ ] `curl -vk https://<pi-ip>:8080/api/health` → TLS 1.2/1.3, `200`, JSON body
- [ ] `curl -v http://<pi-ip>:8080/api/health` → fails or `400` (not cleartext app traffic)
- [ ] `openssl s_client -connect <pi-ip>:8080 </dev/null 2>/dev/null | openssl x509 -noout -ext subjectAltName` → includes Pi LAN IP
- [ ] Log in via browser → DevTools → `session` cookie has **Secure**, **HttpOnly**, **SameSite=Strict**
- [ ] Optional: Wireshark/`tcpdump` during login → no readable `password` / `totpToken` in capture
- [ ] Seed phrase import only tested over `https://` (not `npm run dev` HTTP)

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

---

## Documenting

Per phase, not at the end:

- The matching `docs/security/*.md` entry — move it from open/accepted to mitigated, with the
  control that closed it. The register is the standing answer to "what is still open"; this plan
  only tracks the work.
- `docs/qa/gaps.md` — tick the GAP/MINIMA/WALLET/DEVICE-IO IDs listed in the finding map.
- `SECURITY.md` — only when a guideline or accepted risk actually changes.
- `CHANGELOG.md` under `## [Unreleased] task/272-security-hardening-v1-5`, `### Security`.
- ADRs for: the Phase 2 URL policy, and each product decision if taken.

## Sign-off

V1.5 security is accepted when Phases 1-8 are done or explicitly accepted in `SECURITY.md`, the
manual checks above pass on a Pi deploy, both product decisions have an ADR, and `npm run check`
plus `docker compose build` pass.
