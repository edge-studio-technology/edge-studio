# Host Agent Capability Management Plan

**Status:** In progress
**Created:** 2026-08-19  
**Goal:** Let an admin enable optional host hardware support from the web app after first install, without rerunning `install.sh` manually.

## Context

Optional host capabilities such as Raspberry Pi Camera support are currently controlled by install-time environment flags like `ENABLE_CAMERA=true`. That works during first install, but changing the flag later requires rerunning the installer because the work spans both container runtime configuration and privileged host setup.

The app frontend/backend run in Docker and should remain non-root. The backend cannot safely install host packages, write systemd units, change host device permissions, or restart host services directly. The preferred direction is to install a small root-owned host agent during the initial install. The normal app can then ask that agent to apply a narrow, allowlisted capability change.

Rejected approaches for the first implementation:

- Do not make the backend container privileged or root on the host.
- Do not expose a generic command runner or shell proxy.
- Do not fold this into the product backend.
- Avoid expanding `update-agent` unless code inspection later proves it is the right boundary; it is currently scoped to signed container updates.

The first capability should be camera enable/disable, because it is the current user pain point and already has host helper logic in `install.sh`.

V1 explicitly separates Edge Studio hardware support from host OS driver/package management. The host agent should detect missing OS prerequisites and report them clearly, but it should not install OS packages, edit boot config, or enable kernel/device-tree features automatically in the first version.

## Target Architecture

```txt
Browser UI
  -> backend API, non-root Docker
    -> host-agent API, root-owned host systemd service
      -> systemd / file permissions / fixed host setup actions / Docker Compose restarts
```

The host agent is installed once by `install.sh`, even when optional capabilities start disabled. It exposes only fixed capability actions and reports status/progress back to the backend.

Layer responsibilities:

- `host-agent`: root-owned service that detects capability state, installs/enables/disables Edge Studio helper services, updates app runtime config, and restarts/reloads app services when needed.
- Edge Studio app: Docker frontend/backend that shows hardware state, hides unavailable templates, and requests allowlisted actions through backend APIs.
- Host OS: owns low-level drivers, packages, firmware, boot config, and kernel/device-tree enablement in V1.

Suggested host-side layout:

```txt
host-agent/
  edge_studio_host_agent.py
  capabilities/
    camera.py
```

Suggested systemd service:

```txt
/etc/systemd/system/edge-studio-host-agent.service
```

Suggested runtime env values written by `install.sh`:

```txt
HOST_AGENT_URL=http://<docker-gateway>:<host-agent-port>
HOST_AGENT_TOKEN=<generated-secret>
HOST_AGENT_PORT=<default-port>
```

Use Python stdlib where practical so the host agent does not depend on Docker, npm, or a host Node.js install.

## Security Model

The host agent is privileged, so its API must stay narrow.

Rules:

- Require `Authorization: Bearer <HOST_AGENT_TOKEN>` on all non-health endpoints.
- Generate and persist `HOST_AGENT_TOKEN` during install.
- Pass the token only to the backend container; never expose it to the browser.
- Bind the agent to the host/Docker route needed by backend, and restrict access to the configured Docker subnet where possible.
- Accept only allowlisted capability names and actions.
- Reject unknown request fields instead of silently accepting future behavior.
- Never accept command strings, package names, file paths, or service names from the app.
- Do not install OS packages, drivers, or tools automatically in V1.
- Log actions and results, but never log tokens or secrets.

Backend routes that call the host agent must require a logged-in admin. Use existing auth middleware and `requireRole("admin")` for mutations.

## Host Agent API

Initial endpoints:

```txt
GET  /health
GET  /capabilities
GET  /capabilities/camera
POST /capabilities/camera/apply
POST /capabilities/camera/disable
GET  /jobs/:id
```

Initial capability states:

```txt
disabled
applying
enabled
failed
needs_reboot
missing_prerequisites
```

The job endpoint should be included if camera setup can take long enough that a frontend request may time out. If implementation stays fast and synchronous at first, preserve the response shape so async jobs can be added without redesigning the frontend.

