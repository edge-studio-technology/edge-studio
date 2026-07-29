# ESP32 MQTT Boards

This guide walks through connecting an ESP32 board to Integritas Pi with MQTT.

The app side is already handled by the `ESP32 MQTT Board` input source. The remaining work is flashing firmware onto the ESP32 so it can connect to Wi-Fi and publish JSON to the Pi's MQTT broker.

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
3. Click `Add device or source`.
4. Select `ESP32 MQTT Board`.
5. Set the MQTT broker URL the board should publish to, for example `mqtt://192.168.1.75:1883`, and keep the generated topic for the first test, for example `boards/esp32/data`.
6. Save the device.
7. Leave the `ESP32 MQTT starter firmware` modal open.

The modal builds the firmware broker settings from the saved MQTT broker URL and topic:

```txt
Saved MQTT broker URL: mqtt://192.168.1.75:1883
ESP32 broker host: 192.168.1.75
ESP32 broker port: 1883
Publish topic: boards/esp32/data
```

If the saved broker URL uses `mqtt://mqtt:1883`, `localhost`, or `127.0.0.1`, the ESP32 cannot use that address directly. The modal will ask for an ESP32-reachable broker host and port, such as the Pi LAN IP or another LAN MQTT broker.

## 2. Connect The ESP32 To The Flashing Computer

1. Connect the ESP32 to the computer you will use for flashing, using a USB data cable.
2. This can be a laptop, desktop, or Raspberry Pi.
3. Install and run either Arduino IDE or Arduino CLI on that same computer.

Some USB cables charge only and cannot flash boards. If the ESP32 does not appear as a serial port, try another USB cable first.

## 3. Choose One Flashing Method

You only need one of these methods.

- Use Arduino IDE if you want a graphical app.
- Use Arduino CLI if you are flashing from a terminal, Raspberry Pi, SSH session, or headless setup.

## Method A: Arduino IDE

### 1. Install Arduino IDE

1. Download Arduino IDE from `https://www.arduino.cc/en/software`.
2. Install and open it.

### 2. Add ESP32 Board Support

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

### 3. Install The MQTT Library

In Arduino IDE:

1. Open `Sketch -> Include Library -> Manage Libraries`.
2. Search for `PubSubClient`.
3. Install `PubSubClient` by Nick O'Leary.

### 4. Create The Sketch

1. In Arduino IDE, create a new sketch.
2. Delete the default contents.
3. Copy the generated firmware from Integritas Pi.
4. Paste it into Arduino IDE.

### 5. Set Wi-Fi Credentials

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

### 6. Select Board And Port

In Arduino IDE:

1. Open `Tools -> Board`.
2. Select your ESP32 board. If unsure, try `ESP32 Dev Module`.
3. Open `Tools -> Port`.
4. Select the port that appeared when you plugged in the ESP32.

### 7. Upload The Firmware

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
Publishing: {"device":"esp32-mqtt-board",...}
```

## Method B: Arduino CLI

Use this if you prefer the terminal or are flashing from a Raspberry Pi over SSH.

### 1. Install Arduino CLI

Run this on the computer connected to the ESP32:

```bash
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
```

The installer usually places `arduino-cli` under `~/bin/arduino-cli`.

### 2. Add ESP32 Board Support

```bash
~/bin/arduino-cli config init
~/bin/arduino-cli config add board_manager.additional_urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
~/bin/arduino-cli core update-index
~/bin/arduino-cli core install esp32:esp32
```

### 3. Install The MQTT Library

```bash
~/bin/arduino-cli lib install PubSubClient
```

### 4. Find The ESP32 Port

```bash
~/bin/arduino-cli board list
```

For native-USB ESP32 boards, `board list` may show only `Unknown` while the existing firmware is running. Put the board in bootloader mode and run the command again:

1. Hold `BOOT`.
2. Tap `RESET` / `EN` once.
3. Release `RESET` / `EN`.
4. Keep holding `BOOT` for about two seconds, then release it.
5. Run `~/bin/arduino-cli board list` again.

Look for the ESP32 row. This step is for finding the serial port:

```txt
Port         Protocol Type              Board Name          FQBN                      Core
/dev/ttyACM0 serial   Serial Port (USB) ESP32 Family Device esp32:esp32:esp32_family  esp32:esp32
/dev/ttyAMA0 serial   Serial Port       Unknown
```

In this example, the port is `/dev/ttyACM0`.

If Arduino CLI does not identify the board, use the USB serial port such as `/dev/ttyUSB0`, `/dev/ttyACM0`, or `COM3`. Choose the Board FQBN in the board target step.

### 5. Create The Sketch Folder

Arduino CLI expects the folder and `.ino` file to have the same name.

```bash
mkdir -p ~/esp32-integritas-sensor
nano ~/esp32-integritas-sensor/esp32-integritas-sensor.ino
```

Paste the generated firmware into the file, then replace:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
```

