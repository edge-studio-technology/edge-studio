# Auth And Transport Risks

Related: [SECURITY.md](../../SECURITY.md) · [qa/gaps.md](../qa/gaps.md#auth) · [plans/security-hardening-v1-5.md](../plans/security-hardening-v1-5.md)

## Unauthenticated LAN Access (mitigated, residual TLS trust risk)

Risk: On the default HTTPS deploy, browsers do not trust the self-signed certificate. Users must click through a warning. A network attacker could present a different certificate if users are not careful.

Impact: Session theft remains possible on untrusted networks if users accept a malicious certificate; passive sniffing is mitigated by TLS encryption.

Controls (V1):

- Login required for all `/api/*` routes except health, setup, and login.
- HttpOnly + `SameSite=Strict` session cookies with `Secure` on the default HTTPS deploy; token hashes stored in SQLite.
- Single-factor password/PIN is the currently shipped local-admin control. TOTP is implemented but disabled (`TOTP_ENABLED = false`); whether it is later retained, redesigned, re-enabled, or removed is deliberately undecided and outside V1.5 hardening ([adr/0012](../adr/0012-keep-totp-decision-outside-v1-5-hardening.md)). The flag currently gates enforcement and UI but not the four TOTP routes, so `POST /api/setup/totp/init` remains callable before authentication and returns an enrollment secret until the local admin exists. Phase 8 makes all four routes unavailable while TOTP is disabled.
- Login/setup rate limiting and generic login errors.
- Self-signed TLS encrypts browser-to-Pi traffic by default.

Residual gap: Self-signed certificates do not prove server identity. CSRF tokens are a follow-up (`SameSite=Strict` is the V1 baseline). Custom trusted certificates or operator-managed reverse-proxy TLS are planned for a later release.

Status: Partially mitigated; see `docs/qa/gaps.md` (GAP-01) for follow-up items (HSTS, custom certs).

## Self-Signed HTTPS UI

Risk: The app is served over HTTPS with an installer-generated self-signed certificate.

Impact: Browsers show security warnings. Users may click through without verifying the certificate, which weakens protection against active man-in-the-middle attacks. Passive LAN sniffing of credentials, cookies, API keys, and seed phrases is mitigated by TLS encryption.

Current Controls:

- Installer generates TLS certificate with SANs for `localhost`, `127.0.0.1`, and the detected LAN IP.
- Nginx terminates TLS; `COOKIE_SECURE=true` on the default Docker deploy.
- Certificates stored under `DATA_DIR/certs`; regenerate with `INTEGRITAS_TLS_FORCE=1 bash scripts/generate-tls-cert.sh` after a LAN IP change.

Plan: Custom certificates and HSTS stay out of scope for V1.5 — see [plans/security-hardening-v1-5.md](../plans/security-hardening-v1-5.md#out-of-scope-for-v15).

Status: Mitigated for passive sniffing; residual self-signed trust risk documented.

## Integritas Connect Credentials

Risk: Linking or revoking Integritas Connect is a high-impact mutation. A compromised admin session could link a different account or disrupt proof stamping.

Impact: Service disruption, billing/quota misuse, incorrect stamping under attacker-controlled credentials.

Controls (V1):

- Connect activation (`POST /api/auth/connect/start`, `GET /api/auth/connect/status`) requires an admin session.
- Connect tokens and the derived core API key are stored encrypted in SQLite; never returned to the frontend.
- Device revocation is detected upstream (`DEVICE_REVOKED`) and clears local Connect state.
- Audit events recorded on activation start and revocation.

Status: Mitigated.

## Session Lifecycle On Credential Change

Risk: A stolen or shared session cookie survived the credential change made to lock the attacker
out. Password change and TOTP reset rewrote the stored credential but left every existing session
row valid, so revocation was impossible short of waiting out the 7-day cookie lifetime or deleting
rows by hand.

Impact: An admin who suspects compromise cannot end the attacker's access. Expired session rows also
accumulated in SQLite indefinitely, since the only deletion path was a validation attempt against
that specific row.

Controls:

- `POST /api/auth/settings/password` and `POST /api/auth/settings/totp/verify` delete every session
  for the user on success, including the caller's own, and clear the caller's session cookie on the
  way out. The frontend signs out and returns to the login screen after showing the confirmation.
- Sessions are only revoked once the credential change has actually been applied; a rejected change
  leaves existing sessions alone.
- An hourly backend scheduler (started from `index.ts`, plus one sweep at startup) deletes sessions
  past their absolute expiry.

Residual gap: A new login still does not invalidate other sessions (GAP-09). Sessions that are past
the idle timeout but not past absolute expiry are rejected and deleted on their next use rather than
by the sweep, so such rows can sit in the table until then.

Status: **Mitigated (Phase 3, 2026-09-09).** Review finding [9]; GAP-08 and GAP-17.

## `APP_SECRET` Dependency

Risk: Encrypted local secrets (Integritas API key, TOTP, Connect tokens) can only be decrypted with the same `APP_SECRET` from `.env`. If `APP_SECRET` is lost or changed, stored secrets are unrecoverable. If `.env` leaks together with the database, encrypted secrets can be decrypted.

Impact: Loss of access to saved secrets or compromise when both `.env` and SQLite are obtained.

Plan:

- Preserve `APP_SECRET` during updates.
- Restrict permissions on `/opt/edge-studio/.env`.
- Add backup/restore documentation.
- Consider integrating OS keyring, TPM, age/sops, or user-provided passphrase for stronger production secret handling.

Status: **Partially mitigated — fail-closed startup scheduled, Phase 6 (GAP-04).** `install.sh`
generates `openssl rand -hex 32`, so a default install gets a strong secret — but `ensure_app_secret`
early-returns on any non-empty value, so a supplied or pre-existing `.env` carrying `dev-change-me`
survives an install, and the backend only warns rather than refusing to start. Production secret
design (keyring/TPM/age/sops/passphrase) remains open and is not in V1.5. See
[plans/security-hardening-v1-5.md](../plans/security-hardening-v1-5.md#phase-6--fail-closed-on-weak-config).
