import type { ReactNode } from "react";
import { MutedText } from "../../components/Text";
import { Disclosure } from "../../components/ui/Disclosure";
import { TabList } from "../../components/ui/TabList";
import {
  inputTemplates,
  outputTemplates,
  templateIcon,
  templateKind,
  TemplateNotes,
} from "./DataSourceTemplates";
import type { DataSourceCapabilities, DataSourceTemplate } from "./dataSourceTypes";

export type AddDeviceTab = "template" | "manual";

const TAB_OPTIONS = [
  { value: "template", label: "Guided" },
  { value: "manual", label: "Manual" },
] as const;

const TAB_INFO: Record<AddDeviceTab, { title: string; description: string }> = {
  template: {
    title: "Templates and examples",
    description:
      "Start from guided presets for common devices, examples, and hardware setups. Open one to review its settings and add it.",
  },
  manual: {
    title: "Manual setup",
    description:
      "Configure the protocol, endpoint, topic, or GPIO settings yourself. Open one to fill in its details and add it.",
  },
};

/**
 * Add-device modal body: Guided/Manual tabs, then one collapsible section per template
 * holding that template's form. Only one section is open at a time because the caller
 * owns a single set of form state.
 */
export function AddDevicePanel({
  mode,
  tab,
  onTabChange,
  capabilities,
  expandedTitle,
  onToggleTemplate,
  renderForm,
}: {
  mode: "input" | "output";
  tab: AddDeviceTab;
  onTabChange: (tab: AddDeviceTab) => void;
  capabilities: DataSourceCapabilities | null;
  expandedTitle: string | null;
  onToggleTemplate: (template: DataSourceTemplate | null) => void;
  renderForm: (template: DataSourceTemplate) => ReactNode;
}) {
  const templates = (mode === "input" ? inputTemplates : outputTemplates).filter(
    (template) => templateKind(template) === tab,
  );
  const info = TAB_INFO[tab];

  return (
    <div className="gap-detail-near grid p-2">
      <TabList label="Add device method" value={tab} options={TAB_OPTIONS} onChange={onTabChange} />

      <div>
        <strong>{info.title}</strong>
        <MutedText className="m-0 mt-1">{info.description}</MutedText>
      </div>

      <div className="gap-detail-close grid">
        {templates.map((template) => {
          const Icon = templateIcon(template);
          const open = expandedTitle === template.title;

          return (
            <Disclosure
              key={template.title}
              open={open}
              className="border-stroke-primary rounded-soft border"
              summaryClassName="p-pad-tight"
              contentClassName="px-pad-tight pb-pad-tight"
              title={
                <span className="gap-detail-close pt-detail-next flex min-w-0 items-center">
                  <Icon size={20} className="shrink-0" aria-hidden />
                  <span className="grid min-w-0 gap-1">
                    <span className="type-body-em text-text-primary">{template.title}</span>
                    <MutedText className="m-0">{template.description}</MutedText>
                  </span>
                </span>
              }
              onToggle={(event) => {
                const nowOpen = event.currentTarget.open;
                // Guarded so the auto-close of the previously open section is a no-op.
                if (nowOpen && !open) onToggleTemplate(template);
                else if (!nowOpen && open) onToggleTemplate(null);
              }}
            >
              <TemplateNotes template={template} capabilities={capabilities} />
              {open ? renderForm(template) : null}
            </Disclosure>
          );
        })}
      </div>
    </div>
  );
}
