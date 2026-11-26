import { Pill } from "../../components/Pill";
import { StatusRow } from "../../components/StatusRow";
import { MutedText } from "../../components/Text";
import { InputField } from "../../components/ui/InputField";
import { SelectField } from "../../components/ui/SelectField";
import type { DataSource, DataSourceTemplate } from "./dataSourceTypes";
import type { DeviceFormFields } from "./useDeviceFormFields";

/** True when the current field values are complete enough to submit the device form. */
export function isDataSourceFormValid(fields: DeviceFormFields) {
  const { type, name, url, brokerUrl, topic, gpioChip, gpioPin } = fields;
  if (!name) return false;
  if (type === "spi-display") return [0, 90, 180, 270].includes(fields.displayRotation);
  if (type === "mqtt" || type === "mqtt-output") return Boolean(brokerUrl && topic);
  if (type === "gpio-input" || type === "gpio-output") return Boolean(gpioChip && gpioPin);
  if (type === "pi-camera")
    return Boolean(fields.cameraWidth && fields.cameraHeight && fields.cameraDurationMs);
  if (type === "bme-sensor") return Boolean(fields.bmeBus);
  if (type === "bh1750-sensor") return /^\d+$/.test(fields.bmeBus) && Number(fields.bmeBus) <= 10 && (fields.bmeAddress === "0x23" || fields.bmeAddress === "0x5c");
  if (type === "device-system-data") return true;
  if (type === "webhook") return true;
  return Boolean(url);
}

