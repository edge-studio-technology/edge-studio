# 0019: Hardware Access Through Host Helpers and a Root Host Agent

**Status:** Accepted
**Date:** 2026-08-12

## Context

Camera, I2C sensor, GPIO, and local MQTT support need host access: device nodes, systemd units,
`.env`, Compose profiles and overrides, and sometimes OS packages. The backend and frontend run in
Docker as non-root and must stay that way.

Camera support was first switched on only at install time (`ENABLE_CAMERA=true`), so changing it
later meant rerunning `install.sh`. BME280/BME680 sensors are polled over I2C, not edge-triggered
pins, so they don't fit the GPIO input model.

Real Pi testing showed that leaving all OS prerequisites manual was safe but needlessly forced SSH
for I2C, whose setup steps on Raspberry Pi OS are fixed and already shown in the UI.

## Decision

- **Host-side helpers for device I/O.** Camera capture and BME sensor reads run in small,
  opt-in, token-protected host Python helpers (`camera-helper/`, `sensor-helper/`) reachable from
  the Docker subnet, exposing only allowlisted reads for supported devices. The backend container
  gets no `/dev/i2c-*` or camera device and no native I2C dependency. GPIO input is the exception:
  explicit `/dev/gpiochip0` access with `gpiomon`, input-only.
- **A root host agent for enabling hardware after install.** `install.sh` always installs
  `edge-studio-host-agent` (systemd, Python stdlib), with `HOST_AGENT_URL`/`HOST_AGENT_TOKEN` passed
  only to the backend. The backend reaches it through admin-gated `/api/host-capabilities` routes.
- **Narrow API.** Each capability (`camera`, `sensors`, `gpio`, `mqtt`) has its own fixed action
  set. The agent rejects unknown fields and never accepts command strings, package names, paths,
  or service names. It manages only Edge Studio-owned helper units, `.env` keys, the generated GPIO
  override, and Compose restarts; it refuses to replace a user-managed override. Writes are atomic
  and retry-safe.
- **Installer and agent share one implementation.** The agent owns enable/disable after install;
  the installer's `ENABLE_*` shortcuts call the same code in CLI install mode.
- **Missing prerequisites are reported, not fixed,** with one exception: a separate, explicit
  I2C prerequisite action (`POST /api/host-capabilities/sensors/setup-prerequisites`) runs the
  hardcoded Raspberry Pi OS steps `apt-get update`, `apt-get install -y python3-smbus i2c-tools`,
  `raspi-config nonint do_i2c 0`. It returns step labels, success, the resulting capability, and
  whether a reboot is needed, never raw output, and records an audit event. Manual steps stay
  available.
- **Host-backed devices follow capability state.** Unavailable templates are hidden, configured
  devices show `Disabled`/`Needs attention`, and workflow validation reports the missing support.
- The agent's own code is updated through signed host-runtime artifacts delivered by
  `update-agent` (see the update-agent rule), not by rerunning `install.sh`.

## Alternatives considered

- **Mount `/dev/i2c-1` into the backend with a native Node I2C library.** Simpler at first, but
  fragile native builds on ARM/Docker and hardware access inside the app container.
- **A privileged or root backend container.** Defeats the non-root boundary.
- **A generic command runner or service-management endpoint.** Turns the root agent into a shell.
- **Fold host management into the backend or `update-agent`.** The backend can't have host
  privilege; `update-agent` is scoped to signed container updates.
- **Keep prerequisites manual only.** Forces SSH for a fixed, common setup path.
- **Run I2C setup inside normal sensor enablement.** Changing OS packages and interfaces is a
  different risk level from enabling a helper and should stay an explicit admin action.
- **Reboot automatically after setup.** Disrupts the session; stays an operator action.

## Consequences

- Hardware support can be enabled and disabled from Devices → Hardware support without a terminal.
- The agent holds root and has one OS-package action; its safety depends on keeping every action
  fixed-purpose. New hardware adds a capability, never a generic path.
- Non-Raspberry Pi OS or non-`apt` systems still use manual setup.
- Actions are synchronous behind a blocking modal with polling; long actions could outgrow request
  timeouts.

## History

- 2026-09-10: Root host agent with per-capability actions, and the explicit I2C prerequisite action
  (was "I2C Prerequisite Setup Action").