If OS prerequisites are missing, return `missing_prerequisites` or `failed` with safe, specific diagnostics. The UI should explain what is missing and should not offer a normal enable action until the prerequisite is present.

## Installer Plan

Update `install.sh` so the first install always installs the host agent.

Installer changes:

1. Generate or preserve `HOST_AGENT_TOKEN`.
2. Write `HOST_AGENT_URL`, `HOST_AGENT_TOKEN`, and `HOST_AGENT_PORT` to `.env`.
3. Copy/install the host-agent files into the runtime bundle.
4. Write and enable `edge-studio-host-agent.service`.
5. Keep existing install-time env behavior by applying camera setup during install when `ENABLE_CAMERA=true`.
6. Avoid duplicating camera setup logic between `install.sh` and host-agent code where practical.

The install script should still support current one-command installs. A user who installs with `ENABLE_CAMERA=true` should end with camera support enabled immediately. A user who installs with `ENABLE_CAMERA=false` should still have the host agent ready for later app-driven enablement.

## Camera Capability Plan

Move or mirror the current `install_camera_helper()` behavior from `install.sh` into the host agent's camera capability code.

Camera apply should perform fixed, idempotent steps:

1. Ensure the camera capture directory exists.
2. Apply ownership and permissions.
3. Ensure the camera helper token exists.
4. Write `/etc/systemd/system/edge-studio-camera-helper.service`.
5. Run `systemctl daemon-reload`.
6. Enable and restart `edge-studio-camera-helper.service`.
7. Update app runtime config so `ENABLE_CAMERA=true` and camera helper env values match the service.
8. Recreate or restart backend if the env-only camera flag still requires process restart.
9. Return final status and any safe diagnostic details.

Camera disable should perform fixed, idempotent steps:

1. Disable and stop `edge-studio-camera-helper.service`.
2. Remove or disable the camera helper service file.
3. Run `systemctl daemon-reload`.
4. Update app runtime config so `ENABLE_CAMERA=false`.
5. Recreate or restart backend if required.
6. Return final status and any safe diagnostic details.

Warnings such as missing `rpicam-still` or `libcamera-still` should be reported as capability diagnostics rather than hidden in install logs.

Camera apply should not install Raspberry Pi camera packages in V1. If neither `rpicam-still` nor `libcamera-still` is available, the host agent should report missing host camera tools and the UI should guide the operator to fix the host OS first.

## Runtime Configuration Plan

The current backend reads camera settings from env at startup. The minimal first implementation should preserve that model.

Minimal V1 behavior:

```txt
host-agent updates .env
host-agent recreates/restarts backend
backend rereads ENABLE_CAMERA on startup
```

This is less invasive than moving camera enablement into SQLite immediately.

Possible later improvement:

```txt
backend stores desired capability state in SQLite/settings
backend reads live host-agent status dynamically
camera service checks dynamic config instead of env-only flags
```

Do not build the dynamic configuration version unless the restart-based version proves insufficient.

## Backend Plan

Add a backend feature folder:

```txt
backend/src/features/host-capabilities/
```

Suggested routes:

```txt
GET  /api/host-capabilities
GET  /api/host-capabilities/camera
POST /api/host-capabilities/camera/enable
POST /api/host-capabilities/camera/disable
GET  /api/host-capabilities/jobs/:id
```

Implementation notes:

1. Register routes in `backend/src/app.ts`.
2. Add host-agent config values to `backend/src/config/env.ts`.
3. Require auth for all routes and `requireRole("admin")` for mutations.
4. Normalize host-agent failures through existing API error patterns.
5. Do not expose host-agent token, sensitive host paths, stack traces, or raw command output.
6. Return stable user-facing states for the frontend.

## Frontend Plan

Evolve the existing `LocalServicesCard` in `frontend/src/features/data-sources/DataSourceTemplates.tsx` into a broader hardware-support area on the Devices page. This is the smallest UI change because the card is already rendered by `frontend/src/pages/DataSourcesPage.tsx` and already receives runtime capability data.

