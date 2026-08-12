# BME280/BME680 Sensor Setup

Use this guide for a 4-pin BME280 or BME680 I2C environmental sensor module with `VIN`, `GND`, `SCL`, and `SDA` pins. The module reports temperature, humidity, and air pressure.

## Enable Support

Install or update Edge Studio with sensor support enabled:

```bash
curl -fsSL https://raw.githubusercontent.com/integritas-technology/edge-studio/main/install.sh | sudo env ENABLE_SENSORS=true bash
```

Also enable I2C on the Raspberry Pi host, then reboot if prompted:

```bash
sudo raspi-config
```

Choose `Interface Options` -> `I2C` -> enable.

## Wiring

Use Raspberry Pi physical pin numbering for this table:

| BME sensor pin | Raspberry Pi pin |
|---|---|
| `VIN` | 3.3V physical pin 1 or 5V physical pin 2/4 |
| `GND` | GND physical pin 6/9/etc. |
| `SCL` | GPIO3 / SCL physical pin 5 |
| `SDA` | GPIO2 / SDA physical pin 3 |

Prefer 3.3V when uncertain. The documented module accepts 3.3V-5V, but unknown clones should be verified before wiring.

Some BME680 breakouts expose six pins because the chip also supports SPI. For I2C mode, the extra pins usually mean:

| BME680 pin | I2C use |
|---|---|
| `SDO` | I2C address select: connect to GND for `0x76`, or 3.3V for `0x77`. Some boards already pull this one way. |
| `CS` / `CSB` | SPI chip-select / mode select. Tie to 3.3V for I2C mode if your breakout does not already pull it high. |

If a BME680 module is configured as `0x76` but not found, check whether `SDO` is floating or tied high. If the module is not detected at either address, check whether `CS`/`CSB` must be tied high for I2C mode on that breakout.

For BME680 modules, the helper also needs the Python `bme680` module. The installer creates a dedicated sensor-helper virtualenv at `/opt/edge-studio/.venv-sensor-helper` and installs `bme680` there when `ENABLE_SENSORS=true`.

## Device Settings

In Devices, choose `BME280 Environmental Sensor` or `BME680 Environmental Sensor`.

| Setting | Value |
|---|---|
| Device type | BME280 Environmental Sensor or BME680 Environmental Sensor |
| I2C bus | `1` |
| I2C address | `0x76` first, then try `0x77` if reads fail |

## Verify

If `i2cdetect` is installed, confirm the sensor appears on bus 1:

```bash
sudo i2cdetect -y 1
```

Then trigger a manual read from the Devices table. A successful read stores JSON similar to:

```json
{
  "sensor": "bme280",
  "bus": 1,
  "address": "0x76",
  "temperatureC": 22.4,
  "humidityPercent": 48.1,
  "pressureHpa": 1012.8,
  "readAt": "2026-07-29T00:00:00Z"
}
```

For BME680, the `sensor` field is `bme680` and the same JSON shape is used. Automation workflows can use `Fetch data source` with the BME device, then attach `Stamp data` to stamp the reading hash.
