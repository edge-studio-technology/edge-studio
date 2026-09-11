# Security Hardening V1.5

**Status:** In progress — Phases 1-5 done
**Created:** 2026-09-04
**Revised:** 2026-09-04 — second-opinion review folded in: DNS-address pinning on egress, Phase 0 decision gate, non-destructive
`APP_SECRET` migration, the multipart egress path, global outbound concurrency, and the installer's
bootstrap trust set.
**Revised:** 2026-09-07 — TOTP removal/retention moved outside this branch; this plan now hardens
the dormant implementation without deciding its future. See [adr/0012](../../adr/0012-keep-totp-decision-outside-v1-5-hardening.md).
**Revised:** 2026-09-11 — split into one file per phase (this index plus `phase-N-*.md`) so
Phases 1-5 can be tracked as reviewable/done while Phases 0 and 6-9 stay open. The prior combined
plan is archived at [archive/security-hardening-v1-5.md](../archive/security-hardening-v1-5.md).
**Branch:** `task/272-security-hardening-v1-5`
**Goal:** Close the findings from the external V1.5 security review and the V1 security sign-off
remainder, in one ordered workstream. Phase 9 carries the unit-test audit's production-behaviour
gaps alongside them — they are diagnosed and cheap, but they are not review findings and sit
outside the security sign-off bar.

**Related:** [adr/0010](../../adr/0010-security-review-audit-verdict.md) (triage record and severity
reconciliation) · [security/external-review-2026-09-03.md](../../security/external-review-2026-09-03.md)
(the report, verbatim) · [security/](../../security/) (risk register — the living record of what is
open vs. closed) · [qa/gaps.md](../../qa/gaps.md) (broader QA backlog) · [SECURITY.md](../../../SECURITY.md)

---

## Phases

One file per phase — each carries its own scope, status, implementation steps, "how it landed"
notes, and tests. This index carries only what's shared across all of them.