Suggested placement:

```txt
Devices -> Hardware support
```

Rename the visible section from `Local services` to `Hardware support`. By default, it should show which host-backed capabilities are installed, enabled, available, or unavailable. The current MQTT broker connection details can remain in this area as a local service row/card, while camera and future host hardware capabilities appear alongside it.

Add an action such as:

```txt
Enable / disable hardware
```

That action should open a modal or panel listing supported hardware capabilities and their actions.

Camera card states:

```txt
Camera support: Disabled
Button: Enable camera

Camera support: Applying
Progress: Installing camera helper...

Camera support: Enabled
Button: Disable / Reinstall

Camera support: Failed
Details disclosure + Retry

Camera support: Missing host camera tools
Button: disabled or replaced by guidance
Details: install/enable the Raspberry Pi camera stack on the host, then refresh
```

Frontend notes:

1. Use backend API only; never call the host agent directly from the browser.
2. Show user intent, not env flags.
3. Use existing shared UI components and toast/error-detail patterns.
4. Poll job/status while an apply or disable action is running.
5. If a reboot is required for a future capability, show a clear `needs_reboot` state.
6. If host OS prerequisites are missing, explain the missing prerequisite and do not hide it as a generic enable failure.

Device creation should respect capability state. Hardware templates that require disabled or unavailable host support should not appear in the default `New input` or `New output` flows. Keep them in an internal inactive/disabled template list for now, but do not expose that list until there is a dedicated `Show inactive/disabled devices` UI.

## Extensibility Plan

After camera works, the same host-agent capability framework can support other host features.

Implemented V1 capabilities:

- `sensors` for I2C sensor helper setup.
- `gpio` for device access and compose override management.
- `mqtt` for local broker profile/config toggling if host-level work is needed.

Each capability should remain its own allowlisted action set. Do not add generic service-management endpoints as a shortcut.

Automatic OS package/driver installation is deferred. If it is added later, it should be an explicit per-capability action with OS/model-specific checks, signed/updateable agent logic, reboot handling, and clear user consent. It should not be hidden inside the normal `Enable` action.

Host-agent update delivery also needs a future design. New hardware support may require host-agent changes in addition to frontend/backend Docker image updates, and users should not have to rerun `install.sh` for every host-agent update.

## Current Implementation State

Implemented so far:

- `install.sh` installs a root-owned `edge-studio-host-agent` systemd service during normal install.
- Backend exposes admin-gated `/api/host-capabilities` routes and never exposes the host-agent token to the browser.
- Hardware support in Devices can enable/disable Camera, GPIO, I2C sensors, and the app-managed local MQTT broker.
- Host-agent actions update `.env`, manage Edge Studio-owned helper/systemd/Compose state, and schedule backend or Compose service restarts as needed.
- Host-agent actions report missing OS prerequisites instead of installing host OS packages, drivers, firmware, or boot config.
- Camera, GPIO, I2C sensor, and local MQTT capability state is shown in Hardware support.
- Disabled or unavailable host-backed templates are hidden from the default `New input` / `New output` flows.
- Configured host-backed devices show `Disabled` or `Needs attention` when required support is unavailable.
- Manual read/test actions are disabled when a configured device's required hardware support is unavailable.
- Workflow validation reports disabled/unavailable hardware dependencies for Camera, GPIO, I2C sensors, and app-managed local MQTT broker devices.
- Workflow list rows show a validation error message when there is no persisted runtime `lastError`.
- Hardware enable/disable uses a blocking modal with polling/settle time so the UI does not accept more hardware actions while backend/services are restarting.
- `HOST_CAPABILITY_DEBUG=true` enables secret-safe backend and host-agent diagnostics for hardware support flows.
- Real Pi regression confirmed enable/disable for Camera, GPIO, I2C sensors, and Local MQTT, including state after backend/container restart, disabled device status, workflow validation errors, and template hiding.
- Host-agent capability status now includes per-capability `checks` diagnostics and distinguishes missing tools/devices, helper service state, Compose profile/service/container state, generated GPIO override state, and backend container GPIO readiness.

