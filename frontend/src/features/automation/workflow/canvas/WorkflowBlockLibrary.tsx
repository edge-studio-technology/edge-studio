import type { ReactNode } from "react";
import { Disclosure } from "../../../../components/ui/Disclosure";
import { Text } from "../../../../components/ui/Text";
import type { AutomationBlockType } from "../../automationTypes";
import { isDataBlock } from "./blockPresentation";
import type { DraftWorkflowBlock } from "./types";
import { WorkflowRailHeader, WorkflowRailPanel } from "./WorkflowRail";

const libraryCardClass =
  "cursor-pointer border-stroke-secondary bg-surface-primary grid gap-detail-tight rounded-loose border p-detail-close text-left transition-colors hover:border-stroke-primary hover:bg-surface-always-white focus-visible:ring-stroke-active focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-text-disabled disabled:opacity-60";

export function WorkflowBlockLibrary({
  mode = "build",
  hasStartBlock,
  selectedBlock,
  canAddRecordTriggerEvent = true,
  onSelectStartBlock,
  onAddBlock,
  onAttachStamp,
}: {
  mode?: "build" | "edit";
  hasStartBlock: boolean;
  selectedBlock: DraftWorkflowBlock | undefined;
  canAddRecordTriggerEvent?: boolean;
  onSelectStartBlock: (type: AutomationBlockType) => void;
  onAddBlock: (type: AutomationBlockType) => void;
  onAttachStamp: (parentId: string) => void;
}) {
  const canAddMainBlock = hasStartBlock;
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
      {mode === "build" && !hasStartBlock && (
        <ToolkitGroup title="Start blocks">
          <LibraryCard
            onClick={() => onSelectStartBlock("manual_start")}
            title="Manual run"
            description="Run only when an operator starts it."
          />
          <LibraryCard
            onClick={() => onSelectStartBlock("schedule_start")}
            title="Schedule"
            description="Run repeatedly on an interval."
          />
          <LibraryCard
            onClick={() => onSelectStartBlock("gpio_event_start")}
            title="GPIO input event"
            description="Start from a configured GPIO input device."
          />
          <LibraryCard
            onClick={() => onSelectStartBlock("webhook_event_start")}
            title="Webhook received"
            description="Start when JSON arrives at a webhook URL."
          />
          <LibraryCard
            onClick={() => onSelectStartBlock("mqtt_event_start")}
            title="MQTT message received"
            description="Start when JSON arrives on an MQTT topic."
          />
        </ToolkitGroup>
      )}
      {mode === "build" && hasStartBlock && (
        <Text.Muted>Start block selected. Data and logic blocks can now be added.</Text.Muted>
      )}
      <ToolkitGroup title="Data blocks">
        <LibraryCard
          disabled={!canAddMainBlock || !canAddRecordTriggerEvent}
          onClick={() => onAddBlock("record_trigger_event")}
          title="Record trigger event"
          description="Store the trigger payload as data."
        />
        <LibraryCard
          disabled={!canAddMainBlock}
          onClick={() => onAddBlock("fetch_data_source")}
          title="Fetch data source"
          description="Read a configured source such as HTTP JSON or BME sensor."
        />
        <LibraryCard
          disabled={!canAddMainBlock}
          onClick={() => onAddBlock("capture_camera")}
          title="Capture camera"
          description="Capture media from a configured Raspberry Pi Camera."
        />
        <LibraryCard
          disabled={!canAddMainBlock}
          onClick={() => onAddBlock("set_variable")}
          title="Add variable"
          description="Save a value for later blocks."
        />
      </ToolkitGroup>
      <ToolkitGroup title="Logic blocks">
        <LibraryCard
          disabled={!canAddMainBlock}
          onClick={() => onAddBlock("if_payload_field_equals")}
          title="If field matches"
          description="Stop unless a trigger field or variable matches."
        />
        <LibraryCard
          disabled={!canAddMainBlock}
          onClick={() => onAddBlock("wait")}
          title="Wait"
          description="Pause before the next block."
        />
      </ToolkitGroup>
      <ToolkitGroup title="Action blocks">
        <LibraryCard
          disabled={!canAddMainBlock}
          onClick={() => onAddBlock("show_preview")}
          title="Show preview"
          description="Display a message, JSON, link, or image in the Pi UI."
        />
        <LibraryCard
          disabled={!canAddMainBlock}
          onClick={() => onAddBlock("control_output")}
          title="Control device"
          description="Send a command to a configured output target."
        />
        <LibraryCard
          disabled={!canAddMainBlock}
          onClick={() => onAddBlock("send_transaction")}
          title="Send payment"
          description="Send funds to a saved recipient."
        />
      </ToolkitGroup>
      <ToolkitGroup title="Attached actions">
        <LibraryCard
          disabled={
            !selectedBlock ||
            !isDataBlock(selectedBlock.type) ||
            Boolean(
              selectedBlock.attachedBlocks?.some((block) => block.type === "stamp_integritas"),
            )
          }
          onClick={() => selectedBlock && onAttachStamp(selectedBlock.id)}
          title="Stamp data"
          description="Create an Integritas proof for recorded or fetched data."
        />
      </ToolkitGroup>
    </WorkflowRailPanel>
  );
}

function ToolkitGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Disclosure title={title} summaryClassName="type-callout">
      {children}
    </Disclosure>
  );
}

function LibraryCard({
  title,
  description,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={libraryCardClass} disabled={disabled} onClick={onClick}>
      <span className="type-body-em text-text-primary">{title}</span>
      <span className="type-body text-text-secondary">{description}</span>
    </button>
  );
}
