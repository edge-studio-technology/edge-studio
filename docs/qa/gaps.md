# QA gaps backlog

**Status:** Open  
**Last verified:** Task 706 production Compose auth/header sign-off passed 2026-09-18
**Related:** [SECURITY.md](../../SECURITY.md), [security/](../security/), [CHANGELOG.md](../../CHANGELOG.md)

Shipped features with open QA, security, and test gaps. Only open items live here: delete an item when it closes (git history keeps the record). Close P0 items (or document accepted risk in `SECURITY.md`) before treating an area field-ready.

---

## Sign-off criteria

- [ ] All **P0** items below are done or explicitly accepted in `SECURITY.md`
- [ ] P0 manual checklists pass on a fresh `DATA_DIR` (Pi or dev stack)
- [ ] `npm run check` passes (typecheck + existing parser tests)

---

## UI regression sweep

Browser checks for UI changes that only had build/typecheck or unit-test verification. Run once at desktop width and once below 1024 px, then delete the ticked lines.

- [ ] **Shell** — Sidebar icons and the collapsed-sidebar expand button at both widths; "Start sidebar collapsed" honoured on refresh; onboarding wizard brand mark; `/marketplace` "Coming soon" and the Not found page on an unmatched path; `ErrorBoundary` fallback on a thrown error.
- [ ] **Shared states** — `EmptyContentState`, `LoadingState`, `ErrorContentState`, and `SpinnerAlt` against Figma on Devices, wallet history, address book, and all Diagnostics tabs. `ListFilterBar`: search/filter stay enabled when a search matches nothing, disabled only for a genuinely empty list; numbered pagination greys out when disabled.
- [ ] **Modals** — Footer button order and `form=` submit (Enter and click) on delete confirm, send feedback, send payment, address book add/edit, edit device, and the Minima backup modals; unboxed bodies on progress, edit contact, send payment, and whitelist confirm; no flicker on confirm → progress swaps; outside-click-to-close (press-to-close, no close from an inside-to-outside text selection, setting persists across reload).
- [ ] **Devices** — `New device` opens the add flow; All/Input/Output/Capture filter and search; empty state actions; pagination total follows the filter.
- [ ] **Wallet** — Only History and Address book tabs, History default. Address book: read-only "View contact"; kebab Edit allows changing the Mx/0x address with format and duplicate errors; kebab Remove → confirm → progress → toast.
- [ ] **Workflows** — Workflows table filter/search, pagination, pause/play, overflow actions, and delete via confirm → progress; inbox table full width, All/Unread/Read filter, the four preview formats, mark read/unread, delete via confirm → progress.
- [ ] **Diagnostics** — Proof, read, and run detail modals (`DetailList` + `Disclosure`); eye-icon "View details" plus kebab actions; Refresh button style.
- [ ] **Settings** — Disclosures start collapsed; "Integritas settings" pill shows "Checking…" first; Minima Backups/Peers tables scroll cap, row actions, empty states, and "Delete backup" flow; no auto-restart toggle; RPC console whitelist modal checkbox styling and collapsible Read/Write sections.
- [ ] **Feedback** — Bug/feature/other form states and validation; "Integritas account ID" row ("Not connected" when unlinked); disabled submit without an API key, consent block, and hosted success/failure status.
- [ ] **Updates** — Update page "Update now"/"Check again"; `update-agent` progress page gradient background, logo size and position, and Back buttons; sidebar "Update available" badge clears after a real update cycle.
- [ ] **Copy** — Tightened page and section descriptions fit at real widths (Dashboard, Minima, Integritas, Devices, Settings, onboarding welcome, Marketplace).

---

## Auth

### P0

- [ ] **GAP-01 Transport** — HTTPS default deploy ships (`COOKIE_SECURE=true`). Manual: cookie has `Secure` flag; HTTP redirects to HTTPS. HSTS deferred (V2+).

### P1

- [ ] **GAP-09 Single-session on login** — New login does not invalidate other sessions (optional for single-admin Pi).
- [ ] **GAP-11 Input validation** — No `zod` on auth/setup bodies; manual checks only.
- [ ] **GAP-13 Audit hygiene** — Confirm audit rows never contain passwords, tokens, or API keys (`login.failure` stores `"failed"` only).

### P2

