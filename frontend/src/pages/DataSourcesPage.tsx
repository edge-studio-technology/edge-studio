import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { ButtonRow } from "../components/ButtonRow";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { ProgressModal } from "../components/ProgressModal";
import { MutedText } from "../components/Text";
import { useToast } from "../components/ToastProvider";
import { createAutomationWorkflow } from "../features/automation/automationApi";
import {
  checkDataSourceHealth,
  createDataSource,
  deleteDataSource,
  getDataSourceCapabilities,
  listDataSources,
  readDataSource,
  testDataSourceOutput,
  updateDataSource,
} from "../features/data-sources/dataSourcesApi";
import {
  AddDeviceMethodChoice,
  addDeviceBreadcrumb,
  previousAddDeviceStep,
  type AddDeviceStep,
} from "../features/data-sources/AddDeviceMethodChoice";
import { DataSourceForm } from "../features/data-sources/DataSourceForm";
import { DataSourcesList } from "../features/data-sources/DataSourcesList";
import {
  DataSourceTemplates,
  LocalServicesCard,
} from "../features/data-sources/DataSourceTemplates";
import type {
  DataSource,
  DataSourceCapabilities,
  DataSourceHealthStatus,
  DataSourceTemplate,
} from "../features/data-sources/dataSourceTypes";
import {
  getDeviceSetupGuide,
  StandardDeviceSetupGuide,
  type DeviceGuideAction,
} from "../features/data-sources/deviceSetupGuides";
import { Esp32FirmwareSetup } from "../features/data-sources/Esp32FirmwareSetup";

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
  const [createdGuideWorkflowIds, setCreatedGuideWorkflowIds] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    refresh().catch((err: Error) =>
      showToast({ tone: "error", title: "Could not load devices", message: err.message }),
    );
  }, []);

  useEffect(() => {
    refreshHealthStatuses();
    const interval = window.setInterval(refreshHealthStatuses, 60000);
    return () => window.clearInterval(interval);
  }, [items]);

  async function refresh() {
    const [response, capabilityResponse] = await Promise.all([
      listDataSources(),
      getDataSourceCapabilities(),
    ]);
    setItems(response.items);
    setCapabilities(capabilityResponse);
  }

  function refreshHealthStatuses() {
    const sourcesWithHealth = items.filter((source) => source.config.healthStatusUrl);
    if (sourcesWithHealth.length === 0) return;

    sourcesWithHealth.forEach((source) => {
      checkDataSourceHealth(source.id)
        .then((status) => setHealthStatuses((current) => ({ ...current, [source.id]: status })))
        .catch((err: Error) =>
          setHealthStatuses((current) => ({
            ...current,
            [source.id]: { ok: false, error: err.message },
          })),
        );
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
      showToast({
        tone: "error",
        title: "Device action failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
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
      setCreatedGuideWorkflowIds((current) => ({
        ...current,
        [guideActionStateKey(source, action)]: response.item.id,
      }));
      await refresh();
      showToast({ tone: "success", title: "Workflow created", message: response.item.name });
    } catch (err) {
      showToast({
        tone: "error",
        title: "Guide action failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setRunningGuideActionKey(null);
    }
  }

  const setupGuideBme680SupportWarning = setupGuideSource
    ? bme680SupportWarning(setupGuideSource, capabilities)
    : null;

  return (
    <Page
      title="Connect inputs and outputs"
      desc="Add input sources for data and events, then prepare output targets for automation workflows."
    >
      <Card className="gap-detail-near grid w-full">
        <div>
          <h2 className="type-title text-text-primary m-0">Add devices</h2>
          <p className="type-body text-text-secondary mt-detail-next m-0">
            Create a configured input source or output target. Local services show connection
            details for app-provided services.
          </p>
        </div>
        <ButtonRow>
          <Button onClick={() => setTemplateMode("input")}>Add input source</Button>
          <Button variant="secondary" onClick={() => setTemplateMode("output")}>
            Add output target
          </Button>
        </ButtonRow>
      </Card>

      <LocalServicesCard capabilities={capabilities} />

      {templateMode && (
        <Modal
          title={addDeviceBreadcrumb(templateMode)}
          footer={
            templateMode !== "input" && templateMode !== "output" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTemplateMode(previousAddDeviceStep(templateMode))}
              >
                Back
              </Button>
            ) : null
          }
          onClose={() => setTemplateMode(null)}
        >
          {templateMode === "input" || templateMode === "output" ? (
            <AddDeviceMethodChoice
              mode={templateMode}
              onSelect={(category) =>
                setTemplateMode(
                  `${templateMode}-${category}` as
                    "input-template" | "input-manual" | "output-template" | "output-manual",
                )
              }
            />
          ) : (
            <DataSourceTemplates
              mode={templateMode.startsWith("input") ? "input" : "output"}
              category={templateMode.endsWith("template") ? "template" : "manual"}
              capabilities={capabilities}
              onSelect={applyTemplate}
            />
          )}
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
            onSubmit={() =>
              run(
                async () => {
                  const input = {
                    name,
                    description,
                    type,
                    config:
                      type === "webhook"
                        ? { webhookToken: editingSource?.config.webhookToken }
                        : type === "mqtt"
                          ? {
                              brokerUrl,
                              topic,
                              profile:
                                template?.config.profile === "esp32-mqtt-board"
                                  ? ("esp32-mqtt-board" as const)
                                  : undefined,
                            }
                          : type === "mqtt-output"
                            ? { brokerUrl, topic, qos: 0 as const, retain: false }
                            : type === "http-output"
                              ? {
                                  url,
                                  method: method === "GET" ? ("POST" as const) : method,
                                  headers: {},
                                  timeoutMs: 5000,
                                }
                              : type === "gpio-input"
                                ? {
                                    chip: gpioChip,
                                    pin: Number(gpioPin),
                                    profile: gpioProfile,
                                    pull: gpioPull,
                                    edge: gpioEdge,
                                    debounceMs: Number(gpioDebounceMs),
                                    activeState: gpioActiveState,
                                  }
                                : type === "gpio-output"
                                  ? {
                                      chip: gpioChip,
                                      pin: Number(gpioPin),
                                      profile: "led" as const,
                                      activeState: gpioActiveState,
                                      initialState: "inactive" as const,
                                    }
                                  : type === "pi-camera"
                                    ? {
                                        mode: cameraMode,
                                        width: Number(cameraWidth),
                                        height: Number(cameraHeight),
                                        durationMs: Number(cameraDurationMs),
                                        fps: Number(cameraFps),
                                        outputFormat:
                                          cameraMode === "video"
                                            ? ("h264" as const)
                                            : ("jpg" as const),
                                      }
                                    : type === "bme-sensor"
                                      ? {
                                          sensor: (template?.config.sensor ??
                                            editingSource?.config.sensor ??
                                            "bme280") as "bme280" | "bme680",
                                          bus: Number(bmeBus),
                                          address: bmeAddress,
                                        }
                                      : {
                                          url,
                                          method:
                                            method === "PUT" || method === "PATCH"
                                              ? ("POST" as const)
                                              : method,
                                          healthStatusUrl: healthStatusUrl.trim() || undefined,
                                          headers: {},
                                        },
                  };
                  if (editingSource) await updateDataSource(editingSource.id, input);
                  else {
                    const response = await createDataSource(input);
                    if (getDeviceSetupGuide(response.item)) setSetupGuideSource(response.item);
                  }
                  setFormOpen(false);
                  resetForm();
                },
                editingSource ? "Device updated" : "Device added",
              )
            }
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
        <Modal
          title={getDeviceSetupGuide(setupGuideSource)?.title ?? "Device setup guide"}
          onClose={() => setSetupGuideSource(null)}
        >
          {setupGuideBme680SupportWarning && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              {setupGuideBme680SupportWarning}
            </div>
          )}
          {setupGuideSource.type === "mqtt" &&
          setupGuideSource.config.profile === "esp32-mqtt-board" ? (
            <Esp32FirmwareSetup source={setupGuideSource} />
          ) : (
            <StandardDeviceSetupGuide
              source={setupGuideSource}
              createdWorkflowIds={guideWorkflowIdsForSource(
                setupGuideSource,
                createdGuideWorkflowIds,
              )}
              runningActionKey={runningGuideActionKey}
              onAction={(action) => runGuideAction(setupGuideSource, action)}
              onGoToWorkflow={(workflowId) =>
                navigate(`/automation/${encodeURIComponent(workflowId)}/watch`)
              }
            />
          )}
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
  return Object.fromEntries(
    Object.entries(workflowIds)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, workflowId]) => [key.slice(prefix.length), workflowId]),
  );
}

function bme680SupportWarning(source: DataSource, capabilities: DataSourceCapabilities | null) {
  if (source.type !== "bme-sensor" || source.config.sensor !== "bme680") return null;
  if (!capabilities?.sensors?.enabled || capabilities.sensors.available === false) return null;
  const supportedSensors = capabilities.sensors.supportedSensors;
  if (!supportedSensors || supportedSensors.includes("bme680")) return null;
  return "The sensor helper is not reporting BME680 support yet. Re-run the installer with ENABLE_SENSORS=true or install the PyPI bme680 module in /opt/integritas-pi/.venv-sensor-helper, then restart the sensor helper.";
}
