import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { ButtonRow } from "../components/ButtonRow";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { ErrorAlert } from "../components/patterns/ErrorAlert";
import { Page } from "../components/Page";
import { useToast } from "../components/ToastProvider";
import { createAutomationWorkflow } from "../features/automation/automationApi";
import {
  checkDataSourceHealth,
  deleteDataSource,
  getDataSourceCapabilities,
  listDataSources,
  readDataSource,
  testDataSourceOutput,
  updateDataSource,
} from "../features/data-sources/dataSourcesApi";
import { buildDeviceConfigInput } from "../features/data-sources/buildDeviceConfig";
import { AltAddDeviceFlow } from "../features/data-sources/add-device-alt/AltAddDeviceFlow";
import { ClassicAddDeviceFlow } from "../features/data-sources/add-device-classic/ClassicAddDeviceFlow";
import { DataSourceForm } from "../features/data-sources/DataSourceForm";
import { DataSourcesList } from "../features/data-sources/DataSourcesList";
import {
  DeleteDeviceConfirmModal,
  DeleteDeviceProgressModal,
} from "../features/data-sources/DeleteDeviceModal";
import { LocalServicesCard } from "../features/data-sources/DataSourceTemplates";
import type {
  DataSource,
  DataSourceCapabilities,
  DataSourceHealthStatus,
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

export function DataSourcesPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<DataSource[]>([]);
  const [capabilities, setCapabilities] = useState<DataSourceCapabilities | null>(null);
  const [addDeviceMode, setAddDeviceMode] = useState<"input" | "output" | null>(null);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const editForm = useDeviceFormFields();
  const [healthStatuses, setHealthStatuses] = useState<Record<string, DataSourceHealthStatus>>({});
  const [busy, setBusy] = useState(false);
  const [deletingSource, setDeletingSource] = useState<DataSource | null>(null);
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
      // TODO: remove artificial delay, added temporarily to preview the loading state.
      await new Promise((resolve) => setTimeout(resolve, 5000));
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
          <Button onClick={() => setAddDeviceMode("input")}>Add input source</Button>
          <Button variant="secondary" onClick={() => setAddDeviceMode("output")}>
            Add output target
          </Button>
        </ButtonRow>
      </Card>

      <LocalServicesCard capabilities={capabilities} />

      {ADD_DEVICE_FLOW === "alt" ? (
        <AltAddDeviceFlow
          mode={addDeviceMode}
          capabilities={capabilities}
          onClose={() => setAddDeviceMode(null)}
          onCreated={handleDeviceCreated}
        />
      ) : (
        <ClassicAddDeviceFlow
          mode={addDeviceMode}
          capabilities={capabilities}
          onClose={() => setAddDeviceMode(null)}
          onCreated={handleDeviceCreated}
        />
      )}

      {formOpen && (
        <Modal title="Edit device" closeDisabled={busy} onClose={closeForm}>
          <DataSourceForm
            {...editForm.fields}
            template={null}
            busy={busy}
            submitLabel="Save device"
            onSubmit={saveEditedDevice}
          />
        </Modal>
      )}

      {deletingSource && <DeleteDeviceProgressModal source={deletingSource} />}

      {deleteTarget && (
        <DeleteDeviceConfirmModal
          source={deleteTarget}
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
        onDelete={setDeleteTarget}
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
