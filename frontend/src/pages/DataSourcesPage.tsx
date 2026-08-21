import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { ErrorAlert } from "../components/patterns/ErrorAlert";
import { Page } from "../components/Page";
import { useToast } from "../components/ToastProvider";
import { createAutomationWorkflow } from "../features/automation/automationApi";
import {
  deleteDataSource,
  disableCameraSupport,
  disableGpioSupport,
  disableMqttBroker,
  enableCameraSupport,
  enableGpioSupport,
  enableMqttBroker,
  getDataSourceCapabilities,
  getHostCapabilities,
  listDataSources,
  readDataSource,
  testDataSourceOutput,
  updateDataSource,
} from "../features/data-sources/dataSourcesApi";
import { buildDeviceConfigInput } from "../features/data-sources/buildDeviceConfig";
import { AltAddDeviceFlow } from "../features/data-sources/add-device-alt/AltAddDeviceFlow";
import { ClassicAddDeviceFlow } from "../features/data-sources/add-device-classic/ClassicAddDeviceFlow";
import { DataSourceForm, isDataSourceFormValid } from "../features/data-sources/DataSourceForm";
import { DataSourcesList } from "../features/data-sources/DataSourcesList";
import { LocalServicesCard } from "../features/data-sources/DataSourceTemplates";
import { BlockingProgressModal, DeleteConfirmModal, DeleteProgressModal } from "../components/patterns/DeleteConfirmModal";
import type {
  DataSource,
  DataSourceCapabilities,
  HostCapability,
} from "../features/data-sources/dataSourceTypes";
import {
  getDeviceSetupGuide,
  StandardDeviceSetupGuide,
  type DeviceGuideAction,
} from "../features/data-sources/deviceSetupGuides";
import { Esp32FirmwareSetup } from "../features/data-sources/Esp32FirmwareSetup";
import { useDeviceFormFields } from "../features/data-sources/useDeviceFormFields";

/** Flip to "classic" to compare against the previous add-device flow before it is removed. */
const ADD_DEVICE_FLOW: "alt" | "classic" = "alt";
const HARDWARE_REFRESH_TIMEOUT_MS = 30000;
const HARDWARE_REFRESH_INTERVAL_MS = 1000;
const HARDWARE_RESTART_SETTLE_MS = 7000;
const HARDWARE_STABLE_REFRESH_COUNT = 2;

type HardwareOperation = {
  modalTitle: string;
  progressTitle: string;
  description: string;
};

