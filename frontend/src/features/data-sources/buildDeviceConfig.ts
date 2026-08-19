import type { DeviceFormFields } from "./useDeviceFormFields";
import type { DataSource, DataSourceTemplate } from "./dataSourceTypes";

/**
 * Builds the `config` payload for create/update from the flat form fields. `editingSource`
 * (webhook token passthrough) and `template` (esp32 profile) are both optional since add
 * flows have a template but no editing source, and the edit modal has an editing source
 * but no template.
 */
export function buildDeviceConfigInput(
  fields: DeviceFormFields,
  {
    editingSource,
    template,
  }: { editingSource?: DataSource | null; template?: DataSourceTemplate | null },
) {
  const {
    type,
    url,
    healthStatusUrl,
    brokerUrl,
    topic,
    gpioChip,
    gpioPin,
    gpioProfile,
    gpioPull,
    gpioEdge,
    gpioDebounceMs,
    gpioActiveState,
    cameraMode,
    cameraWidth,
    cameraHeight,
    cameraDurationMs,
    cameraFps,
    bmeSensor,
    bmeBus,
    bmeAddress,
    method,
  } = fields;

  if (type === "webhook") return { webhookToken: editingSource?.config.webhookToken };
  if (type === "mqtt")
    return {
      brokerUrl,
      topic,
      profile:
        template?.config.profile === "esp32-mqtt-board" ? ("esp32-mqtt-board" as const) : undefined,
    };
  if (type === "mqtt-output") return { brokerUrl, topic, qos: 0 as const, retain: false };
  if (type === "http-output")
    return {
      url,
      method: method === "GET" ? ("POST" as const) : method,
      headers: {},
      timeoutMs: 5000,
    };
  if (type === "gpio-input")
    return {
      chip: gpioChip,
      pin: Number(gpioPin),
      profile: gpioProfile,
      pull: gpioPull,
      edge: gpioEdge,
      debounceMs: Number(gpioDebounceMs),
      activeState: gpioActiveState,
    };
  if (type === "gpio-output")
    return {
      chip: gpioChip,
      pin: Number(gpioPin),
      profile: "led" as const,
      activeState: gpioActiveState,
      initialState: "inactive" as const,
    };
  if (type === "pi-camera")
    return {
      mode: cameraMode,
      width: Number(cameraWidth),
      height: Number(cameraHeight),
      durationMs: Number(cameraDurationMs),
      fps: Number(cameraFps),
      outputFormat: cameraMode === "video" ? ("h264" as const) : ("jpg" as const),
    };
  if (type === "bme-sensor")
    return {
      sensor: bmeSensor,
      bus: Number(bmeBus),
      address: bmeAddress,
    };
  if (type === "device-system-data")
    return {
      includeSpecs: true,
      includePerformance: true,
      includeNetwork: true,
      includeLocation: true,
    };
  return {
    url,
    method: method === "PUT" || method === "PATCH" ? ("POST" as const) : method,
    healthStatusUrl: healthStatusUrl.trim() || undefined,
    headers: {},
  };
}
