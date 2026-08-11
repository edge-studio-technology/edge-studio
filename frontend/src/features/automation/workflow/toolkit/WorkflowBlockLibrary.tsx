import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Disclosure } from "../../../../components/ui/Disclosure";
import { SwitchField } from "../../../../components/ui/SwitchField";
import { Tooltip } from "../../../../components/ui/Tooltip";
import { cx } from "../../../../lib/cx";
import type { AutomationBlockType } from "../../automationTypes";
import { WorkflowRailHeader, WorkflowRailPanel } from "../chrome/WorkflowRail";

const libraryCardClass =
  "cursor-pointer border-stroke-secondary bg-surface-primary grid gap-detail-tight rounded-loose border p-detail-close text-left transition-colors hover:border-stroke-primary hover:bg-surface-always-white focus-visible:ring-stroke-active focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-text-disabled disabled:opacity-60";
const libraryCardSelectedClass = "border-stroke-active bg-surface-always-white";

const NEEDS_START_REASON = "Choose a start block first.";

export function WorkflowBlockLibrary({
  mode = "build",
  hasStartBlock,
  selectedStartType,
  canAddRecordTriggerEvent = true,
  canAddSendPayment = true,
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
  enabled?: boolean;
  onEnabledChange?: (value: boolean) => void;
  enabledDisabled?: boolean;
  enabledDisabledReason?: string;
  onSelectStartBlock: (type: AutomationBlockType) => void;
  onAddBlock: (type: AutomationBlockType) => void;
}) {
  const canAddMainBlock = hasStartBlock;
  const needsStartReason = canAddMainBlock ? undefined : NEEDS_START_REASON;
  const recordTriggerReason = recordTriggerDisabledReason(
    canAddMainBlock,
    canAddRecordTriggerEvent,
    selectedStartType,
  );
  const sendPaymentReason = !canAddMainBlock
    ? NEEDS_START_REASON
    : mode === "edit" && !canAddSendPayment
      ? "Add an address book contact in Wallet first."
      : undefined;
  const showEnabled = enabled !== undefined && onEnabledChange !== undefined;
  const enableSwitch = showEnabled ? (
    <SwitchField
      label={mode === "build" ? "Enable after create" : "Enable workflow"}
      description={
        mode === "build"
          ? "Start the workflow as soon as it is created."
          : "This workflow runs directly when enabled."
      }
      checked={enabled}
      disabled={enabledDisabled}
      onChange={(event) => onEnabledChange(event.target.checked)}
      className="border-stroke-secondary pb-detail-close pt-detail-close min-w-0 border-t border-b"
    />
  ) : null;

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
          <LibraryCard
            selected={selectedStartType === "manual_start"}
            onClick={() => onSelectStartBlock("manual_start")}
            title="Manual run"
            description="Run only when an operator starts it."
          />
          <LibraryCard
            selected={selectedStartType === "schedule_start"}
            onClick={() => onSelectStartBlock("schedule_start")}
            title="Schedule"
            description="Run repeatedly on an interval."
          />
          <LibraryCard
            selected={selectedStartType === "gpio_event_start"}
            onClick={() => onSelectStartBlock("gpio_event_start")}
            title="GPIO input event"
            description="Start from a configured GPIO input device."
          />
          <LibraryCard
            selected={selectedStartType === "webhook_event_start"}
            onClick={() => onSelectStartBlock("webhook_event_start")}
            title="Webhook received"
            description="Start when JSON arrives at a webhook URL."
          />
          <LibraryCard
            selected={selectedStartType === "mqtt_event_start"}
            onClick={() => onSelectStartBlock("mqtt_event_start")}
            title="MQTT message received"
            description="Start when JSON arrives on an MQTT topic."
          />
        </ToolkitGroup>
      )}
      <ToolkitGroup key={`data-${hasStartBlock}`} title="Data blocks" defaultOpen={hasStartBlock}>
        <LibraryCard
          disabled={Boolean(recordTriggerReason)}
          disabledReason={recordTriggerReason}
          onClick={() => onAddBlock("record_trigger_event")}
          title="Record trigger event"
          description="Store the trigger payload as data."
        />
        <LibraryCard
          disabled={Boolean(needsStartReason)}
          disabledReason={needsStartReason}
          onClick={() => onAddBlock("fetch_data_source")}
          title="Fetch data source"
          description="Read a configured source such as HTTP JSON or BME sensor."
        />
        <LibraryCard
          disabled={Boolean(needsStartReason)}
          disabledReason={needsStartReason}
          onClick={() => onAddBlock("capture_camera")}
          title="Capture camera"
          description="Capture media from a configured Raspberry Pi Camera."
        />
        <LibraryCard
          disabled={Boolean(needsStartReason)}
          disabledReason={needsStartReason}
          onClick={() => onAddBlock("set_variable")}
          title="Add variable"
          description="Save a value for later blocks."
        />
      </ToolkitGroup>
      <ToolkitGroup title="Logic blocks" defaultOpen={false}>
        <LibraryCard
          disabled={Boolean(needsStartReason)}
          disabledReason={needsStartReason}
          onClick={() => onAddBlock("if_payload_field_equals")}
          title="If field matches"
          description="Stop unless a trigger field or variable matches."
        />
        <LibraryCard
          disabled={Boolean(needsStartReason)}
          disabledReason={needsStartReason}
          onClick={() => onAddBlock("wait")}
          title="Wait"
          description="Pause before the next block."
        />
      </ToolkitGroup>
      <ToolkitGroup title="Action blocks" defaultOpen={false}>
        <LibraryCard
          disabled={Boolean(needsStartReason)}
          disabledReason={needsStartReason}
          onClick={() => onAddBlock("show_preview")}
          title="Show preview"
          description="Display a message, JSON, link, or image in the Pi UI."
        />
        <LibraryCard
          disabled={Boolean(needsStartReason)}
          disabledReason={needsStartReason}
          onClick={() => onAddBlock("control_output")}
          title="Control device"
          description="Send a command to a configured output target."
        />
        <LibraryCard
          disabled={Boolean(sendPaymentReason)}
          disabledReason={sendPaymentReason}
          onClick={() => onAddBlock("send_transaction")}
          title="Send payment"
          description="Send funds to a saved recipient."
        />
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
  title,
  description,
  disabled,
  disabledReason,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
  selected?: boolean;
  onClick: () => void;
}) {
  const card = (
    <button
      type="button"
      className={cx(
        libraryCardClass,
        "w-full",
        selected && libraryCardSelectedClass,
        disabled && disabledReason && "pointer-events-none",
      )}
      disabled={disabled}
      aria-pressed={selected || undefined}
      onClick={onClick}
    >
      <span className="gap-detail-close flex items-center justify-between">
        <span className="type-body-em text-text-primary">{title}</span>
        {selected ? (
          <Check aria-hidden className="text-icon-primary size-4 shrink-0" strokeWidth={2.5} />
        ) : null}
      </span>
      <span className="type-body text-text-secondary">{description}</span>
    </button>
  );

  if (!disabled || !disabledReason) return card;

  return (
    <Tooltip title={disabledReason} placement="left">
      <span className="block w-full">{card}</span>
    </Tooltip>
  );
}
