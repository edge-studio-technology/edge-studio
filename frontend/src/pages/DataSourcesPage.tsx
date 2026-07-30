import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { ProgressModal } from "../components/ProgressModal";
import { MutedText } from "../components/Text";
import { useToast } from "../components/ToastProvider";
import { createAutomationWorkflow } from "../features/automation/automationApi";
import { checkDataSourceHealth, createDataSource, deleteDataSource, getDataSourceCapabilities, listDataSources, readDataSource, testDataSourceOutput, updateDataSource } from "../features/data-sources/dataSourcesApi";
import { DataSourceForm } from "../features/data-sources/DataSourceForm";
import { DataSourcesList } from "../features/data-sources/DataSourcesList";
import { DataSourceTemplates, LocalServicesCard } from "../features/data-sources/DataSourceTemplates";
import type { DataSource, DataSourceCapabilities, DataSourceHealthStatus, DataSourceTemplate } from "../features/data-sources/dataSourceTypes";
import { getDeviceSetupGuide, StandardDeviceSetupGuide, type DeviceGuideAction } from "../features/data-sources/deviceSetupGuides";

type AddDeviceStep = "choose" | "input" | "output" | "input-template" | "input-manual" | "output-template" | "output-manual";

export function DataSourcesPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<DataSource[]>([]);
  const [capabilities, setCapabilities] = useState<DataSourceCapabilities | null>(null);
  const [template, setTemplate] = useState<DataSourceTemplate | null>(null);
  const [templateMode, setTemplateMode] = useState<AddDeviceStep | null>(null);
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
  const [bmeBus, setBmeBus] = useState("1");
  const [bmeAddress, setBmeAddress] = useState<"0x76" | "0x77">("0x76");
  const [method, setMethod] = useState<"GET" | "POST" | "PUT" | "PATCH">("GET");
  const [healthStatuses, setHealthStatuses] = useState<Record<string, DataSourceHealthStatus>>({});
  const [busy, setBusy] = useState(false);
  const [deletingSource, setDeletingSource] = useState<DataSource | null>(null);
  const [setupGuideSource, setSetupGuideSource] = useState<DataSource | null>(null);
  const [runningGuideActionKey, setRunningGuideActionKey] = useState<string | null>(null);
  const [createdGuideWorkflowIds, setCreatedGuideWorkflowIds] = useState<Record<string, string>>({});

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
    setBmeBus(String(nextTemplate.config.bus ?? 1));
    setBmeAddress(nextTemplate.config.address ?? "0x76");
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
    setBmeBus(String(source.config.bus ?? 1));
    setBmeAddress(source.config.address ?? "0x76");
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
    setBmeBus("1");
    setBmeAddress("0x76");
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

  async function runGuideAction(source: DataSource, action: DeviceGuideAction) {
    setRunningGuideActionKey(action.key);
    try {
      const response = await createAutomationWorkflow(action.workflow(source));
      setCreatedGuideWorkflowIds((current) => ({ ...current, [guideActionStateKey(source, action)]: response.item.id }));
      await refresh();
      showToast({ tone: "success", title: "Workflow created", message: response.item.name });
    } catch (err) {
      showToast({ tone: "error", title: "Guide action failed", message: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setRunningGuideActionKey(null);
    }
  }

  const setupGuideBme680SupportWarning = setupGuideSource ? bme680SupportWarning(setupGuideSource, capabilities) : null;

  return (
      <Page eyebrow="Devices" title="Connect inputs and outputs" desc="Add input sources for data and events, then prepare output targets for automation workflows.">
      <Card className="grid gap-4">
        <div>
          <strong>Add devices</strong>
          <MutedText className="m-0 mt-1">Create a configured input source or output target. Local services show connection details for app-provided services.</MutedText>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => setTemplateMode("choose")}>Add device or source</Button>
        </div>
      </Card>

      <LocalServicesCard capabilities={capabilities} />

      {templateMode && (
        <Modal title={addDeviceBreadcrumb(templateMode)} actions={templateMode !== "choose" ? <button className="rounded-[14px] border border-slate-200 bg-white px-3.5 py-2.5 font-bold text-slate-700" type="button" onClick={() => setTemplateMode(previousAddDeviceStep(templateMode))}>Back</button> : null} onClose={() => setTemplateMode(null)}>
          {templateMode === "choose" ? <AddDeviceKindChoice onSelect={setTemplateMode} /> : templateMode === "input" || templateMode === "output" ? <AddDeviceMethodChoice mode={templateMode} onSelect={(category) => setTemplateMode(`${templateMode}-${category}` as "input-template" | "input-manual" | "output-template" | "output-manual")} /> : <DataSourceTemplates mode={templateMode.startsWith("input") ? "input" : "output"} category={templateMode.endsWith("template") ? "template" : "manual"} capabilities={capabilities} onSelect={applyTemplate} />}
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
            bmeBus={bmeBus}
            setBmeBus={setBmeBus}
            bmeAddress={bmeAddress}
            setBmeAddress={setBmeAddress}
            method={method}
            setMethod={setMethod}
            busy={busy}
            submitLabel={editingSource ? "Save device" : "Add device"}
            onSubmit={() => run(async () => {
              const input = { name, description, type, config: type === "webhook" ? { webhookToken: editingSource?.config.webhookToken } : type === "mqtt" ? { brokerUrl, topic, profile: template?.config.profile === "esp32-mqtt-board" ? "esp32-mqtt-board" as const : undefined } : type === "mqtt-output" ? { brokerUrl, topic, qos: 0 as const, retain: false } : type === "http-output" ? { url, method: method === "GET" ? "POST" as const : method, headers: {}, timeoutMs: 5000 } : type === "gpio-input" ? { chip: gpioChip, pin: Number(gpioPin), profile: gpioProfile, pull: gpioPull, edge: gpioEdge, debounceMs: Number(gpioDebounceMs), activeState: gpioActiveState } : type === "gpio-output" ? { chip: gpioChip, pin: Number(gpioPin), profile: "led" as const, activeState: gpioActiveState, initialState: "inactive" as const } : type === "pi-camera" ? { mode: cameraMode, width: Number(cameraWidth), height: Number(cameraHeight), durationMs: Number(cameraDurationMs), fps: Number(cameraFps), outputFormat: cameraMode === "video" ? "h264" as const : "jpg" as const } : type === "bme-sensor" ? { sensor: (template?.config.sensor ?? editingSource?.config.sensor ?? "bme280") as "bme280" | "bme680", bus: Number(bmeBus), address: bmeAddress } : { url, method: method === "PUT" || method === "PATCH" ? "POST" as const : method, healthStatusUrl: healthStatusUrl.trim() || undefined, headers: {} } };
              if (editingSource) await updateDataSource(editingSource.id, input);
              else {
                const response = await createDataSource(input);
                if (getDeviceSetupGuide(response.item)) setSetupGuideSource(response.item);
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

      {setupGuideSource && (
        <Modal title={getDeviceSetupGuide(setupGuideSource)?.title ?? "Device setup guide"} onClose={() => setSetupGuideSource(null)}>
          {setupGuideBme680SupportWarning && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{setupGuideBme680SupportWarning}</div>}
          {setupGuideSource.type === "mqtt" && setupGuideSource.config.profile === "esp32-mqtt-board" ? <Esp32FirmwareSetup source={setupGuideSource} /> : <StandardDeviceSetupGuide source={setupGuideSource} createdWorkflowIds={guideWorkflowIdsForSource(setupGuideSource, createdGuideWorkflowIds)} runningActionKey={runningGuideActionKey} onAction={(action) => runGuideAction(setupGuideSource, action)} onGoToWorkflow={(workflowId) => navigate(`/automation?flow=watch&id=${encodeURIComponent(workflowId)}`)} />}
        </Modal>
      )}

      <DataSourcesList
        items={items}
        healthStatuses={healthStatuses}
        busy={busy}
        onRead={(source) => run(() => readDataSource(source.id), "Manual read completed")}
        onTestOutput={(source) => run(() => testDataSourceOutput(source.id), "Test pulse sent")}
        onOpenSetupGuide={setSetupGuideSource}
        onEdit={editSource}
        onDelete={deleteSource}
      />
    </Page>
  );
}

function guideActionStateKey(source: DataSource, action: DeviceGuideAction) {
  return `${source.id}:${action.key}`;
}

function guideWorkflowIdsForSource(source: DataSource, workflowIds: Record<string, string>) {
  const prefix = `${source.id}:`;
  return Object.fromEntries(Object.entries(workflowIds).filter(([key]) => key.startsWith(prefix)).map(([key, workflowId]) => [key.slice(prefix.length), workflowId]));
}

function bme680SupportWarning(source: DataSource, capabilities: DataSourceCapabilities | null) {
  if (source.type !== "bme-sensor" || source.config.sensor !== "bme680") return null;
  if (!capabilities?.sensors?.enabled || capabilities.sensors.available === false) return null;
  const supportedSensors = capabilities.sensors.supportedSensors;
  if (!supportedSensors || supportedSensors.includes("bme680")) return null;
  return "BME680 support is not installed on the sensor helper host. Install python3-bme680, then restart the sensor helper.";
}

function AddDeviceKindChoice({ onSelect }: { onSelect: (mode: "input" | "output") => void }) {
  return (
    <div className="grid min-h-[min(520px,calc(90vh-160px))] gap-4 md:grid-cols-2">
      <button type="button" className="grid min-h-[240px] content-between gap-6 rounded-[24px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.10)]" onClick={() => onSelect("input")}>
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Input</span>
          <h3 className="mt-3 text-2xl">Add input source</h3>
          <MutedText className="m-0 mt-2">Receive JSON, MQTT messages, webhooks, GPIO events, camera captures, or board data that workflows can record and react to.</MutedText>
        </div>
        <span className="font-extrabold text-blue-700">Choose input source</span>
      </button>
      <button type="button" className="grid min-h-[240px] content-between gap-6 rounded-[24px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.10)]" onClick={() => onSelect("output")}>
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Output</span>
          <h3 className="mt-3 text-2xl">Add output target</h3>
          <MutedText className="m-0 mt-2">Connect LEDs, HTTP endpoints, MQTT topics, or other devices that automation workflows can control.</MutedText>
        </div>
        <span className="font-extrabold text-blue-700">Choose output target</span>
      </button>
    </div>
  );
}

function AddDeviceMethodChoice({ mode, onSelect }: { mode: "input" | "output"; onSelect: (category: "template" | "manual") => void }) {
  return (
    <div className="grid min-h-[min(520px,calc(90vh-160px))] gap-4 md:grid-cols-2">
      <button type="button" className="grid min-h-[240px] content-between gap-6 rounded-[24px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.10)]" onClick={() => onSelect("template")}>
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Guided</span>
          <h3 className="mt-3 text-2xl">Start from a template</h3>
          <MutedText className="m-0 mt-2">Use guided presets for common {mode === "input" ? "devices, sensors, cameras, and board examples" : "output devices and hardware setups"}.</MutedText>
        </div>
        <span className="font-extrabold text-blue-700">Choose template</span>
      </button>
      <button type="button" className="grid min-h-[240px] content-between gap-6 rounded-[24px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.10)]" onClick={() => onSelect("manual")}>
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Manual</span>
          <h3 className="mt-3 text-2xl">Define manually</h3>
          <MutedText className="m-0 mt-2">Configure the {mode === "input" ? "protocol, endpoint, topic, or GPIO input settings" : "endpoint, MQTT topic, or output target settings"} yourself.</MutedText>
        </div>
        <span className="font-extrabold text-blue-700">Choose manual setup</span>
      </button>
    </div>
  );
}

function addDeviceBreadcrumb(mode: AddDeviceStep) {
  const parts = ["Add device or source"];
  if (mode.startsWith("input")) parts.push("Add input source");
  if (mode.startsWith("output")) parts.push("Add output target");
  if (mode.includes("template")) parts.push("Template");
  if (mode.endsWith("manual")) parts.push("Manual");
  return parts.join(" > ");
}

function previousAddDeviceStep(mode: AddDeviceStep) {
  if (mode === "input" || mode === "output") return "choose";
  if (mode.startsWith("input")) return "input";
  return "output";
}

function Esp32FirmwareSetup({ source }: { source: DataSource }) {
  const [flashMethod, setFlashMethod] = useState<"ide" | "cli">("ide");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const savedBroker = esp32BrokerParts(source.config.brokerUrl ?? "mqtt://localhost:1883");
  const [esp32BrokerHost, setEsp32BrokerHost] = useState(savedBroker.host);
  const [esp32BrokerPort, setEsp32BrokerPort] = useState(String(savedBroker.port));
  const broker = { host: esp32BrokerHost.trim() || savedBroker.host, port: Number(esp32BrokerPort) || savedBroker.port };
  const firmware = esp32Firmware({ deviceName: source.name, mqttHost: broker.host, mqttPort: broker.port, topic: source.config.topic ?? "sensors/esp32/data", wifiSsid, wifiPassword });

  return (
    <Card className="grid max-w-4xl gap-4">
      <div>
        <strong>Next steps</strong>
        <MutedText className="m-0 mt-1">The device was saved as a normal MQTT input source. Follow these steps to flash an ESP32 and verify that Integritas Pi receives its JSON messages.</MutedText>
      </div>
      <div className="grid gap-2 text-sm">
        <div>Saved MQTT broker URL: <code>{source.config.brokerUrl}</code></div>
        <div>ESP32 broker host: <code>{broker.host}</code></div>
        <div>ESP32 broker port: <code>{broker.port}</code></div>
        <div>Publish topic: <code>{source.config.topic}</code></div>
      </div>
      {savedBroker.needsEsp32Override && <div className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>ESP32 broker address needed</strong>
        <div>{savedBroker.reason} Enter the broker host and port that the ESP32 can reach from Wi-Fi/LAN.</div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 font-bold">ESP32 broker host<input value={esp32BrokerHost} onChange={(event) => setEsp32BrokerHost(event.target.value)} placeholder="192.168.1.75" /></label>
          <label className="grid gap-2 font-bold">ESP32 broker port<input value={esp32BrokerPort} onChange={(event) => setEsp32BrokerPort(event.target.value)} placeholder="1883" inputMode="numeric" /></label>
        </div>
      </div>}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <strong>Walkthrough</strong>
        <ol className="m-0 grid gap-2 pl-5">
          <li>Connect the ESP32 to the computer you will use for flashing, using a USB data cable. This can be a laptop, desktop, or Raspberry Pi.</li>
          <li>Choose one flashing method below. Use Arduino IDE for a graphical app, or Arduino CLI for terminal/Raspberry Pi/headless use.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={flashMethod === "ide" ? "primary" : "secondary"} onClick={() => setFlashMethod("ide")}>Arduino IDE</Button>
          <Button type="button" size="sm" variant={flashMethod === "cli" ? "primary" : "secondary"} onClick={() => setFlashMethod("cli")}>Arduino CLI</Button>
        </div>
        {flashMethod === "ide" ? <ArduinoIdeSteps firmware={firmware} wifiSsid={wifiSsid} wifiPassword={wifiPassword} onWifiSsidChange={setWifiSsid} onWifiPasswordChange={setWifiPassword} /> : <ArduinoCliSteps firmware={firmware} wifiSsid={wifiSsid} wifiPassword={wifiPassword} onWifiSsidChange={setWifiSsid} onWifiPasswordChange={setWifiPassword} />}
      </div>
      <MutedText className="m-0">The starter sketch publishes a simple Ping JSON message first; replace it with real sensor fields after the MQTT path works.</MutedText>
    </Card>
  );
}

function ArduinoIdeSteps({ firmware, wifiSsid, wifiPassword, onWifiSsidChange, onWifiPasswordChange }: FirmwareStepProps) {
  return (
    <div className="grid gap-3">
      <strong>Arduino IDE steps</strong>
      <SetupStep index={1} title="Install Arduino IDE">Install and open Arduino IDE on the flashing computer from <InlineCode>arduino.cc/en/software</InlineCode>.</SetupStep>
      <SetupStep index={2} title="Add ESP32 Board Manager URL">Open <InlineCode>File -&gt; Preferences</InlineCode> and add this Boards Manager URL: <InlineCode>https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json</InlineCode>.</SetupStep>
      <SetupStep index={3} title="Install ESP32 Board Support">Open <InlineCode>Tools -&gt; Board -&gt; Boards Manager</InlineCode>, search for <InlineCode>esp32</InlineCode>, and install <InlineCode>esp32 by Espressif Systems</InlineCode>.</SetupStep>
      <SetupStep index={4} title="Install PubSubClient">Open <InlineCode>Sketch -&gt; Include Library -&gt; Manage Libraries</InlineCode>, search for <InlineCode>PubSubClient</InlineCode>, and install it.</SetupStep>
      <SetupStep index={5} title="Paste Firmware And Wi-Fi"><FirmwareStepContent firmware={firmware} wifiSsid={wifiSsid} wifiPassword={wifiPassword} onWifiSsidChange={onWifiSsidChange} onWifiPasswordChange={onWifiPasswordChange} /></SetupStep>
      <SetupStep index={6} title="Select Board And Port">Select <InlineCode>Tools -&gt; Board -&gt; ESP32 Dev Module</InlineCode> if unsure, then select the ESP32 serial port under <InlineCode>Tools -&gt; Port</InlineCode>.</SetupStep>
      <SetupStep index={7} title="Upload Firmware">Click Upload. If it gets stuck at Connecting, hold the ESP32 <InlineCode>BOOT</InlineCode> button until upload starts.</SetupStep>
      <SetupStep index={8} title="Monitor Serial Output">Open <InlineCode>Tools -&gt; Serial Monitor</InlineCode> at <InlineCode>115200</InlineCode> baud and look for Wi-Fi, MQTT, and Publishing messages.</SetupStep>
      <SetupStep index={9} title="Create Or Enable Workflow">Create or enable an Automation workflow with <InlineCode>MQTT message received</InlineCode> as the start block and this source selected.</SetupStep>
    </div>
  );
}

type FirmwareStepProps = {
  firmware: string;
  wifiSsid: string;
  wifiPassword: string;
  onWifiSsidChange: (value: string) => void;
  onWifiPasswordChange: (value: string) => void;
};

function ArduinoCliSteps({ firmware, wifiSsid, wifiPassword, onWifiSsidChange, onWifiPasswordChange }: FirmwareStepProps) {
  const [boardListOutput, setBoardListOutput] = useState("");
  const [manualFqbn, setManualFqbn] = useState("esp32:esp32:esp32");
  const detectedBoard = detectEsp32Board(boardListOutput);
  const detectedPort = detectedBoard?.port ?? null;
  const detectedFqbn = detectedBoard?.fqbn ?? null;
  const usableDetectedFqbn = detectedFqbn === "esp32:esp32:esp32_family" ? null : detectedFqbn;
  const selectedFqbn = usableDetectedFqbn ?? (manualFqbn.trim() || "esp32:esp32:esp32");
  const commands = esp32CliCommands(detectedPort ?? "/dev/ttyUSB0", selectedFqbn);

  return (
    <div className="grid gap-3">
      <strong>Arduino CLI steps</strong>
      <SetupStep index={1} title="Install Arduino CLI">
          <div>Run this on the computer connected to the ESP32.</div>
          <CommandBlock value={commands.installCli} />
          <div className="mt-2">If the installer says <InlineCode>arduino-cli not found</InlineCode>, that is usually OK. Use <InlineCode>/home/pi/bin/arduino-cli</InlineCode> or <InlineCode>~/bin/arduino-cli</InlineCode> in commands.</div>
      </SetupStep>
      <SetupStep index={2} title="Install ESP32 Core">
          <CommandBlock value={commands.installEsp32Core} />
      </SetupStep>
      <SetupStep index={3} title="Install PubSubClient">
          <CommandBlock value={commands.installLibrary} />
      </SetupStep>
      <SetupStep index={4} title="Find The ESP32 Port">
          <CommandBlock value={commands.boardList} />
          <div className="mt-2">Run the command and paste its output here. For native-USB ESP32 boards, hold <InlineCode>BOOT</InlineCode>, tap <InlineCode>RESET</InlineCode>/<InlineCode>EN</InlineCode>, then run the command again if the board appears as <InlineCode>Unknown</InlineCode>.</div>
          <textarea className="mt-2 min-h-[110px] font-mono text-xs" value={boardListOutput} onChange={(event) => setBoardListOutput(event.target.value)} placeholder={'Port         Protocol Type              Board Name          FQBN                      Core\n/dev/ttyACM0 serial   Serial Port (USB) ESP32 Family Device esp32:esp32:esp32_family  esp32:esp32\n/dev/ttyAMA0 serial   Serial Port       Unknown'} />
          {detectedBoard ? <div className="mt-2">Detected ESP32 port: <InlineCode>{detectedBoard.port}</InlineCode>.</div> : <div className="mt-2">Look for a USB serial port such as <InlineCode>/dev/ttyUSB0</InlineCode>, <InlineCode>/dev/ttyACM0</InlineCode>, or <InlineCode>COM3</InlineCode>.</div>}
      </SetupStep>
      <SetupStep index={5} title="Create Sketch File">
          <div>Create the sketch folder and file, then paste the generated firmware below.</div>
          <CommandBlock value={commands.createSketch} />
          <FirmwareStepContent firmware={firmware} wifiSsid={wifiSsid} wifiPassword={wifiPassword} onWifiSsidChange={onWifiSsidChange} onWifiPasswordChange={onWifiPasswordChange} />
      </SetupStep>
      <SetupStep index={6} title="Choose Board Target">
          <div>List available ESP32 board targets, then choose the target that matches the board or chip family.</div>
          <CommandBlock value={commands.boardListAll} />
          <label className="grid gap-2 font-bold text-slate-700">Board FQBN<input value={usableDetectedFqbn ?? manualFqbn} onChange={(event) => setManualFqbn(event.target.value)} disabled={Boolean(usableDetectedFqbn)} placeholder="esp32:esp32:esp32" /></label>
          <div className="mt-2">This board target is used by both compile and upload. Use <InlineCode>esp32:esp32:esp32</InlineCode> for a generic ESP32 Dev Module. If upload reports a different chip family, choose the matching FQBN from the available ESP32 board targets, then rerun compile/upload.</div>
          <div className="mt-2">Board options can be appended to the FQBN. For native-USB boards with blank serial monitor output, try enabling USB CDC on boot, for example <InlineCode>esp32:esp32:esp32s3:CDCOnBoot=cdc</InlineCode>.</div>
          <div className="mt-2">{usableDetectedFqbn ? <>Using detected FQBN <InlineCode>{usableDetectedFqbn}</InlineCode>.</> : <>Using Board FQBN <InlineCode>{selectedFqbn}</InlineCode>.</>}</div>
          {detectedFqbn === "esp32:esp32:esp32_family" && <div className="mt-2">Arduino reported <InlineCode>esp32:esp32:esp32_family</InlineCode> in step 4. That identifies the ESP32 family but is not a build target, so choose a real Board FQBN here.</div>}
      </SetupStep>
      <SetupStep index={7} title="Compile Sketch">
          <CommandBlock value={commands.compile} />
      </SetupStep>
      <SetupStep index={8} title="Upload Firmware">
          <div>{detectedPort ? <>Using detected port <InlineCode>{detectedPort}</InlineCode>.</> : <>Using placeholder port <InlineCode>/dev/ttyUSB0</InlineCode>. Paste the board list output in step 4 to update this command.</>}</div>
          <CommandBlock value={commands.upload} />
          <div className="mt-2">If it waits at Connecting, hold the ESP32 <InlineCode>BOOT</InlineCode> button until upload starts. If the error says the chip is not the selected target, set Board FQBN in step 6 to the matching target, such as <InlineCode>esp32:esp32:esp32s3</InlineCode>, <InlineCode>esp32:esp32:esp32c3</InlineCode>, or <InlineCode>esp32:esp32:esp32s2</InlineCode>.</div>
      </SetupStep>
      <SetupStep index={9} title="Monitor Serial Output">
          <CommandBlock value={commands.monitor} />
          <div className="mt-2">Look for Wi-Fi connected, MQTT connected, and Publishing messages. If the monitor stays blank, press <InlineCode>RESET</InlineCode>/<InlineCode>EN</InlineCode> once. For native-USB boards, enable USB CDC on boot in the Board FQBN and compile/upload again.</div>
      </SetupStep>
      <SetupStep index={10} title="Create Or Enable Workflow">Create or enable an Automation workflow with <InlineCode>MQTT message received</InlineCode> as the start block and this source selected.</SetupStep>
    </div>
  );
}

function FirmwareStepContent({ firmware, wifiSsid, wifiPassword, onWifiSsidChange, onWifiPasswordChange }: FirmwareStepProps) {
  const [showFirmware, setShowFirmware] = useState(false);
  return (
    <div className="mt-3 grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 font-bold text-slate-700">Wi-Fi name<input value={wifiSsid} onChange={(event) => onWifiSsidChange(event.target.value)} placeholder="MyWifi" /></label>
        <label className="grid gap-2 font-bold text-slate-700">Wi-Fi password<input type="password" value={wifiPassword} onChange={(event) => onWifiPasswordChange(event.target.value)} placeholder="Wi-Fi password" /></label>
      </div>
      <div className="text-sm text-slate-600">These values are inserted into the firmware text only. They are not saved to Integritas Pi.</div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="xs" onClick={() => navigator.clipboard?.writeText(firmware)}>Copy firmware</Button>
        <Button type="button" size="xs" variant="secondary" onClick={() => setShowFirmware((value) => !value)}>{showFirmware ? "Hide firmware" : "Show firmware"}</Button>
      </div>
      {showFirmware && <textarea className="min-h-[420px] font-mono text-xs" readOnly value={firmware} />}
    </div>
  );
}

function SetupStep({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
      <h4 className="m-0 text-sm font-extrabold text-slate-800">{index}. {title}</h4>
      <div className="mt-2 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}

function CommandBlock({ value }: { value: string }) {
  return (
    <div className="mt-2 grid gap-2">
      <textarea className="min-h-[92px] font-mono text-xs" readOnly value={value} />
      <Button type="button" size="xs" variant="secondary" onClick={() => navigator.clipboard?.writeText(value)}>Copy commands</Button>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <span className="break-all rounded bg-white px-1.5 py-0.5 font-mono text-[0.9em] text-slate-600">{children}</span>;
}

function esp32CliCommands(port: string, fqbn: string) {
  const cli = "~/bin/arduino-cli";
  const sketchPath = "~/esp32-integritas-sensor";
  return {
    installCli: "curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh",
    installEsp32Core: [
      `${cli} config init`,
      `${cli} config add board_manager.additional_urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`,
      `${cli} core update-index`,
      `${cli} core install esp32:esp32`,
    ].join("\n"),
    installLibrary: `${cli} lib install PubSubClient`,
    boardList: `${cli} board list`,
    boardListAll: `${cli} board listall esp32`,
    createSketch: [`mkdir -p ${sketchPath}`, `nano ${sketchPath}/esp32-integritas-sensor.ino`].join("\n"),
    compile: `${cli} compile --fqbn ${fqbn} ${sketchPath}`,
    upload: `${cli} upload -p ${port} --fqbn ${fqbn} ${sketchPath}`,
    monitor: `${cli} monitor -p ${port} --config baudrate=115200`,
  };
}

function detectEsp32Board(output: string) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const usbLine = lines.find((line) => /\bserial\b/i.test(line) && /\b(USB|Serial Port \(USB\))\b/i.test(line) && /^(\/dev\/ttyUSB\d+|\/dev\/ttyACM\d+|COM\d+)/i.test(line));
  const fallbackLine = lines.find((line) => /^(\/dev\/ttyUSB\d+|\/dev\/ttyACM\d+|COM\d+)/i.test(line));
  const line = usbLine ?? fallbackLine;
  const portMatch = line?.match(/^(\/dev\/ttyUSB\d+|\/dev\/ttyACM\d+|COM\d+)/i);
  if (!portMatch) return null;

  const fqbnMatch = line?.match(/\besp32:esp32:[a-z0-9_\-]+\b/i);
  return { port: portMatch[1], fqbn: fqbnMatch?.[0] ?? null };
}

function esp32BrokerParts(brokerUrl: string) {
  const browserHost = typeof window === "undefined" ? "192.168.1.50" : window.location.hostname;
  try {
    const url = new URL(brokerUrl);
    const host = url.hostname;
    const port = Number(url.port || 1883);
    const internalHost = host === "mqtt" || host === "localhost" || host === "127.0.0.1" || host === "::1";
    return {
      host: internalHost ? browserHost : host,
      port,
      needsEsp32Override: internalHost,
      reason: internalHost ? `The saved broker host ${host} is only reachable from the backend host/container, not from the ESP32.` : null,
    };
  } catch {
    return { host: "", port: 1883, needsEsp32Override: true, reason: "The saved broker URL could not be parsed." };
  }
}

function esp32Firmware(input: { deviceName: string; mqttHost: string; mqttPort: number; topic: string; wifiSsid: string; wifiPassword: string }) {
  const deviceSlug = slugifyDeviceName(input.deviceName);
  const wifiSsid = input.wifiSsid || "YOUR_WIFI_NAME";
  const wifiPassword = input.wifiPassword || "YOUR_WIFI_PASSWORD";
  return `#include <WiFi.h>
#include <PubSubClient.h>

const char* WIFI_SSID = "${escapeCppString(wifiSsid)}";
const char* WIFI_PASSWORD = "${escapeCppString(wifiPassword)}";

const char* MQTT_HOST = "${escapeCppString(input.mqttHost)}";
const int MQTT_PORT = ${input.mqttPort};
const char* MQTT_TOPIC = "${escapeCppString(input.topic)}";
const char* DEVICE_NAME = "${escapeCppString(deviceSlug)}";
const int STATUS_LED_PIN = 2; // Change to the board's LED pin, or -1 to disable.

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastPublishAt = 0;
const unsigned long PUBLISH_INTERVAL_MS = 30000;
IPAddress mqttIp;
bool mqttHostIsIp = false;

void setStatusLed(bool on) {
  if (STATUS_LED_PIN < 0) return;
  digitalWrite(STATUS_LED_PIN, on ? HIGH : LOW);
}

void blinkStatusLed(int count, int onMs, int offMs) {
  if (STATUS_LED_PIN < 0) return;
  for (int i = 0; i < count; i++) {
    setStatusLed(true);
    delay(onMs);
    setStatusLed(false);
    delay(offMs);
  }
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    setStatusLed(true);
    delay(500);
    setStatusLed(false);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Wi-Fi connected: ");
  Serial.println(WiFi.localIP());
  Serial.print("Gateway: ");
  Serial.println(WiFi.gatewayIP());
  Serial.print("Subnet: ");
  Serial.println(WiFi.subnetMask());
  Serial.print("DNS: ");
  Serial.println(WiFi.dnsIP());
  Serial.print("RSSI: ");
  Serial.println(WiFi.RSSI());
}

void configureMqttServer() {
  mqttHostIsIp = mqttIp.fromString(MQTT_HOST);
  if (mqttHostIsIp) {
    mqtt.setServer(mqttIp, MQTT_PORT);
  } else {
    mqtt.setServer(MQTT_HOST, MQTT_PORT);
  }
}

void testBrokerTcp() {
  WiFiClient testClient;
  Serial.print("Testing TCP to MQTT broker ");
  Serial.print(MQTT_HOST);
  Serial.print(":");
  Serial.print(MQTT_PORT);
  Serial.print("...");

  const bool connected = mqttHostIsIp ? testClient.connect(mqttIp, MQTT_PORT) : testClient.connect(MQTT_HOST, MQTT_PORT);
  if (connected) {
    Serial.println("connected");
    testClient.stop();
  } else {
    Serial.println("failed");
  }
}

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("Connecting to MQTT...");
    if (mqtt.connect(DEVICE_NAME)) {
      Serial.println("connected");
      blinkStatusLed(2, 100, 100);
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqtt.state());
      Serial.println(" retrying in 5 seconds");
      blinkStatusLed(5, 100, 100);
      delay(5000);
    }
  }
}

void publishReading() {
  char payload[256];
  snprintf(payload, sizeof(payload),
    R"json({"device":"%s","message":"Ping!","uptimeMs":%lu})json",
    DEVICE_NAME,
    millis()
  );

  Serial.print("Publishing: ");
  Serial.println(payload);
  mqtt.publish(MQTT_TOPIC, payload);
  blinkStatusLed(1, 300, 100);
}

void setup() {
  if (STATUS_LED_PIN >= 0) {
    pinMode(STATUS_LED_PIN, OUTPUT);
    setStatusLed(false);
  }

  Serial.begin(115200);
  delay(1500);
  Serial.println();
  Serial.println("Integritas ESP32 MQTT board starting");
  blinkStatusLed(3, 150, 150);
  connectWifi();
  configureMqttServer();
  testBrokerTcp();
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
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "esp32-mqtt-board";
}

function escapeCppString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