| Phase | Title | Status | File |
| --- | --- | --- | --- |
| 0 | Product decision gate | Provisional defaults in place; confirm at [pre-merge decision pass](#pre-merge-decision-pass) | [phase-0-product-decision-gate.md](./phase-0-product-decision-gate.md) |
| 1 | Stop returning the backup password | Done (2026-09-07) | [phase-1-backup-password-leak.md](./phase-1-backup-password-leak.md) |
| 2 | Close the Minima RPC bypass | Done (2026-09-08) | [phase-2-minima-rpc-bypass.md](./phase-2-minima-rpc-bypass.md) |
| 3 | Session lifecycle | Done (2026-09-09) | [phase-3-session-lifecycle.md](./phase-3-session-lifecycle.md) |
| 4 | Fix the install-time trust chain | Done (2026-09-09) | [phase-4-install-time-trust-chain.md](./phase-4-install-time-trust-chain.md) |
| 5 | Resource limits | Done (2026-09-09) | [phase-5-resource-limits.md](./phase-5-resource-limits.md) |
| 6 | Fail closed on weak config | Not started | [phase-6-fail-closed-on-weak-config.md](./phase-6-fail-closed-on-weak-config.md) |
| 7 | Retention, redaction, budgets | Not started | [phase-7-retention-redaction-budgets.md](./phase-7-retention-redaction-budgets.md) |
| 8 | V1 sign-off remainder | Not started | [phase-8-v1-sign-off-remainder.md](./phase-8-v1-sign-off-remainder.md) |
| 9 | Correctness hardening from the unit-test audit | Not started | [phase-9-correctness-hardening.md](./phase-9-correctness-hardening.md) |

---

## Scope

This plan is the single owner of security work for V1.5. It absorbs two earlier plans, both now in
[archive/](../archive/):

- **`security-checklist.md`** (V1 sign-off, 2026-06-25) — its remaining live items are
  [Phase 8](./phase-8-v1-sign-off-remainder.md), its manual TLS checks are
  [Verify once](#verify-once-manual), its scope boundaries are [Out of scope](#out-of-scope-for-v15).
- **`high-risk-business-logic-hardening.md`** (2026-09-02) — session revocation is
  [Phase 3](./phase-3-session-lifecycle.md), error sanitization is
  [Phase 1](./phase-1-backup-password-leak.md), and its non-review items are
  [Phase 9](./phase-9-correctness-hardening.md). Its dormant TOTP retry-loop item remains
  documented but is outside this branch.

TOTP removal, retention, redesign, or re-enablement is explicitly outside this plan. ADR 0011's
earlier removal decision is superseded by [ADR 0012](../../adr/0012-keep-totp-decision-outside-v1-5-hardening.md).
[plans/remove-totp.md](../remove-totp.md) remains unapproved candidate analysis only. This branch
hardens the dormant implementation where a live security finding reaches it; it does not use those
fixes to imply a decision about the feature's future.

The two archived plans were folded in because they had begun to describe the same work with
different numbering, which is how a fix gets done twice or not at all.

The ordering is ADR 0010's. Where the report and the audit disagree on severity, the ADR's rating
is what this plan orders by.

Two review findings are **not** patches: the unauthenticated first-boot admin claim [2] and
anonymous MQTT [5]. Both are accurately described and both need a product decision before any
code. They are [Phase 0](./phase-0-product-decision-gate.md) — a gate with owners and dates, not an
unscheduled appendix. [2] is the only high finding left once Phase 4 lands, and an undated high is
one that quietly ships.

---

## Finding map

Review findings (15 = the report's 14 plus the SSRF the audit added):

| # | Finding | ADR 0010 rating | Phase |
| --- | --- | --- | --- |
| SSRF | Unvalidated data-source URL reaches internal Minima RPC | above every medium, below the two highs | 2 |
| 1 | Unsigned runtime bundle supplies its own verifier and trust key | high (confirmed) | 4 |
| 2 | Unauthenticated first client can claim sole administrator authority | high (confirmed) | 0 |
| 3 | Outbound HTTP reads buffer unbounded responses, one path has no deadline | medium | 5 |
| 4 | Documented installer streams mutable remote code into a root shell | medium | 4 |
| 5 | Optional LAN MQTT broker permits anonymous publishing | medium | 0 |
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
| GAP-05 / checklist 4 | Dormant TOTP routes remain callable while `TOTP_ENABLED` is false | 8 |
| GAP-03 / checklist 6 | Manual auth E2E on fresh `DATA_DIR` | 8 |
| GAP-06 / checklist 5 | CSRF posture — decide and document | 8 |
| GAP-08 | `deleteExpiredSessions()` never scheduled | 3 |
| GAP-10 | Rate limits beyond login/setup | 7 |
| GAP-12 / MINIMA-06 / MINIMA-07 | Routes gated on session but not `requireRole("admin")` | 2 |
| DEVICE-IO-06 | Output egress controls — HTTP URL validation only; broker allowlists and per-target rate limits stay open | 2 (partial) |
| WALLET-08 | No server-side Minima address validation | 9 |
| high-risk plan | Minima restart operation-lock cleanup | 9 |
| high-risk plan | Onboarding TOTP QR retry loop | out of scope — dormant; must be fixed before re-enabling TOTP |
| high-risk plan | Update Agent stream timeout never settles | 9 |

Already closed since the register was last written, and not carried here: **GAP-02** (auth
automated tests — shipped in 0.39.0 with the non-public-route smoke test) and the "Missing Security
Tests" entry in `security/low-priority-and-future.md`.

---

## Product decision detail

See [Phase 0](./phase-0-product-decision-gate.md#findings-in-detail) — the two gated findings ([2],
[5]) are described there, next to their decision table.

---

## Pre-merge decision pass

Every product/policy call in this plan is **provisionally defaulted to the safest option that does
not block implementation**, so the branch can be worked end to end without stopping. None are
confirmed. Run this pass before the branch merges to `dev`/`main`; a default that survives the pass
becomes the decision and gets its ADR then.

Defaults in force:

| # | Decision | Provisional default | Phase | Reversal cost |
| --- | --- | --- | --- | --- |
| 1 | [2] First-boot admin claim | accept; document LAN threat model | 0 | **high** — adds a numbered phase ahead of Phase 5 |
| 2 | [5] MQTT device auth | accept as-is; off by default | 0 | low — DEVICE-IO-04/05 stay open either way |
| 3 | Egress URL policy | block Compose subnet, gateway, service names; `http`/`https` only — **implemented, adr/0014** | 2 | medium — widening to a deny-by-default allowlist is a rewrite |
| 4 | DNS address pinning | pin resolved address to socket; take the `undici` dependency — **implemented, adr/0014** | 2 | low — mock boundary already moved off `global.fetch` |
| 5 | Console mutating subcommands | constrain argument shape per catalog entry — **implemented, adr/0015** | 2 | low |
| 6 | Session revocation scope | revoke all sessions incl. caller; clear cookie; force re-login — **implemented** | 3 | low |
| 7 | Verifier runtime | pin `node:20-bookworm-slim` by digest — **implemented, adr/0016** | 4 | low |
| 8 | `curl \| sudo bash` | accept as residual; ship documented download-inspect-run + checksum — **implemented, adr/0016** | 4 | low — real fix needs release infra |
| 9 | Limit values | ship the proposed table as defaults, clamp to hard maxima — **implemented, adr/0017**; Pi measurement still outstanding (DEVICE-IO-09) | 5 | low — values are configurable |
| 10 | `APP_SECRET` migration | one-shot transactional re-encrypt; never boot half-migrated | 6 | low — safe whether or not field installs exist |
| 11 | Dev escape hatch | explicit opt-in env flag, never derived from `NODE_ENV` | 6 | low |
| 12 | Image digest pins | manual bump at release, documented in the release doc | 6 | low |
| 13 | Retention values | 30 days / 10 000 rows / 500-row batches / hourly + startup pass | 7 | low — configurable |
| 14 | Webhook token rotation | **do not rotate**; fix the logger and the label only | 7 | low now, rises once logs leave the Pi |
| 15 | Wallet-trigger budget | reject `cooldownSeconds: 0` on `send_transaction` workflows; 10 runs/hour persisted | 7 | medium — the budget counter is a schema change |
| 16 | CSRF posture | `SameSite=Strict` + JSON/multipart-only; no tokens | 8 | low — already settled in ADR 0010 |
| 17 | Dormant TOTP routes | gate all four on `TOTP_ENABLED`; keep the first-admin guard | 8 | low — already settled in ADR 0012 |
| 18 | Minima address grammar | take it from Minima source/docs; defer WALLET-08 rather than guess | 9 | low |

Rows 1, 10, 14, and 15 are the ones with real product or operator consequences; the rest are
technical calls that can be confirmed in bulk. Rows 16 and 17 are already decided by ADR and are
listed only so the pass is complete.

---

## Out of scope for V1.5

Carried from the archived checklist. Do not let these expand the branch:

- HSTS, Let's Encrypt, domains, DNS.
- Caddy or an external reverse proxy as the default path.
- Private CA and per-device certificate trust.
- CLI session auth (GAP-16) — 401 today, documented.
- Replacing the Docker socket mount.
- Argon2id (GAP-14), `__Host-` cookie prefix (GAP-15), pen test / ZAP scan (GAP-18).
- The product decision to retain, redesign, re-enable, or remove TOTP, and any resulting feature or
  schema work — see [adr/0012](../../adr/0012-keep-totp-decision-outside-v1-5-hardening.md).
- The dormant onboarding TOTP QR retry-loop bug; it remains documented and blocks re-enablement.

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
- ADRs for: the Phase 2 URL policy (**done — adr/0014**) and console subcommands (**done — adr/0015**), the Phase 4 install-time trust set (**done — adr/0016**), the Phase 5 limit values (**done — adr/0017**), the Phase 6 `APP_SECRET` migration, the Phase 7 deferred
  global budgets, and each Phase 0 product decision.

## Sign-off

V1.5 security is accepted when the [pre-merge decision pass](#pre-merge-decision-pass) has run and
every surviving default has its ADR, Phases 1-8 are done or explicitly accepted in `SECURITY.md`,
the manual checks above pass on a Pi deploy, and `npm run check` plus `docker compose build` pass. Phase 9 is correctness hardening rather than a
review finding, and is deliberately outside this bar.

Anything recorded as accepted rather than fixed — the `curl | sudo bash` one-liner, global wallet
budgets, the MQTT half of DEVICE-IO-06, and [2] if acceptance is the Phase 0 call — stays **open/accepted** in `docs/security/`, with exit criteria. Sign-off means the
risk is known and owned, not that it is gone.
