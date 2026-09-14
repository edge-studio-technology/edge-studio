# 0010: I2C Prerequisite Setup Action

**Status:** Accepted
**Date:** 2026-09-10

## Context

Hardware support originally treated host OS prerequisites as operator-owned. The host agent could
enable Edge Studio helper services and Compose/device access, but missing Raspberry Pi OS packages
or interfaces were reported through manual setup steps. Real Pi testing showed that this is safe but
unnecessarily interrupts the in-app setup flow for I2C sensors: the required commands are fixed,
Raspberry Pi OS-specific, and already shown in the UI.

At the same time, the root-owned host agent must not become a generic shell or package-management
proxy. Its privilege boundary relies on fixed, capability-specific actions that are reachable only
through authenticated admin backend routes.

## Decision

- Add a separate I2C-only prerequisite setup action instead of folding OS changes into the normal
  `I2C sensors` enable/repair action.
- Expose it as `POST /api/host-capabilities/sensors/setup-prerequisites`, backed by the host-agent
  path `/capabilities/sensors/setup-prerequisites`.
- Keep the host-agent implementation hardcoded to the Raspberry Pi OS I2C prerequisite steps:
  `apt-get update`, `apt-get install -y python3-smbus i2c-tools`, and
  `raspi-config nonint do_i2c 0`.
- Return step labels, boolean success state, the resulting sensor capability, and whether reboot is
  still required. Do not return raw command output.
- Keep manual setup steps available from the same UI state.
- Record an audit event for successful automatic prerequisite setup.

## Alternatives considered

- **Keep prerequisites manual only.** Rejected because it forces SSH/terminal use for a fixed,
  common Raspberry Pi OS setup path that the app can safely express as a narrow action.
- **Run the displayed commands generically from the host agent.** Rejected because this would create
  a generic command execution surface and weaken the host-agent privilege boundary.
- **Run automatic setup as part of sensor enablement.** Rejected because enabling Edge Studio's
  helper and changing Raspberry Pi OS packages/interfaces are different risk levels and should stay
  explicit to the admin.
- **Automatically reboot after setup.** Rejected for now because rebooting disrupts the session and
  should remain a separate explicit operator action.

## Consequences

- Raspberry Pi OS users can complete common I2C setup from the app UI without SSH.
- Non-Raspberry Pi OS or non-`apt-get` systems still use manual setup.
- The host agent now has one OS-package/interface action, but it remains fixed-purpose and
  capability-specific.
- Sensor support enablement still remains separate; after prerequisites are fixed, the user enables
  or repairs `I2C sensors` normally.

## Where this lives in code

- `host-agent/edge_studio_host_agent.py` — `setup_sensor_prerequisites` and the
  `/capabilities/sensors/setup-prerequisites` route.
- `backend/src/features/host-capabilities/hostCapabilities.service.ts` —
  `setupHostSensorPrerequisites`.
- `backend/src/features/host-capabilities/hostCapabilities.routes.ts` — admin route and audit event.
- `frontend/src/pages/DataSourcesPage.tsx` — automatic setup action orchestration.
- `frontend/src/features/data-sources/DataSourceTemplates.tsx` — Automatic setup / Manual setup UI.