The starter firmware also includes an optional status LED:

```cpp
const int STATUS_LED_PIN = 2;
```

Change this to the board's LED pin, connect an external LED to that GPIO, or set it to `-1` to disable LED diagnostics.

### 6. Choose Board Target

List the available ESP32 board targets:

```bash
~/bin/arduino-cli board listall esp32
```

This command lists the FQBN values available after installing the ESP32 core. It does not identify the exact connected board, but it helps you choose a generic or board-specific target.

The Board FQBN is the board target used by both compile and upload. Start with the generic ESP32 Dev Module target unless you know the exact chip/board:

```txt
esp32:esp32:esp32
```

Family identifiers such as `esp32:esp32:esp32_family` are not build targets. If upload later reports a different chip family than the selected target, choose the matching FQBN from `board listall esp32`, then compile again. Common examples include:

- `esp32:esp32:esp32s3` for ESP32-S3 boards.
- `esp32:esp32:esp32c3` for ESP32-C3 boards.
- `esp32:esp32:esp32s2` for ESP32-S2 boards.

### 7. Compile

```bash
~/bin/arduino-cli compile --fqbn esp32:esp32:esp32 ~/esp32-integritas-sensor
```

Example for ESP32-S3:

```bash
~/bin/arduino-cli compile --fqbn esp32:esp32:esp32s3 ~/esp32-integritas-sensor
```

Board options can be appended to the FQBN. For native-USB boards with blank serial monitor output, enable USB CDC on boot and compile/upload again. Example for ESP32-S3:

```bash
~/bin/arduino-cli compile --fqbn esp32:esp32:esp32s3:CDCOnBoot=cdc ~/esp32-integritas-sensor
```

### 8. Upload

Replace `/dev/ttyACM0` with the port from `board list`, and use the same Board FQBN from the board target step:

```bash
~/bin/arduino-cli upload -p /dev/ttyACM0 --fqbn esp32:esp32:esp32 ~/esp32-integritas-sensor
```

If you added board options in the board target step, use the same FQBN here. Example:

```bash
~/bin/arduino-cli upload -p /dev/ttyACM0 --fqbn esp32:esp32:esp32s3:CDCOnBoot=cdc ~/esp32-integritas-sensor
```

If upload waits at `Connecting...`, hold the ESP32 `BOOT` button until upload starts.

If upload says the chip is not the selected target, change the FQBN to the matching target from `board listall esp32`, then compile/upload again.

### 9. Monitor Serial Output

```bash
~/bin/arduino-cli monitor -p /dev/ttyACM0 --config baudrate=115200
```

Expected output:

```txt
Integritas ESP32 MQTT board starting
Connecting to Wi-Fi...
Wi-Fi connected: 192.168.1.x
Gateway: 192.168.1.1
Subnet: 255.255.255.0
DNS: 192.168.1.1
RSSI: -55
Testing TCP to MQTT broker 192.168.1.76:1883...connected
Connecting to MQTT...connected
Publishing: {"device":"esp32-mqtt-board",...}
```

If the monitor stays blank, press `RESET` / `EN` once while the monitor is open. For native-USB boards, also check whether USB CDC on boot is enabled in the Board FQBN, for example `esp32:esp32:esp32s3:CDCOnBoot=cdc`.

If serial output is still unavailable, use the optional status LED in the starter firmware:

- Three short blinks at boot means the sketch started.
- Slow blinking while connecting means Wi-Fi is not connected yet.
- Two short blinks means MQTT connected.
- One longer blink means a Ping payload was published.
- Five short blinks means MQTT connection failed and will retry.

If serial output shows `Testing TCP to MQTT broker ... failed`, the ESP32 cannot reach the broker host/port from its Wi-Fi network. Check that the ESP32 IP, gateway, and subnet match the LAN that can reach the Pi, then test for router/client isolation or firewall rules between the ESP32 and the Pi.

## 4. Create Or Enable The Workflow

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

The starter firmware publishes a simple connectivity message:

```json
{
  "device": "esp32-integritas-sensor",
  "message": "Ping!",
  "uptimeMs": 123456
}
```

Replace this payload with real sensor fields after the MQTT path works end-to-end.
