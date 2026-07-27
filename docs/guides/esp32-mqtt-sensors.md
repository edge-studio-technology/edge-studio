# ESP32 MQTT Sensors

This guide walks through connecting an ESP32 sensor device to Integritas Pi with MQTT.

The app side is already handled by the `ESP32 MQTT Sensor` input source. The remaining work is flashing firmware onto the ESP32 so it can connect to Wi-Fi and publish JSON to the Pi's MQTT broker.

## What You Need

- ESP32 development board.
- USB data cable. Some USB cables charge only and cannot flash boards.
- Computer used for flashing the ESP32. This can be a laptop, desktop, or Raspberry Pi.
- Wi-Fi network name and password.
- Integritas Pi running with the local MQTT broker enabled.
- The generated firmware from the Integritas Pi setup modal.

## 1. Create The Device In Integritas Pi

1. Open Integritas Pi in the browser.
2. Go to `Devices`.
3. Click `Add input source`.
4. Select `ESP32 MQTT Sensor`.
5. Keep the generated topic for the first test, for example `sensors/esp32/data`.
6. Save the device.
7. Leave the `ESP32 MQTT starter firmware` modal open.

The modal shows two broker details for the ESP32:

```txt
ESP32 broker host: <Pi LAN IP>
ESP32 broker port: 1883
Publish topic: sensors/esp32/data
```

The ESP32 must use the LAN host, not the Docker-internal `mqtt://mqtt:1883` address.

## 2. Connect The ESP32 To The Flashing Computer

1. Connect the ESP32 to the computer you will use for flashing, using a USB data cable.
2. This can be a laptop, desktop, or Raspberry Pi.
3. Install and run Arduino IDE on that same computer.

Some USB cables charge only and cannot flash boards. If the ESP32 does not appear as a serial port, try another USB cable first.

## 3. Install Arduino IDE

1. Download Arduino IDE from `https://www.arduino.cc/en/software`.
2. Install and open it.

## 4. Add ESP32 Board Support

In Arduino IDE:

1. Open `File -> Preferences`.
2. Find `Additional boards manager URLs`.
3. Add this URL:

```txt
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```

4. Open `Tools -> Board -> Boards Manager`.
5. Search for `esp32`.
6. Install `esp32 by Espressif Systems`.

## 5. Install The MQTT Library

In Arduino IDE:

1. Open `Sketch -> Include Library -> Manage Libraries`.
2. Search for `PubSubClient`.
3. Install `PubSubClient` by Nick O'Leary.

## 6. Create The Sketch

1. In Arduino IDE, create a new sketch.
2. Delete the default contents.
3. Copy the generated firmware from Integritas Pi.
4. Paste it into Arduino IDE.

## 7. Set Wi-Fi Credentials

Find these lines near the top of the sketch:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
```

Replace them with your Wi-Fi details:

```cpp
const char* WIFI_SSID = "MyWifi";
const char* WIFI_PASSWORD = "my-wifi-password";
```

Do not commit or share sketches containing real Wi-Fi passwords.

## 8. Select Board And Port

In Arduino IDE:

1. Open `Tools -> Board`.
2. Select your ESP32 board. If unsure, try `ESP32 Dev Module`.
3. Open `Tools -> Port`.
4. Select the port that appeared when you plugged in the ESP32.

## 9. Upload The Firmware

1. Click the `Upload` button in Arduino IDE.
2. If upload waits at `Connecting...`, hold the ESP32 `BOOT` button until upload starts.
3. Wait for upload to finish.
4. Open `Tools -> Serial Monitor`.
5. Set baud rate to `115200`.

Expected serial output:

```txt
Connecting to Wi-Fi...
Wi-Fi connected: 192.168.1.x
Connecting to MQTT...connected
Publishing: {"device":"esp32-mqtt-sensor",...}
```

## 10. Create Or Enable The Workflow

The MQTT source only subscribes while an enabled workflow watches it.

1. Go to `Automation`.
2. Create a workflow.
3. Choose `MQTT message received` as the start block.
4. Select the ESP32 MQTT source.
5. Add `Record trigger event`.
6. Enable the workflow.

After the ESP32 publishes, check:

- `Automation -> Watch workflow` for recent runs.
- `Diagnostics -> Reads` for recorded JSON payloads.
- `Devices` for latest preview/hash.

## Troubleshooting

### ESP32 Does Not Upload

- Use a USB data cable, not a charge-only cable.
- Select the correct serial port.
- Try holding `BOOT` while upload starts.
- Install the USB serial driver for your board if the port never appears.

### Wi-Fi Does Not Connect

- Check SSID and password.
- Many ESP32 boards only support 2.4 GHz Wi-Fi, not 5 GHz-only networks.
- Keep the ESP32 near the router for the first test.

### MQTT Does Not Connect

- Confirm the Pi and ESP32 are on the same LAN.
- Use the Pi LAN IP shown in the Integritas Pi modal.
- Confirm the local MQTT broker is enabled.
- Confirm port `1883` is reachable from the LAN.
- Do not use `mqtt://mqtt:1883` in ESP32 firmware; that name only works inside Docker.

### Workflow Does Not Run

- MQTT sources only subscribe while an enabled workflow watches them.
- Confirm the workflow start block uses the ESP32 MQTT source.
- Confirm the ESP32 publishes to the same topic configured in Devices.
- Confirm the payload is valid JSON.

### Payload Is Valid But Not Useful Yet

The starter firmware uses placeholder sensor values:

```cpp
float readTemperatureC() {
  return 21.8;
}
```

Replace these functions with real sensor reads after the MQTT path works end-to-end.
