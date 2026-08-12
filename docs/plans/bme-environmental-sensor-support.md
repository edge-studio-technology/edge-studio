# BME Environmental Sensor Support Plan

**Status:** Implemented
**Created:** 2026-07-29
**Goal:** Add first-class Raspberry Pi BME280 support, with an implementation path that can reuse the same sensor-helper architecture for BME680 and future I2C environmental sensors.

## Context

The attached BME280 module documentation describes a Bosch BME280 environmental sensor board that measures temperature, humidity, and air pressure over I2C. The module exposes four pins: `VIN`, `GND`, `SCL`, and `SDA`; accepts `3.3V-5V`; and commonly uses I2C address `0x76` or `0x77`.

This device does not fit the existing `gpio-input` model because it is not an edge/event pin. It is a polled I2C measurement device that should produce JSON read previews and hashes like other data-producing sources.

Two implementation paths were considered:

1. Direct backend I2C access: simpler at first, but requires mounting `/dev/i2c-1` into the backend container and adding native Node I2C dependencies that may be fragile on ARM/Docker.
2. Host-side Python helper: adds one helper service, but matches the existing Pi Camera pattern, keeps host hardware access outside the backend container, and provides a better extension point for BME680 and future I2C sensors.

Chosen direction: add a narrow host-side Python sensor helper, then integrate BME280 as a first-class readable input source through the existing Devices and Automation flows. This is the better path because BME680 support can share the same helper and backend/frontend shape.

## Sensor Helper

Add a host-side helper service similar in spirit to `camera-helper/integritas_camera_helper.py`:

- New helper directory, likely `sensor-helper/`.
- New service name: `edge-studio-sensor-helper`.
- Token-protected local HTTP API reachable by the backend through the fixed Compose gateway.
- Use Python sensor libraries suitable for Raspberry Pi I2C hardware. Prefer a library path that can support both BME280 and BME680 without large custom register implementations, unless packaging constraints require a small in-repo BME280 reader.

Initial helper endpoints:

- `GET /health` — confirms the helper process is alive.
- `GET /capabilities` — reports whether I2C access is available and which sensor types are supported by the installed helper dependencies.
- `POST /read` — reads one configured sensor and returns normalized JSON.

Initial `POST /read` request shape:

```json
{
  "sensor": "bme280",
  "bus": 1,
  "address": "0x76"
}
```

Initial BME280 response shape:

```json
{
  "sensor": "bme280",
  "bus": 1,
  "address": "0x76",
  "temperatureC": 22.4,
  "humidityPercent": 48.1,
  "pressureHpa": 1012.8,
  "readAt": "2026-07-29T00:00:00.000Z"
}
```

Planned BME680 response can extend the same shape with gas data:

```json
{
  "sensor": "bme680",
  "bus": 1,
  "address": "0x76",
  "temperatureC": 22.4,
  "humidityPercent": 48.1,
  "pressureHpa": 1012.8,
  "gasResistanceOhms": 128420,
  "readAt": "2026-07-29T00:00:00.000Z"
}
```

## Install And Runtime Config

Extend the opt-in host hardware pattern used by GPIO and camera support:

- Add `ENABLE_SENSORS=false` or `ENABLE_I2C_SENSORS=false` to `.env.example` and install/runtime docs.
- Add `SENSOR_HELPER_URL`, `SENSOR_HELPER_TOKEN`, and any helper-specific timeout/config values to `backend/src/config/env.ts` and `docker-compose.yml`.
- Update `install.sh` to install/disable the helper based on the new env flag.
- Ensure the helper runs as a host-side service with access to `/dev/i2c-1` and appropriate group permissions.
- Do not mount `/dev/i2c-1` into the backend container unless the helper approach is explicitly abandoned.

## Backend Changes

**`backend/src/config/env.ts`** — add sensor helper config values and defaults.

**`backend/src/features/data-sources/dataSources.service.ts`**:

- Add a `BmeSensorConfig` type for BME devices:
  ```ts
  export type BmeSensorConfig = {
    sensor: "bme280";
    bus: number;
    address: "0x76" | "0x77";
  };
  ```
- Add `parseBmeSensorConfig()` with validation for bus/address.
- Extend `parseDataSourceConfig()` for the new type.
- Add `readBmeSensorSource()` that calls the sensor helper, canonicalizes the returned JSON, calculates the same SHA3 hash style as HTTP JSON reads, and returns `{ contentType, bytesHash, canonicalBytes, preview, fetchedAt }`.

**`backend/src/features/data-sources/sensorHelper.service.ts`** — add the narrow HTTP client for helper `/health`, `/capabilities`, and `/read` calls. Keep helper errors structured and avoid leaking tokens.

**`backend/src/features/data-sources/dataSources.routes.ts`**:

- Add the new source type to `isSupportedDeviceType()`.
- Add sensor helper capabilities to `GET /api/data-sources/capabilities`.
- Allow manual reads for BME sensor sources.
- Route BME sensor read failures through the same read-history and data-source error behavior as HTTP JSON reads.

**`backend/src/features/automation/automation.service.ts`**:

