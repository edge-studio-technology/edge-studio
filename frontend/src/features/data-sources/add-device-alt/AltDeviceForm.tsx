import { Pill } from "../../../components/Pill";
import { DetailList, DetailRow } from "../../../components/patterns/DetailList";
import { InputField } from "../../../components/ui/InputField";
import { SelectField } from "../../../components/ui/SelectField";
import type { ReactNode } from "react";
import type { DataSourceTemplate } from "../dataSourceTypes";
import type { DeviceFormFields } from "../useDeviceFormFields";

export type AltDeviceProvisioningStep = "type" | "name" | "setup" | "review";

const provisioningSteps: { id: AltDeviceProvisioningStep; title: string; description: string }[] = [
  { id: "type", title: "Select device type", description: "Confirm the selected template or protocol." },
  { id: "name", title: "Give it a name", description: "Name this device so it is easy to find later." },
  { id: "setup", title: "Set up connection", description: "Configure the required endpoint, topic, pin, or sensor settings." },
  { id: "review", title: "Review and add", description: "Check the saved settings before creating the device." },
];

export function altDeviceProvisioningSteps() {
  return provisioningSteps;
}

/** True when the current field values are complete enough to create the device. */
export function isAltDeviceFormValid(fields: DeviceFormFields) {
  const { type, name, url, brokerUrl, topic, gpioChip, gpioPin } = fields;
  if (!name) return false;
  if (type === "mqtt" || type === "mqtt-output") return Boolean(brokerUrl && topic);
  if (type === "gpio-input" || type === "gpio-output") return Boolean(gpioChip && gpioPin);
  if (type === "pi-camera")
    return Boolean(fields.cameraWidth && fields.cameraHeight && fields.cameraDurationMs);
  if (type === "bme-sensor") return Boolean(fields.bmeBus);
  if (type === "device-system-data") return true;
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
  currentStep,
  action,
}: {
  template: DataSourceTemplate;
  fields: DeviceFormFields;
  currentStep: AltDeviceProvisioningStep;
  action?: ReactNode;
}) {
  return (
    <section className="grid min-h-full min-w-0 overflow-hidden rounded-soft lg:grid-cols-[260px_minmax(0,1fr)]">
      <ProvisioningTimeline currentStep={currentStep} fields={fields} />
      <div className="border-stroke-secondary bg-surface-primary grid min-w-0 content-start border-t p-detail-next lg:border-t-0 lg:border-l">
        {currentStep === "type" && <DeviceTypeStep template={template} />}
        {currentStep === "name" && <NameStep fields={fields} />}
        {currentStep === "setup" && <SetupFields fields={fields} />}
        {currentStep === "review" && <ReviewStep template={template} fields={fields} />}
        {action ? <div className="mt-detail-near flex justify-end">{action}</div> : null}
      </div>
    </section>
  );
}

export function isAltDeviceStepValid(fields: DeviceFormFields, step: AltDeviceProvisioningStep) {
  if (step === "name") return Boolean(fields.name.trim());
  if (step === "setup") return isAltDeviceSetupValid(fields);
  if (step === "review") return isAltDeviceFormValid(fields);
  return true;
}

function isAltDeviceSetupValid(fields: DeviceFormFields) {
  const { type, url, brokerUrl, topic, gpioChip, gpioPin } = fields;
  if (type === "mqtt" || type === "mqtt-output") return Boolean(brokerUrl && topic);
  if (type === "gpio-input" || type === "gpio-output") return Boolean(gpioChip && gpioPin);
  if (type === "pi-camera") return Boolean(fields.cameraWidth && fields.cameraHeight && fields.cameraDurationMs);
  if (type === "bme-sensor") return Boolean(fields.bmeBus);
  if (type === "device-system-data") return true;
  if (type === "webhook") return true;
  return Boolean(url);
}

