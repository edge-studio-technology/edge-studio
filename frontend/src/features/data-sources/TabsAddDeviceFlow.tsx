import { useEffect, useState } from "react";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/ToastProvider";
import { createDataSource } from "./dataSourcesApi";
import { AddDevicePanel, type AddDeviceTab } from "./AddDevicePanel";
import { buildDeviceConfigInput } from "./buildDeviceConfig";
import { DataSourceForm } from "./DataSourceForm";
import { resolveTemplateConfig } from "./DataSourceTemplates";
import type { DataSource, DataSourceCapabilities, DataSourceTemplate } from "./dataSourceTypes";
import { useDeviceFormFields } from "./useDeviceFormFields";

/**
 * Tabs add-device flow: Guided/Manual tabs, one collapsible section per template with its
 * form inline. Fully self-contained (own tab/section state, own form fields, own submit) so
 * it can be deleted on its own once the team picks a flow — see the toggle in `DataSourcesPage`.
 */
export function TabsAddDeviceFlow({
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
  const [tab, setTab] = useState<AddDeviceTab>("template");
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [template, setTemplate] = useState<DataSourceTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const { fields, reset, fillFromTemplate } = useDeviceFormFields();

  useEffect(() => {
    if (!mode) return;
    setTab("template");
    setExpandedTemplate(null);
    setTemplate(null);
    reset();
    // Reset only when a fresh open is requested, not on every field change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (!mode) return null;

  function toggleTemplateSection(nextTemplate: DataSourceTemplate | null) {
    if (!nextTemplate) {
      setExpandedTemplate(null);
      setTemplate(null);
      reset();
      return;
    }
    const resolved = { ...nextTemplate, config: resolveTemplateConfig(nextTemplate, capabilities) };
    fillFromTemplate(resolved);
    setTemplate(resolved);
    setExpandedTemplate(nextTemplate.title);
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

  return (
    <Modal
      title={mode === "input" ? "Add input source" : "Add output target"}
      closeDisabled={saving}
      onClose={onClose}
    >
      <AddDevicePanel
        mode={mode}
        tab={tab}
        onTabChange={(nextTab) => {
          setTab(nextTab);
          toggleTemplateSection(null);
        }}
        capabilities={capabilities}
        expandedTitle={expandedTemplate}
        onToggleTemplate={toggleTemplateSection}
        renderForm={() => (
          <DataSourceForm
            {...fields}
            template={template}
            busy={saving}
            submitLabel={mode === "input" ? "Add input" : "Add output"}
            onSubmit={handleSubmit}
          />
        )}
      />
    </Modal>
  );
}
