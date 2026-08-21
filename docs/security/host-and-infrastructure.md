# Host And Infrastructure Risks

Related: [SECURITY.md](../../SECURITY.md) · [qa/gaps.md](../qa/gaps.md)

## Docker Socket Mount

Risk: The backend mounts `/var/run/docker.sock` to read container status/resource usage and to restart the Minima container via `POST /api/minima/restart` (admin-only). Docker socket access is highly sensitive.

Impact: If the backend is compromised, an attacker could read container metadata or restart/stop containers allowed by the Docker API and socket group permissions.

Current Controls:

- Docker write use is narrow: only `restartComposeService("minima")` and `startComposeService("minima")` are implemented (no generic container control API).
- `POST /api/minima/restart` requires an admin session and records an audit event. It now performs a graceful shutdown first — RPC `quit compact:true`, then poll for the container to actually cycle (via Docker-reported `RestartCount`/`StartedAt`, not RPC response or a transient "not running" check — verified the RPC can report shutdown complete well before the process actually exits) before starting it back up — falling back to the previous forceful `restartComposeService` restart only after 5 minutes with no confirmed cycle. That window is intentionally long: forcing a SIGTERM/SIGKILL while the node is still legitimately mid-shutdown/compacting is the same DB corruption risk this graceful path exists to avoid.
- An opt-in "auto restart" toggle (`GET`/`POST /api/minima/restart/auto`, off by default) can trigger that same restart unattended every 48 hours, on the nightly backup scheduler's tick, with no per-run admin action or approval. Toggling it on/off still requires an admin session and is audited; the restart itself uses the same graceful path above.

Plan:

- Replace direct Docker socket access with a narrow sidecar or socket proxy with an explicit allowlist (read stats + restart minima only).
- Consider cAdvisor or host-exported metrics for read-only monitoring.
- Make Docker control optional and disabled by default in production.

Status: Open. Accepted only for prototype operator convenience.

## Minima RPC Console

Risk: The RPC console (`backend/src/features/minima/minima-console.catalog.ts`, `minima-console.service.ts`, `POST /api/minima/console/run`) lets an admin type and run raw Minima RPC command strings, replicating the feel of Minima's own Terminal MiniDapp. A free-text RPC proxy would let any authenticated admin session run `vault` (dumps the seed phrase/private keys in the response) or `sendfrom`/`signfrom`/`createfrom`/`postfrom`/`createtokenfrom` (accept a raw private key as a request argument), and `quit` would halt the node with no UI recovery path.

Impact: Uncontrolled RPC access could leak wallet secrets to the browser/client, allow direct fund movement bypassing normal UI safeguards, or take the node down.

Current Controls:

- Closed-world catalog: nothing runs unless it is both listed in the static `minimaConsoleCatalog` array and enabled in the admin whitelist (`minima_console_whitelist` setting). No request body can whitelist a command outside the catalog — `updateConsoleWhitelist` rejects unknown keys.
- `vault`, `sendfrom`, `signfrom`, `createfrom`, `postfrom`, `createtokenfrom`, `decryptbackup`, `keys`, and `quit` have no catalog entry at all for v1, so no whitelist edit can ever enable them as a raw, free-text command. The first six can expose or accept a raw wallet private key or seed phrase; a bare, unwrapped `quit` can shut the node down with no in-UI recovery. `quit compact:true` is used internally by `restartMinimaContainer()` (`minima.service.ts`) as the first step of a controlled restart that always ends by starting the container back up — this is a narrow, wrapped, non-whitelist-able use, not an exception to the exclusion.
- Every other catalog command defaults to enabled only if it is read-only (no side effects); anything that can mutate funds, chain state, config, network, or the wallet defaults to disabled and must be explicitly turned on.
- Whitelist edits (`POST /api/minima/console/whitelist`) require re-entering the admin PIN/password, the same re-auth pattern `changePassword` uses, and are rate-limited (`authRateLimiter`). This raises the bar against a hijacked-but-not-credentialed session; it does not help if the admin credential itself is compromised (accepted, user-level risk).
- `GET`/`POST /api/minima/console/whitelist` and `POST /api/minima/console/run` all require an admin session (`requireRole("admin")`).
- Where a whitelisted command already has a dedicated narrow backend action (`megammrsync` → `resyncMegammr()`, `peers action:addpeers` → `addMinimaPeers()`), the console dispatches to that same function instead of re-implementing the RPC call, so operation-tracking, audit logging, and error normalization stay a single source of truth.
- Audit events record which command verb ran (`minima.console.run`) and which whitelist keys changed (`minima.console.whitelist_updated`), never the raw RPC response body — consistent with how the rest of the codebase avoids persisting secrets in audit logs.
- The frontend scrollback (command + response) is held in local React state only, never written to `localStorage`, and is cleared on unmount/reload.