function ProvisioningTimeline({ currentStep, fields }: { currentStep: AltDeviceProvisioningStep; fields: DeviceFormFields }) {
  const currentIndex = provisioningSteps.findIndex((step) => step.id === currentStep);
  return (
    <ol className="bg-surface-secondary m-0 grid h-full list-none p-detail-next">
      {provisioningSteps.map((step, index) => {
        const complete = index < currentIndex || (index === currentIndex && isAltDeviceStepValid(fields, step.id));
        const active = step.id === currentStep;
        const isLast = index === provisioningSteps.length - 1;
        return (
          <li key={step.id} className="gap-detail-tight grid min-h-24 grid-cols-[auto_minmax(0,1fr)] items-start last:min-h-0">
            <span className="grid h-full grid-rows-[auto_minmax(0,1fr)] justify-items-center">
              <span
                className={`grid size-8 place-items-center rounded-full border type-body-em ${
                  active
                    ? "border-stroke-active bg-surface-primary text-text-primary"
                    : complete
                      ? "border-stroke-success bg-feedback-positive text-core-white"
                      : "border-stroke-secondary bg-surface-secondary text-text-tertiary"
                }`}
              >
                {complete && !active ? "✓" : index + 1}
              </span>
              {!isLast && <span className="bg-stroke-secondary my-detail-tight w-px" aria-hidden />}
            </span>
            <span>
              <span className={`type-body-em block ${active ? "text-text-primary" : "text-text-secondary"}`}>{step.title}</span>
              <span className="type-meta text-text-tertiary block">{step.description}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function DeviceTypeStep({ template }: { template: DataSourceTemplate }) {
  return (
    <div className="gap-detail-close grid">
      <Pill>{template.title}</Pill>
      <div>
        <h3 className="type-title text-text-primary m-0">{template.title}</h3>
        <p className="type-body text-text-secondary mt-detail-tight m-0">{template.description}</p>
      </div>
    </div>
  );
}

function NameStep({ fields }: { fields: DeviceFormFields }) {
  return (
    <div className="gap-detail-close grid">
      <div>
        <h3 className="type-title text-text-primary m-0">Name this device</h3>
        <p className="type-body text-text-secondary mt-detail-tight m-0">This name is shown in Devices, Workflows, and setup guides.</p>
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
    </div>
  );
}

function SetupFields({ fields }: { fields: DeviceFormFields }) {
  const { type } = fields;
  return (
    <div className="gap-detail-close grid">
      <div>
        <h3 className="type-title text-text-primary m-0">Set up connection</h3>
        <p className="type-body text-text-secondary mt-detail-tight m-0">Configure the required settings for this device.</p>
      </div>
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

      {type === "webhook" && (
        <p className="type-body text-text-secondary m-0">
          Edge Studio will generate the receive URL after the device is saved. Use that URL to POST JSON from your app or device.
        </p>
      )}

      {type === "device-system-data" && (
        <p className="type-body text-text-secondary m-0">
          No connection settings are needed. This source reads local OS facts from this Pi.
        </p>
      )}
    </div>
  );
}

function ReviewStep({ template, fields }: { template: DataSourceTemplate; fields: DeviceFormFields }) {
  return (
    <div className="gap-detail-close grid">
      <div>
        <h3 className="type-title text-text-primary m-0">Review and add</h3>
        <p className="type-body text-text-secondary mt-detail-tight m-0">Confirm these settings before creating the device.</p>
      </div>
      <DetailList>
        <DetailRow label="Type" value={template.title} />
        <DetailRow label="Name" value={fields.name || "Not set"} />
        {fields.description && <DetailRow label="Description" value={fields.description} />}
        {fields.type === "json-api" && <DetailRow label="URL" value={fields.url} />}
        {fields.type === "http-output" && <DetailRow label="URL" value={fields.url} />}
        {(fields.type === "json-api" || fields.type === "http-output") && <DetailRow label="Method" value={fields.method} />}
        {(fields.type === "mqtt" || fields.type === "mqtt-output") && <DetailRow label="Broker URL" value={fields.brokerUrl} />}
        {(fields.type === "mqtt" || fields.type === "mqtt-output") && <DetailRow label="Topic" value={fields.topic} />}
        {(fields.type === "gpio-input" || fields.type === "gpio-output") && <DetailRow label="GPIO chip" value={fields.gpioChip} />}
        {(fields.type === "gpio-input" || fields.type === "gpio-output") && <DetailRow label="BCM pin" value={fields.gpioPin} />}
        {fields.type === "gpio-input" && <DetailRow label="Edge" value={fields.gpioEdge} />}
        {fields.type === "gpio-input" && <DetailRow label="Pull resistor" value={fields.gpioPull} />}
        {(fields.type === "gpio-input" || fields.type === "gpio-output") && <DetailRow label="Active state" value={fields.gpioActiveState} />}
        {fields.type === "bme-sensor" && <DetailRow label="Sensor model" value={fields.bmeSensor.toUpperCase()} />}
        {fields.type === "bme-sensor" && <DetailRow label="I2C bus" value={fields.bmeBus} />}
        {fields.type === "bme-sensor" && <DetailRow label="I2C address" value={fields.bmeAddress} />}
        {fields.type === "webhook" && <DetailRow label="Receive URL" value="Generated after saving" />}
      </DetailList>
    </div>
  );
}
