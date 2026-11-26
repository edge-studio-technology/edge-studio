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

- **Host-side helpers for device I/O.** Camera capture and BME/BH1750 sensor reads run in small,
  opt-in, token-protected host Python helpers (`camera-helper/`, `sensor-helper/`) reachable from
  the Docker subnet, exposing only allowlisted reads for supported devices. The backend container
  gets no `/dev/i2c-*` or camera device and no native I2C dependency. GPIO input is the exception:
  explicit `/dev/gpiochip0` access with `gpiomon`, input-only.
- **BH1750 measurements use raw I2C in the existing sensor helper.** Enable/repair installs `smbus2` in the existing managed virtualenv. The helper powers on/resets the chip, sets standard MTreg 69 (`0x42`, `0x65`), requests one-shot high resolution (`0x20`), waits the documented worst-case 180 ms, and reads exactly two bytes without sending a register byte. It converts the big-endian count to lux by dividing by 1.2. These values come from the [ROHM BH1750FVI datasheet linked by Adafruit](https://www.mouser.com/datasheet/2/348/bh1750fvi-e-186247.pdf); no physical timing claim is made. A helper-local lock serializes BH1750 requests so overlapping manual/workflow reads cannot restart each other's conversions. Only bus/address are operator settings; fixed mode avoids a range/calibration UI for the initial lux-reading scope. The helper reports model support only when `smbus2` imports, and callers warn when an older helper lacks it.
- **SPI display output stays in a dedicated opt-in helper.** PIM576 title/text rendering uses a hash-locked CPython 3.13/Debian 13 aarch64 dependency set, including Pillow and Pimoroni's `st7789==1.0.1` driver, in a retained virtualenv. The helper uses one fixed SPI0 CE0/DC GPIO25/BL GPIO24 layout with only rotation editable. It restores the pinned driver's controller and SPI state before repeated writes because another SPI consumer or controller reset can invalidate retained state without invalidating the Python object. This keeps SPI/GPIO dependencies outside the non-root backend, avoids arbitrary pin/command or file/URL rendering endpoints, and reuses the workflow's existing output budget and variable interpolation. The helper binds to the configured Docker gateway and requires its own token. Fixed white-on-black text, 16 MHz SPI, zero offsets and a 20-pixel font keep the initial scope small; panel geometry and Debian GPIO compatibility are physically verified only for the documented Pi 4/Debian 13 setup. Initial adoption requires installer refresh because an older agent's fixed artifact allowlist cannot extract newly added helper files; subsequent artifacts include them. No signature/allowlist boundary is weakened to bypass that transition.
- **A root host agent for enabling hardware after install.** `install.sh` always installs
  `edge-studio-host-agent` (systemd, Python stdlib), with `HOST_AGENT_URL`/`HOST_AGENT_TOKEN` passed
  only to the backend. The backend reaches it through admin-gated `/api/host-capabilities` routes.
- **Narrow API.** Each capability (`camera`, `sensors`, `gpio`, `mqtt`) has its own fixed action
  set, including `displays` for SPI text output. The agent rejects unknown fields and never accepts command strings, package names, paths,
  or service names. It manages only Edge Studio-owned helper units, `.env` keys, the generated GPIO
  override, and Compose restarts; it refuses to replace a user-managed override. Writes are atomic
  and retry-safe.
- **Installer and agent share one implementation.** The agent owns enable/disable after install;
  the installer's `ENABLE_*` shortcuts call the same code in CLI install mode.
- **OS prerequisites change only through explicit setup actions.** The separate
  I2C prerequisite action (`POST /api/host-capabilities/sensors/setup-prerequisites`) runs the
  hardcoded Raspberry Pi OS steps `apt-get update`, `apt-get install -y python3-smbus i2c-tools`,
  `raspi-config nonint do_i2c 0`. It returns step labels, success, the resulting capability, and
  whether a reboot is needed, never raw output, and records an audit event. Manual steps stay
  available.
- **SPI prerequisite setup is also explicit.** Hardware support offers Automatic setup separately from display enablement. The root action checks for `apt-get` and `raspi-config`, installs fixed Python environment/build prerequisites and calls `raspi-config nonint do_spi 0`. It reports step success and whether `/dev/spidev0.0` is still absent; no helper enablement or reboot is implied. This follows the I2C boundary while leaving manual guidance for Debian hosts without the required tools; it does not introduce arbitrary boot-file editing or package-repository management.
- **Host-backed devices follow capability state.** Unavailable templates are hidden, configured
  devices show `Disabled`/`Needs attention`, and workflow validation reports the missing support.
- The agent's own code is updated through signed host-runtime artifacts delivered by
  `update-agent` (see the update-agent rule), not by rerunning `install.sh`.
- **Uninstallation stays in the host terminal.** Settings offers a copyable command for a fixed-purpose root uninstaller, without adding a remote deletion endpoint to the agent. The operator reviews the removal plan and confirms in `/dev/tty`; the application cannot reliably report completion after removing its own containers. Data is retained in place by default, including `.env` and `APP_SECRET`, to preserve reinstallability. Deletion is limited to validated internal data paths; external or ambiguous ownership stays a manual operation. Configuration stays whenever configured data remains. Legacy firewall rules lack ownership tags, so matching rules from verified units require a separate operator attestation before removal.

## Alternatives considered

- **Mount `/dev/i2c-1` into the backend with a native Node I2C library.** Simpler at first, but
  fragile native builds on ARM/Docker and hardware access inside the app container.
- **Use SMBus register-block reads for BH1750.** They send an extra command/register byte; BH1750 expects a raw two-byte I2C read after conversion. `smbus2.i2c_rdwr` provides that transaction without a new hardware service.
- **Use the Adafruit CircuitPython/Blinka stack for BH1750.** Valid upstream option, but introduces a broader board abstraction and dependency chain when the existing helper already owns bus/address selection and needs only a fixed command/read sequence.
- **A privileged or root backend container.** Defeats the non-root boundary.
- **A generic command runner or service-management endpoint.** Turns the root agent into a shell.
- **Fold host management into the backend or `update-agent`.** The backend can't have host
  privilege; `update-agent` is scoped to signed container updates.
- **Keep prerequisites manual only.** Forces SSH for a fixed, common setup path.
- **Run I2C setup inside normal sensor enablement.** Changing OS packages and interfaces is a
  different risk level from enabling a helper and should stay an explicit admin action.
- **Reboot automatically after setup.** Disrupts the session; stays an operator action.
- **Uninstall through an agent endpoint.** Adds a remote destructive host action and needs an independent job runner that survives removal; terminal instructions cover the current scope.
- **Delete the entire installation directory or globally prune Docker images.** Can remove unknown files or resources belonging to other applications.

## Consequences

- Hardware support can be enabled and disabled from Devices → Hardware support without a terminal.
- The agent holds root and has one OS-package action; its safety depends on keeping every action
  fixed-purpose. New hardware adds a capability, never a generic path.
- Non-Raspberry Pi OS or non-`apt` systems still use manual setup.
- Actions are synchronous behind a blocking modal with polling; long actions could outgrow request
  timeouts.
- Uninstalling retained-data installations leaves configuration and operational metadata on disk; external data and unverified legacy firewall rules require manual review. There is no automatic secure erase.

## History

- 2026-11-26: Recorded scoped PIM576 panel geometry and Debian GPIO verification on Raspberry Pi 4/Debian 13.
- 2026-11-20: Added explicit SPI prerequisite setup in Hardware support, with manual fallback and operator-managed reboot.
- 2026-11-20: Added a narrow SPI text-display helper, fixed PIM576 wiring, managed driver dependencies and explicit first-adoption installer refresh.
- 2026-11-19: BH1750 raw I2C lux reads, fixed conversion timing, managed smbus2 dependency and serialized measurements within the existing sensor capability.
- 2026-11-03: Terminal uninstaller and Settings instructions; retained-data and host-resource ownership boundaries.
- 2026-09-10: Root host agent with per-capability actions, and the explicit I2C prerequisite action
  (was "I2C Prerequisite Setup Action").
