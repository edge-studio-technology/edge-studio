# ESP32 MQTT Sensor Onboarding Plan

**Status:** Planned  
**Created:** 2026-07-23  
**Goal:** Help operators connect ESP32 sensor devices to Integritas Pi workflows by generating MQTT configuration and starter firmware, without making the Pi app responsible for flashing firmware in V1.

## Summary

Integritas Pi already supports the runtime path needed for ESP32 sensor devices:

```txt
ESP32 sensor
  -> publishes JSON over MQTT
  -> Raspberry Pi local MQTT broker
  -> Integritas Pi MQTT input source
  -> Automation workflow
  -> record / condition / output / stamp
```

The missing piece is ESP32 firmware setup. The ESP32 must connect to Wi-Fi, read a sensor, serialize data as JSON, connect to the MQTT broker, publish to the configured topic, and reconnect after failures.

V1 should not try to flash ESP32 devices from the Pi app. Instead, the app should guide the operator by generating a ready-to-edit Arduino/PlatformIO sketch and matching MQTT input-source configuration.

## Recommended Approach

Implement a hybrid of:

- Generated firmware config.
- Copy-paste firmware templates.

This corresponds to option 3 from the discussion, with option 2 as the generated output format.

Do not start with:

- Docs-only static examples as the only UX.
- Captive-portal firmware.
- In-app USB flashing.

Those can be revisited after the MQTT workflow path is proven with real ESP32 hardware.

## Target User Experience

Add an onboarding path from Devices:

```txt
Devices -> Add input source -> ESP32 MQTT Sensor
```

The operator fills in:

```txt
Device name: Greenhouse sensor
Sensor template: DHT22 temperature/humidity / generic JSON / button / PIR / analog input
MQTT broker: local Pi broker or custom broker URL
MQTT topic: sensors/greenhouse/data
Publish interval: 30 seconds
ESP32 board family: Arduino ESP32 starter
```

The app then provides:

```txt
1. A saved MQTT input source using the chosen broker/topic.
2. Example JSON payload expected by the workflow.
3. Copyable Arduino/PlatformIO sketch with broker/topic and payload shape filled in.
4. Setup instructions for Wi-Fi credentials and flashing outside the Pi app.
5. A "waiting for first message" status path using the existing MQTT input preview/read history.
```

## Current App Support

Already available:

- Optional local MQTT broker through Docker Compose.
- MQTT input source configuration with broker URL and topic.
- Backend MQTT subscriptions while an enabled workflow exists for the source.
- Automation `mqtt_event_start` blocks.
- `record_trigger_event`, conditions, output actions, camera capture, and Integritas stamping blocks.

Needed for ESP32 onboarding:

- A friendlier `ESP32 MQTT Sensor` input-source preset.
- Firmware template generation.
- Docs explaining how to flash with Arduino IDE or PlatformIO.
- Example JSON payloads and topic naming guidance.

## Device Model

Prefer keeping ESP32 sensors as normal MQTT input sources at runtime:

```ts
type: "mqtt"
config: {
  brokerUrl: string;
  topic: string;
  profile?: "esp32-sensor";
  expectedPayload?: Record<string, unknown>;
}
```

If the existing schema should stay minimal, `profile` and `expectedPayload` can be frontend-only template metadata at first. The backend only needs broker URL and topic to ingest JSON.

The important boundary:

- Integritas Pi owns workflow ingestion and generated setup help.
- ESP32 firmware owns Wi-Fi, sensor reads, MQTT publish, and reconnect behavior.

## Firmware Template Scope

Initial generated sketch should target Arduino ESP32 because it is beginner-friendly and widely documented.

Generated sketch responsibilities:

```txt
Connect to Wi-Fi.
Connect to MQTT broker.
Read one configured sensor or placeholder function.
Publish JSON to the configured topic.
Reconnect Wi-Fi/MQTT after disconnects.
Include serial debug logs.
```

