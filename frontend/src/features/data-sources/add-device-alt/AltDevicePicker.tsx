import { AltOptionCard } from "../../../components/patterns/AltOptionCard";
import { resolveTemplateConfig, templateIcon } from "../DataSourceTemplates";
import type { DataSourceCapabilities, DataSourceTemplate } from "../dataSourceTypes";
import { altDeviceOptions } from "./altDeviceOptions";

/** Step 1 of the alt add-device flow: one card per manually configurable device type. */
export function AltDevicePicker({
  mode,
  capabilities,
  onSelect,
}: {
  mode: "input" | "output";
  capabilities: DataSourceCapabilities | null;
  onSelect: (template: DataSourceTemplate) => void;
}) {
  return (
    <div className="gap-detail-close grid sm:grid-cols-2 lg:grid-cols-3">
      {altDeviceOptions(mode).map((template) => (
        <AltOptionCard
          key={template.title}
          icon={templateIcon(template)}
          title={template.title}
          description={template.description}
          actionLabel={mode === "input" ? "Add input" : "Add output"}
          onClick={() =>
            onSelect({ ...template, config: resolveTemplateConfig(template, capabilities) })
          }
        />
      ))}
    </div>
  );
}
