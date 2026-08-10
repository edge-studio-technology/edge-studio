import type { DataSource } from "../../../data-sources/dataSourceTypes";
import { Pill } from "../../../../components/Pill";
import { IconButton } from "../../../../components/ui/Button";
import { ScrollArea } from "../../../../components/ui/ScrollArea";
import { cx } from "../../../../lib/cx";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Database,
  GitBranch,
  Inbox,
  Play,
  Radio,
  Send,
  ShieldCheck,
  Timer,
  Trash2,
  TriangleAlert,
  Variable,
  Webhook,
  Zap,
} from "lucide-react";
import type { AutomationBlockType } from "../../automationTypes";
import { blockPresentation, isDataBlock, type WorkflowCanvasBadge } from "./blockPresentation";
import type {
  DraftWorkflowBlock,
  WorkflowCanvasBlock,
  WorkflowCanvasMode,
  WorkflowCanvasRuntimeState,
  WorkflowCanvasValidationIssue,
} from "./types";

const mutedText = "type-meta text-text-secondary";
const statusPillClass = (good: boolean) => (good ? "good" : "neutral");
const canvasClass = "h-full min-h-0 overflow-hidden";
const canvasLaneClass =
  "relative flex h-full min-h-[360px] flex-col items-center bg-surface-primary bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-grey-03)_32%,transparent)_1px,transparent_1px)] bg-[length:18px_18px] py-pad-relaxed pl-pad-relaxed pr-[calc(360px+var(--spacing-pad-relaxed)+var(--spacing-pad-tight))] md:min-h-0";
/** Reserves closed validation height; the card itself is absolute and expands over blocks. */
const canvasTopSlotClass = "relative z-20 mb-detail-close max-w-[320px] w-full shrink-0 self-start";
const canvasTopSlotReserveClass =
  "pointer-events-none h-[calc(2*var(--spacing-margin-tight)+1.75rem+2px)] w-full";
const canvasContentClass =
  "flex min-h-0 w-full flex-1 flex-col items-center [justify-content:safe_center]";
const canvasEndSpacerClass = "h-[40px] w-px shrink-0";
const emptyCanvasClass =
  "border-stroke-primary bg-surface-secondary text-text-primary grid min-h-[180px] w-full max-w-[520px] place-items-center rounded-soft border border-dashed p-margin-relaxed text-center";
const blockBaseClass =
  "relative w-full max-w-[520px] cursor-pointer rounded-soft border p-margin-tight text-text-primary transition-[border-color,box-shadow] before:absolute before:left-1/2 before:top-[-25px] before:hidden before:h-[24px] before:w-px before:-translate-x-1/2 before:bg-stroke-active focus-visible:ring-stroke-active focus-visible:ring-2 focus-visible:outline-none [&+&]:mt-detail-near [&+&]:before:block";
const selectedBlockClass = "border-stroke-active shadow-[0_0_0_1px_var(--color-stroke-active)]";
const blockIconTileBaseClass = "flex size-7 shrink-0 items-center justify-center rounded-full";

/** Soft tint + icon color by category; shape/icon carry meaning so color isn’t the only cue. */
function blockIconToneClass(type: AutomationBlockType) {
  if (type.endsWith("_start")) return "bg-feedback-warning/20 text-icon-warning";
  if (isDataBlock(type)) return "bg-[#2563EB]/15 text-[#2563EB]";
  if (type === "set_variable" || type === "if_payload_field_equals" || type === "wait")
    return "bg-surface-accent/15 text-text-accent";
  if (type === "stamp_integritas") return "bg-feedback-positive/20 text-icon-success";
  return "bg-[#DB2777]/15 text-[#DB2777]";
}

const blockTypeIcon: Record<AutomationBlockType, LucideIcon> = {
  manual_start: Play,
  schedule_start: Clock,
  gpio_event_start: Cpu,
  webhook_event_start: Webhook,
  mqtt_event_start: Radio,
  record_trigger_event: Inbox,
  fetch_data_source: Database,
  capture_camera: Camera,
  set_variable: Variable,
  if_payload_field_equals: GitBranch,
  wait: Timer,
  show_preview: Zap,
  stamp_integritas: ShieldCheck,
  control_output: Cpu,
  send_transaction: Send,
};

