[← Back to index](./README.md)

# Phase 8 — V1 sign-off remainder

**Covers:** GAP-07, GAP-06, GAP-05, GAP-03. From the archived `security-checklist.md`, minus what
has since shipped or been decided.

1. **Security headers** (GAP-07) — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
   and a minimal CSP on nginx.
2. **CSRF** (GAP-06) — ADR 0010 already assessed `SameSite=Strict` plus JSON/multipart-only bodies
   as an adequate V1 posture. Remaining work is to write that down as an accepted risk in
   `SECURITY.md`, not to add tokens.
3. **Dormant TOTP routes** (GAP-05) — when backend `TOTP_ENABLED` is false, make all four setup and
   settings init/verify routes unavailable. Keep `assertLocalAdminNotCreated()` on the setup paths
   as defense in depth. Returning an enrollment secret when TOTP is deliberately enabled is part of
   any future enablement design and is not decided here.
4. **Manual auth E2E** (GAP-03) — on a fresh `DATA_DIR`: wizard with and without an Integritas key,
   reload persistence, logout, generic login errors, setup cannot re-run, CLI 401 documented. Also
   verify all four TOTP routes are unavailable in the shipped disabled configuration.
