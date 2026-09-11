# Host Agent Pi Validation Checklist

Use this checklist for a factory-reset Raspberry Pi validation pass of Host Agent Capability Management V1.

## Test Setup

- [ ] Raspberry Pi is running Raspberry Pi OS Lite 64-bit, current stable/bookworm.
- [ ] SSH works after clearing any old host key entry, if needed: `ssh-keygen -R <pi-ip>`.
- [ ] Edge Studio is installed from the intended release/channel on the fresh Pi.
- [ ] First-run setup is complete and an admin can sign in through the browser.
- [ ] Required hardware is available: Pi Camera or USB camera, GPIO button or jumper, optional GPIO LED, BME280/BME680 I2C sensor, and MQTT test publisher/subscriber.
- [ ] Test notes record the Pi model, OS image date, Edge Studio version, install channel, browser, and IP address.

## Baseline Checks

- [ ] Open `Devices` -> `Hardware support`.
- [ ] Confirm the card shows `N of 4 enabled`.
- [ ] Confirm Camera, GPIO, I2C sensors, and Local MQTT chips are visible.
- [ ] Click each chip and confirm it opens the matching detail in the Hardware support modal.
- [ ] Confirm detail rows use full-width rows/dividers, not nested inset boxes.
- [ ] Confirm disabled capabilities show the expected primary action: `Enable` or `Action required`.
- [ ] Confirm MQTT connection URLs are hidden while Local MQTT is disabled.
- [ ] Confirm unavailable hardware copy reads `Ready for device configuration.` when support is enabled and available.

## Camera Support

- [ ] Start with Camera support disabled, if possible.
- [ ] Enable Camera support from Hardware support.
- [ ] Confirm the blocking modal prevents starting another hardware action while the operation runs.
- [ ] Confirm status settles to enabled and available, or shows specific missing-prerequisite guidance.
- [ ] Add a Raspberry Pi Camera capture device.
- [ ] Run a manual capture or `Capture camera` workflow.
- [ ] Confirm capture preview appears and no unexpected device `lastError` remains.
- [ ] Disable Camera support.
- [ ] Confirm camera templates are hidden from the default `New input` / `New output` flow or blocked as expected.
- [ ] Confirm configured camera devices show `Disabled` or `Needs attention`.
- [ ] Re-enable Camera support and capture again.
- [ ] Reboot the Pi and confirm the final Camera enabled/disabled state persists.

## GPIO Support

- [ ] Start with GPIO support disabled, if possible.
- [ ] Enable GPIO support from Hardware support.
- [ ] Confirm status settles to enabled and available.
- [ ] Confirm the backend container can see `/dev/gpiochip0` after enablement.
- [ ] Add a generic `GPIO Input Pin` device and confirm it shows the generic guide.
- [ ] Add a `GPIO Button` profile device and confirm it shows the GPIO Button guide.
- [ ] Confirm naming a generic GPIO input `Button` does not select the GPIO Button guide.
- [ ] Trigger the GPIO input and confirm a listening workflow records the event.
- [ ] If testing output, add a GPIO LED and confirm `Control output` pulse works.
- [ ] Disable GPIO support and confirm configured GPIO devices show `Disabled` or `Needs attention`.
- [ ] Re-enable or `Repair` GPIO support and confirm GPIO still works.
- [ ] Apply an update or restart cycle and confirm `/dev/gpiochip0` remains attached to the backend container.
- [ ] If GPIO regresses after update/restart, capture `docker inspect edge-studio-backend-1 --format '{{json .HostConfig.Devices}}'` before and after repair.

## I2C Sensor Support

- [ ] Start from a host where I2C prerequisites are missing or disabled, if possible.
- [ ] Open I2C sensors in Hardware support and confirm the state is `Action required` when prerequisites are missing.
- [ ] Confirm `Automatic setup` and `Manual setup` choices are visible.
- [ ] Open manual setup and confirm commands are copyable and Raspberry Pi OS/Debian-oriented.
- [ ] Run `Automatic setup`.
- [ ] Confirm the UI reports reboot guidance when setup completes.
- [ ] Reboot the Pi.
- [ ] Sign in again and confirm the session-expiry/restart copy is understandable.
- [ ] Return to `Devices` -> `Hardware support` and refresh status.
- [ ] Confirm I2C sensors can be enabled after prerequisites are present.
- [ ] Confirm the I2C check details include expected output similar to `crw-rw----` and `root i2c`.
- [ ] Wire a BME280 or BME680 sensor safely.
- [ ] Add the BME device with the correct I2C address.
- [ ] Run a manual read or `Fetch data source` workflow.
- [ ] Confirm payload preview includes sensor values and no unexpected device `lastError` remains.
- [ ] Disable I2C sensors and confirm configured sensor devices show `Disabled` or `Needs attention`.
- [ ] Re-enable I2C sensors and confirm the sensor reads again.