export function WorkflowCanvas({
  mode,
  blocks,
  sources,
  selectedBlockId,
  statusLabel,
  statusGood,
  bottomOverlay = false,
  topSlot,
  validationByBlockId = {},
  runtimeByBlockId = {},
  onSelectBlock,
  onMoveBlock,
  onRemoveBlock,
}: {
  mode: WorkflowCanvasMode;
  blocks: WorkflowCanvasBlock[];
  sources: DataSource[];
  selectedBlockId: string;
  statusLabel: string;
  statusGood: boolean;
  bottomOverlay?: boolean;
  topSlot?: ReactNode;
  validationByBlockId?: Record<string, WorkflowCanvasValidationIssue[]>;
  runtimeByBlockId?: Record<string, WorkflowCanvasRuntimeState>;
  onSelectBlock: (id: string) => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
  onRemoveBlock: (id: string) => void;
}) {
  const isBuild = mode === "build";
  const actionLabels = isBuild
    ? { up: "Up", down: "Down", remove: "Remove" }
    : { up: "Move up", down: "Move down", remove: "Remove" };
  return (
    <section className={canvasClass}>
      <div className="sr-only">
        <h3>{isBuild ? "Draft canvas" : "Workflow canvas"}</h3>
        <p>
          {isBuild
            ? "This is the starter chain that will be created."
            : "Select a block to edit or inspect it. Move and remove actions apply immediately."}
        </p>
      </div>
      <ScrollArea className={canvasLaneClass}>
        <div className="top-pad-tight right-[calc(360px+var(--spacing-pad-relaxed)+var(--spacing-pad-tight))] absolute z-10">
          <Pill tone={statusPillClass(statusGood)}>{statusLabel}</Pill>
        </div>
        {topSlot ? (
          <div className={canvasTopSlotClass}>
            <div className={canvasTopSlotReserveClass} aria-hidden />
            <div className="absolute top-0 right-0 left-0">{topSlot}</div>
          </div>
        ) : null}
        <div className={cx(canvasContentClass, bottomOverlay && "pb-[240px]")}>
          {blocks.length === 0 && (
            <div className={emptyCanvasClass}>
              <div className="gap-detail-next grid">
                <span className="type-title text-text-tertiary">+</span>
                <strong className="type-body-em">
                  {isBuild ? "Click from the toolkit to add a start block" : "No blocks"}
                </strong>
                <p className={cx(mutedText, "m-0")}>
                  {isBuild
                    ? "Start with Manual, Schedule, GPIO, Webhook, or MQTT. Then add data and logic blocks."
                    : "Add a start block by creating a new workflow."}
                </p>
              </div>
            </div>
          )}
          {blocks.map((block, index) => (
            <WorkflowBlockCard
              key={block.id}
              block={block}
              index={index}
              sources={sources}
              selected={block.id === selectedBlockId}
              canMoveUp={index > 1}
              canMoveDown={index > 0 && index < blocks.length - 1}
              actionLabels={actionLabels}
              validationIssues={validationByBlockId[block.id] ?? []}
              runtime={runtimeByBlockId[block.id]}
              onSelect={() => onSelectBlock(block.id)}
              onMoveUp={() => onMoveBlock(block.id, -1)}
              onMoveDown={() => onMoveBlock(block.id, 1)}
              onRemove={() => onRemoveBlock(block.id)}
            />
          ))}
          <div aria-hidden className={cx(canvasEndSpacerClass, bottomOverlay && "h-[240px]")} />
        </div>
      </ScrollArea>
    </section>
  );
}