export function DataSourceForm({
  displayRotation,
  setDisplayRotation,
  template,
  name,
  setName,
  description,
  setDescription,
  type,
  url,
  setUrl,
  brokerUrl,
  setBrokerUrl,
  topic,
  setTopic,
  gpioChip,
  setGpioChip,
  gpioPin,
  setGpioPin,
  gpioProfile,
  gpioPull,
  setGpioPull,
  gpioEdge,
  setGpioEdge,
  gpioDebounceMs,
  setGpioDebounceMs,
  gpioActiveState,
  setGpioActiveState,
  cameraMode,
  setCameraMode,
  cameraWidth,
  setCameraWidth,
  cameraHeight,
  setCameraHeight,
  cameraDurationMs,
  setCameraDurationMs,
  cameraFps,
  setCameraFps,
  bmeBus,
  setBmeBus,
  bmeAddress,
  setBmeAddress,
  method,
  setMethod,
  submitLabel = "Add source",
}: {
  displayRotation: 0 | 90 | 180 | 270;
  setDisplayRotation: (value: 0 | 90 | 180 | 270) => void;
  template: DataSourceTemplate | null;
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  type: DataSource["type"];
  setType: (value: DataSource["type"]) => void;
  url: string;
  setUrl: (value: string) => void;
  brokerUrl: string;
  setBrokerUrl: (value: string) => void;
  topic: string;
  setTopic: (value: string) => void;
  gpioChip: string;
  setGpioChip: (value: string) => void;
  gpioPin: string;
  setGpioPin: (value: string) => void;
  gpioProfile: "generic" | "pir-motion" | "gpio-button";
  setGpioProfile: (value: "generic" | "pir-motion" | "gpio-button") => void;
  gpioPull: "off" | "up" | "down";
  setGpioPull: (value: "off" | "up" | "down") => void;
  gpioEdge: "rising" | "falling" | "both";
  setGpioEdge: (value: "rising" | "falling" | "both") => void;
  gpioDebounceMs: string;
  setGpioDebounceMs: (value: string) => void;
  gpioActiveState: "high" | "low";
  setGpioActiveState: (value: "high" | "low") => void;
  cameraMode: "photo" | "video";
  setCameraMode: (value: "photo" | "video") => void;
  cameraWidth: string;
  setCameraWidth: (value: string) => void;
  cameraHeight: string;
  setCameraHeight: (value: string) => void;
  cameraDurationMs: string;
  setCameraDurationMs: (value: string) => void;
  cameraFps: string;
  setCameraFps: (value: string) => void;
  bmeBus: string;
  setBmeBus: (value: string) => void;
  bmeAddress: NonNullable<DataSource["config"]["address"]>;
  setBmeAddress: (value: NonNullable<DataSource["config"]["address"]>) => void;
  method: "GET" | "POST" | "PUT" | "PATCH";
  setMethod: (value: "GET" | "POST" | "PUT" | "PATCH") => void;
  submitLabel?: string;
}) {
  return (
    <section className="gap-detail-close grid min-w-0">
      <StatusRow>
        <div>
          <strong>{submitLabel}</strong>
          <MutedText className="m-0 mt-1">
            Configure how this device communicates with Edge Studio.
          </MutedText>
        </div>
        {template && <Pill>{template.title}</Pill>}
      </StatusRow>
      <InputField
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Source name"
      />
      <InputField
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="What does this source provide?"
      />
      {type === "webhook" ? (
        <MutedText>
          A receive URL will be generated after saving. POST JSON to that URL to update this source.
        </MutedText>
      ) : type === "mqtt" ? (
        <>
          <InputField
            label="Broker URL"
            value={brokerUrl}
            onChange={(event) => setBrokerUrl(event.target.value)}
            placeholder="mqtt://192.168.1.50:1883"
          />
          <InputField
            label="Topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="sensors/+/data"
          />
          <MutedText>
            Messages must contain JSON payloads. The backend subscribes and updates this source when
            messages arrive.
          </MutedText>
          {template?.config.profile === "esp32-mqtt-board" && (
            <MutedText>
              The saved device is a normal MQTT input source. After saving, the app will show
              starter ESP32 firmware that publishes JSON to this topic.
            </MutedText>
          )}
        </>
      ) : type === "mqtt-output" ? (
        <>
          <InputField
            label="Broker URL"
            value={brokerUrl}
            onChange={(event) => setBrokerUrl(event.target.value)}
            placeholder="mqtt://mqtt:1883"
          />
          <InputField
            label="Topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="devices/example/set"
          />
          <MutedText>Workflows publish JSON payloads to this broker topic.</MutedText>
        </>
      ) : type === "gpio-input" ? (
        <>
          <InputField
            label="GPIO chip"
            value={gpioChip}
            onChange={(event) => setGpioChip(event.target.value)}
            placeholder="gpiochip0"
          />
          <InputField
            label="BCM pin number"
            value={gpioPin}
            onChange={(event) => setGpioPin(event.target.value)}
            placeholder="17"
            inputMode="numeric"
          />
          <SelectField
            label="Pull resistor"
            value={gpioPull}
            onChange={(event) => setGpioPull(event.target.value as "off" | "up" | "down")}
            options={[
              { value: "off", label: "Off" },
              { value: "up", label: "Pull-up" },
              { value: "down", label: "Pull-down" },
            ]}
          />
          <SelectField
            label="Edge"
            value={gpioEdge}
            onChange={(event) => setGpioEdge(event.target.value as "rising" | "falling" | "both")}
            options={[
              { value: "rising", label: "Rising" },
              { value: "falling", label: "Falling" },
              { value: "both", label: "Both" },
            ]}
          />
          <InputField
            label="Debounce ms"
            value={gpioDebounceMs}
            onChange={(event) => setGpioDebounceMs(event.target.value)}
            placeholder="100"
            inputMode="numeric"
          />
          <SelectField
            label="Active state"
            value={gpioActiveState}
            onChange={(event) => setGpioActiveState(event.target.value as "high" | "low")}
            options={[
              { value: "high", label: "High" },
              { value: "low", label: "Low" },
            ]}
          />
          <MutedText>
            {gpioProfile === "pir-motion"
              ? "PIR Motion Sensor profile is fixed by the selected template."
              : gpioProfile === "gpio-button"
                ? "GPIO Button profile is fixed by the selected template."
              : "GPIO Input Pin uses the generic input profile."}{" "}
            GPIO input sources use BCM numbering and record edge events only while a
            workflow is enabled.
          </MutedText>
          {gpioProfile === "pir-motion" && (
            <MutedText>
              HC-SR501 default: OUT to GPIO23 / physical pin 16, VCC to 5V, GND to GND. Use active
              High, pull Off, and wait 60-90 seconds after power-on for warmup.
            </MutedText>
          )}
        </>
      ) : type === "gpio-output" ? (
        <>
          <InputField
            label="GPIO chip"
            value={gpioChip}
            onChange={(event) => setGpioChip(event.target.value)}
            placeholder="gpiochip0"
          />
          <InputField
            label="BCM pin number"
            value={gpioPin}
            onChange={(event) => setGpioPin(event.target.value)}
            placeholder="18"
            inputMode="numeric"
          />
          <SelectField
            label="LED turns on when GPIO is"
            value={gpioActiveState}
            onChange={(event) => setGpioActiveState(event.target.value as "high" | "low")}
            options={[
              { value: "high", label: "High (common GPIO to resistor to LED to GND wiring)" },
              { value: "low", label: "Low (LED/resistor tied to 3.3V, GPIO sinks current)" },
            ]}
          />
          <MutedText>
            GPIO LED profile is fixed by the selected template. LED output targets can be pulsed
            from Workflows. For the documented GPIO18 LED wiring, choose High. Wire the LED with a
            220-330 ohm resistor and never connect GPIO directly to 5V, motors, or relays.
          </MutedText>
        </>
      ) : type === "pi-camera" ? (
        <>
          <SelectField
            label="Capture mode"
            value={cameraMode}
            onChange={(event) => setCameraMode(event.target.value as "photo" | "video")}
            options={[
              { value: "photo", label: "Photo" },
              { value: "video", label: "Video" },
            ]}
          />
          <InputField
            label="Width"
            value={cameraWidth}
            onChange={(event) => setCameraWidth(event.target.value)}
            placeholder="1280"
            inputMode="numeric"
          />
          <InputField
            label="Height"
            value={cameraHeight}
            onChange={(event) => setCameraHeight(event.target.value)}
            placeholder="720"
            inputMode="numeric"
          />
          <InputField
            label={cameraMode === "photo" ? "Warmup timeout ms" : "Video duration ms"}
            value={cameraDurationMs}
            onChange={(event) => setCameraDurationMs(event.target.value)}
            placeholder={cameraMode === "photo" ? "1000" : "5000"}
            inputMode="numeric"
          />
          {cameraMode === "video" && (
            <InputField
              label="FPS"
              value={cameraFps}
              onChange={(event) => setCameraFps(event.target.value)}
              placeholder="30"
              inputMode="numeric"
            />
          )}
          <MutedText>
            Camera capture is triggered by the Capture camera block in Workflows. Captured media stays
            on the Pi; Integritas stamps the media file hash.
          </MutedText>
        </>
      ) : type === "spi-display" ? (
        <>
          <SelectField label="Rotation" value={String(displayRotation)} onChange={(event) => setDisplayRotation(Number(event.target.value) as 0 | 90 | 180 | 270)} options={[0, 90, 180, 270].map((rotation) => ({ value: String(rotation), label: `${rotation}°` }))} />
          <MutedText>PIM576 uses SPI0 CE0 with DC GPIO25 and backlight GPIO24. Use the setup guide for wiring; control its text from a workflow.</MutedText>
        </>
      ) : type === "bme-sensor" || type === "bh1750-sensor" ? (
        <>
          <InputField
            label="I2C bus"
            description={type === "bh1750-sensor" ? "Use 1 for the Pi header. Enter a whole bus number from 0 to 10." : undefined}
            error={type === "bh1750-sensor" && (!/^\d+$/.test(bmeBus) || Number(bmeBus) > 10) ? "Enter an I2C bus number from 0 to 10." : undefined}
            value={bmeBus}
            onChange={(event) => setBmeBus(event.target.value)}
            placeholder="1"
            inputMode="numeric"
          />
          <SelectField
            label="I2C address"
            value={bmeAddress}
            onChange={(event) => setBmeAddress(event.target.value as NonNullable<DataSource["config"]["address"]>)}
            options={type === "bh1750-sensor" ? [
              { value: "0x23", label: "0x23 (default)" },
              { value: "0x5c", label: "0x5c (ADDR high)" },
            ] : [
              { value: "0x76", label: "0x76" },
              { value: "0x77", label: "0x77" },
            ]}
          />
          <MutedText>
            {type === "bh1750-sensor" ? "BH1750 reads ambient light in lux. Wire VIN to 3.3V, GND to ground, SCL to physical pin 5 / GPIO3, and SDA to physical pin 3 / GPIO2." : <>BME280/BME680 sensors read temperature, humidity, and air pressure over I2C. BME680
            reads also include gas resistance. Wire VIN to 3.3V or 5V, GND to ground, SCL to
            physical pin 5 / GPIO3, and SDA to physical pin 3 / GPIO2.</>}
          </MutedText>
        </>
      ) : type === "device-system-data" ? (
        <MutedText>
          Device System Data reads local OS facts from this Pi: device specs, performance counters,
          network interface status, and coarse timezone/locale context. It does not use an external
          endpoint or require wiring.
        </MutedText>
      ) : type === "http-output" ? (
        <>
          <InputField
            label="URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/device/command"
          />
          <SelectField
            label="Method"
            value={method === "GET" ? "POST" : method}
            onChange={(event) => setMethod(event.target.value as "POST" | "PUT" | "PATCH")}
            options={[
              { value: "POST", label: "POST" },
              { value: "PUT", label: "PUT" },
              { value: "PATCH", label: "PATCH" },
            ]}
          />
          <MutedText>
            Set the request body in each workflow's Control device block so this target can be
            reused by different workflows.
          </MutedText>
        </>
      ) : (
        <>
          <InputField
            label="URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/data.json"
          />
          <SelectField
            label="Method"
            value={method === "PUT" || method === "PATCH" ? "POST" : method}
            onChange={(event) => setMethod(event.target.value as "GET" | "POST")}
            options={[
              { value: "GET", label: "GET" },
              { value: "POST", label: "POST" },
            ]}
          />
        </>
      )}
    </section>
  );
}