Plan:

- Revisit `keys` (whether its response can ever include private key material) and `decryptbackup`/`vault`/the `*from` family before ever considering them for the catalog.
- If any excluded command is ever added later, add response redaction before persisting or displaying it — not just gate it behind the whitelist.

Status: Mitigated via closed-world catalog + re-auth-gated whitelist + hard exclusions. See `.agents/rules/minima.md`.

## Minima Node Backup & Restore

Risk: The Account Settings "Node backup & restore" panel (`backend/src/features/minima/minima-backup.service.ts`, `minima.routes.ts` `/api/minima/backups*`) lets an admin create, download, upload, and restore full Minima node backup (`.bak`) files, plus set one admin-chosen backup password used for every backup. Unlike the existing seed-phrase-only wallet import, a node backup is a superset containing the seed phrase, private keys, coin proofs, and transaction history. The backup password itself is stored encrypted in SQLite (keyed by `APP_SECRET`, same primitive as Integritas token storage) so the backend's own scheduler can create automatic backups unattended.

Impact: An attacker with filesystem access to the host (or a compromised backend container) could read the DB, recover the stored backup password, and decrypt any backup file also on disk — recovering full wallet keys and history. A malicious or malformed uploaded restore file could also be used to attempt a path traversal or overwrite of unrelated files if the backup directory logic were not scoped correctly.

Current Controls:

- The backend only gains filesystem access to one new, narrow, purpose-built subdirectory: `${MINIMA_DATA_DIR:-./minima}/backups` mounted read-write at the fixed container path `/minima-backups` (`docker-compose.yml`). The same host directory is also mounted into `minima` at `/home/minima/backups` — required because Minima resolves the `backup`/`restoresync` `file:` argument against its home dir, not `/home/minima/data` (verified against the pinned image). This is the only host directory shared between the two containers; the backend has no access to the rest of Minima's data directory (seed/private key files, chain DB) and Minima has no access to anything outside its own data dir plus this one backups subfolder.
- All backup filenames are validated as a bare basename and containment-checked with the same resolve-then-realpath pattern used by the host file browser (`files.service.ts`) before any read/write/delete, preventing path traversal via a crafted filename or upload.
- `GET/POST/DELETE /api/minima/backups*` all require an admin session (`requireRole("admin")`).
- Downloading a backup, restoring from a backup (existing file or new upload), and setting/changing the backup password all require re-entering the current admin PIN/password, the same re-auth pattern used by `updateConsoleWhitelist` and `changePassword`, since each reads, activates, or replaces key material.
- Deleting a backup does not require re-auth — it only removes a copy of data recoverable elsewhere (the running node itself, or other retained backup files), not a unique secret.
- Backups (manual and automatic alike) share one rolling list capped at 20, oldest auto-deleted once a new one pushes past the cap, since every backup now uses the same real password. All of them are downloadable and restorable.
- Automatic backups are created by the backend's own scheduler (`minima-backup-scheduler.service.ts`, a fixed nightly time — 00:30 on the backend container's clock, see `TZ` in `docker-compose.yml`) rather than Minima's built-in `backup auto:true` — verified against Minima's own source (`minima-global/Minima`) that the built-in scheduler always uses Minima's hardcoded default password (`"minima"`, public) and always writes to Minima's own default data folder with no configurable path, making it unable to deliver a real password or a visible/capped location for recurring runs. Enabling the backend's own scheduler requires a backup password to already be set.
- Audit events (`minima.backup.created`, `.downloaded`, `.restored`, `.deleted`, `.auto_toggled`, `.password_set`) record the filename/acting user but never the backup password itself.
- Restoring always uses Minima's `restoresync` (restore + Megammr archive re-sync in one step) against the already-configured, admin-set Megammr host — never a host supplied by the request body.
- Rejected mitigation: encrypting backup *file contents* at rest with `APP_SECRET` directly (as a second layer beyond the admin's own password). That would make `APP_SECRET` a standing, unrotatable key for every backup's data — rotating it (already required to be preserved across upgrades for this exact reason) would permanently brick every existing backup. Storing only the *setting value* (the admin-chosen backup password) encrypted with `APP_SECRET`, as implemented, doesn't have this problem: an attacker who can read the encrypted setting already has host/container access (out of scope for this register), and the backup files themselves remain protected by a real, admin-chosen, rotatable password — which is what makes them safe once they leave the device, not local DB storage.

Plan:

- Consider allowing the backup password to be changed (re-encrypting nothing retroactively — existing backups keep their original password) with a clear UI warning that old backups won't decrypt with a new password.

Status: Mitigated via a narrow scoped volume, path containment, admin-only + re-auth-gated routes (including for the password itself), capped/auto-pruned lists, and audit logging. Third revision this session — see `docs/plans/minima-node-backup-restore.md`.

## Update Agent Docker Socket Mount

Risk: The `update-agent` service mounts `/var/run/docker.sock` to pull images by digest and recreate `frontend`/`backend`/`minima` containers during an update. Docker socket access is host-root-equivalent: any process holding the mount can start a privileged or host-mounted container regardless of whether the socket is reachable over the network.

Impact: If `update-agent` is compromised (e.g. via a flaw in its manifest parsing or HTTP handling), the attacker gains the same practical privilege as host root.

Current Controls:

- `update-agent` has no host-exposed port; it is reached only through `frontend`'s nginx (`/update`), and its `/status`/`/apply` endpoints require an authenticated admin session (verified against `backend`'s existing session store via `GET /api/auth/me`).
- No generic Docker command surface — only the specific pull/create/start/stop/remove/inspect calls needed to apply a signed update.
- No dependencies beyond `express`; no endpoints beyond `/status`, `/apply`, and its static update page.
- Update manifests must be signed (Ed25519) with a private key that only exists in GitHub Actions Secrets; `update-agent` verifies the signature against an embedded public key before trusting any digest.
- Deliberately not merged with TLS termination/routing duties — a bug in `update-agent` does not also hand over the public-facing routing layer, and vice versa.

