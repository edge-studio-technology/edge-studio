import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { useToast } from "../../../components/ToastProvider";
import { buildDeviceConfigInput } from "../buildDeviceConfig";
import { createDataSource } from "../dataSourcesApi";
import type { DataSource, DataSourceCapabilities, DataSourceTemplate } from "../dataSourceTypes";
import { useDeviceFormFields } from "../useDeviceFormFields";
import { AltDeviceForm, isAltDeviceFormValid } from "./AltDeviceForm";
import { AltDevicePicker } from "./AltDevicePicker";

/**
 * Alt add-device flow: two steps (pick device -> configure), manual setup only, with
 * back/submit in the modal footer. Runs alongside `ClassicAddDeviceFlow` until one wins.
 */
export function AltAddDeviceFlow({
  mode,
  capabilities,
  onClose,
  onCreated,
}: {
  mode: "input" | "output" | null;
  capabilities: DataSourceCapabilities | null;
  onClose: () => void;
  onCreated: (source: DataSource) => void;
}) {
  const { showToast } = useToast();
  const [template, setTemplate] = useState<DataSourceTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const { fields, reset, fillFromTemplate } = useDeviceFormFields();

  useEffect(() => {
    if (!mode) return;
    setTemplate(null);
    reset();
    // Reset only when a fresh open is requested, not on every field change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (!mode) return null;

  const addLabel = mode === "input" ? "Add input" : "Add output";

  function selectTemplate(next: DataSourceTemplate) {
    fillFromTemplate(next);
    setTemplate(next);
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const response = await createDataSource({
        name: fields.name,
        description: fields.description,
        type: fields.type,
        config: buildDeviceConfigInput(fields, { template }),
      });
      showToast({ tone: "success", title: "Device added" });
      onCreated(response.item);
    } catch (err) {
      showToast({
        tone: "error",
        title: "Device action failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (template) {
    return (
      <Modal
        title={<AddDeviceBreadcrumb mode={mode} final="Add device" />}
        closeDisabled={saving}
        onClose={onClose}
        width="wide"
        bodyClassName="min-h-0 flex-1"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={saving}
              iconStart={<ArrowLeft aria-hidden />}
              onClick={() => setTemplate(null)}
            >
              Back
            </Button>
            <Button
              disabled={saving || !isAltDeviceFormValid(fields)}
              onClick={() => void handleSubmit()}
            >
              {addLabel}
            </Button>
          </>
        }
      >
        <AltDeviceForm template={template} fields={fields} />
      </Modal>
    );
  }

  return (
    <Modal
      title={<AddDeviceBreadcrumb mode={mode} />}
      onClose={onClose}
      width="wide"
      bodyClassName="min-h-0 flex-1"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <AltDevicePicker mode={mode} capabilities={capabilities} onSelect={selectTemplate} />
    </Modal>
  );
}

function AddDeviceBreadcrumb({ mode, final }: { mode: "input" | "output"; final?: string }) {
  const parts = [mode === "input" ? "Input source" : "Output target"];
  if (final) parts.push(final);

  return (
    <span className="gap-detail-tight flex flex-wrap items-center">
      {parts.map((part, index) => (
        <span key={part} className="gap-detail-tight flex items-center">
          {index > 0 && <ChevronRight className="text-text-tertiary" size={18} aria-hidden />}
          <span className={index === parts.length - 1 ? "" : "text-text-tertiary"}>{part}</span>
        </span>
      ))}
    </span>
  );
}
