# Pimoroni PIM576 SPI LCD

Display workflow text on the **1.54-inch SPI Colour Square LCD (240×240), Pimoroni PIM576**. This is an output target, not a readable sensor. The first version supports a title and wrapped text, white on black, using a fixed font. Images, graphs, animation and other display models are outside this integration.

Product: [Pimoroni PIM576](https://shop.pimoroni.com/en-eu/products/1-54-spi-colour-square-lcd-240x240-breakout?variant=39351811702867). The implementation uses [Pimoroni's ST7789 driver](https://github.com/pimoroni/st7789-python), version 1.0.1. The supplied board photo labels power, CS, SCK, MOSI, DC, BL and GND. The shop page was rate-limited during development; the exact tested setup and remaining evidence limits are recorded below.

## Requirements

- Verified test platform: Raspberry Pi 4 Model B Rev 1.4, Debian 13 (trixie), aarch64, at source commit `54b8ccc2baa135d1ebca323f044ddd809525519a`.
- Direct Pi SPI connection using the fixed wiring below: one display on SPI0 CE0, DC GPIO25, backlight GPIO24. The application rejects a second configured display and collisions with configured GPIO devices on these pins. Other processes or HATs can still claim the pins; stop competing drivers before testing.
- Host devices `/dev/spidev0.0` and `/dev/gpiochip0`. Start in **Devices → Hardware support → SPI displays**. If prerequisites are missing, choose **Automatic setup** to install Python prerequisites and enable host SPI using the fixed `raspi-config nonint do_spi 0` action. Setup reports whether a reboot is required; it never reboots or enables the display helper automatically. After any reboot, refresh Hardware support and select Enable.
- Automatic setup requires the host's `apt-get` and `raspi-config`; it checks both before making changes. Use the module's **Manual setup** option on other systems. On Debian without raspi-config, enable `dtparam=spi=on` in the host's active Pi boot configuration, then reboot. Use the host OS documentation to locate its boot configuration; do not assume a path on every OS. The app does not add package repositories or edit arbitrary boot files.
- Python 3 with virtualenv/build support. Hardware support shows copyable commands for `python3-venv`, `python3-dev` and `build-essential` if needed. The helper runs as the installer-selected user with the `spi` and `gpio` groups where present; the devices must be accessible to that user.
- **Devices → Hardware support → SPI displays → Enable**. Enable/Repair creates `.venv-display-helper` and installs the exact, hash-verified dependency set in `display-helper/requirements.lock`. First setup may take several minutes and needs package-index connectivity. The lock targets CPython 3.13 on Debian 13 aarch64; repair fails closed on an unsupported platform or changed package artifact.

The managed dependency set is `st7789` 1.0.1 (MIT), `gpiodevice` 0.1.0 (MIT), `gpiod` 2.6.0 (LGPL-2.1-or-later), `spidev` 3.8 (MIT), NumPy 2.5.5 (BSD-3-Clause and bundled compatible notices), and Pillow 12.0.0 (MIT-CMU). No upstream package code is vendored; each installed distribution retains its own license and notices.

SPI display support starts disabled. The backend remains non-root with no new device mount. It sends authenticated text requests to the narrow host display helper, bound to the configured Docker gateway on `DISPLAY_HELPER_PORT` (default `38183`). Helper status reports prerequisites and software readiness, not physical screen detection.

## Installation and updates

Use the [fork-to-Pi quickstart](./contributor-quickstart.md#fork-source-build-on-a-disposable-pi) for testing. The contribution fork is `https://github.com/devmus/edge-studio`, branch `feat/pim576-spi-display`. The branch must be committed and pushed before installation; the assistant must supply the actual expected SHA after that authorized push. Do not use the current base SHA as evidence that uncommitted changes were installed.

On the test Pi, after the branch is published:

```bash
cd ~
curl -fsSL https://raw.githubusercontent.com/devmus/edge-studio/feat/pim576-spi-display/install.sh -o edge-studio-install.sh
less edge-studio-install.sh
sudo env APP_REPO_URL=https://github.com/devmus/edge-studio.git APP_BRANCH=feat/pim576-spi-display DEV_MODE=true bash edge-studio-install.sh
sudo git -C /opt/edge-studio rev-parse HEAD
cd /opt/edge-studio
sudo docker compose ps
```

Compare the full installed SHA with the pushed expected SHA, confirm running frontend/backend services, open the printed HTTPS address and verify the PIM576 option. The expected SHA is not fixed in this guide. For later revisions, commit/push again on the development computer, record the new SHA, download/inspect/rerun the same source-mode installer on the Pi, and repeat the checks.

**First installation of this new helper requires an installer refresh.** Older host agents only extract their existing file allowlist during an in-app update and may omit a newly introduced helper file. Rerun the matching source installer for a fork test; official releases must document the equivalent installer refresh when this integration ships. Repair gives an actionable error if helper code is absent. Later host-runtime artifacts include the display helper in their fixed allowlist. Do not use the official in-app updater to install unmerged fork changes.

Installer reruns preserve the display-helper virtualenv, token and configured port; enabled support is reapplied through the same fixed host-agent action. Advanced/headless installs may use `ENABLE_DISPLAYS=true`, after host SPI prerequisites are present. Enable/Repair and Disable are deliberate admin actions, distinct from saving a device or enabling a workflow. Uninstall stops the display helper and removes its managed code/environment using the existing confirmed uninstaller path.

## Wiring

Power off and unplug the Pi before wiring. This table uses **physical Pi header pin numbers**, with BCM GPIO names separately identified.

| PIM576 board label | Pi connection |
| --- | --- |
| `3V–5V` | 3.3V, physical pin **1** |
| `CS` | GPIO8 / CE0, physical pin **24** |
| `SCK` | GPIO11 / SCLK, physical pin **23** |
| `MOSI` | GPIO10, physical pin **19** |
| `DC` | GPIO25, physical pin **22** |
| `BL` | GPIO24, physical pin **18** |
| `GND` | Ground, physical pin **6** |

No MISO or reset wire is used. The driver performs software reset. Keep wires short; the fixed SPI clock is 16 MHz. Use only this documented board/wiring initially; matching resolution alone does not establish support for other ST7789 panels.

## Add, test and edit the screen

1. Open **SPI displays** under Hardware support. If Action required is shown, choose **Automatic setup** (or Manual setup on an unsupported host). Reboot only if requested, refresh status, then select **Enable**. Host prerequisite setup, helper enablement and device creation are separate operations.
2. In **Devices → New device**, select **PIM576 SPI LCD**. The option is hidden until display support is enabled.
3. Give it a name, select rotation `0`, `90`, `180` or `270` degrees, review and save. Saving the device does not send an output.
4. From the device menu select **Test display**. It deliberately sends `Edge Studio` / `Display connected` to the physical panel.
5. Check all four corners, text orientation, background and characters. Edit the same saved device to change rotation; its ID and workflow references remain intact. Retry the test after editing.

The device is output-only: it has no manual read action. A successful helper/SPI response confirms the write was accepted, not that a working panel is attached; this wiring has no readback of the screen's appearance.

## Starter workflow: display a custom variable

The device guide creates a **disabled** starter workflow with no other sensors:

1. **Manual run**.
2. **Set variable**: name `message`, source **Custom JSON**, value `"Hello from Edge Studio"` (including the JSON quotation marks).
3. **Control device**: select the LCD; **Display JSON**:

```json
{
  "title": "Edge Studio",
  "text": "{{message}}"
}
```

Review the workflow and run manually. Change the custom variable, save and run again; confirm the screen changes and the output result appears in run/block history. The guide's existing action handling avoids duplicate starter creation. Use a Schedule start only when deliberate repeating updates are wanted; there is no background refresh loop or new block type.

`text` must be a nonempty string of up to 512 characters. `title` is optional, a single line of up to 32 characters. These validation limits do not promise the content fits the panel. Text wraps within 216 pixels; an over-wide title or too many wrapped lines is rejected before a write, preserving the previous frame. The fixed Pillow font determines supported glyphs. Use short plain text for the first test. A variable that resolves to a number/object instead of a string is rejected; set a string variable or build a string around the value.

## Failure and privacy behaviour

- Disabled/missing support, malformed JSON, invalid rotation, missing text and GPIO ownership conflicts produce actionable validation or runtime errors.
- The helper serializes hardware writes and reuses its GPIO/SPI handle. It does not run arbitrary commands, retrieve URLs, read image/font paths from requests, or render during configuration preview.
- Workflow runs record display text/results and structured failures through the existing output block path. The triggering sensor's health is not overwritten by a display failure. Existing workflow output budgets still apply.
- Text is visible to people near the screen and retained in workflow history; do not display secrets. This integration does not transmit content to a cloud service.
- Disable stops further helper updates and attempts to turn the backlight off on orderly shutdown. The LCD may retain its previous frame; disconnect power if the image must be removed. Host GPIO release/power-loss behaviour requires physical verification.

## Verification status

The contributor and assistant verified a physical PIM576 on Raspberry Pi 4 Model B Rev 1.4, Debian 13 (trixie), aarch64, using the fixed wiring above and exact source commit `54b8ccc2baa135d1ebca323f044ddd809525519a`. The fork branch and installed checkout matched that SHA, fresh [Linux PR CI](https://github.com/edge-studio-technology/edge-studio/actions/runs/45781959531) passed, and the source-built frontend/backend containers were healthy.

Enable/Repair reported the SPI device, GPIO device, hash-locked dependencies and helper service available. The backend reached the authenticated helper through the Docker-subnet firewall rule. The contributor observed clean white-on-black text for rotations `0`, `90`, `180` and `270`; `180` was upright for the tested mounting. The documented in-app Test display action worked, saved rotation `180` survived reopen, and two custom-variable workflow values appeared physically and in run/block history. Eighteen sequential/concurrent writes finished on a clean `Recovery OK` frame. Disable stopped the listener and turned off the backlight; re-enable reacquired SPI/GPIO and restored clean output.

The keep-data uninstaller removed the owned containers, Compose network, host/sensor/display services, helper code and virtualenv, listener and installation-owned firewall rules. It retained `.env`, application/Minima data, captures and update state. Reinstalling the same branch restored the exact SHA, healthy containers, helper capability, firewall rule, saved device/workflow and visible output.

A [privacy-checked physical photo](https://github.com/edge-studio-technology/edge-studio/pull/198#issuecomment-7187943485) is attached to the PR. Missing/busy SPI or GPIO recovery, overlong-content frame preservation, other Pi/OS revisions and other ST7789 panels were not physically tested. The contributor personally confirmed the right to submit under the project's MIT terms and checked the PR statement. Upstream merge and release remain maintainer actions.
