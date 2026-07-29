# Data Source Rules

- Supported V1 input/capture source types are HTTP JSON Source fetches, BME280 Environmental Sensor reads, Webhook Receiver JSON receives, MQTT Subscriber JSON subscriptions, Raspberry Pi GPIO Input Pin events, and Raspberry Pi Camera captures.
- Supported V1 output target types are GPIO LED pulses, HTTP JSON Target requests, and MQTT Publisher JSON publishes.
- Skip file-source and manual-upload source types unless explicitly requested.
- Store the latest JSON preview and latest hash on the data source.
- Raspberry Pi Camera devices are capture sources, not output targets. Workflow `Capture camera` blocks hash captured media bytes and store JSON metadata as the read preview.
- Do not impose arbitrary app-level file/data limits unless required for safety.
- Webhook sources receive JSON through public `/api/data-source-webhooks/:token` endpoints generated per source. They are push-only and only record incoming data when an enabled Automation workflow exists for the source.
- MQTT sources define a broker URL/topic and expect JSON payloads. The backend only subscribes while an enabled Automation workflow exists for the MQTT source.
- GPIO input sources define a BCM pin, edge, pull resistor, debounce, and active state. They are input-only and only watch pins while an enabled Automation workflow exists for the source.
- BME280 sensor sources define I2C bus/address and are readable fetch sources, not event sources. They require the opt-in host-side sensor helper.
- Raspberry Pi Camera capture requires explicit camera device access and must stay opt-in because it grants host camera access and can record private images/video.

## Naming Conventions

Use names that separate physical devices, generic integrations, and low-level hardware interfaces:

- Physical devices: use the device name first, adding protocol only when it clarifies the setup. Examples: `ESP32 MQTT Board`, `PIR Motion Sensor`, `Raspberry Pi Camera`.
- Generic integrations: use `[Protocol] + [Payload/role] + [Source/Target]`. Inputs are sources; outputs are targets. Examples: `HTTP JSON Source`, `HTTP JSON Target`, `MQTT Subscriber`, `MQTT Publisher`, `Webhook Receiver`.
- Low-level hardware: use `[Interface] + [Direction] + [Unit]`. Examples: `GPIO Input Pin`, `GPIO Output Pin`.

Prefer user-facing device/integration names in picker cards. Keep protocol URLs, topics, pins, and other implementation details in descriptions and configuration forms.
- The optional local MQTT broker is a local service, not a configured device. Keep it off by default and document LAN exposure when enabling it.