Plan:

- Treat "`update-agent` compromised → Pi compromised" as an accepted risk for V1, mitigated by minimal code surface rather than network placement (the mount itself cannot be made safe if the holding process is compromised).
- Revisit only if a narrower Docker control surface (e.g. a proxy with an explicit allowlist) becomes necessary; out of scope for V1.

Status: Accepted risk, documented. See `.agents/rules/update-agent.md`.

## Host Agent Capability Management

Risk: `install.sh` installs a root-owned `edge-studio-host-agent` service that lets the backend request narrow host hardware support actions, including enabling or disabling Raspberry Pi Camera support, GPIO container access, and the local MQTT broker after the app is already installed.

Impact: If the host agent or its bearer token is compromised, an attacker could perform the specific host actions implemented by the agent, including changing camera-helper systemd state, changing GPIO Compose device access, toggling the MQTT Compose profile, and restarting backend/MQTT containers.

Current Controls:

- The browser never talks to the host agent directly; it calls backend routes under `/api/host-capabilities`.
- Backend host-capability mutations require an authenticated admin session.
- The host agent requires an installer-generated bearer token that is written to `.env` and passed only to the backend container.
- The host agent exposes fixed capability endpoints only; it has no generic shell, package install, driver install, file write, or service-management proxy.
- I2C sensor support can be enabled/disabled through the host agent, but host OS prerequisites such as I2C enablement and SMBus packages are still reported rather than installed automatically.
- V1 host-agent actions manage Edge Studio helper/config state and report missing OS prerequisites; they do not install Raspberry Pi OS packages, drivers, firmware, or boot config automatically.
- The installer adds the same Docker-subnet firewall pattern used by other host helpers where `iptables` is available.

Plan:

- Keep future capabilities allowlisted and capability-specific.
- Keep OS package/driver installation out of the normal enable path unless a later explicit, per-capability design is approved.
- Add asynchronous job history if hardware setup actions become long-running.
- Design host-agent update delivery so new helper/capability logic can ship through the app update path without asking users to rerun `install.sh`.
- Revisit binding/firewall behavior during real Pi verification.

Status: Accepted risk for app-managed hardware enablement. See `docs/plans/host-agent-capability-management.md`.

## I2C Sensor Helper

Risk: `ENABLE_SENSORS=true` installs a host-side `edge-studio-sensor-helper` service that can read supported I2C sensors such as BME280 and BME680 through the Pi's I2C bus.

