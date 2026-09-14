import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { useToast } from "../../../components/ToastProvider";
import { createDataSource } from "../dataSourcesApi";
import { AddDeviceMethodChoice } from "./AddDeviceMethodChoice";
import { buildDeviceConfigInput } from "../buildDeviceConfig";
import { DataSourceForm, isDataSourceFormValid } from "../DataSourceForm";
import { resolveTemplateConfig } from "../DataSourceTemplates";
import { DataSourceTemplates } from "./ClassicDeviceTemplates";
import type { DataSource, DataSourceCapabilities, DataSourceTemplate, HostCapability } from "../dataSourceTypes";
import { useDeviceFormFields } from "../useDeviceFormFields";

/**
 * Add-device flow: method choice -> template grid -> form, each its own modal step.
 */
export function ClassicAddDeviceFlow({
  mode,
  capabilities,
  hostCapabilities,
  onClose,
  onCreated,
}: {
  mode: "input" | "output" | null;
  capabilities: DataSourceCapabilities | null;
  hostCapabilities?: HostCapability[];
  onClose: () => void;
  onCreated: (source: DataSource) => void;
}) {
  const { showToast } = useToast();
  const [category, setCategory] = useState<"template" | "manual" | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [template, setTemplate] = useState<DataSourceTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const { fields, reset, fillFromTemplate } = useDeviceFormFields();

  useEffect(() => {
    if (!mode) return;
    setCategory(null);
    setFormOpen(false);
    setTemplate(null);
    reset();
    // Reset only when a fresh open is requested, not on every field change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (!mode) return null;

  function selectTemplate(nextTemplate: DataSourceTemplate) {
    const resolved = { ...nextTemplate, config: resolveTemplateConfig(nextTemplate, capabilities) };
    fillFromTemplate(resolved);
    setTemplate(resolved);
    setFormOpen(true);
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

  if (formOpen) {
    return (
      <Modal
        title={addDeviceBreadcrumb(mode, category, "Add device")}
        closeDisabled={saving}
        onClose={onClose}
        footer={
          <>
            <BackButton disabled={saving} onClick={() => setFormOpen(false)} />
            <Button
              disabled={saving || !isDataSourceFormValid(fields)}
              onClick={() => void handleSubmit()}
            >
              {mode === "input" ? "Add input" : "Add output"}
            </Button>
          </>
        }
      >
        <DataSourceForm
          {...fields}
          template={template}
          submitLabel={mode === "input" ? "Add input" : "Add output"}
        />
      </Modal>
    );
  }

  return (
    <Modal
      title={addDeviceBreadcrumb(mode, category)}
      closeDisabled={saving}
      onClose={onClose}
      footer={category ? <BackButton onClick={() => setCategory(null)} /> : undefined}
    >
      <div className="gap-detail-close p-pad-tight grid">
        {category ? (
          <DataSourceTemplates
            mode={mode}
            category={category}
            capabilities={capabilities}
            hostCapabilities={hostCapabilities}
            onSelect={selectTemplate}
          />
        ) : (
          <AddDeviceMethodChoice mode={mode} onSelect={setCategory} />
        )}
      </div>
    </Modal>
  );
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button
      variant="ghost"
      disabled={disabled}
      iconStart={<ArrowLeft aria-hidden />}
      onClick={onClick}
    >
      Back
    </Button>
  );
}

function addDeviceBreadcrumb(
  mode: "input" | "output",
  category: "template" | "manual" | null,
  final?: string,
) {
  const parts = [mode === "input" ? "Input source" : "Output target"];
  if (category === "template") parts.push("Template");
  if (category === "manual") parts.push("Manual");
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