- [ ] **GAP-14** Argon2id instead of scrypt — native bcrypt replaced with built-in scrypt in #216 ([ADR 0035](../adr/0035-hash-admin-credentials-with-scrypt.md)); Argon2id and removal of legacy bcrypt verification tracked in #887.
- [ ] **GAP-15** `__Host-` session cookie prefix
- [ ] **GAP-16** CLI authentication (401 today)
- [ ] **GAP-18** Pen test / OWASP ZAP scan

---

## Device status

### P0

- [ ] **DS-01 `GET /api/status`** — Auth-gated; returns `{ checkedAt, device, app, node }`; `setupComplete` and `integritasConnected` behave as expected.
- [ ] **DS-02 Device ID** — `device.id` stable across backend restarts; not regenerated on other settings changes.
- [ ] **DS-03 Graceful shutdown** — `docker stop` completes without hang; clean restart. Note: schedulers/MQTT/GPIO/SQLite stop, but Express HTTP server is not explicitly closed.

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
- [ ] **MINIMA-03 Manual restart** — Admin restart works; audit event `minima.container.restart` recorded.
- [ ] **MINIMA-04 Peer add** — `GET /api/minima/peers` (auth); `POST /api/minima/peers/add` (admin). Active peers vs configured peers count may differ.

### P1

- [ ] **MINIMA-10 Stall detection** — In-memory `monitoring.*` resets on backend restart.
- [ ] **MINIMA-11 Docker socket** — Writable mount required for restart; risk accepted in `SECURITY.md`.

### P2

- [ ] **MINIMA-12** Live RPC integration tests behind `MINIMA_INTEGRATION_TEST=1`
- [ ] **MINIMA-13** Document curl examples for operators
- [ ] **MINIMA-14** Peer remove (not in Minima docs; defer)
- [ ] **MINIMA-15** `GET /api/minima/peers` returns 502 on RPC failure; `GET /status` returns 200 with `state: "error"` — inconsistent

---

## Wallet

### P0

- [ ] **WALLET-02 Auth gating** — GET routes: any auth; POST mutations (`receive-address`, `send-payment`): admin.
- [ ] **WALLET-03 Live RPC parsers** — `parseSendResponse` not verified against a live node.
- [ ] **WALLET-04 Clipboard** — `CopyableCode` silently fails without secure context; no fallback toast on HTTP.

### P1

- [ ] **WALLET-06 Send errors** — Insufficient balance, malformed address, zero/negative amount surfaced correctly.
- [ ] **WALLET-07 Token names** — Custom tokens show human-readable name in send modal (not tokenId fallback).

### P2

- [ ] **WALLET-10** Wallet audit events (`wallet.payment.send`, etc.) not in Diagnostics UI

---

## Device I/O And Local MQTT

### P0

- [ ] **DEVICE-IO-01 Pi/LAN E2E** — Verify HTTP/API output, MQTT output, MQTT input through the optional local broker, and GPIO output on a Raspberry Pi or representative LAN setup.

### P1

- [ ] **DEVICE-IO-04 MQTT broker auth** — Add username/password support for the optional local broker before production use. Review finding [5]; blocked on the device-authentication product decision.
- [ ] **DEVICE-IO-05 MQTT broker hardening** — Add TLS/certificate options, topic ACLs, and LAN bind controls before production use. Same product decision as DEVICE-IO-04.
- [ ] **DEVICE-IO-06b Output egress controls (MQTT + rate limits)** — Still open: MQTT broker allowlists and per-target rate limits for both HTTP and MQTT outputs. The broker half depends on Phase 0's MQTT device-authentication decision; rate limits are Phase 7's per-workflow budget work.
- [ ] **DEVICE-IO-09 Measure the Phase 5 limit defaults on a Pi** — The outbound response cap, concurrency/queue bounds, deadline, upload cap, and MQTT payload cap were chosen by reasoning about workload shape, not measured under load on real hardware. Every value is configurable and clamped, so a wrong default is a tuning problem rather than a security one. Revisit [adr/0017](../adr/0017-outbound-and-upload-resource-limits.md) with real numbers.
- [ ] **DEVICE-IO-07 Secret/header handling** — Add safe storage/redaction before exposing custom HTTP output headers or credentials in the UI.

### P2

- [ ] **DEVICE-IO-08 Dynamic output payload templates** — Add variable interpolation and explicit redaction rules if richer HTTP/MQTT output payload shaping is needed beyond the current body modes.

---