function WorkflowBlockCard({
  block,
  index,
  sources,
  selected,
  canMoveUp,
  canMoveDown,
  actionLabels,
  validationIssues,
  runtime,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  block: DraftWorkflowBlock;
  index: number;
  sources: DataSource[];
  selected: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  actionLabels: { up: string; down: string; remove: string };
  validationIssues: WorkflowCanvasValidationIssue[];
  runtime?: WorkflowCanvasRuntimeState;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const presentation = blockPresentation(block, sources, validationIssues, runtime);
  const headerBadges = presentation.badges.slice(0, 3);
  const overflowBadges = presentation.badges.slice(3);
  const BlockIcon = blockTypeIcon[block.type];
  return (
    <div
      className={cx(blockBaseClass, presentation.className, selected && selectedBlockClass)}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
    >
      <div className="gap-detail-next grid">
        <div className="gap-detail-next flex items-center justify-between">
          <span className="type-meta text-text-secondary shrink-0 uppercase">
            {index === 0 ? "Start" : "Then"}
          </span>
          {/* Capability / validation tags: shared Pill */}
          <WorkflowBadges badges={headerBadges} />
        </div>
        {/* Title row: category icon badge + title/description */}
        <div className="gap-detail-next flex items-start">
          <span
            className={cx(blockIconTileBaseClass, "mt-detail-fine", blockIconToneClass(block.type))}
            aria-hidden
          >
            <BlockIcon className="size-4" strokeWidth={2} />
          </span>
          <div className="gap-detail-tight grid min-w-0 flex-1">
            <strong className="type-body-em text-text-primary">{presentation.title}</strong>
            <p className="type-body text-text-primary m-0">{presentation.description}</p>
          </div>
        </div>
      </div>
      {overflowBadges.length > 0 && <WorkflowBadges badges={overflowBadges} />}
      {block.attachedBlocks?.map((attached) => (
        <AttachedBlockCard key={attached.id} block={attached} sources={sources} />
      ))}
      {/* Footer: trash + move up/down */}
      {!block.type.endsWith("_start") && (
        <div className="mt-detail-close gap-detail-next flex items-center justify-end">
          <IconButton
            type="button"
            variant="ghost"
            size="compact"
            className="text-icon-secondary hover:border-stroke-error hover:text-icon-error"
            aria-label={actionLabels.remove}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 aria-hidden />
          </IconButton>
          <IconButton
            type="button"
            variant="secondary"
            size="compact"
            aria-label={actionLabels.up}
            disabled={!canMoveUp}
            onClick={(event) => {
              event.stopPropagation();
              onMoveUp();
            }}
          >
            <ChevronUp aria-hidden />
          </IconButton>
          <IconButton
            type="button"
            variant="secondary"
            size="compact"
            aria-label={actionLabels.down}
            disabled={!canMoveDown}
            onClick={(event) => {
              event.stopPropagation();
              onMoveDown();
            }}
          >
            <ChevronDown aria-hidden />
          </IconButton>
        </div>
      )}
    </div>
  );
}

function AttachedBlockCard({
  block,
  sources,
}: {
  block: DraftWorkflowBlock;
  sources: DataSource[];
}) {
  const presentation = blockPresentation(block, sources, [], undefined);
  const BlockIcon = blockTypeIcon[block.type];
  return (
    <div className="border-stroke-secondary bg-surface-secondary mt-detail-close gap-detail-next rounded-soft p-margin-close grid border">
      <span className="type-meta text-text-secondary uppercase">Attached</span>
      <div className="gap-detail-next flex items-start">
        <span
          className={cx(blockIconTileBaseClass, "mt-detail-fine", blockIconToneClass(block.type))}
          aria-hidden
        >
          <BlockIcon className="size-4" strokeWidth={2} />
        </span>
        <div className="gap-detail-tight grid min-w-0 flex-1">
          <strong className="type-body-em text-text-primary">{presentation.title}</strong>
          <p className="type-body text-text-primary m-0">{presentation.description}</p>
        </div>
      </div>
    </div>
  );
}

function WorkflowBadges({ badges }: { badges: WorkflowCanvasBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="gap-detail-next flex shrink-0 flex-wrap justify-end">
      {badges.map((badge) => {
        // Validation alerts: error/warn Pill + triangle (no colored validation ring on the card).
        if (badge.tone === "error" || badge.tone === "warn") {
          return (
            <Pill key={badge.label} tone={badge.tone}>
              <span className="gap-detail-tight inline-flex items-center">
                {badge.alert ? (
                  <TriangleAlert
                    aria-hidden
                    className={
                      badge.tone === "error"
                        ? "text-icon-error size-3 shrink-0"
                        : "text-icon-warning size-3 shrink-0"
                    }
                  />
                ) : null}
                {badge.label}
              </span>
            </Pill>
          );
        }
        return <Pill key={badge.label}>{badge.label}</Pill>;
      })}
    </div>
  );
}
