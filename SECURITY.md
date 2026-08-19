# Security Policy

## Supported Use

Edge Studio is a prototype intended to run on a trusted local network. It is not hardened for public internet exposure or multi-tenant production use. Only the version on `main` is supported.

## Guidelines

Follow these when deploying, operating, or contributing to this project:

- Never expose the backend, Minima RPC, or the Docker socket directly to an untrusted network. Access the UI only through the frontend's HTTPS proxy.
- Never enter admin credentials, import a wallet seed phrase, or download/upload a Minima node backup file over a network connection you cannot verify, even though it is TLS-encrypted. A self-signed certificate proves encryption, not server identity. A node backup file contains the same key material as a seed phrase, plus coin proofs and transaction history, protected only by the single admin-chosen backup password stored in Edge Studio (not a Minima node/wallet password) that encrypts every backup — treat it with the same care as the seed phrase itself.
- Never disable HTTPS or set `COOKIE_SECURE=false` outside local development.
- Never commit `.env`, `APP_SECRET`, Integritas API keys, or any other credential to version control.
- Never add a generic Minima command proxy or arbitrary shell execution path. Expose only narrow, allowlisted, validated actions. The admin RPC console is a scoped exception: it only runs commands from a static, closed-world catalog that are also enabled in an admin-curated, re-auth-gated whitelist — see `docs/security/host-and-infrastructure.md`.
- Never return secrets, password hashes, TOTP secrets, or raw session tokens from an API response.
- Local admins may use a 6-digit PIN on a trusted LAN or an 8+ character password containing uppercase, lowercase, a number, and a symbol. Prefer a unique password when stronger protection is needed; only the bcrypt hash is stored, and the credential type is not persisted.
- Preserve `APP_SECRET` across upgrades; losing or changing it makes stored encrypted secrets unrecoverable. For Integritas Connect, the Pi detects decrypt failure, clears the local link (`TOKEN_DECRYPT_FAILED`), and requires reconnect — it does not revoke the device on Connect as revoking requires secret tokens.
- Integritas core calls prefer the Connect account API key decrypted in backend memory. Manually saved and environment API keys remain backend-only fallbacks and are never returned to the browser.
- Hosted feedback delivery uses the existing backend-only Integritas API key and sends feedback text, device metadata, browser context, local user metadata, the connected Integritas account ID, Node/Integritas connection status, and non-secret usage stats to Integritas only when confirmed for the current submission.
- Treat Docker socket access, GPIO device access, camera device access, I2C sensor helper access, local MQTT broker exposure, and host file mounts as high-privilege capabilities — keep them opt-in, admin-gated, and off by default wherever possible.
- Device System Data reads can include local hostname, LAN IP addresses, OS/kernel details, CPU/memory facts, and timezone/locale. Review previews before stamping or sharing them; do not add public-IP geolocation, GPS, Wi-Fi SSID/BSSID, MAC address, CPU serial, or other stable hardware identifiers without explicit opt-in and updated documentation.
- Pin dependency and image versions before any production-like deployment; avoid mutable tags such as `:dev`.
- Never set `UPDATE_DRY_RUN=true` outside local development — it makes `update-agent` report every apply as successful without pulling or swapping any container, silently masking a broken or misconfigured update path. It defaults off and is never written by `install.sh`.

The detailed risk register — specific risks, current controls, and mitigation plans by area — is maintained separately and kept current as the system changes.

## Reporting A Vulnerability

Open a private security advisory or contact a maintainer directly. Include reproduction steps, affected version, and potential impact.

You should expect an acknowledgment within 48 hours and a more detailed response within 5 business days. There is no bug bounty program.

## Disclosure Policy

Please report privately and allow time for a fix before public disclosure. Once a fix is available, it will be released and noted in `CHANGELOG.md` under a `Security` entry.
