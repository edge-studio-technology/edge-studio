import type { DataSource, DataSourceCapabilities, DataSourceTemplate, HostCapability } from "./dataSourceTypes";

export function hostCapabilityForDeviceType(type: DataSource["type"] | DataSourceTemplate["type"]): HostCapability["name"] | null {
  if (type === "pi-camera") return "camera";
  if (type === "bme-sensor") return "sensors";
  if (type === "gpio-input" || type === "gpio-output") return "gpio";
  return null;
}

export function hostCapabilityForDevice(source: DataSource, hostCapabilities: HostCapability[]) {
  const name = usesLocalMqttBroker(source) ? "mqtt" : hostCapabilityForDeviceType(source.type);
  if (!name) return null;
  return hostCapabilities.find((capability) => capability.name === name) ?? null;
}

export function isTemplateActiveByCapability(
  template: DataSourceTemplate,
  capabilities: DataSourceCapabilities | null,
  hostCapabilities: HostCapability[],
) {
  const capabilityName = hostCapabilityForDeviceType(template.type);
  const hostCapability = capabilityName ? hostCapabilities.find((capability) => capability.name === capabilityName) : null;
  if (hostCapability) return hostCapability.enabled;

  if (template.type === "pi-camera") return Boolean(capabilities?.camera?.enabled);
  if (template.type === "bme-sensor") return Boolean(capabilities?.sensors?.enabled);
  if (template.type === "gpio-input" || template.type === "gpio-output") return Boolean(capabilities?.gpioInput.available);
  return true;
}

export function fallbackCapabilityState(source: DataSource, capabilities: DataSourceCapabilities | null) {
  if (source.type === "pi-camera") return { enabled: Boolean(capabilities?.camera?.enabled), available: Boolean(capabilities?.camera?.available), reason: capabilities?.camera?.reason ?? null };
  if (source.type === "bme-sensor") return { enabled: Boolean(capabilities?.sensors?.enabled), available: Boolean(capabilities?.sensors?.available), reason: capabilities?.sensors?.reason ?? null };
  if (source.type === "gpio-input" || source.type === "gpio-output") return { enabled: Boolean(capabilities?.gpioInput.enabled ?? capabilities?.gpioInput.available), available: Boolean(capabilities?.gpioInput.available), reason: capabilities?.gpioInput.reason ?? null };
  if (usesLocalMqttBroker(source)) {
    const enabled = Boolean(capabilities?.mqttBroker?.enabled);
    return { enabled, available: enabled, reason: enabled ? null : "Local MQTT broker is disabled. Enable it from Devices -> Hardware support." };
  }
  return null;
}

function usesLocalMqttBroker(source: DataSource) {
  if (source.type !== "mqtt" && source.type !== "mqtt-output") return false;
  const brokerUrl = source.config.brokerUrl?.trim().toLowerCase() ?? "";
  return brokerUrl === "mqtt://mqtt:1883" || brokerUrl === "mqtt://localhost:1883" || brokerUrl === "mqtt://127.0.0.1:1883";
}