Known V1 boundaries:

- The installer remains responsible for initial install, host-agent installation, Docker/runtime bundle setup, and advanced `ENABLE_*` shortcut behavior.
- The host-agent owns hardware activation/disablement logic. The app reaches it through backend APIs after install, and installer `ENABLE_*` shortcuts call the same host-agent code through CLI install mode.
- Edge Studio does not install OS-level prerequisites automatically yet.
- Raspberry Pi OS/Debian prerequisite guidance is shown in the UI; other Linux distributions may work but are not the primary supported guidance path.

Completed implementation checkpoints:

- Real Pi regression pass for app-managed hardware enable/disable, backend/container restart behavior, disabled device status, workflow validation errors, and template hiding.
- Installer/host-agent ownership boundary moved into final V1 shape: installer owns initial setup and host-agent installation, host-agent owns app-managed hardware changes after install, and installer advanced `ENABLE_*` shortcuts call the same host-agent capability logic through CLI install mode.
- Host-agent status hardening is implemented for Camera, GPIO, I2C sensors, and local MQTT: checks distinguish missing host tools/devices, helper service states, generated GPIO override readiness, backend container device visibility, Compose profile/service availability, and MQTT container running state.
- Host-agent file-write hardening started: `.env`, generated GPIO override, and camera/sensor systemd unit writes now use atomic replacement; service-file deletes tolerate repeated disable/race conditions; GPIO override writes refuse to replace user-managed override files.
- GPIO action safety now reports user-managed override blockage in capability status and rejects automatic repair before changing `.env`, avoiding partial enablement when `docker-compose.override.yml` cannot be edited safely.
- `.env` and Compose profile updates are now more retry-safe: repeated updates collapse duplicate edited keys and repeated MQTT apply/disable does not duplicate profile entries.
- Host-agent retry tests now cover repeated GPIO apply, repeated MQTT apply/disable, and repeated Camera/I2C helper disable actions with mocked external service boundaries.
- Host-agent retry tests now also cover repeated Camera/I2C apply actions and systemd restart failures before `.env` is flipped to enabled.
- Backend and Docker Compose restart scheduling now reports missing Docker and process-launch failures as structured retryable results instead of uncaught action errors.
- Action-level backend restart failure tests now cover Camera, GPIO, and I2C enablement leaving generated state intact and returning the failed restart result for retry.
- Automated capability-logic tests now cover frontend device/template host-capability mapping, backend workflow validation for disabled/unavailable Camera/GPIO/I2C/local MQTT dependencies, and host-agent `.env`/Compose/GPIO override safety behavior.
- Prerequisite UX now includes an explicit Hardware support refresh action, contextual `I have completed this, refresh now` affordance for blocked prerequisites, copyable Raspberry Pi OS/Debian-oriented commands, and a single low-noise platform disclaimer.

## Remaining Implementation Steps

1. Host-agent action safety.
   V1 action safety is implemented for the known file-write, duplicate-update, user-managed override, repeated-click, and restart-scheduling failure paths. Keep this section open only for manual Pi retry validation and issues found during release testing.

   Implementation checkpoints:

   - Run manual Pi retry validation for repeated Enable/Disable/Repair across Camera, GPIO, I2C sensors, and local MQTT.
   - Review whether `.env` writes should reject non-allowlisted keys at the helper boundary, even though callers currently pass fixed internal updates only.
   - Verify failed prerequisites and failed partial actions can be corrected and retried without manual cleanup beyond the prerequisite fix.

2. Improve hardware operation model.
   The blocking modal plus polling is acceptable for V1. Longer-term, implement host-agent jobs: `POST /capabilities/:name/apply` returns a job id, and the UI polls job/capability state. This avoids request timeout issues for longer actions.

3. Add automated tests around capability logic.
   Core V1 capability-logic coverage is implemented. Add further tests only for bugs found during Pi retry validation or for future host-agent job/update-delivery work.