## Local MQTT Support

- [ ] Start with Local MQTT disabled, if possible.
- [ ] Enable Local MQTT from Hardware support.
- [ ] Confirm progress copy remains understandable during first-time Docker create/start/recreate wait.
- [ ] Confirm status settles to enabled and available.
- [ ] Confirm MQTT connection URLs become visible only after Local MQTT is enabled.
- [ ] Add an MQTT Subscriber using the local broker.
- [ ] Publish a test JSON payload to the configured topic.
- [ ] Confirm an enabled workflow records the MQTT event and shows preview data.
- [ ] Add an MQTT Publisher output target using the local broker.
- [ ] Run a `Control output` publish action and confirm a subscriber receives it.
- [ ] Disable Local MQTT and confirm configured local MQTT devices show `Disabled` or `Needs attention`.
- [ ] Re-enable Local MQTT and confirm subscriber and publisher flows still work.

## Workflow And Device Gating

- [ ] Confirm hardware-backed templates do not appear in default creation flows when their support is disabled or unavailable.
- [ ] Confirm existing devices depending on disabled support are clearly marked `Disabled` or `Needs attention`.
- [ ] Confirm manual read/test actions are disabled when required hardware support is unavailable.
- [ ] Confirm workflow validation reports disabled/unavailable Camera, GPIO, I2C, and local MQTT dependencies.
- [ ] Confirm workflow list rows show validation errors when there is no persisted runtime `lastError`.
- [ ] Confirm successful hardware workflows can create Automation inbox previews.
- [ ] Confirm `Stamp data` creates Integritas proofs for fetch, trigger-record, and capture flows where applicable.

## Retry And Recovery

- [ ] Repeat Enable -> Disable -> Enable for Camera.
- [ ] Repeat Enable -> Disable -> Enable for GPIO.
- [ ] Repeat Enable -> Disable -> Enable for I2C sensors.
- [ ] Repeat Enable -> Disable -> Enable for Local MQTT.
- [ ] Run `Repair` for any enabled-but-unavailable capability and confirm it either fixes the issue or gives specific guidance.
- [ ] Confirm repeated clicks do not start overlapping hardware operations.
- [ ] Confirm a failed prerequisite can be fixed and retried without manual cleanup beyond the prerequisite fix.
- [ ] Confirm hardware action error toasts explain the next recovery step.

## UI Checks

- [ ] Confirm `Action required`, `Disable`, `Repair`, and `Enable` are visually distinct in the modal.
- [ ] Confirm prerequisite copy tells users they can skip hardware they do not own or do not plan to use.
- [ ] Confirm the I2C reboot flow is understandable after reboot and sign-in.
- [ ] Confirm device setup guides do not teach the old install-flag-first mental model.
- [ ] Confirm the Hardware support modal scrolls cleanly on a mobile-width viewport.
- [ ] Confirm long command/check details are readable and copyable without breaking layout.

## Audit And Security Checks

- [ ] Confirm hardware enable actions create sanitized audit events.
- [ ] Confirm hardware disable actions create sanitized audit events.
- [ ] Confirm I2C prerequisite setup creates `host-capability.setup-prerequisites`.
- [ ] Confirm audit details do not include host-agent tokens, `.env` contents, raw command output, restart payloads, or helper secrets.
- [ ] Confirm a non-admin user cannot run hardware mutations, if a non-admin account is available.
- [ ] Confirm the browser never receives `HOST_AGENT_TOKEN`.

## Final Evidence

- [ ] Save screenshots of the Hardware support summary, each capability detail, and any `Action required` state encountered.
- [ ] Save notes for each capability with pass/fail, observed state, and recovery steps used.
- [ ] Save logs or command output for any failed action before retrying.
- [ ] Record whether full verification was run after the Pi pass: `npm run check`, backend/frontend builds, and `docker compose config`.
- [ ] Move the linked task in `docs/TASKS.md` to Done only after the checklist is complete or remaining failures are split into specific follow-up tasks.