- Allow `fetch_data_source` blocks to read BME sensor sources.
- Use `readBmeSensorSource()` and record the resulting preview/hash in data reads.
- Update `sourceUrlForRecord()` to produce a useful source URL such as `bme280:i2c-1:0x76`.

**`backend/src/features/automation/automation.validation.ts`** and **`backend/src/features/automation/automation.routes.ts`**:

- Update fetch-block validation so BME sensor sources are accepted as readable data sources, unlike event-only sources such as GPIO/MQTT/webhook.

## Frontend Changes

**`frontend/src/features/data-sources/dataSourceTypes.ts`**:

- Add the new source type, likely `bme-sensor` or `bme280`.
- Add config fields for `sensor`, `bus`, and `address`.
- Extend `DataSourceCapabilities` with sensor helper availability.

Preferred naming: use a generic type such as `bme-sensor` with `config.sensor: "bme280"` so BME680 can be added later without another broad UI/backend shape change.

**`frontend/src/features/data-sources/DataSourceTemplates.tsx`**:

- Add an input template card titled `BME280 Environmental Sensor`.
- Describe it as an I2C temperature, humidity, and pressure sensor.
- Disable or warn when sensor helper/I2C support is not enabled.
- Include concise wiring guidance on the card or form:
  - `VIN` to `3.3V` or `5V`
  - `GND` to ground
  - `SCL` to Pi physical pin `5` / GPIO3
  - `SDA` to Pi physical pin `3` / GPIO2
  - I2C must be enabled on the Pi

**`frontend/src/features/data-sources/DataSourceForm.tsx`** and **`frontend/src/pages/DataSourcesPage.tsx`**:

- Add form state for sensor bus/address.
- Add BME sensor form fields:
  - `I2C bus`, default `1`
  - `I2C address`, default `0x76`, option `0x77`
- Build the correct create/update payload for the new source type.
- Keep the form simple; do not expose oversampling/calibration settings in V1.

**`frontend/src/features/data-sources/DataSourcesList.tsx`**:

- Show type label `BME280 Environmental Sensor`.
- Show endpoint `i2c-1 0x76` or similar.
- Enable the manual read action for BME sensor sources.
- Health should report helper/I2C capability, not an HTTP health URL.

**`frontend/src/pages/AutomationPage.tsx`**:

- Ensure BME sensor sources appear as valid sources for `Fetch data source` blocks.
- No new start block is needed because BME280 is polled/read, not event-driven.

## Data Model

No SQLite migration is expected for the first implementation because data source `type` and `config` are already stored as strings/JSON.

Example saved data source:

```json
{
  "type": "bme-sensor",
  "config": {
    "sensor": "bme280",
    "bus": 1,
    "address": "0x76"
  }
}
```

## Security And Operational Notes

- Treat I2C sensor access as host hardware access.
- Keep it opt-in and admin-gated.
- Keep helper tokens backend-only and never expose them in frontend responses or logs.
- Avoid generic I2C read/write proxy behavior. The helper should only expose allowlisted sensor reads for supported sensor types.
- Do not let users provide arbitrary device paths or arbitrary I2C commands through the API.
- Document that enabling the helper grants the app access to attached I2C sensors on the Pi.

## Docs

Update these docs as part of implementation:

- `README.md` — install flag, runtime config, wiring, and operational workflow.
- `.env.example` — sensor helper env values.
- `SECURITY.md` and/or `docs/security/host-and-infrastructure.md` — I2C host hardware access risk.
- `docs/guides/` — add a BME sensor wiring/setup guide, or add a new section to an existing device guide.
- `CHANGELOG.md` — user/operator-facing entry under `[Unreleased]`.
- `.agents/rules/data-sources.md`, `.claude/rules/data-sources.md`, and `.cursor/rules/data-sources.mdc` — update supported V1 source list once implemented.
- `.agents/rules/docker.md`, `.claude/rules/docker.md`, and `.cursor/rules/docker.mdc` — add the sensor-helper host access rule once implemented.

## Verification

Static verification:

1. `npm run check`
2. `npm --prefix backend run build`
3. `npm --prefix frontend run build`
4. `docker compose config`
5. `bash -n install.sh`

Container-impacting verification:

1. `docker compose build`
2. Install or enable the sensor helper on a Raspberry Pi with I2C enabled.
3. Confirm `GET /api/data-sources/capabilities` reports sensor helper availability.
4. Add a `BME280 Environmental Sensor` from Devices with address `0x76`; if no data is returned, retry `0x77`.
5. Trigger a manual read and confirm the Devices table shows JSON preview and a hash.
6. Create a workflow with a manual or scheduled start plus `Fetch data source` for the BME280 source.
7. Run the workflow and confirm read history records temperature, humidity, pressure, and hash.
8. Disable/stop the helper and confirm the UI shows a friendly capability/read error without exposing helper tokens or stack traces.

Hardware verification notes:

- Confirm Raspberry Pi I2C is enabled before testing.
- Confirm the module is wired `VIN`, `GND`, `SCL`, `SDA` correctly.
- Confirm the address with an external host check such as `i2cdetect -y 1` when available.
- Compare readings with a known thermometer/hygrometer/barometer if accuracy matters.