4. Finalize prerequisite UX.
   Implemented for V1. Keep open only for copy refinements from real Pi operator testing.

5. Host-agent update delivery.
   Ensure host-agent and helper updates are delivered through the normal signed/update flow, not only by rerunning `install.sh`. Confirm runtime bundle contents and service reload/restart behavior when host-agent/helper code changes.

   Inspection findings:

   - Install-time runtime bundle already includes `.env.example`, Compose files, `scripts/verify-manifest.mjs`, the manifest public key, `host-agent/edge_studio_host_agent.py`, `camera-helper/edge_studio_camera_helper.py`, `sensor-helper/edge_studio_sensor_helper.py`, and Mosquitto config.
   - The signed update manifest currently covers only Docker image digests for `frontend`, `backend`, and `updateAgent`, plus `version` and `createdAt`.
   - `update-agent` currently applies only Docker container updates for frontend/backend and launches a special self-update path for the update-agent container.
   - `update-agent` has Docker socket access but no `/opt/edge-studio` bind mount and no root/systemd access, so it cannot currently update host-agent/helper files or restart host services directly.
   - `install.sh` installs/restarts `edge-studio-host-agent.service` and applies advanced `ENABLE_*` shortcuts through the host-agent CLI, but this path only runs when the installer is rerun.

   Recommended implementation boundary:

   - Extend the signed manifest with a host runtime artifact hash or digest instead of trusting an unsigned bundle URL.
   - Add a narrow host-agent update endpoint or CLI action that accepts a verified host-runtime payload from update-agent and atomically replaces only allowlisted host files.
   - Let the root-owned host-agent restart itself and enabled helper services after file replacement; run `systemctl daemon-reload` only if unit definitions change.
   - Mount or deliver the verified host-runtime payload to update-agent without granting update-agent generic root filesystem write access.
   - Record host-runtime update success/failure in the update result, and do not record the manifest as fully applied if host-runtime update fails.

   Implemented in this repo:

   - `hostRuntime` is now a required signed manifest field with `url` and `sha256`.
   - `update-agent` downloads the host runtime artifact, verifies the signed SHA-256, and posts it to the host-agent.
   - `docker-compose.yml` passes `HOST_AGENT_URL` and `HOST_AGENT_TOKEN` to update-agent.
   - The host-agent accepts `POST /updates/host-runtime/apply` and atomically replaces only allowlisted host runtime files.
   - Host runtime status is included in update status so host-only updates are visible in the app.

   Prompt for the manifest repo agent:

   ```txt
   Update the Edge Studio manifest publishing flow for the new required hostRuntime manifest field.

   Context:
   - The app repo now requires signed manifests to include:
     "hostRuntime": {
       "url": "https://.../edge-studio-runtime.tar.gz",
       "sha256": "<64-char lowercase hex sha256>"
     }
   - Existing frontend/backend/updateAgent image digest fields remain required.
   - Backward compatibility with old app installs is not required; users will rerun install.sh for this breaking update.
   - The host runtime artifact should be the same runtime tarball currently published for installs, unless the manifest repo already has a clearer artifact naming convention.

   Tasks:
   1. Update manifest generation to include hostRuntime.url and hostRuntime.sha256.
   2. Compute sha256 from the exact uploaded host runtime tarball bytes.
   3. Ensure manifest.json is signed after hostRuntime is inserted.
   4. Upload/serve manifest.json, manifest.json.sig, and the host runtime tarball from the public cloud release path.
   5. Keep the GitHub raw fallback path in sync with the public cloud path.
   6. Add or update tests/docs in the manifest repo for the new required field.

   Expected manifest shape:
   {
     "frontend": "ghcr.io/.../frontend@sha256:...",
     "backend": "ghcr.io/.../backend@sha256:...",
     "updateAgent": "ghcr.io/.../update-agent@sha256:...",
     "hostRuntime": {
       "url": "https://edgestudio.technology/manifest/release/edge-studio-runtime.tar.gz",
       "sha256": "..."
     },
     "version": "...",
     "createdAt": "..."
   }
   ```

   Expanded manifest repo agent handoff:

   ```txt
   You are working in the Edge Studio manifest publishing repo. This repo is static release output: the Edge Studio app repo CI writes files here, so do not hand-edit `edge-studio/<channel>/manifest.json` unless you also regenerate the signature with the real signing key. The durable fix belongs in the app repo release workflow, with this repo receiving generated output plus docs.

   The application repo branch `hardware-installer-agent` now requires every signed update manifest to include a host runtime artifact:

   {
     "hostRuntime": {
       "url": "https://.../edge-studio-runtime.tar.gz",
       "sha256": "<64-char lowercase hex sha256>"
     }
   }

   Current app-side behavior:
   - The update-agent validates signed manifests and rejects manifests missing `hostRuntime.url` or `hostRuntime.sha256`.
   - The update-agent downloads `hostRuntime.url`, verifies the SHA-256 against `hostRuntime.sha256`, then sends the verified tarball to the host-agent.
   - The host-agent only applies allowlisted files from the tarball:
     - `host-agent/edge_studio_host_agent.py`
     - `camera-helper/edge_studio_camera_helper.py`
     - `sensor-helper/edge_studio_sensor_helper.py`
     - `docker/mosquitto/mosquitto.conf`
   - The manifest must be signed after `hostRuntime` is inserted. Do not sign first and mutate later.
   - Backward compatibility with older app versions is not required for this branch; operators will rerun the latest `install.sh` before relying on update-agent updates.

   Required changes:
   1. In the app repo release workflow, build `edge-studio-runtime.tar.gz` before `manifest.json` is generated and signed.
   2. Ensure the runtime tarball comes from `scripts/release/runtime-bundle-files.json` or an equivalent source and contains paths relative to repo root.
   3. Compute SHA-256 from the exact tarball bytes that will be copied into this manifest repo.
   4. Insert `hostRuntime.url` and `hostRuntime.sha256` into `manifest.json` before signing.
   5. Sign the final manifest only after `hostRuntime` is present.
   6. Push `manifest.json`, `manifest.json.sig`, and `edge-studio-runtime.tar.gz` together under `edge-studio/<channel>/`.
   7. Keep the public cloud mirror and GitHub raw fallback serving the same generated files.
   8. In this manifest repo, update README/docs to document the new manifest shape and the fact that channel files are generated by app repo CI.
   9. Add tests or fixture checks in whichever repo owns them proving generated manifests include valid `hostRuntime.url` and a 64-char hex `hostRuntime.sha256`.

   Acceptance checks:
   - A generated manifest has this shape:
     {
       "frontend": "ghcr.io/.../frontend@sha256:...",
       "backend": "ghcr.io/.../backend@sha256:...",
       "updateAgent": "ghcr.io/.../update-agent@sha256:...",
       "hostRuntime": {
         "url": "https://edgestudio.technology/manifest/release/edge-studio-runtime.tar.gz",
         "sha256": "<sha256 of the exact tarball bytes>"
       },
       "version": "...",
       "createdAt": "..."
     }
   - Verifying the signed manifest succeeds.
   - Downloading `hostRuntime.url` and hashing it produces exactly `hostRuntime.sha256`.
   - The runtime tarball includes all four allowlisted required files at repo-relative paths.
   ```

   Operator end-to-end deployment guide:

   1. Merge/release the app repo changes that require `hostRuntime` in signed manifests.
   2. Update the manifest repo/pipeline using the handoff above.
   3. Build and publish the Docker images for `frontend`, `backend`, and `updateAgent`; record their immutable `@sha256:` image references.
   4. Build/upload the host runtime tarball from the same app commit. The tarball must contain the allowlisted host files at repo-relative paths.
   5. Compute the SHA-256 from the exact downloadable tarball URL that devices will fetch.
   6. Generate `manifest.json` with the three image digests, `hostRuntime.url`, `hostRuntime.sha256`, `version`, and `createdAt`.
   7. Sign `manifest.json` and publish `manifest.json`, `manifest.json.sig`, and the runtime tarball to the public manifest path.
   8. Update the GitHub raw fallback manifest path with the same signed manifest content and runtime artifact reference.
   9. On a test Pi, rerun the latest `install.sh` once so the new update-agent/host-agent wiring and token/env support are installed.
   10. Confirm the test Pi `.env` points `MANIFEST_URL` at the new signed manifest and has the expected manifest public key.
   11. Start the stack with the update-agent profile enabled.
   12. In the app, check update status and confirm `host-runtime` appears alongside container services.
   13. Apply the update from the app, or call the update-agent apply endpoint if testing manually.
   14. Confirm the update completes and the applied manifest is recorded only after all container updates and host runtime update succeed.
   15. Verify host files on the Pi match the released artifact and enabled helper services were restarted or scheduled as expected.
   16. Repeat the test with a host-only runtime change before production rollout so the `host-runtime` status/update path is proven independently of container updates.
   17. Roll out to production devices by instructing operators to rerun latest `install.sh` once, then use the normal signed update flow for subsequent updates.

   Manual validation commands for the release artifact:

   ```sh
   curl -fsSL "$HOST_RUNTIME_URL" -o /tmp/edge-studio-runtime.tar.gz
   sha256sum /tmp/edge-studio-runtime.tar.gz
   tar -tzf /tmp/edge-studio-runtime.tar.gz | grep -E '^(host-agent/edge_studio_host_agent.py|camera-helper/edge_studio_camera_helper.py|sensor-helper/edge_studio_sensor_helper.py|docker/mosquitto/mosquitto.conf)$'
   ```

