import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { ProgressModal } from "../components/ProgressModal";
import { MutedText } from "../components/Text";
import { useToast } from "../components/ToastProvider";
import { checkDataSourceHealth, createDataSource, deleteDataSource, getDataSourceCapabilities, listDataSources, readDataSource, testDataSourceOutput, updateDataSource } from "../features/data-sources/dataSourcesApi";
import { DataSourceForm } from "../features/data-sources/DataSourceForm";
import { DataSourcesList } from "../features/data-sources/DataSourcesList";
import { DataSourceTemplates, LocalServicesCard } from "../features/data-sources/DataSourceTemplates";
import type { DataSource, DataSourceCapabilities, DataSourceHealthStatus, DataSourceTemplate } from "../features/data-sources/dataSourceTypes";

export function DataSourcesPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<DataSource[]>([]);
  const [capabilities, setCapabilities] = useState<DataSourceCapabilities | null>(null);
  const [template, setTemplate] = useState<DataSourceTemplate | null>(null);
  const [templateMode, setTemplateMode] = useState<"input" | "output" | null>(null);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<DataSource["type"]>("json-api");
  const [url, setUrl] = useState("");
  const [healthStatusUrl, setHealthStatusUrl] = useState("");
  const [brokerUrl, setBrokerUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [gpioChip, setGpioChip] = useState("gpiochip0");
  const [gpioPin, setGpioPin] = useState("17");
  const [gpioProfile, setGpioProfile] = useState<"generic" | "pir-motion">("generic");
  const [gpioPull, setGpioPull] = useState<"off" | "up" | "down">("off");
  const [gpioEdge, setGpioEdge] = useState<"rising" | "falling" | "both">("both");
  const [gpioDebounceMs, setGpioDebounceMs] = useState("100");
  const [gpioActiveState, setGpioActiveState] = useState<"high" | "low">("high");
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [cameraWidth, setCameraWidth] = useState("1280");
  const [cameraHeight, setCameraHeight] = useState("720");
  const [cameraDurationMs, setCameraDurationMs] = useState("1000");
  const [cameraFps, setCameraFps] = useState("30");
  const [method, setMethod] = useState<"GET" | "POST" | "PUT" | "PATCH">("GET");
  const [healthStatuses, setHealthStatuses] = useState<Record<string, DataSourceHealthStatus>>({});
  const [busy, setBusy] = useState(false);
  const [deletingSource, setDeletingSource] = useState<DataSource | null>(null);
  const [esp32SetupSource, setEsp32SetupSource] = useState<DataSource | null>(null);

  useEffect(() => {
    refresh().catch((err: Error) => showToast({ tone: "error", title: "Could not load devices", message: err.message }));
  }, []);

  useEffect(() => {
    refreshHealthStatuses();
    const interval = window.setInterval(refreshHealthStatuses, 60000);
    return () => window.clearInterval(interval);
  }, [items]);

  async function refresh() {
    const [response, capabilityResponse] = await Promise.all([listDataSources(), getDataSourceCapabilities()]);
    setItems(response.items);
    setCapabilities(capabilityResponse);
  }

  function refreshHealthStatuses() {
    const sourcesWithHealth = items.filter((source) => source.config.healthStatusUrl);
    if (sourcesWithHealth.length === 0) return;

    sourcesWithHealth.forEach((source) => {
      checkDataSourceHealth(source.id)
        .then((status) => setHealthStatuses((current) => ({ ...current, [source.id]: status })))
        .catch((err: Error) => setHealthStatuses((current) => ({ ...current, [source.id]: { ok: false, error: err.message } })));
    });
  }

  function applyTemplate(nextTemplate: DataSourceTemplate) {
    setEditingSource(null);
    setTemplate(nextTemplate);
    setName(nextTemplate.title);
    setDescription(nextTemplate.description);
    setType(nextTemplate.type);
    setUrl(nextTemplate.config.url ?? "");
    setHealthStatusUrl(nextTemplate.config.healthStatusUrl ?? "");
    setBrokerUrl(nextTemplate.config.brokerUrl ?? "");
    setTopic(nextTemplate.config.topic ?? "");
    setGpioChip(nextTemplate.config.chip ?? "gpiochip0");
    setGpioPin(String(nextTemplate.config.pin ?? 17));
    setGpioProfile(nextTemplate.config.profile === "pir-motion" ? "pir-motion" : "generic");
    setGpioPull(nextTemplate.config.pull ?? "off");
    setGpioEdge(nextTemplate.config.edge ?? "both");
    setGpioDebounceMs(String(nextTemplate.config.debounceMs ?? 100));
    setGpioActiveState(nextTemplate.config.activeState ?? "high");
    setCameraMode(nextTemplate.config.mode ?? "photo");
    setCameraWidth(String(nextTemplate.config.width ?? 1280));
    setCameraHeight(String(nextTemplate.config.height ?? 720));
    setCameraDurationMs(String(nextTemplate.config.durationMs ?? 1000));
    setCameraFps(String(nextTemplate.config.fps ?? 30));
    setMethod(nextTemplate.config.method ?? "GET");
    setFormOpen(true);
    setTemplateMode(null);
  }

  function editSource(source: DataSource) {
    setEditingSource(source);
    setTemplate(null);
    setName(source.name);
    setDescription(source.description ?? "");
    setType(source.type);
    setUrl(source.config.url ?? "");
    setHealthStatusUrl(source.config.healthStatusUrl ?? "");
    setBrokerUrl(source.config.brokerUrl ?? "");
    setTopic(source.config.topic ?? "");
    setGpioChip(source.config.chip ?? "gpiochip0");
    setGpioPin(String(source.config.pin ?? 17));
    setGpioProfile(source.config.profile === "pir-motion" ? "pir-motion" : "generic");
    setGpioPull(source.config.pull ?? "off");
    setGpioEdge(source.config.edge ?? "both");
    setGpioDebounceMs(String(source.config.debounceMs ?? 100));
    setGpioActiveState(source.config.activeState ?? "high");
    setCameraMode(source.config.mode ?? "photo");
    setCameraWidth(String(source.config.width ?? 1280));
    setCameraHeight(String(source.config.height ?? 720));
    setCameraDurationMs(String(source.config.durationMs ?? 1000));
    setCameraFps(String(source.config.fps ?? 30));
    setMethod(source.config.method ?? "GET");
    setFormOpen(true);
    setTemplateMode(null);
  }

  function resetForm() {
    setTemplate(null);
    setEditingSource(null);
    setName("");
    setDescription("");
    setType("json-api");
    setUrl("");
    setHealthStatusUrl("");
    setBrokerUrl("");
    setTopic("");
    setGpioChip("gpiochip0");
    setGpioPin("17");
    setGpioProfile("generic");
    setGpioPull("off");
    setGpioEdge("both");
    setGpioDebounceMs("100");
    setGpioActiveState("high");
    setCameraMode("photo");
    setCameraWidth("1280");
    setCameraHeight("720");
    setCameraDurationMs("1000");
    setCameraFps("30");
    setMethod("GET");
  }

  function closeForm() {
    if (busy) return;
    setFormOpen(false);
    resetForm();
  }

  async function run(action: () => Promise<unknown>, successTitle?: string) {
    setBusy(true);
    try {
      await action();
      await refresh();
      if (successTitle) showToast({ tone: "success", title: successTitle });
    } catch (err) {
      showToast({ tone: "error", title: "Device action failed", message: err instanceof Error ? err.message : "Unknown error" });
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSource(source: DataSource) {
    setDeletingSource(source);
    try {
      await run(() => deleteDataSource(source.id), "Device deleted");
    } finally {
      setDeletingSource(null);
    }
  }

  return (
      <Page eyebrow="Devices" title="Connect inputs and outputs" desc="Add input sources for data and events, then prepare output targets for automation workflows.">
      <Card className="grid gap-4">
        <div>
          <strong>Add devices</strong>
          <MutedText className="m-0 mt-1">Create a configured input source or output target. Local services show connection details for app-provided services.</MutedText>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => setTemplateMode("input")}>Add input source</Button>
          <Button type="button" variant="secondary" onClick={() => setTemplateMode("output")}>Add output target</Button>
        </div>
      </Card>

      <LocalServicesCard capabilities={capabilities} />

      {templateMode && (
        <Modal title={templateMode === "input" ? "Add input source" : "Add output target"} onClose={() => setTemplateMode(null)}>
          <DataSourceTemplates mode={templateMode} capabilities={capabilities} onSelect={applyTemplate} />
        </Modal>
      )}

      {formOpen && (
        <Modal title={editingSource ? "Edit device" : "Add device"} onClose={closeForm}>
          <DataSourceForm
            template={template}
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            type={type}
            setType={setType}
            url={url}
            setUrl={setUrl}
            healthStatusUrl={healthStatusUrl}
            setHealthStatusUrl={setHealthStatusUrl}
            brokerUrl={brokerUrl}
            setBrokerUrl={setBrokerUrl}
            topic={topic}
            setTopic={setTopic}
            gpioChip={gpioChip}
            setGpioChip={setGpioChip}
            gpioPin={gpioPin}
            setGpioPin={setGpioPin}
            gpioProfile={gpioProfile}
            setGpioProfile={setGpioProfile}
            gpioPull={gpioPull}
            setGpioPull={setGpioPull}
            gpioEdge={gpioEdge}
            setGpioEdge={setGpioEdge}
            gpioDebounceMs={gpioDebounceMs}
            setGpioDebounceMs={setGpioDebounceMs}
            gpioActiveState={gpioActiveState}
            setGpioActiveState={setGpioActiveState}
            cameraMode={cameraMode}
            setCameraMode={setCameraMode}
            cameraWidth={cameraWidth}
            setCameraWidth={setCameraWidth}
            cameraHeight={cameraHeight}
            setCameraHeight={setCameraHeight}
            cameraDurationMs={cameraDurationMs}
            setCameraDurationMs={setCameraDurationMs}
            cameraFps={cameraFps}
            setCameraFps={setCameraFps}
            method={method}
            setMethod={setMethod}
            busy={busy}
            submitLabel={editingSource ? "Save device" : "Add device"}
            onSubmit={() => run(async () => {
              const input = { name, description, type, config: type === "webhook" ? { webhookToken: editingSource?.config.webhookToken } : type === "mqtt" ? { brokerUrl, topic, profile: template?.config.profile === "esp32-sensor" ? "esp32-sensor" as const : undefined } : type === "mqtt-output" ? { brokerUrl, topic, qos: 0 as const, retain: false } : type === "http-output" ? { url, method: method === "GET" ? "POST" as const : method, headers: {}, timeoutMs: 5000 } : type === "gpio-input" ? { chip: gpioChip, pin: Number(gpioPin), profile: gpioProfile, pull: gpioPull, edge: gpioEdge, debounceMs: Number(gpioDebounceMs), activeState: gpioActiveState } : type === "gpio-output" ? { chip: gpioChip, pin: Number(gpioPin), profile: "led" as const, activeState: gpioActiveState, initialState: "inactive" as const } : type === "pi-camera" ? { mode: cameraMode, width: Number(cameraWidth), height: Number(cameraHeight), durationMs: Number(cameraDurationMs), fps: Number(cameraFps), outputFormat: cameraMode === "video" ? "h264" as const : "jpg" as const } : { url, method: method === "PUT" || method === "PATCH" ? "POST" as const : method, healthStatusUrl: healthStatusUrl.trim() || undefined, headers: {} } };
              if (editingSource) await updateDataSource(editingSource.id, input);
              else {
                const response = await createDataSource(input);
                if (template?.config.profile === "esp32-sensor") setEsp32SetupSource(response.item);
              }
              setFormOpen(false);
              resetForm();
            }, editingSource ? "Device updated" : "Device added")}
          />
        </Modal>
      )}

      {deletingSource && (
        <ProgressModal
          title="Deleting device"
          headline="Deleting in progress"
          message={`Removing ${deletingSource.name}. Large read histories can take a few seconds while saved read rows are detached from this device.`}
        />
      )}

      {esp32SetupSource && (
        <Modal title="ESP32 MQTT starter firmware" onClose={() => setEsp32SetupSource(null)}>
          <Esp32FirmwareSetup source={esp32SetupSource} capabilities={capabilities} />
        </Modal>
      )}

      <DataSourcesList
        items={items}
        healthStatuses={healthStatuses}
        busy={busy}
        onRead={(source) => run(() => readDataSource(source.id), "Manual read completed")}
        onTestOutput={(source) => run(() => testDataSourceOutput(source.id), "Test pulse sent")}
        onEdit={editSource}
        onDelete={deleteSource}
      />
    </Page>
  );
}

function Esp32FirmwareSetup({ source, capabilities }: { source: DataSource; capabilities: DataSourceCapabilities | null }) {
  const broker = esp32BrokerParts(capabilities, source.config.brokerUrl ?? "mqtt://localhost:1883");
  const firmware = esp32Firmware({ deviceName: source.name, mqttHost: broker.host, mqttPort: broker.port, topic: source.config.topic ?? "sensors/esp32/data" });

  return (
    <Card className="grid max-w-4xl gap-4">
      <div>
        <strong>Next steps</strong>
        <MutedText className="m-0 mt-1">The device was saved as a normal MQTT input source. Flash this starter sketch to an ESP32, then create or enable an MQTT workflow that watches this source.</MutedText>
      </div>
      <div className="grid gap-2 text-sm">
        <div>ESP32 broker host: <code>{broker.host}</code></div>
        <div>ESP32 broker port: <code>{broker.port}</code></div>
        <div>Publish topic: <code>{source.config.topic}</code></div>
      </div>
      <MutedText className="m-0">Install the Arduino ESP32 board package and the <code>PubSubClient</code> library. Replace the Wi-Fi placeholders before flashing.</MutedText>
      <textarea className="min-h-[420px] font-mono text-xs" readOnly value={firmware} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => navigator.clipboard?.writeText(firmware)}>Copy firmware</Button>
        <Button type="button" variant="secondary" onClick={() => navigator.clipboard?.writeText(JSON.stringify(exampleEsp32Payload(source.name), null, 2))}>Copy example JSON</Button>
      </div>
    </Card>
  );
}

