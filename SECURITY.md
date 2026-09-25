# Security Policy

## Supported Use

Edge Studio is a prototype intended to run on a trusted local network. It is not hardened for public internet exposure or multi-tenant production use. Only the version on `main` is supported.

## Guidelines

Follow these when deploying, operating, or contributing to this project:

- Never expose the backend, Minima RPC, or the Docker socket directly to an untrusted network. Access the UI only through the frontend's HTTPS proxy.
- Never enter admin credentials, import a wallet seed phrase, or download/upload a Minima node backup file over a network connection you cannot verify, even though it is TLS-encrypted. A self-signed certificate proves encryption, not server identity. A node backup file contains the same key material as a seed phrase, plus coin proofs and transaction history, protected only by the single admin-chosen backup password stored in Edge Studio (not a Minima node/wallet password) that encrypts every backup — treat it with the same care as the seed phrase itself.
- Never disable HTTPS or set `COOKIE_SECURE=false` outside local development.
- V1 intentionally does not use CSRF tokens. Browser mutations use JSON or multipart bodies, and session cookies are `HttpOnly`, `SameSite=Strict`, and `Secure` in the default HTTPS deployment. This is an accepted residual risk for trusted-LAN, single-admin use per [`docs/adr/0010`](docs/adr/0010-security-review-audit-verdict.md). Revisit this decision before public-internet or multi-tenant use, cross-site browser integrations, loosening `SameSite`, or accepting simple form content types.
- Never commit `.env`, `APP_SECRET`, Integritas API keys, or any other credential to version control.
- Never add a generic Minima command proxy or arbitrary shell execution path. Expose only narrow, allowlisted, validated actions. The admin RPC console is a scoped exception: it only runs commands from a static, closed-world catalog that are also enabled in an admin-curated, re-auth-gated whitelist — see `docs/security/host-and-infrastructure.md`.
- Never return secrets, password hashes, TOTP secrets, or raw session tokens from an API response.
- Never return an upstream result object verbatim from a service that built a secret-bearing request, and never carry a secret into a log line — a Pi's Docker logs are as much a sink as a response body. Redaction is a boundary (`backend/src/shared/redact.ts`, applied by `structuredError()`, `sendApiError()`, and the Minima RPC layer), not something each call site remembers.
- Local admins may use a 6-digit PIN on a trusted LAN or an 8+ character password containing uppercase, lowercase, a number, and a symbol. Prefer a unique password when stronger protection is needed; only the bcrypt hash is stored, and the credential type is not persisted.
- Keep `APP_SECRET` non-empty and preserve it across upgrades; `install.sh` generates it, and the backend refuses to start without it. Losing or changing it makes stored encrypted secrets unrecoverable. For Integritas Connect, the Pi detects decrypt failure, clears the local link (`TOKEN_DECRYPT_FAILED`), and requires reconnect — it does not revoke the device on Connect as revoking requires secret tokens.
- Integritas core calls prefer the Connect account API key decrypted in backend memory. Manually saved and environment API keys remain backend-only fallbacks and are never returned to the browser.
- Hosted feedback delivery uses the existing backend-only Integritas API key and sends feedback text, device metadata, browser context, local user metadata, the connected Integritas account ID, and non-secret usage stats to Integritas only when confirmed for the current submission.
- Treat Docker socket access, host-agent access, GPIO device access, camera device access, I2C sensor helper access, local MQTT broker exposure, and host file mounts as high-privilege capabilities — keep them opt-in, admin-gated, and off by default wherever possible.
- Host-agent hardware actions manage Edge Studio helper services and report missing host OS prerequisites; they do not install OS drivers/packages automatically in V1.
- Device System Data reads can include local hostname, LAN IP addresses, OS/kernel details, CPU/memory facts, and timezone/locale. Review previews before stamping or sharing them; do not add public-IP geolocation, GPS, Wi-Fi SSID/BSSID, MAC address, CPU serial, or other stable hardware identifiers without explicit opt-in and updated documentation.
- Pin dependency and image versions before any production-like deployment; avoid mutable tags such as `:dev`.
- Never let `install.sh` take its verifier, its trust anchor, or its verifier runtime from an artifact it is meant to authenticate. The Ed25519 public key, the verifier source, and the pinned Node image digest are embedded in `install.sh` itself; the runtime bundle and update manifest are verified against them, and the bundle must match the signed manifest SHA-256 before anything is extracted or pulled. See [`docs/adr/0016`](docs/adr/0016-install-time-bootstrap-trust-set.md) and [`docs/adr/0020`](docs/adr/0020-bind-installer-runtime-to-signed-manifest.md).
- The documented `curl ... | sudo bash` install command is an **accepted residual risk**, not a closed one. It streams a mutable branch into a root shell, and the trust chain above starts at that script. Prefer the verified install path in `README.md` (tag-pinned installer, published checksum, read before running). Closing this needs an immutable versioned installer URL, a detached signature, and a key distributed independently of the source repository.
- Automation runs, block runs, visible automation inbox items, and data-source reads are preserved from automatic deletion. User-deleted inbox items are physically purged in batches of at most 500 rows at startup and hourly, yielding between batches until drained, and Integritas history remains until explicit deletion. Preserved data can grow without bound until a separate product lifecycle adds configuration, export, quotas, and disk warnings. See [`docs/adr/0023`](docs/adr/0023-classify-stored-records-before-applying-retention.md) and [`docs/adr/0026`](docs/adr/0026-preserve-workflow-run-history.md).
- Webhook tokens and MQTT broker credentials stay out of logs and read history. Webhook, MQTT, and GPIO reads record `data-source:<id>` instead of their URL, historical rows are scrubbed on upgrade, and the backend request log and nginx access log mask the webhook token path segment. Docker logs written before this change are not rewritten, and tokens are not rotated automatically; if those logs have left the Pi, replace the webhook source to get a new token. Container logs rotate at 10 MB × 3 files per service; Update Agent applies this fixed policy when recreating a container. Existing deployments need a verified installer rerun to apply rotation to every service (see README). nginx masks normalized webhook paths case-insensitively, including encoded and repeated slashes.
- Any workflow run that reaches a payment, device output, camera capture, or Integritas stamp block consumes one slot of a fixed, persisted budget of 10 runs per rolling hour per workflow, whatever triggered it; a failed action still consumes its slot. Event-triggered workflows containing a payment block require a cooldown of at least 1 second. The budget limits repetition only — payment recipient and amount remain whatever the admin configured.
- Webhook ingestion (60/min per client and source), automation changes and manual runs (30/min per client), and Integritas stamp creation (10/min per client) are rate-limited per backend process; limits reset on restart and do not cover MQTT or GPIO, which rely on the workflow budget. See [`docs/adr/0022`](docs/adr/0022-bound-external-automation-effects.md).
- Never set `UPDATE_DRY_RUN=true` outside local development — it makes `update-agent` report every apply as successful without pulling or swapping any container, silently masking a broken or misconfigured update path. It defaults off and is never written by `install.sh`.

The detailed risk register — specific risks, current controls, and mitigation plans by area — lives
in [`docs/security/`](docs/security/) and is kept current as the system changes.

An external static security review of the codebase was completed on 2026-09-03
([`docs/security/external-review-2026-09-03.md`](docs/security/external-review-2026-09-03.md),
kept verbatim). Its findings were independently audited and re-rated in
[`docs/adr/0010`](docs/adr/0010-security-review-audit-verdict.md), and the resulting work is
scheduled in [`docs/plans/security/`](docs/plans/security/README.md).
Several of the findings are open as of this writing; the register entries say which, and under which
phase they are addressed. This is a prototype on a trusted LAN — treat the register, not this page,
as the current state.

## Reporting A Vulnerability

Open a private security advisory or contact a maintainer directly. Include reproduction steps, affected version, and potential impact.

You should expect an acknowledgment within 48 hours and a more detailed response within 5 business days. There is no bug bounty program.

## Disclosure Policy

Please report privately and allow time for a fix before public disclosure. Once a fix is available, it will be released and noted in `CHANGELOG.md` under a `Security` entry.
