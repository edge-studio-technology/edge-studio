import { Pill } from "../../../components/Pill";
import { InputField } from "../../../components/ui/InputField";
import { SelectField } from "../../../components/ui/SelectField";
import type { DataSourceTemplate } from "../dataSourceTypes";
import type { DeviceFormFields } from "../useDeviceFormFields";

/** True when the current field values are complete enough to create the device. */
export function isAltDeviceFormValid(fields: DeviceFormFields) {
  const { type, name, url, brokerUrl, topic, gpioChip, gpioPin } = fields;
  if (!name) return false;
  if (type === "mqtt" || type === "mqtt-output") return Boolean(brokerUrl && topic);
  if (type === "gpio-input" || type === "gpio-output") return Boolean(gpioChip && gpioPin);
  if (type === "pi-camera")
    return Boolean(fields.cameraWidth && fields.cameraHeight && fields.cameraDurationMs);
  if (type === "bme-sensor") return Boolean(fields.bmeBus);
  if (type === "webhook") return true;
  return Boolean(url);
}

/**
 * Step 2 of the alt add-device flow. Deliberately text-light: the picked device is
 * summarised by its badge plus its own description, and each type shows only its
 * required configuration fields. Submit lives in the modal footer.
 */
export function AltDeviceForm({
  template,
  fields,
}: {
  template: DataSourceTemplate;
  fields: DeviceFormFields;
}) {
  const { type } = fields;

  return (
    <section className="gap-detail-close grid min-w-0">
      <div className="gap-detail-next flex flex-col items-start">
        <Pill>{template.title}</Pill>
        <p className="type-body text-text-secondary m-0">{template.description}</p>
      </div>

      <InputField
        label="Name"
        value={fields.name}
        onChange={(event) => fields.setName(event.target.value)}
        placeholder="Device name"
      />
      <InputField
        label="Description"
        value={fields.description}
        onChange={(event) => fields.setDescription(event.target.value)}
        placeholder="What does this device do?"
      />

      {(type === "mqtt" || type === "mqtt-output") && (
        <>
          <InputField
            label="Broker URL"
            value={fields.brokerUrl}
            onChange={(event) => fields.setBrokerUrl(event.target.value)}
            placeholder="mqtt://192.168.1.50:1883"
          />
          <InputField
            label="Topic"
            value={fields.topic}
            onChange={(event) => fields.setTopic(event.target.value)}
            placeholder={type === "mqtt" ? "sensors/+/data" : "devices/example/set"}
          />
        </>
      )}

      {type === "gpio-input" && (
        <>
          <InputField
            label="GPIO chip"
            value={fields.gpioChip}
            onChange={(event) => fields.setGpioChip(event.target.value)}
            placeholder="gpiochip0"
          />
          <InputField
            label="BCM pin number"
            value={fields.gpioPin}
            onChange={(event) => fields.setGpioPin(event.target.value)}
            placeholder="17"
            inputMode="numeric"
          />
          <SelectField
            label="Pull resistor"
            value={fields.gpioPull}
            onChange={(event) => fields.setGpioPull(event.target.value as "off" | "up" | "down")}
            options={[
              { value: "off", label: "Off" },
              { value: "up", label: "Pull-up" },
              { value: "down", label: "Pull-down" },
            ]}
          />
          <SelectField
            label="Edge"
            value={fields.gpioEdge}
            onChange={(event) =>
              fields.setGpioEdge(event.target.value as "rising" | "falling" | "both")
            }
            options={[
              { value: "rising", label: "Rising" },
              { value: "falling", label: "Falling" },
              { value: "both", label: "Both" },
            ]}
          />
          <InputField
            label="Debounce ms"
            value={fields.gpioDebounceMs}
            onChange={(event) => fields.setGpioDebounceMs(event.target.value)}
            placeholder="100"
            inputMode="numeric"
          />
          <SelectField
            label="Active state"
            value={fields.gpioActiveState}
            onChange={(event) => fields.setGpioActiveState(event.target.value as "high" | "low")}
            options={[
              { value: "high", label: "High" },
              { value: "low", label: "Low" },
            ]}
          />
        </>
      )}

      {type === "gpio-output" && (
        <>
          <InputField
            label="GPIO chip"
            value={fields.gpioChip}
            onChange={(event) => fields.setGpioChip(event.target.value)}
            placeholder="gpiochip0"
          />
          <InputField
            label="BCM pin number"
            value={fields.gpioPin}
            onChange={(event) => fields.setGpioPin(event.target.value)}
            placeholder="18"
            inputMode="numeric"
          />
          <SelectField
            label="LED turns on when GPIO is"
            value={fields.gpioActiveState}
            onChange={(event) => fields.setGpioActiveState(event.target.value as "high" | "low")}
            options={[
              { value: "high", label: "High" },
              { value: "low", label: "Low" },
            ]}
          />
        </>
      )}

      {type === "pi-camera" && (
        <>
          <SelectField
            label="Capture mode"
            value={fields.cameraMode}
            onChange={(event) => fields.setCameraMode(event.target.value as "photo" | "video")}
            options={[
              { value: "photo", label: "Photo" },
              { value: "video", label: "Video" },
            ]}
          />
          <InputField
            label="Width"
            value={fields.cameraWidth}
            onChange={(event) => fields.setCameraWidth(event.target.value)}
            placeholder="1280"
            inputMode="numeric"
          />
          <InputField
            label="Height"
            value={fields.cameraHeight}
            onChange={(event) => fields.setCameraHeight(event.target.value)}
            placeholder="720"
            inputMode="numeric"
          />
          <InputField
            label={fields.cameraMode === "photo" ? "Warmup timeout ms" : "Video duration ms"}
            value={fields.cameraDurationMs}
            onChange={(event) => fields.setCameraDurationMs(event.target.value)}
            placeholder={fields.cameraMode === "photo" ? "1000" : "5000"}
            inputMode="numeric"
          />
          {fields.cameraMode === "video" && (
            <InputField
              label="FPS"
              value={fields.cameraFps}
              onChange={(event) => fields.setCameraFps(event.target.value)}
              placeholder="30"
              inputMode="numeric"
            />
          )}
        </>
      )}

      {type === "bme-sensor" && (
        <>
          <SelectField
            label="Sensor model"
            value={fields.bmeSensor}
            onChange={(event) => fields.setBmeSensor(event.target.value as "bme280" | "bme680")}
            options={[
              { value: "bme280", label: "BME280" },
              { value: "bme680", label: "BME680" },
            ]}
          />
          <InputField
            label="I2C bus"
            value={fields.bmeBus}
            onChange={(event) => fields.setBmeBus(event.target.value)}
            placeholder="1"
            inputMode="numeric"
          />
          <SelectField
            label="I2C address"
            value={fields.bmeAddress}
            onChange={(event) => fields.setBmeAddress(event.target.value as "0x76" | "0x77")}
            options={[
              { value: "0x76", label: "0x76" },
              { value: "0x77", label: "0x77" },
            ]}
          />
        </>
      )}

      {type === "http-output" && (
        <>
          <InputField
            label="URL"
            value={fields.url}
            onChange={(event) => fields.setUrl(event.target.value)}
            placeholder="https://example.com/device/command"
          />
          <SelectField
            label="Method"
            value={fields.method === "GET" ? "POST" : fields.method}
            onChange={(event) => fields.setMethod(event.target.value as "POST" | "PUT" | "PATCH")}
            options={[
              { value: "POST", label: "POST" },
              { value: "PUT", label: "PUT" },
              { value: "PATCH", label: "PATCH" },
            ]}
          />
        </>
      )}

      {type === "json-api" && (
        <>
          <InputField
            label="URL"
            value={fields.url}
            onChange={(event) => fields.setUrl(event.target.value)}
            placeholder="https://example.com/data.json"
          />
          <InputField
            label="Health status URL"
            value={fields.healthStatusUrl}
            onChange={(event) => fields.setHealthStatusUrl(event.target.value)}
            placeholder="https://example.com/health"
          />
          <SelectField
            label="Method"
            value={fields.method === "PUT" || fields.method === "PATCH" ? "POST" : fields.method}
            onChange={(event) => fields.setMethod(event.target.value as "GET" | "POST")}
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
