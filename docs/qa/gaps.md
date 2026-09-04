# QA gaps backlog

**Status:** Open  
**Last verified:** 2026-09-04 (security items only, against `571ba70`)  
**Related:** [SECURITY.md](../../SECURITY.md), [security/](../security/), [plans/security-hardening-v1-5.md](../plans/security-hardening-v1-5.md), [CHANGELOG.md](../../CHANGELOG.md)

> Security items scheduled for V1.5 are owned by
> [plans/security-hardening-v1-5.md](../plans/security-hardening-v1-5.md) and annotated below with
> their phase. This backlog stays the list of *what is open*; the plan is *when and how*. Tick items
> here as each phase lands.

Shipped features with open QA, security, and test gaps. Close P0 items (or document accepted risk in `SECURITY.md`) before treating an area field-ready.

---

## Sign-off criteria

- [ ] All **P0** items below are done or explicitly accepted in `SECURITY.md`
- [ ] P0 manual checklists pass on a fresh `DATA_DIR` (Pi or dev stack)
- [ ] `npm run check` passes (typecheck + existing parser tests)

---

## Auth

### P0

- [ ] **GAP-01 Transport** — HTTPS default deploy ships (`COOKIE_SECURE=true`). Manual: cookie has `Secure` flag; HTTP redirects to HTTPS. HSTS deferred (V2+).
- [x] **GAP-02 Automated auth tests** — Done (0.39.0): backend auth suites plus a smoke test asserting every non-public route requires a session.
- [ ] **GAP-03 Manual E2E checklist** — Wizard (with/without Integritas key), reload persistence, logout, generic login errors, setup cannot re-run, CLI 401 documented.
- [ ] **GAP-04 `APP_SECRET` validation** — Default `dev-change-me` only warns; refuse startup in production-like mode. Also regenerate it in `install.sh`, which currently preserves any non-empty value. **Phase 6.**
- [ ] **GAP-05 TOTP secret in API** — `POST /api/setup/totp/init` and `POST /api/auth/settings/totp/init` both return raw `secret`, and neither route is gated on `TOTP_ENABLED` (the setup one sits before `requireAuth` and answers anyone until the local admin exists). Resolution is removal, not hardening — TOTP is being deleted, see [adr/0011](../adr/0011-remove-unused-totp.md) and [plans/remove-totp.md](../plans/remove-totp.md).
- [ ] **GAP-06 CSRF** — `SameSite=Strict` only; no CSRF tokens. Decided: adequate V1 posture given JSON/multipart-only bodies ([adr/0010](../adr/0010-security-review-audit-verdict.md)); remaining work is writing it up as an accepted risk. **Phase 8.**
- [ ] **GAP-07 Security headers** — No CSP, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` on nginx/backend. **Phase 8.**

### P1

- [ ] **GAP-08 Session cleanup** — `deleteExpiredSessions()` exists but is not scheduled from `index.ts`. **Phase 3.**
- [ ] **GAP-09 Single-session on login** — New login does not invalidate other sessions (optional for single-admin Pi).
- [ ] **GAP-10 Rate limits** — Login, setup, and `/api/auth/settings/*` are rate-limited. Integritas stamp, automation, files, etc. are not. **Phase 7.**
- [ ] **GAP-11 Input validation** — No `zod` on auth/setup bodies; manual checks only.
- [ ] **GAP-12 Integritas admin gates** — Stamp, history delete/export, verify require session only; `requireRole('admin')` only on API-key routes. Folded into Phase 2's single admin-gate audit pass, with MINIMA-06/07 and `GET /api/data-sources/:id/health`. **Phase 2.**
- [ ] **GAP-13 Audit hygiene** — Confirm audit rows never contain passwords, TOTP, tokens, or API keys (`login.failure` stores `"failed"` only).
- [ ] **GAP-17 Session invalidation** — Password change and TOTP reset UI shipped (0.9.0); sessions are **not** invalidated after password/TOTP change. `deleteAllUserSessions` exists and is unit-tested with zero call sites. Review finding [9]. **Phase 3.**

### P2

- [ ] **GAP-14** Argon2id instead of bcrypt
- [ ] **GAP-15** `__Host-` session cookie prefix
- [ ] **GAP-16** CLI authentication (401 today)
- [ ] **GAP-18** Pen test / OWASP ZAP scan

---

## Device status

### P0

- [ ] **DS-01 `GET /api/status`** — Auth-gated; returns `{ checkedAt, device, app, node }`; `setupComplete` and `integritasConnected` behave as expected.
- [ ] **DS-02 Device ID** — `device.id` stable across backend restarts; not regenerated on other settings changes.
- [ ] **DS-03 Graceful shutdown** — `docker stop` completes without hang; clean restart. Note: schedulers/MQTT/GPIO/SQLite stop, but Express HTTP server is not explicitly closed.

### P1

- [ ] **DS-04 Unit tests** — `device.service.ts` (`ensureDeviceId`, `getDeviceInfo`).
- [ ] **DS-05 Route tests** — `status.routes.ts` authenticated 200, unauthenticated 401.

### P2

- [ ] **DS-06 Health integration test** — `GET /api/health` returns `{ status: "ok", service: "edge-studio-backend" }` without auth.
- [ ] **DS-07 `integritasConnected` live check** — 30 s cache, 3 s timeout; unreachable upstream returns `false` with HTTP 200 (not 500). Verify latency ≤ ~3.5 s when upstream is down.

### Manual — dashboard

- [ ] Seven metric cards render: Wallet balance, Node status, Integritas API, Device, Device CPU, Device Memory, Device Disk
- [ ] Device status card auto-refreshes (~30 s)

---

## Minima

### P0

- [ ] **MINIMA-01 Stopped container** — `docker compose stop minima` → `state: "stopped"` (HTTP 200); recovers on start.
- [ ] **MINIMA-02 Megammr resync + restart (UI)** — Resync chains container restart when Minima reports `needsRestart`; success toast; stats recover.
- [ ] **MINIMA-03 Manual restart** — Admin restart works; audit event `minima.container.restart` recorded.
- [ ] **MINIMA-04 Peer add** — `GET /api/minima/peers` (auth); `POST /api/minima/peers/add` (admin). Active peers vs configured peers count may differ.
- [ ] **MINIMA-05 Parser tests** — `minima.parse.test.ts` (8 tests) passes in `npm run check`.

### P1

- [ ] **MINIMA-06 Admin gate on resync** — `POST /api/minima/megammrsync/resync` is any authenticated user, not admin. **Phase 2.**
- [ ] **MINIMA-07 Admin gate on config** — `POST /api/minima/config` is any authenticated user. **Phase 2.**
- [ ] **MINIMA-08 Auto-resync no restart** — Poller calls `resyncMegammr()` only; does not restart container when `needsRestart`.
- [ ] **MINIMA-09 App shell overview** — Header wallet/node pills fetched once on mount; may be stale until reload.
- [ ] **MINIMA-10 Stall detection** — In-memory `monitoring.*` resets on backend restart.
- [ ] **MINIMA-11 Docker socket** — Writable mount required for restart; risk accepted in `SECURITY.md`.

### P2

- [ ] **MINIMA-12** Live RPC integration tests behind `MINIMA_INTEGRATION_TEST=1`
- [ ] **MINIMA-13** Document curl examples for operators
- [ ] **MINIMA-14** Peer remove (not in Minima docs; defer)
- [ ] **MINIMA-15** `GET /api/minima/peers` returns 502 on RPC failure; `GET /status` returns 200 with `state: "error"` — inconsistent

---

## Tokens

### P0

- [ ] **TOKENS-01 Live `tokencreate`** — Verify RPC shape on Pi; create via API/UI; `tokenId` in SQLite and `GET /api/tokens`.
- [ ] **TOKENS-02 Auth gating** — List/requirements: auth; create: admin. Unauthenticated → 401; non-admin create → 403.
- [ ] **TOKENS-03 Audit `tokens.create`** — Records `tokenId`, `name`, `amount`, `decimal`, `txpowId`; no secrets; failed creates do not log success.
- [ ] **TOKENS-04 UI create flow** — Modal with name/supply/decimal; minimum MINIMA indicator; submit disabled when insufficient; success toast.

### P1

- [ ] **TOKENS-05 Validation/errors** — < 0.001 MINIMA blocked; bad name/amount/decimal → 400; RPC failure → 502.
- [ ] **TOKENS-06 List behavior** — Excludes native `0x00`; merges SQLite metadata; empty wallet → `[]`.
- [ ] **TOKENS-07 Irreversibility UX** — No visible "cannot be undone" warning in create modal.
- [ ] **TOKENS-08 Duplicate idempotency** — Re-submit after partial failure skips second SQLite insert but returns success.

### P2

- [ ] **TOKENS-09** Repository/service unit tests (only parser test exists today)
- [ ] **TOKENS-10** Event listeners (defer — automation design)
- [ ] **TOKENS-11** Dedicated Tokens nav page (optional)
- [ ] **TOKENS-12** `tokens.create` audit rows not visible in Diagnostics UI

---

## Wallet

### P0

- [ ] **WALLET-01 Seed phrase import** — Phrase sent as JSON body over the connection; **use only on HTTPS default deploy**. Confirm phrase not in Docker logs; `wallet.import` audit has `{ userId }` only.
- [ ] **WALLET-02 Auth gating** — GET routes: any auth; POST mutations (`receive-address`, `send-payment`, `import`): admin.
- [ ] **WALLET-03 Live RPC parsers** — `parseSendResponse`, `parsePaymentStatusResponse`, `parseImportResponse` not verified against live node.
- [ ] **WALLET-04 Clipboard** — `CopyableCode` silently fails without secure context; no fallback toast on HTTP.

### P1

- [ ] **WALLET-05 Import restart** — Node may restart after import; verify RPC recovery and no stale balance.
- [ ] **WALLET-06 Send errors** — Insufficient balance, malformed address, zero/negative amount surfaced correctly.
- [ ] **WALLET-07 Token names** — Custom tokens show human-readable name in send modal (not tokenId fallback).
- [ ] **WALLET-08 Address validation** — No server-side format regex; frontend placeholder `Mx… or 0x…` only. Establish the authoritative grammar first. **Phase 9.**

### P2

- [ ] **WALLET-09** No parser unit tests for `wallet.parse.ts`
- [ ] **WALLET-10** Wallet audit events (`wallet.payment.send`, `wallet.import`, etc.) not in Diagnostics UI
- [ ] **WALLET-11** Receive history not implemented (send history only)

---

## Device I/O And Local MQTT

### P0

- [ ] **DEVICE-IO-01 Pi/LAN E2E** — Verify HTTP/API output, MQTT output, MQTT input through the optional local broker, and GPIO output on a Raspberry Pi or representative LAN setup.
- [ ] **DEVICE-IO-02 Dependency audit** — `npm run check` currently reaches audit and reports backend advisories for `multer`, transitive `tar` via `@mapbox/node-pre-gyp`, and frontend/dev `esbuild`; decide update vs accepted prototype risk.
- [ ] **DEVICE-IO-03 CLI shell syntax** — `bash -n bin/edge-studio` fails on this workspace because the file has CRLF line endings; normalize before relying on shell verification.

### P1

- [ ] **DEVICE-IO-04 MQTT broker auth** — Add username/password support for the optional local broker before production use. Review finding [5]; blocked on the device-authentication product decision.
- [ ] **DEVICE-IO-05 MQTT broker hardening** — Add TLS/certificate options, topic ACLs, and LAN bind controls before production use. Same product decision as DEVICE-IO-04.
- [ ] **DEVICE-IO-06 Output egress controls** — Add broker/URL allowlists and per-target rate limits for HTTP/API and MQTT output targets. Now urgent, not future: unvalidated target URLs are one of the two routes to the Minima RPC bypass. **Phase 2.**
- [ ] **DEVICE-IO-07 Secret/header handling** — Add safe storage/redaction before exposing custom HTTP output headers or credentials in the UI.

### P2

- [ ] **DEVICE-IO-08 Dynamic output payload templates** — Add variable interpolation and explicit redaction rules if richer HTTP/MQTT output payload shaping is needed beyond the current body modes.

---

## Cross-cutting doc debt

These are not code gaps but stale docs that confuse QA:

- ~~`SECURITY.md` custom-token section still mentions labeled accounts / `fromAccountAddress` (removed in 0.8.0).~~ Fixed — split into `docs/security/wallet-and-tokens.md`, rewritten for the single-wallet model.
- ~~`docs/README.md` active-plans table references deleted plan files.~~ Fixed 2026-09-04.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-09-04 | Reconciled security items against the external review and [adr/0010](../adr/0010-security-review-audit-verdict.md); annotated scheduled items with their hardening phase; closed GAP-02 |
| 2026-07-09 | `SECURITY.md` split into lean top-level file + `docs/security/*`; fixed stale `fromAccountAddress` reference |
| 2026-06-29 | Consolidated per-area QA docs into single backlog; applied 0.8.0/0.9.0 corrections |
