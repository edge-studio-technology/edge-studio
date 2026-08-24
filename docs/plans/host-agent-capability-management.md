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

Known V1 boundaries:

- The installer remains responsible for initial install, host-agent installation, Docker/runtime bundle setup, and advanced `ENABLE_*` shortcut behavior.
- The host-agent owns hardware activation/disablement logic. The app reaches it through backend APIs after install, and installer `ENABLE_*` shortcuts call the same host-agent code through CLI install mode.
- Edge Studio does not install OS-level prerequisites automatically yet.
- Raspberry Pi OS/Debian prerequisite guidance is shown in the UI; other Linux distributions may work but are not the primary supported guidance path.

## Remaining Implementation Steps

1. Real Pi regression pass.
   Verify enable/disable for Camera, GPIO, I2C sensors, and Local MQTT on the Pi. Confirm state after backend/container restart, disabled device status, workflow validation errors, template hiding, and external MQTT devices remaining independent from Local MQTT broker state.

2. Host-agent status hardening.
   Make capability status checks more precise: camera should distinguish missing tools/helper inactive/no detected camera where practical; GPIO should distinguish missing `/dev/gpiochip0`, missing/generated override state, and backend not recreated yet; I2C should distinguish `/dev/i2c-1` missing, SMBus missing, helper inactive; MQTT should ideally check Compose service/container state, not only `.env`/profile state.

3. Host-agent action safety.
   Keep every action idempotent and retry-safe. Continue protecting user-managed Compose overrides. Improve `.env` write preservation where needed. Ensure partial failures leave a useful reported state and can be retried without manual cleanup.

4. Finalize installer/host-agent ownership boundaries.
   Keep installer-owned initial setup and host-agent-owned app-managed hardware changes. Ensure advanced `ENABLE_*` shortcuts and host-agent actions produce identical runtime state where possible. Avoid duplicating behavior in ways that drift.

5. Improve hardware operation model.
   The blocking modal plus polling is acceptable for V1. Longer-term, implement host-agent jobs: `POST /capabilities/:name/apply` returns a job id, and the UI polls job/capability state. This avoids request timeout issues for longer actions.

6. Add automated tests around capability logic.
   Add frontend tests for device type to capability mapping, backend workflow validation tests for disabled Camera/GPIO/I2C/local MQTT, and host-agent tests for `.env` updates, Compose profile updates, and safe GPIO override detection. Mock `systemctl`/`docker` where practical.

7. Finalize prerequisite UX.
   Add an explicit `Refresh hardware status` action in the modal, copyable Raspberry Pi OS prerequisite commands, and an `I have completed this, refresh now` style affordance. Keep the Debian/Raspberry Pi OS disclaimer visible but not noisy.

8. Host-agent update delivery.
   Ensure host-agent and helper updates are delivered through the normal signed/update flow, not only by rerunning `install.sh`. Confirm runtime bundle contents and service reload/restart behavior when host-agent/helper code changes.

9. Security and audit trail.
   Add audit events for hardware enable/disable actions, including capability name and resulting state. Do not log tokens or full `.env`. Consider re-auth for hardware actions later if these are treated like other privileged host mutations.

10. Documentation final pass.
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
