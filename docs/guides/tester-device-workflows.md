# Tester Device And Workflow Guide

Use this guide to choose a quick end-to-end test. A passing test means the device/source is added, a workflow runs, `Show preview` displays the payload, and `Stamp data` creates an Integritas proof when the block supports recorded, fetched, or captured data.

## Basic Test Process

1. Open Edge Studio in the browser.
2. Go to `Devices`.
3. Click `Add device or source`.
4. Choose the device, source, or target you want to test from the wizard.
5. Configure the required fields, such as URL, topic, GPIO pin, I2C address, or camera settings.
6. Save the device/source/target.
7. Open the setup guide shown for that device and follow the wiring, broker, flashing, or endpoint instructions.
8. Use any available device test action first, such as manual read, test pulse, or webhook/MQTT publish.
9. Go to `Automation`.
10. Create a workflow using the matching blocks from the table below.
11. Configure each block to use the device/source/target you just added.
12. Enable the workflow if it uses an event start block such as webhook, MQTT, or GPIO.
13. Trigger the workflow and check run history, Automation inbox previews, and Integritas proofs.

## Test With A Raspberry Pi

| Device or source to add | Extra hardware | Simple workflow blocks |
|---|---|---|
| `HTTP JSON Source` | Reachable JSON endpoint; no extra Pi hardware | `Manual run` -> `Fetch data source` -> `Show preview`; attach `Stamp data` to `Fetch data source` |
| `Webhook Receiver` | A PC, phone, or another service that can POST JSON to the Pi webhook URL | `Webhook received` -> `Record trigger event` -> `Show preview`; attach `Stamp data` to `Record trigger event` |
| `MQTT Subscriber` | MQTT broker, or Edge Studio local MQTT broker enabled; MQTT publisher on PC, Pi, or ESP32 | `MQTT message received` -> `Record trigger event` -> `Show preview`; attach `Stamp data` to `Record trigger event` |
| `ESP32 MQTT Board` | ESP32 dev board, USB data cable, Wi-Fi, MQTT broker reachable from the ESP32, Arduino IDE or Arduino CLI for flashing | `MQTT message received` -> `Record trigger event` -> `Show preview`; attach `Stamp data` to `Record trigger event` |
| `GPIO Input Pin` / `GPIO Button` | Push button or jumper wire; safe 3.3V GPIO wiring | `GPIO input event` -> `Record trigger event` -> `Show preview`; attach `Stamp data` to `Record trigger event` |
| `PIR Motion Sensor` | HC-SR501-style PIR module, jumper wires, 5V power, GPIO-safe `OUT` signal; warm up for `60-90` seconds | `GPIO input event` -> `Record trigger event` -> `Show preview`; attach `Stamp data` to `Record trigger event` |
| `BME280 Environmental Sensor` | BME280 I2C module, jumper wires, I2C enabled, install/update with `ENABLE_SENSORS=true` | `Manual run` or `Schedule` -> `Fetch data source` -> `Show preview`; attach `Stamp data` to `Fetch data source` |
| `BME680 Environmental Sensor` | BME680 I2C module, jumper wires, I2C enabled, install/update with `ENABLE_SENSORS=true`; some boards also need `SDO` address select and `CS/CSB` tied for I2C mode | `Manual run` or `Schedule` -> `Fetch data source` -> `Show preview`; attach `Stamp data` to `Fetch data source` |
| `Raspberry Pi Camera` | Pi camera module or USB camera exposed to the Pi; camera access enabled for the install | `Manual run` or `Schedule` -> `Capture camera` -> `Show preview`; attach `Stamp data` to `Capture camera` |
| `GPIO LED` | Low-current LED, `220-330 ohm` resistor, jumper wires; do not connect GPIO directly to 5V, motors, relays, or mains | `Manual run` -> `Control output` with action `pulse` |
| `HTTP JSON Target` | Reachable HTTP endpoint that accepts JSON | `Manual run` -> `Control output` with action `send_request` |
| `MQTT Publisher` | MQTT broker plus a subscriber to watch the published topic | `Manual run` -> `Control output` with action `publish` |

## Test With A PC

These tests can be driven from a PC browser and PC tools. Edge Studio can still be running on the Pi, Docker, or another test host, but Pi-only GPIO, I2C, and camera hardware cannot be tested from the PC alone.

| Device or source to add | Extra hardware or tool | Simple workflow blocks |
|---|---|---|
| `HTTP JSON Source` | Any reachable JSON API, local test server, or mock endpoint | `Manual run` -> `Fetch data source` -> `Show preview`; attach `Stamp data` to `Fetch data source` |
| `Webhook Receiver` | `curl`, Postman, Insomnia, or another tool that can POST JSON to the webhook URL | `Webhook received` -> `Record trigger event` -> `Show preview`; attach `Stamp data` to `Record trigger event` |
| `MQTT Subscriber` | MQTT broker plus a PC MQTT publish tool | `MQTT message received` -> `Record trigger event` -> `Show preview`; attach `Stamp data` to `Record trigger event` |
| `HTTP JSON Target` | Test HTTP receiver such as a local webhook/debug server | `Manual run` -> `Control output` with action `send_request` |
| `MQTT Publisher` | MQTT broker plus a PC MQTT subscribe tool | `Manual run` -> `Control output` with action `publish` |
| `ESP32 MQTT Board` | ESP32 dev board, USB data cable, Wi-Fi, MQTT broker reachable from the board, Arduino IDE or Arduino CLI on the PC | `MQTT message received` -> `Record trigger event` -> `Show preview`; attach `Stamp data` to `Record trigger event` |

## Quick Pass Criteria

1. The device/source saves without validation errors.
2. Manual reads, test pulses, webhook posts, MQTT messages, GPIO events, or camera captures produce a successful workflow run.
3. `Show preview` creates an Automation inbox item with the expected payload or capture metadata.
4. `Stamp data` creates a proof for fetch, trigger-record, and capture blocks.
5. Workflow run history shows successful blocks and no unexpected `last_error` on the device/source.

## Notes

- Use the GPIO and BME guides for exact wiring before connecting sensors.
- `Webhook Receiver`, `MQTT Subscriber`, and `GPIO Input Pin` only ingest events while an enabled workflow is listening.
- `GPIO LED`, `HTTP JSON Target`, and `MQTT Publisher` are output targets. They are tested with `Control output`, not `Stamp data`.
- Keep test payloads free of secrets because previews, run history, and proofs may preserve data or hashes.