function esp32BrokerParts(capabilities: DataSourceCapabilities | null, fallbackBrokerUrl: string) {
  const browserHost = typeof window === "undefined" ? "192.168.1.50" : window.location.hostname;
  if (capabilities?.mqttBroker?.enabled) return { host: capabilities.mqttBroker.publicHost || browserHost, port: capabilities.mqttBroker.publicPort ?? 1883 };

  try {
    const url = new URL(fallbackBrokerUrl);
    return { host: url.hostname || browserHost, port: Number(url.port || 1883) };
  } catch {
    return { host: browserHost || "192.168.1.50", port: 1883 };
  }
}

function exampleEsp32Payload(deviceName: string) {
  return {
    device: slugifyDeviceName(deviceName),
    temperatureC: 21.8,
    humidityPercent: 48.2,
    uptimeMs: 123456,
  };
}

function esp32Firmware(input: { deviceName: string; mqttHost: string; mqttPort: number; topic: string }) {
  const deviceSlug = slugifyDeviceName(input.deviceName);
  return `#include <WiFi.h>
#include <PubSubClient.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* MQTT_HOST = "${escapeCppString(input.mqttHost)}";
const int MQTT_PORT = ${input.mqttPort};
const char* MQTT_TOPIC = "${escapeCppString(input.topic)}";
const char* DEVICE_NAME = "${escapeCppString(deviceSlug)}";

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastPublishAt = 0;
const unsigned long PUBLISH_INTERVAL_MS = 30000;

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Wi-Fi connected: ");
  Serial.println(WiFi.localIP());
}

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("Connecting to MQTT...");
    if (mqtt.connect(DEVICE_NAME)) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqtt.state());
      Serial.println(" retrying in 5 seconds");
      delay(5000);
    }
  }
}

float readTemperatureC() {
  // TODO: replace with your sensor read.
  return 21.8;
}

float readHumidityPercent() {
  // TODO: replace with your sensor read, or remove this field.
  return 48.2;
}

void publishReading() {
  char payload[256];
  snprintf(payload, sizeof(payload),
    "{\"device\":\"%s\",\"temperatureC\":%.1f,\"humidityPercent\":%.1f,\"uptimeMs\":%lu}",
    DEVICE_NAME,
    readTemperatureC(),
    readHumidityPercent(),
    millis()
  );

  Serial.print("Publishing: ");
  Serial.println(payload);
  mqtt.publish(MQTT_TOPIC, payload);
}

void setup() {
  Serial.begin(115200);
  connectWifi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
}

void loop() {
  connectWifi();
  connectMqtt();
  mqtt.loop();

  if (millis() - lastPublishAt >= PUBLISH_INTERVAL_MS) {
    lastPublishAt = millis();
    publishReading();
  }
}
`;
}

function slugifyDeviceName(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "esp32-sensor";
}

function escapeCppString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
