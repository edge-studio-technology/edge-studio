# Host And Infrastructure Risks

Related: [SECURITY.md](../../SECURITY.md) · [qa/gaps.md](../qa/gaps.md)

## Docker Socket Mount

Risk: The backend mounts `/var/run/docker.sock` to read container status/resource usage and to restart the Minima container via `POST /api/minima/restart` (admin-only). Docker socket access is highly sensitive.

Impact: If the backend is compromised, an attacker could read container metadata or restart/stop containers allowed by the Docker API and socket group permissions.

Current Controls:

- Docker write use is narrow: only `restartComposeService("minima")` is implemented (no generic container control API).
- `POST /api/minima/restart` requires an admin session and records an audit event.

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
- `vault`, `sendfrom`, `signfrom`, `createfrom`, `postfrom`, `createtokenfrom`, `decryptbackup`, `keys`, and `quit` have no catalog entry at all for v1, so no whitelist edit can ever enable them. The first six can expose or accept a raw wallet private key or seed phrase; `quit` can shut the node down with no in-UI recovery.
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

Risk: The Account Settings "Node backup & restore" panel (`backend/src/features/minima/minima-backup.service.ts`, `minima.routes.ts` `/api/minima/backups*`) lets an admin create, download, upload, and restore full Minima node backup (`.bak`) files. Unlike the existing seed-phrase-only wallet import, a node backup is a superset containing the seed phrase, private keys, coin proofs, and transaction history. If created without a password, the file is unencrypted key material at rest.

Impact: An attacker with filesystem access to the host (or a compromised backend container) could read an unencrypted backup file and recover full wallet keys and history. A malicious or malformed uploaded restore file could also be used to attempt a path traversal or overwrite of unrelated files if the backup directory logic were not scoped correctly.

Current Controls:

- The backend only gains filesystem access to one new, narrow, purpose-built subdirectory: `${MINIMA_DATA_DIR:-./minima}/backups` mounted read-write at the fixed container path `/minima-backups` (`docker-compose.yml`). The same host directory is also mounted into `minima` at `/home/minima/backups` — required because Minima resolves the `backup`/`restoresync` `file:` argument against its home dir, not `/home/minima/data` (verified against the pinned image). This is the only host directory shared between the two containers; the backend has no access to the rest of Minima's data directory (seed/private key files, chain DB) and Minima has no access to anything outside its own data dir plus this one backups subfolder.
- All backup filenames are validated as a bare basename and containment-checked with the same resolve-then-realpath pattern used by the host file browser (`files.service.ts`) before any read/write/delete, preventing path traversal via a crafted filename or upload.
- `GET/POST/DELETE /api/minima/backups*` all require an admin session (`requireRole("admin")`).
- Downloading an existing backup and restoring from a backup (existing file or new upload) both require re-entering the current admin PIN/password (`POST .../download`, `POST .../restore`), the same re-auth pattern used by `updateConsoleWhitelist` and `changePassword`, since either action reads or activates potentially unencrypted key material.
- Deleting a backup does not require re-auth — it only removes a copy of data recoverable elsewhere (the running node itself, or other retained backup files), not a unique secret.
- The optional built-in Minima daily auto-backup (`backup auto:true`) is opt-in and off by default; the UI and README both label it as writing unencrypted files.
- Audit events (`minima.backup.created`, `.downloaded`, `.restored`, `.deleted`, `.auto_toggled`) record the filename and acting user but never the backup password.
- Restoring always uses Minima's `restoresync` (restore + Megammr archive re-sync in one step) against the already-configured, admin-set Megammr host — never a host supplied by the request body.

Plan:

- Consider encrypting backups at rest by default (e.g. requiring a password) rather than allowing an unencrypted backup as the default path, once real-node behavior for `backup password:`/`auto:` is confirmed.
- Revisit whether auto-backup should be off-by-default at the RPC level too (currently only gated by this feature's own toggle), if Minima's own default changes.

Status: Mitigated via a narrow scoped volume, path containment, admin-only + re-auth-gated routes, and audit logging. New in this release — see `docs/plans/minima-node-backup-restore.md`.

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
