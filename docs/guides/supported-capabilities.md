# Supported hardware, devices and workflow blocks

Use this catalog to check what Edge Studio can do before choosing hardware or proposing a new integration. It describes the implementation in this checkout, reviewed on **2026-11-20**: five optional hardware/service capabilities, sixteen device/integration templates and fifteen workflow block types. Older installed versions may differ.

Jump to [hardware capabilities](#hardware-capabilities), [devices and integrations](#devices-and-integrations), [workflow blocks](#workflow-blocks), or [requesting and contributing support](#requesting-and-contributing-support).

In the app, browse **Devices → New device**, enable prerequisites under **Devices → Hardware support**, and browse blocks in **Workflows → New workflow → Toolkit**. Saved devices have in-app setup guides. Available choices depend on enabled capabilities, configured devices and workflow context.

## What “supported” means

All entries below have an implementation in the current code. This is not a certification of every board, operating system or product using the same protocol.

| Evidence label | Meaning |
| --- | --- |
| Protocol integration | The app supports the listed interface and payload. Your endpoint, firmware, authentication and message shape must match it; a vendor product is not automatically supported |
| Software integration | A local software capability is implemented; the returned information depends on its runtime/container environment |
| Prototype test documented | The linked guide records a physical prototype setup as tested. This does not establish a complete Pi/OS/architecture compatibility matrix or a fresh test of every release |
| Physical evidence not recorded here | Code and setup instructions exist, but this catalog does not cite a model-specific physical test record. Verify your exact hardware before relying on it |

The [GPIO guide](./gpio-device-settings.md#tested) documents prototype button, LED and HC-SR501-style PIR tests; its other suggested wiring configurations remain untested. The [BH1750 guide](./bh1750-sensor.md#verification-status) records a contributor-reported physical prototype and workflow preview on a Pi 4 with Debian 13.6/aarch64. These records are distinct from automated tests. For reproducible new evidence, record the exact device, Pi, OS/architecture, source commit, configuration and observed results using the [contributor trial](./contributor-trial.md).

## Hardware capabilities

These enable local interfaces or services; they are separate from individual configured devices. Optional capabilities start disabled. **Hardware support** shows their actual state and missing prerequisites on your installation.

| Capability | Enables | Requirements and limits | Setup |
| --- | --- | --- | --- |
| Camera | Raspberry Pi Camera captures | Host camera helper and working `rpicam`/`libcamera` tools; the host must detect the camera. Camera Module 3 (`imx708`) needs a compatible host stack. This is not general USB webcam support | [Camera requirements](../../README.md#configuration) and the device's in-app guide |
| GPIO | GPIO inputs, button/PIR events and LED output | Access to `gpiochip0`, compatible host GPIO tooling and safe 3.3V signal wiring. Listed output support is for low-current LEDs | [GPIO wiring and settings](./gpio-device-settings.md) |
| I2C sensors | BME280/BME680 and BH1750 reads | Host I2C enabled, sensor helper and model-specific dependencies; configure the correct bus/address | [BME setup](./bme280-sensor.md), [BH1750 setup](./bh1750-sensor.md) |
| SPI displays | PIM576 text output | Host SPI0 CE0 and GPIO access, opt-in authenticated display helper and managed Python dependencies; first adoption requires an installer refresh | [PIM576 setup](./pim576-display.md) |
| Local MQTT broker | An optional broker for MQTT devices | Network reachability and the app's broker configuration. The current local broker has no authentication and belongs on a trusted network. External brokers can be used without enabling this local service | [ESP32/broker setup](./esp32-mqtt-sensors.md) and [security limits](../../SECURITY.md) |

## Devices and integrations

Inputs supply data, event inputs start workflows when messages or pin events arrive, captures produce media, and outputs receive commands. A profile such as GPIO Button or ESP32 MQTT Board reuses an existing interface rather than introducing a separate protocol driver.

### Inputs and captures

| Device/template | What it does and how it connects | Requirements / workflow use | Evidence and setup |
| --- | --- | --- | --- |
| HTTP JSON Source | Pull JSON from an HTTP endpoint | Reachable allowed URL; **Fetch data source** | Protocol integration; [test example](./tester-device-workflows.md#test-with-a-pc) |
| Webhook Receiver | Accept pushed JSON at a generated webhook URL | Sender can reach the app; **Webhook received → Record trigger event** | Protocol integration; [test example](./tester-device-workflows.md#test-with-a-pc) |
| MQTT Subscriber | Receive JSON from a broker/topic | Reachable broker; **MQTT message received → Record trigger event** | Protocol integration; [test example](./tester-device-workflows.md#test-with-a-pc) |
| ESP32 MQTT Board | MQTT input profile with generated starter firmware | ESP32, flashing tool, Wi-Fi and a broker reachable from the board; uses the MQTT event blocks | Physical evidence not recorded here; [firmware/setup guide](./esp32-mqtt-sensors.md) |
| GPIO Input Pin | Detect configured pin edges | GPIO enabled; **GPIO input event → Record trigger event** | Prototype test documented for the button/PIR examples only; [other suggested configurations](./gpio-device-settings.md#untested) remain untested |
| GPIO Button | Button input profile, default GPIO17 to GND | GPIO enabled; uses GPIO event blocks | Prototype test documented; [GPIO17 button](./gpio-device-settings.md#input-button-on-gpio17) |
| PIR Motion Sensor | HC-SR501-style GPIO motion input profile | GPIO enabled, verified pinout/voltage and sensor warm-up; uses GPIO event blocks | Prototype test documented; [GPIO23 PIR](./gpio-device-settings.md#hc-sr501-pir-motion-sensor-on-gpio23) |
| BME280 Environmental Sensor | Read temperature, humidity and pressure over I2C | I2C sensors enabled, correct bus/address; **Fetch data source** | Physical evidence not recorded here; [BME setup](./bme280-sensor.md) |
| BME680 Environmental Sensor | BME readings plus gas resistance over I2C | I2C sensors enabled and BME680 helper dependency; **Fetch data source**. Gas resistance is not a calibrated air-quality score | Physical evidence not recorded here; [BME setup](./bme280-sensor.md) |
| BH1750 Light Sensor | Read ambient light in lux from Adafruit STEMMA QT product 4681 over direct Pi I2C | I2C sensors enabled, refreshed helper with `smbus2`, bus 1 and address `0x23` (or `0x5c` with ADDR high); manual read or **Fetch data source** | Prototype test documented (contributor-reported): Pi 4 Model B Rev 1.4, Debian 13.6/aarch64, bus 1/address `0x23`; [setup, commit and evidence limits](./bh1750-sensor.md#verification-status) |
| Device System Data | Read system specs, performance, network status and coarse locale | Read from the backend/container environment; **Fetch data source**. Not unrestricted host telemetry or GPS | Software integration; [in-app guide source](../../frontend/src/features/data-sources/deviceSetupGuides.tsx) |
| Raspberry Pi Camera | Capture a JPEG photo or short H.264 video | Camera enabled and detected by the host tools; **Capture camera** | Physical evidence not recorded here; in-app setup guide and [camera requirements](../../README.md#configuration) |

Webhook, MQTT and GPIO listeners operate while enabled workflows need them. They are event inputs, not sources polled by **Fetch data source**. Protocol compatibility does not provide automatic vendor discovery, firmware flashing or decoding of arbitrary non-JSON messages.

### Outputs

| Device/template | What it does and how it connects | Requirements / workflow use | Evidence and setup |
| --- | --- | --- | --- |
| GPIO LED | Control a low-current LED through a GPIO pin | GPIO enabled, safe wiring and series resistor; **Control device**; test with **Test pulse** first | Prototype test documented; [GPIO18 LED](./gpio-device-settings.md#output-led-on-gpio18) |
| HTTP JSON Target | Send requests/payloads to an HTTP endpoint; also supports configured multipart media uploads | Reachable allowed URL and a compatible receiving endpoint; **Control device** | Protocol integration; [test example](./tester-device-workflows.md#test-with-a-pc) |
| MQTT Publisher | Publish JSON to a broker/topic | Reachable broker and compatible receiver; **Control device** | Protocol integration; [test example](./tester-device-workflows.md#test-with-a-pc) |
| PIM576 SPI LCD | Display title/text on Pimoroni's 1.54-inch 240×240 SPI screen | SPI displays enabled; fixed SPI0 CE0/DC GPIO25/BL GPIO24 wiring; **Control device → Display text** with a custom variable | Pi 4 Model B Rev 1.4 / Debian 13 / aarch64 verified; [setup, exact commit and evidence limits](./pim576-display.md#verification-status) |

Outputs do not become readable inputs. Generic GPIO access does not establish support for motors, relays or mains equipment.

## Workflow blocks

These are the current toolkit names. Some older guides call **Control device** “Control output” or **Send payment** “Send transaction”; they refer to the same underlying block types. Click a block in the app for its field help and configuration.

| Category | Block | Purpose | Compatible inputs / requirements |
| --- | --- | --- | --- |
| Start | Manual run | Start when an operator runs the workflow | No event device required |
| Start | Schedule | Start repeatedly at a configured interval | Workflow enabled for scheduled execution |
| Start | GPIO input event | Start on a pin event | GPIO Input Pin, GPIO Button or PIR Motion Sensor; enabled GPIO and workflow |
| Start | Webhook received | Start when JSON arrives | Configured Webhook Receiver and enabled workflow |
| Start | MQTT message received | Start on a broker message | MQTT Subscriber or ESP32 MQTT Board and enabled workflow |
| Data | Record trigger event | Store and hash the event that started the run | GPIO, webhook or MQTT start; creates data that can be stamped |
| Data | Fetch data source | Read, store and hash current JSON | HTTP JSON Source, BME280, BME680, BH1750 or Device System Data |
| Data | Capture camera | Capture media and record its hash/metadata | Configured Raspberry Pi Camera and enabled camera capability |
| Data | Set variable | Save a value for later blocks in this run | Custom JSON, trigger fields, latest data or context; variables do not persist between runs |
| Logic | If field matches | Continue only when a comparison passes, including numeric **changed by at least** | Trigger field or previously set variable; change baseline persists until successful completion and resets on condition edits; stops later blocks on failure |
| Logic | Wait | Delay the next block | Configured duration; does not add automatic retry logic |
| Action | Show preview | Create a local Workflow Inbox item | Text, JSON, links or image references from configured content/context; not an external notification service |
| Action | Control device | Send an output command | GPIO LED, HTTP JSON Target, MQTT Publisher or PIM576 SPI LCD; actual effect depends on target/action |
| Action | Send payment | Send native MINIMA to a saved recipient | Available Minima node, usable address book recipient and funds; current workflow payments use native MINIMA (`0x00`) |
| Attached | Stamp data | Create an Integritas proof for a data hash | Attach to Record trigger event, Fetch data source or Capture camera; configured Integritas access required |

Workflows execute an ordered sequence. Add one start block first; device-dependent blocks may be unavailable until a suitable device exists. Stamping attaches to a data block rather than adding a separate final step. Validation checks configuration and dependencies before execution; it does not prove physical wiring or external service behaviour. Payments, outputs and capture perform real actions when run.

For hands-on examples, see the [tester guide](./tester-device-workflows.md). Existing action budgets and security boundaries apply; see [SECURITY.md](../../SECURITY.md).

## Requesting and contributing support

Missing something? [Request device support](https://github.com/edge-studio-technology/edge-studio/issues/new?template=device-support.yml), [request workflow behaviour](https://github.com/edge-studio-technology/edge-studio/issues/new?template=workflow-request.yml), or [browse existing requests](https://github.com/edge-studio-technology/edge-studio/issues). Requests are public; leave out credentials, private payloads and diagnostic archives.

To contribute, read [CONTRIBUTING.md](../../CONTRIBUTING.md), the [device recipe](./contributing-devices.md) or [workflow recipe](./contributing-workflows.md). These are source contributions reviewed through GitHub; the future Module Builder's installable packages are not available through this catalog.

Update this catalog in the same PR whenever adding, removing or changing a hardware capability, device template or block. Keep names, requirements, setup links and verification evidence accurate. To mark a new physical setup tested, link reproducible evidence and state its exact tested scope; do not promote a suggested configuration to tested based on mocked tests.

Maintainers can compare the catalog with [device templates](../../frontend/src/features/data-sources/DataSourceTemplates.tsx), [hardware mappings](../../frontend/src/features/data-sources/hardwareCapabilities.ts), [in-app setup guides](../../frontend/src/features/data-sources/deviceSetupGuides.tsx), [workflow toolkit/help](../../frontend/src/features/automation/workflow/workflowBlockHelp.ts), and [backend workflow validation](../../backend/src/features/automation/automation.validation.ts). This is a maintained overview, not an automatically generated compatibility database.
