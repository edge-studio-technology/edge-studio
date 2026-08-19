import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Disclosure } from "../../../../components/ui/Disclosure";
import { SwitchField } from "../../../../components/ui/SwitchField";
import { Tooltip } from "../../../../components/ui/Tooltip";
import { cx } from "../../../../lib/cx";
import type { DataSource } from "../../../data-sources/dataSourceTypes";
import type { AutomationBlockType } from "../../automationTypes";
import { WorkflowRailHeader, WorkflowRailPanel } from "../chrome/WorkflowRail";
import { blockHelp, workflowBlockLibraryTypes } from "../workflowBlockHelp";
import { missingDeviceLibraryReason } from "../workflowHelpers";

const libraryCardClass =
  "border-stroke-secondary bg-surface-primary grid gap-detail-tight rounded-loose border p-detail-close text-left transition-colors focus-visible:ring-stroke-active focus-visible:ring-2 focus-visible:outline-none";
const libraryCardSelectedClass = "border-stroke-active bg-surface-always-white";
const libraryCardInteractiveClass =
  "hover:border-stroke-primary hover:bg-surface-always-white cursor-pointer";
const libraryCardDisabledClass = "text-text-disabled cursor-not-allowed opacity-60";

const NEEDS_START_REASON = "Choose a start block first.";

export function WorkflowBlockLibrary({
  mode = "build",
  hasStartBlock,
  selectedStartType,
  canAddRecordTriggerEvent = true,
  canAddSendPayment = true,
  sources = [],
  enabled,
  onEnabledChange,
  enabledDisabled = false,
  enabledDisabledReason,
  onSelectStartBlock,
  onAddBlock,
}: {
  mode?: "build" | "edit";
  hasStartBlock: boolean;
  selectedStartType?: AutomationBlockType;
  canAddRecordTriggerEvent?: boolean;
  canAddSendPayment?: boolean;
  sources?: DataSource[];
  enabled?: boolean;
  onEnabledChange?: (value: boolean) => void;
  enabledDisabled?: boolean;
  enabledDisabledReason?: string;
  onSelectStartBlock: (type: AutomationBlockType) => void;
  onAddBlock: (type: AutomationBlockType) => void;
}) {
  const canAddMainBlock = hasStartBlock;
  // Enable toggle is create-only; edit auto-pauses and re-enable lives on the workflow list.
  const showEnabled = mode === "build" && enabled !== undefined && onEnabledChange !== undefined;
  const enableSwitch = showEnabled ? (
    <SwitchField
      label="Enable after create"
      description="Start the workflow as soon as it is created."
      checked={enabled}
      disabled={enabledDisabled}
      onChange={(event) => onEnabledChange(event.target.checked)}
      className="border-stroke-secondary pb-detail-close pt-detail-close min-w-0 border-t border-b"
    />
  ) : null;

  function cardDisabledReason(type: AutomationBlockType): string | undefined {
    if (!type.endsWith("_start") && !canAddMainBlock) return NEEDS_START_REASON;
    if (type === "record_trigger_event") {
      return recordTriggerDisabledReason(
        canAddMainBlock,
        canAddRecordTriggerEvent,
        selectedStartType,
      );
    }
    if (type === "send_transaction" && !canAddSendPayment) {
      return "Add an address book contact in Wallet first.";
    }
    return missingDeviceLibraryReason(type, sources);
  }

  return (
    <WorkflowRailPanel>
      <WorkflowRailHeader
        title="Toolkit"
        description={
          mode === "build"
            ? "Choose a sequence of blocks from the toolkit, then add logic to build your workflow."
            : "Add blocks to this workflow. Select a block on the canvas to configure it."
        }
      />
      {enableSwitch &&
        (enabledDisabled && enabledDisabledReason ? (
          <Tooltip title={enabledDisabledReason} placement="left">
            <span className="block w-full">{enableSwitch}</span>
          </Tooltip>
        ) : (
          enableSwitch
        ))}
      {mode === "build" && (
        <ToolkitGroup
          key={`start-${hasStartBlock}`}
          title="Start blocks"
          defaultOpen={!hasStartBlock}
        >
          {workflowBlockLibraryTypes.Start.map((type) => {
            const disabledReason = cardDisabledReason(type);
            return (
              <LibraryCard
                key={type}
                type={type}
                selected={selectedStartType === type}
                disabled={Boolean(disabledReason)}
                disabledReason={disabledReason}
                onClick={() => onSelectStartBlock(type)}
              />
            );
          })}
        </ToolkitGroup>
      )}
      <ToolkitGroup key={`data-${hasStartBlock}`} title="Data blocks" defaultOpen={hasStartBlock}>
        {workflowBlockLibraryTypes.Data.map((type) => {
          const disabledReason = cardDisabledReason(type);
          return (
            <LibraryCard
              key={type}
              type={type}
              disabled={Boolean(disabledReason)}
              disabledReason={disabledReason}
              onClick={() => onAddBlock(type)}
            />
          );
        })}
      </ToolkitGroup>
      <ToolkitGroup title="Logic blocks" defaultOpen={false}>
        {workflowBlockLibraryTypes.Logic.map((type) => {
          const disabledReason = cardDisabledReason(type);
          return (
            <LibraryCard
              key={type}
              type={type}
              disabled={Boolean(disabledReason)}
              disabledReason={disabledReason}
              onClick={() => onAddBlock(type)}
            />
          );
        })}
      </ToolkitGroup>
      <ToolkitGroup title="Action blocks" defaultOpen={false}>
        {workflowBlockLibraryTypes.Action.map((type) => {
          const disabledReason = cardDisabledReason(type);
          return (
            <LibraryCard
              key={type}
              type={type}
              disabled={Boolean(disabledReason)}
              disabledReason={disabledReason}
              onClick={() => onAddBlock(type)}
            />
          );
        })}
      </ToolkitGroup>
      {/* <ToolkitGroup title="Attached actions">
        <LibraryCard
          disabled={Boolean(stampReason)}
          disabledReason={stampReason}
          onClick={attachStamp}
          title="Stamp data"
          description="Create an Integritas proof for recorded or fetched data."
        />
        {stampPickerOpen && stampTargets.length >= 2 && (
          <Menu
            items={stampTargets.map((block) => ({
              label: draftBlockTitle(block),
              onClick: () => pickStampTarget(block.id),
            }))}
          />
        )}
      </ToolkitGroup> */}
    </WorkflowRailPanel>
  );
}

