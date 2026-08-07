import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Disclosure } from "../../../../components/ui/Disclosure";
import { Menu } from "../../../../components/ui/Menu";
import { Tooltip } from "../../../../components/ui/Tooltip";
import { cx } from "../../../../lib/cx";
import type { AutomationBlockType } from "../../automationTypes";
import { draftBlockTitle, isDataBlock } from "./blockPresentation";
import type { DraftWorkflowBlock } from "./types";
import { WorkflowRailHeader, WorkflowRailPanel } from "./WorkflowRail";

const libraryCardClass =
  "cursor-pointer border-stroke-secondary bg-surface-primary grid gap-detail-tight rounded-loose border p-detail-close text-left transition-colors hover:border-stroke-primary hover:bg-surface-always-white focus-visible:ring-stroke-active focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-text-disabled disabled:opacity-60";
const libraryCardSelectedClass = "border-stroke-active bg-surface-always-white";

const NEEDS_START_REASON = "Choose a start block first.";

export function WorkflowBlockLibrary({
  mode = "build",
  hasStartBlock,
  selectedStartType,
  blocks,
  canAddRecordTriggerEvent = true,
  onSelectStartBlock,
  onAddBlock,
  onAttachStamp,
}: {
  mode?: "build" | "edit";
  hasStartBlock: boolean;
  selectedStartType?: AutomationBlockType;
  blocks: DraftWorkflowBlock[];
  canAddRecordTriggerEvent?: boolean;
  onSelectStartBlock: (type: AutomationBlockType) => void;
  onAddBlock: (type: AutomationBlockType) => void;
  onAttachStamp: (parentId: string) => void;
}) {
  const [stampPickerOpen, setStampPickerOpen] = useState(false);
  const canAddMainBlock = hasStartBlock;
  const needsStartReason = canAddMainBlock ? undefined : NEEDS_START_REASON;
  const recordTriggerReason = recordTriggerDisabledReason(
    canAddMainBlock,
    canAddRecordTriggerEvent,
    selectedStartType,
  );
  const stampTargets = blocks.filter(
    (block) =>
      isDataBlock(block.type) &&
      !block.attachedBlocks?.some((attached) => attached.type === "stamp_integritas"),
  );
  const stampReason = stampDisabledReason(
    stampTargets,
    blocks.some((block) => isDataBlock(block.type)),
  );

  useEffect(() => {
    if (stampTargets.length < 2) setStampPickerOpen(false);
  }, [stampTargets.length]);

  function attachStamp() {
    if (stampTargets.length === 1) {
      onAttachStamp(stampTargets[0].id);
      return;
    }
    if (stampTargets.length >= 2) setStampPickerOpen((open) => !open);
  }

  function pickStampTarget(parentId: string) {
    onAttachStamp(parentId);
    setStampPickerOpen(false);
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
          disabled={Boolean(needsStartReason)}
          disabledReason={needsStartReason}
          onClick={() => onAddBlock("send_transaction")}
          title="Send payment"
          description="Send funds to a saved recipient."
        />
      </ToolkitGroup>
      <ToolkitGroup title="Attached actions">
        <LibraryCard
          disabled={Boolean(stampReason)}
          disabledReason={stampReason}
          selected={stampPickerOpen}
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
      </ToolkitGroup>
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

function stampDisabledReason(
  stampTargets: DraftWorkflowBlock[],
  hasAnyDataBlock: boolean,
): string | undefined {
  if (stampTargets.length > 0) return undefined;
  return hasAnyDataBlock ? "All data blocks already have a stamp." : "Add a data block first.";
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
    <Disclosure title={title} summaryClassName="type-callout" defaultOpen={defaultOpen}>
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
      <span className="type-body-em text-text-primary">{title}</span>
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