Impact: If abused, helper access could disclose local environmental sensor readings or interact with attached I2C devices. A generic I2C proxy would be much higher risk because arbitrary reads/writes could affect unrelated hardware on the bus.

Current Controls:

- Sensor support is off by default and requires `ENABLE_SENSORS=true`.
- The backend calls the helper with a generated bearer token; the token is not exposed to the browser.
- The helper API is narrow: `/read` only accepts allowlisted sensor types and validated bus/address values, and does not expose arbitrary I2C operations.
- The helper is intended for trusted local Raspberry Pi deployments and is only reachable from the configured Compose subnet firewall rule when installed by `install.sh`.

Plan:

- Keep future sensors allowlisted and avoid generic I2C read/write endpoints.
- Revisit helper isolation if sensor support expands beyond read-only environmental sensors.

Status: Accepted risk for opt-in prototype hardware support.

## Update Manifest Signing Key

Risk: The `update-agent` update flow trusts any manifest whose signature verifies against the embedded Ed25519 public key. Compromise of the corresponding private key would let an attacker publish a manifest pointing at attacker-controlled image digests.

Impact: A stolen signing key could be used to make `update-agent` pull and run arbitrary images on every Pi in the field, which — combined with `update-agent`'s `docker.sock` access — is equivalent to full host compromise on affected devices.

Current Controls:

- The private key is generated once, manually, and stored only in GitHub Actions Secrets. It never exists on the VPS or any Pi.
- CI signs the manifest in a single job step; the key is read from the secret into an environment variable for that step only and is never written to a file that survives the job.
- `update-agent` only ever holds the public key, baked into its image at build time.
- Digest pinning means a valid signature alone is not sufficient to run a different artifact than what the digest names — an attacker would need both a stolen key and control of a pushed image.

Plan:

- If the key is ever suspected compromised, rotate it (generate a new keypair, update the GH secret, ship the new public key in a `update-agent` release) and document the rotation in this file.

Status: Accepted risk, documented. See `.agents/rules/update-agent.md`.

## File Browser Metadata Exposure

Risk: Backend lists files and directories from the configured host path. Mount is read-only, but filenames, directory names, sizes, and structure may be sensitive.

Impact: Local data disclosure to anyone who can access the UI.

Plan:

- Keep `HOST_FILES_DIR` as narrow as possible.
- Add auth before use outside trusted local development.
- Add per-user allowlists or explicit directory selection later.
- Avoid mounting `/home/pi` in production unless required.

Status: Partially mitigated by read-only mount and path traversal checks. Auth gates `/api/files/*` (see `docs/plans/auth-security.md`).

## Path Traversal And Symlink Escape

Risk: File browser endpoints could be abused to access files outside the allowed directory.

Impact: Sensitive host file disclosure.

Current Controls:

- Uses `path.resolve` to block `../` traversal.
- Uses `fs.realpath` to block symlink escape outside `/host-files`.
- Host mount is read-only.

Plan:

- Add tests for traversal, symlink escape, encoded paths, and permission errors.
- Consider hiding symlinks entirely.

Status: Mitigated for prototype, needs tests.

## SQLite File Permissions

Risk: SQLite data directory must be writable by backend uid `1000`. Incorrect permissions can crash backend. Overly broad permissions can expose encrypted settings and future app data.

Impact: Availability issue or local data exposure.

Current Controls:

- Installer creates data directory and sets owner to `1000:1000`.
- Installer sets directory mode `700`.

Plan:

- Add startup diagnostics with clear error messages.
- Consider migration command and backup documentation.

Status: Partially mitigated.

## Dependency And Image Supply Chain

Risk: Docker images and npm packages are pulled from external registries. Tags such as `minimaglobal/minima:dev` are mutable.

Impact: Unexpected updates, compromised dependencies, reproducibility issues.

Plan:

- Pin image digests for production.
- Avoid `:dev` tags outside prototyping.
- Add automated `npm audit` and image vulnerability scanning.
- Review native dependency `better-sqlite3` updates.

Status: Open.

## One-Line Curl Installer

Risk: `curl | sudo bash` executes remote code as root.

Impact: If GitHub, DNS, TLS trust, or repository contents are compromised, host compromise is possible.

Plan:

- Publish checksums or signed releases.
- Support downloading and inspecting installer before running.
- Consider package repository, deb package, or signed install bundle.
- Keep installer minimal and auditable.

Status: Open. Accepted for prototype UX exploration.