export function DataSourcesPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<DataSource[]>([]);
  const [capabilities, setCapabilities] = useState<DataSourceCapabilities | null>(null);
  const [hostCapabilities, setHostCapabilities] = useState<HostCapability[]>([]);
  const [addDeviceMode, setAddDeviceMode] = useState<"input" | "output" | null>(null);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const editForm = useDeviceFormFields();
  const [busy, setBusy] = useState(false);
  const [deletingSource, setDeletingSource] = useState<DataSource | null>(null);
  const [hardwareOperation, setHardwareOperation] = useState<HardwareOperation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DataSource | null>(null);
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

  async function refresh() {
    const [response, capabilityResponse, hostCapabilityResponse] = await Promise.all([
      listDataSources(),
      getDataSourceCapabilities(),
      getHostCapabilities().catch(() => ({ items: [] })),
    ]);
    setItems(response.items);
    setCapabilities(capabilityResponse);
    setHostCapabilities(hostCapabilityResponse.items);
    return { items: response.items, capabilities: capabilityResponse, hostCapabilities: hostCapabilityResponse.items };
  }

  function handleDeviceCreated(source: DataSource) {
    setAddDeviceMode(null);
    refresh();
    if (getDeviceSetupGuide(source)) setSetupGuideSource(source);
  }

  function editSource(source: DataSource) {
    setEditingSource(source);
    editForm.fillFromSource(source);
    setFormOpen(true);
  }

  function closeForm() {
    if (busy) return;
    setFormOpen(false);
    setEditingSource(null);
    editForm.reset();
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

  async function confirmDelete() {
    if (!deleteTarget) return;
    const source = deleteTarget;
    setDeleteTarget(null);
    await deleteSource(source);
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

  async function saveEditedDevice() {
    if (!editingSource) return;
    await run(async () => {
      await updateDataSource(editingSource.id, {
        name: editForm.fields.name,
        description: editForm.fields.description,
        type: editForm.fields.type,
        config: buildDeviceConfigInput(editForm.fields, { editingSource }),
      });
      setFormOpen(false);
      setEditingSource(null);
      editForm.reset();
    }, "Device updated");
  }

  async function enableCameraHardware() {
    const result = await runHardwareAction(
      () => enableCameraSupport(),
      {
        modalTitle: "Updating camera support",
        progressTitle: "Applying hardware changes",
        description: "Edge Studio is enabling the camera helper and restarting services. This can take a few seconds.",
      },
      { name: "camera", enabled: true },
    );
    if (!result) return;
    if (result.response?.warning) {
      showToast({ tone: "warning", title: "Camera support enabled with warning", message: result.response.warning });
    } else {
      showToast({ tone: "success", title: "Camera support enabled" });
    }
  }

  async function disableCameraHardware() {
    const result = await runHardwareAction(
      () => disableCameraSupport(),
      {
        modalTitle: "Updating camera support",
        progressTitle: "Applying hardware changes",
        description: "Edge Studio is disabling the camera helper and restarting services. This can take a few seconds.",
      },
      { name: "camera", enabled: false },
    );
    if (!result) return;
    showToast({ tone: "success", title: "Camera support disabled" });
  }

  async function enableGpioHardware() {
    const result = await runHardwareAction(
      () => enableGpioSupport(),
      {
        modalTitle: "Updating GPIO support",
        progressTitle: "Applying hardware changes",
        description: "Edge Studio is updating GPIO device access and restarting services. This can take a few seconds.",
      },
      { name: "gpio", enabled: true },
    );
    if (!result) return;
    showToast({ tone: "success", title: "GPIO support enabled" });
  }

  async function disableGpioHardware() {
    const result = await runHardwareAction(
      () => disableGpioSupport(),
      {
        modalTitle: "Updating GPIO support",
        progressTitle: "Applying hardware changes",
        description: "Edge Studio is removing GPIO device access and restarting services. This can take a few seconds.",
      },
      { name: "gpio", enabled: false },
    );
    if (!result) return;
    showToast({ tone: "success", title: "GPIO support disabled" });
  }

  async function enableMqttHardware() {
    const result = await runHardwareAction(
      () => enableMqttBroker(),
      {
        modalTitle: "Updating local MQTT broker",
        progressTitle: "Applying hardware changes",
        description: "Edge Studio is enabling the local MQTT broker and restarting services. This can take a few seconds.",
      },
      { name: "mqtt", enabled: true },
    );
    if (!result) return;
    showToast({ tone: "success", title: "Local MQTT broker enabled" });
  }

  async function disableMqttHardware() {
    const result = await runHardwareAction(
      () => disableMqttBroker(),
      {
        modalTitle: "Updating local MQTT broker",
        progressTitle: "Applying hardware changes",
        description: "Edge Studio is disabling the local MQTT broker and restarting services. This can take a few seconds.",
      },
      { name: "mqtt", enabled: false },
    );
    if (!result) return;
    showToast({ tone: "success", title: "Local MQTT broker disabled" });
  }

  async function runHardwareAction<T>(
    action: () => Promise<T>,
    operation: HardwareOperation,
    expected: Pick<HostCapability, "name" | "enabled">,
  ) {
    setBusy(true);
    setHardwareOperation(operation);
    try {
      const response = await action();
      await delay(HARDWARE_RESTART_SETTLE_MS);
      await waitForHardwareState(expected);
      return { response };
    } catch (err) {
      const transient = isTransientRestartError(err);
      if (transient) {
        await delay(HARDWARE_RESTART_SETTLE_MS);
        const recovered = await waitForHardwareState(expected).then(() => true).catch(() => false);
        if (recovered) return {};
      }
      showToast({ tone: "error", title: "Hardware action failed", message: hardwareActionErrorMessage(err) });
      await refresh().catch(() => undefined);
      return null;
    } finally {
      setHardwareOperation(null);
      setBusy(false);
    }
  }

  async function waitForHardwareState(expected: Pick<HostCapability, "name" | "enabled">) {
    const deadline = Date.now() + HARDWARE_REFRESH_TIMEOUT_MS;
    let lastError: unknown = null;
    let stableRefreshes = 0;
    while (Date.now() < deadline) {
      await delay(HARDWARE_REFRESH_INTERVAL_MS);
      try {
        const response = await refresh();
        const capability = response.hostCapabilities.find((item) => item.name === expected.name);
        if (capability?.enabled === expected.enabled) {
          stableRefreshes += 1;
          if (stableRefreshes >= HARDWARE_STABLE_REFRESH_COUNT) return;
        } else {
          stableRefreshes = 0;
        }
      } catch (err) {
        stableRefreshes = 0;
        lastError = err;
      }
    }
    throw new Error(
      lastError
        ? "Edge Studio is still restarting. Wait a few seconds, then refresh Hardware support."
        : "Hardware support did not report the expected state before the timeout.",
    );
  }

  const setupGuideBme680SupportWarning = setupGuideSource
    ? bme680SupportWarning(setupGuideSource, capabilities)
    : null;

  return (
    <Page
      title="Devices"
      desc="Add input sources for data and events, and output targets for workflows."
    >
      {/* "Add devices" card disabled for v1 — its actions moved next to the device list's
      filter bar (New input / New output), making this separate card redundant.
      <Card className="gap-detail-near grid w-full">
        <div>
          <h2 className="type-title text-text-primary m-0">Add devices</h2>
          <p className="type-body text-text-secondary mt-detail-next m-0">
            Create a configured input source or output target. Local services show connection
            details for app-provided services.
          </p>
        </div>
        <ButtonRow>
          <Button onClick={() => setAddDeviceMode("input")}>Add input source</Button>
          <Button variant="secondary" onClick={() => setAddDeviceMode("output")}>
            Add output target
          </Button>
        </ButtonRow>
      </Card> */}

      <LocalServicesCard
        capabilities={capabilities}
        hostCapabilities={hostCapabilities}
        busy={busy}
        onEnableCamera={enableCameraHardware}
        onDisableCamera={disableCameraHardware}
        onEnableGpio={enableGpioHardware}
        onDisableGpio={disableGpioHardware}
        onEnableMqtt={enableMqttHardware}
        onDisableMqtt={disableMqttHardware}
      />

      {ADD_DEVICE_FLOW === "alt" ? (
        <AltAddDeviceFlow
          mode={addDeviceMode}
          capabilities={capabilities}
          hostCapabilities={hostCapabilities}
          onClose={() => setAddDeviceMode(null)}
          onCreated={handleDeviceCreated}
        />
      ) : (
        <ClassicAddDeviceFlow
          mode={addDeviceMode}
          capabilities={capabilities}
          hostCapabilities={hostCapabilities}
          onClose={() => setAddDeviceMode(null)}
          onCreated={handleDeviceCreated}
        />
      )}

      {formOpen && (
        <Modal
          title="Edit device"
          closeDisabled={busy}
          onClose={closeForm}
          footer={
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={closeForm}>
                Cancel
              </Button>
              <Button
                disabled={busy || !isDataSourceFormValid(editForm.fields)}
                onClick={() => void saveEditedDevice()}
              >
                Save device
              </Button>
            </>
          }
        >
          <DataSourceForm {...editForm.fields} template={null} submitLabel="Save device" />
        </Modal>
      )}

      {deletingSource && (
        <DeleteProgressModal
          title="Deleting device"
          description={`Removing ${deletingSource.name}. Large read histories can take a few seconds while saved read rows are detached from this device.`}
        />
      )}

      {hardwareOperation && (
        <BlockingProgressModal
          title={hardwareOperation.modalTitle}
          progressTitle={hardwareOperation.progressTitle}
          description={hardwareOperation.description}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="Delete device"
          itemLabel={deleteTarget.name}
          confirmLabel="Delete device"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}

      {setupGuideSource && (
        <Modal
          title={getDeviceSetupGuide(setupGuideSource)?.title ?? "Device setup guide"}
          description={getDeviceSetupGuide(setupGuideSource)?.intro}
          onClose={() => setSetupGuideSource(null)}
        >
          {setupGuideBme680SupportWarning && (
            <ErrorAlert status="warning" className="mb-4 max-w-none">
              {setupGuideBme680SupportWarning}
            </ErrorAlert>
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
                // Restore watch once the canvas watch view is ready:
                // navigate(`/workflows/${encodeURIComponent(workflowId)}/watch`)
                navigate(`/workflows/${encodeURIComponent(workflowId)}/edit`)
              }
            />
          )}
        </Modal>
      )}

      <DataSourcesList
        items={items}
        capabilities={capabilities}
        hostCapabilities={hostCapabilities}
        busy={busy}
        loading={capabilities === null}
        onRead={(source) => run(() => readDataSource(source.id), "Manual read completed")}
        onTestOutput={(source) => run(() => testDataSourceOutput(source.id), "Test pulse sent")}
        onOpenSetupGuide={setSetupGuideSource}
        onEdit={editSource}
        onDelete={setDeleteTarget}
        onAddInput={() => setAddDeviceMode("input")}
        onAddOutput={() => setAddDeviceMode("output")}
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
  return "The sensor helper is not reporting BME680 support yet. Re-run the installer with ENABLE_SENSORS=true or install the PyPI bme680 module in /opt/edge-studio/.venv-sensor-helper, then restart the sensor helper.";
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isTransientRestartError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    error.name === "TypeError" ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed")
  );
}

function hardwareActionErrorMessage(error: unknown) {
  if (isTransientRestartError(error)) {
    return "Edge Studio is restarting services. Wait a few seconds, then try again.";
  }
  return error instanceof Error && error.message
    ? error.message
    : "Edge Studio could not apply the hardware change. Try again after services finish restarting.";
}