function recordTriggerDisabledReason(
  canAddMainBlock: boolean,
  canAddRecordTriggerEvent: boolean,
  selectedStartType: AutomationBlockType | undefined,
): string | undefined {
  if (!canAddMainBlock) return NEEDS_START_REASON;
  if (canAddRecordTriggerEvent) return undefined;
  if (
    selectedStartType === "gpio_event_start" ||
    selectedStartType === "webhook_event_start" ||
    selectedStartType === "mqtt_event_start"
  ) {
    return "Already added to this workflow.";
  }
  return "Only available for GPIO, webhook, or MQTT starts.";
}

function ToolkitGroup({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Disclosure
      title={title}
      summaryClassName="type-callout"
      defaultOpen={defaultOpen}
      className="border-stroke-secondary pb-detail-close border-b"
    >
      {children}
    </Disclosure>
  );
}

function LibraryCard({
  type,
  disabled,
  disabledReason,
  selected,
  onClick,
}: {
  type: AutomationBlockType;
  disabled?: boolean;
  disabledReason?: string;
  selected?: boolean;
  onClick: () => void;
}) {
  const help = blockHelp(type);
  const card = (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={cx(
        libraryCardClass,
        "w-full",
        selected && libraryCardSelectedClass,
        disabled ? libraryCardDisabledClass : libraryCardInteractiveClass,
      )}
      aria-disabled={disabled || undefined}
      aria-pressed={selected || undefined}
      onClick={() => {
        if (disabled) return;
        onClick();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <span className="gap-detail-close flex items-center justify-between">
        <span className="type-body-em text-text-primary">{help.title}</span>
        <span className="gap-detail-tight flex shrink-0 items-center">
          {selected ? (
            <Check aria-hidden className="text-icon-primary size-4 shrink-0" strokeWidth={2.5} />
          ) : null}
        </span>
      </span>
    </div>
  );

  if (!disabled || !disabledReason) return card;

  return (
    <Tooltip title={disabledReason} placement="left">
      <span className="block w-full">{card}</span>
    </Tooltip>
  );
}