Template placeholders:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* MQTT_HOST = "192.168.1.50";
const int MQTT_PORT = 1883;
const char* MQTT_TOPIC = "sensors/greenhouse/data";
```

Example payload:

```json
{
  "device": "greenhouse-sensor",
  "temperatureC": 21.8,
  "humidityPercent": 48.2,
  "batteryVolts": 4.1,
  "sentAt": "2026-07-23T19:30:00.000Z"
}
```

Note: ESP32 does not have reliable wall-clock time unless the firmware uses NTP. If NTP is not included, use `uptimeMs` instead of `sentAt`, and let Integritas Pi record receipt time.

## Initial Templates

Start with a small set:

```txt
Generic JSON publisher
DHT22 temperature/humidity
Digital input/button
Analog input
PIR motion over MQTT
```

Avoid adding too many sensor-specific libraries before testing real hardware. Every template that imports a sensor library becomes maintenance surface.

## Workflow Examples

Generated onboarding should suggest workflow templates such as:

```txt
ESP32 MQTT message -> Record trigger event
ESP32 MQTT message -> If temperatureC > threshold -> Send HTTP/MQTT output
ESP32 MQTT message -> Record trigger event -> Stamp with Integritas
ESP32 MQTT motion -> Capture Pi Camera -> Stamp with Integritas
```

The workflow should receive the JSON payload published by the ESP32 as the trigger payload.

## Security And Operational Notes

Document these tradeoffs:

- Wi-Fi credentials are placed in firmware source if using the generated Arduino sketch.
- The local MQTT broker currently targets trusted LAN use.
- Anonymous MQTT broker access is convenient but not production-grade.
- ESP32 devices should publish JSON only; no arbitrary code or shell execution is involved in Integritas Pi.
- Do not paste secrets into workflow output payloads or public logs.

If broker authentication is added later, update the generator to include username/password placeholders and document secret handling.

## Backend Plan

1. Keep ingestion on the existing MQTT source path.
2. If needed, allow optional MQTT source profile metadata without changing subscription behavior.
3. Add an API endpoint or frontend helper that returns generated firmware text from selected onboarding options.
4. Reuse existing local MQTT broker capability data for broker URL suggestions.
5. Keep generated firmware deterministic and text-only; do not compile or flash firmware from the backend.

## Frontend Plan

1. Add `ESP32 MQTT Sensor` as an input-source onboarding card.
2. Let the operator choose local broker vs custom broker.
3. Generate a topic with a safe default such as `sensors/<slug>/data`.
4. Create the underlying MQTT input source.
5. Show copyable firmware and setup steps after saving.
6. Show expected JSON payload and suggested workflow templates.
7. Surface "waiting for first message" using existing device preview/read status where possible.

## Documentation Plan

Add docs for:

- Arduino IDE setup.
- PlatformIO setup if useful.
- Required ESP32 libraries for each template.
- How to find the Pi LAN broker URL.
- Topic naming conventions.
- JSON payload requirements.
- Troubleshooting Wi-Fi, broker reachability, invalid JSON, and workflow not running because no enabled workflow is watching the MQTT source.

Likely files:

- `README.md` for the high-level ESP32 MQTT flow.
- `docs/guides/esp32-mqtt-sensors.md` for detailed setup.
- `docs/security/data-sources-and-automation.md` if broker/auth/security posture changes.
- `CHANGELOG.md` when the user-facing onboarding ships.

## Open Decisions

- Should generated firmware include NTP time sync, or should the first template use `uptimeMs` only?
- Should Wi-Fi credentials be edited in source code, or should we provide a simple serial/captive-portal config later?
- Should broker auth wait until MQTT broker username/password support exists?
- Should firmware generation happen entirely in the frontend, or through a backend endpoint for consistency/testing?
- Which ESP32 sensor template should be tested first on real hardware?

## Implementation Milestones

### Milestone 1: Docs And Static Template

- [ ] Add `docs/guides/esp32-mqtt-sensors.md`.
- [ ] Provide one generic Arduino ESP32 MQTT JSON publisher sketch.
- [ ] Verify ESP32 publishes JSON to the Pi broker and an MQTT workflow records it.

### Milestone 2: App Onboarding Preset

- [ ] Add `ESP32 MQTT Sensor` input-source card.
- [ ] Prefill broker/topic from local MQTT broker capability data.
- [ ] Save as a normal MQTT input source.
- [ ] Show generated firmware text after creation.

### Milestone 3: Sensor Templates

- [ ] Add DHT22 template after hardware verification.
- [ ] Add digital input/button template.
- [ ] Add analog input template.
- [ ] Add PIR-over-MQTT template if useful after GPIO PIR workflows are stable.

### Milestone 4: Workflow Guidance

- [ ] Add suggested workflow templates for MQTT record/stamp/condition/output flows.
- [ ] Add first-message troubleshooting UI or docs.
- [ ] Document security and MQTT broker auth limitations.