6. Security and audit trail.
   Add audit events for hardware enable/disable actions, including capability name and resulting state. Do not log tokens or full `.env`. Consider re-auth for hardware actions later if these are treated like other privileged host mutations.

7. Documentation final pass.
    Keep README, security docs, troubleshooting guidance, changelog, and this plan aligned after the Pi regression pass and any status/job model changes.

## Documentation Plan

Update during implementation:

- `README.md` for post-install hardware enablement and runtime config behavior.
- `SECURITY.md` for the privileged host-agent trust boundary.
- `docs/security/host-and-infrastructure.md` for host-agent risks, token handling, and camera privacy implications.
- `.agents/rules/docker.md`, `.claude/rules/docker.md`, and `.cursor/rules/docker.mdc` if the service topology/rules change.
- `CHANGELOG.md` under the implementation branch's `[Unreleased]` section for the operator-facing change.

Consider an ADR if implementation reveals a non-obvious design decision, such as whether to reuse `update-agent`, how to restrict host-agent network access, or why backend restart remains the V1 config mechanism.

## Verification Plan

Static checks:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
bash -n install.sh
```

For container or runtime-bundle changes:

```bash
docker compose build
```

Security checks:

- Host-agent request without token fails.
- Host-agent request with bad token fails.
- Browser cannot read `HOST_AGENT_TOKEN`.
- Non-admin backend request to enable/disable camera fails.
- Host-agent rejects unsupported capability/action names.

Manual Pi checks:

- Fresh install with `ENABLE_CAMERA=false` installs the host agent and leaves camera disabled.
- Enable camera from the app without terminal commands.
- Confirm backend reports camera support enabled after any required restart.
- Capture a photo through a Pi Camera device.
- Disable camera from the app without terminal commands.
- Re-enable camera from the app and capture again.
- Reboot the Pi and confirm the final enabled/disabled state persists.

## Open Questions

- Should the host agent bind only to localhost with a backend-accessible proxy, or directly to the configured Docker gateway address long term? V1 uses the backend-accessible host/Docker route plus token and Docker-subnet firewall rule where available.
- Should any future capability install OS packages or edit Raspberry Pi boot/interface config automatically? V1 reports missing prerequisites and keeps OS-level changes manual.
- Should a future version include an app-triggered reboot action for `needs_reboot`, or only instruct the user to reboot from the Pi/system UI?
- Should hardware enable/disable actions require re-auth in addition to an admin session?
