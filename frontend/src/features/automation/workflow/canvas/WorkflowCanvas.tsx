import type { DataSource } from "../../../data-sources/dataSourceTypes";
import { Pill } from "../../../../components/Pill";
import { IconButton } from "../../../../components/ui/Button";
import { Divider } from "../../../../components/ui/Divider";
import { ScrollArea } from "../../../../components/ui/ScrollArea";
import { Tooltip } from "../../../../components/ui/Tooltip";
import { cx } from "../../../../lib/cx";
import type { LucideIcon } from "lucide-react";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Database,
  GitBranch,
  HelpCircle,
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
import { Link } from "react-router-dom";
import type { AutomationBlockType } from "../../automationTypes";
import { blockPresentation, isDataBlock, type WorkflowCanvasBadge } from "./blockPresentation";
import { blockHelp } from "../workflowBlockHelp";
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
const canvasContentClass =
  "flex min-h-full w-full flex-col items-center [justify-content:safe_center]";
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
        <div className="top-pad-tight absolute right-[calc(360px+var(--spacing-pad-relaxed)+var(--spacing-pad-tight))] z-10">
          <Pill tone={statusPillClass(statusGood)}>{statusLabel}</Pill>
        </div>
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
  const BlockIcon = blockTypeIcon[block.type];
  const showActions = !block.type.endsWith("_start");
  const showFooter = presentation.badges.length > 0 || showActions;
  return (
    <div
      className={cx(blockBaseClass, presentation.className, selected && selectedBlockClass)}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-block-help]")) return;
        onSelect();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest("[data-block-help]")) return;
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
    >
      <div className="gap-detail-next grid">
        <div className="gap-detail-next flex items-center justify-between">
          <span className="type-meta text-text-secondary uppercase">
            {index === 0 ? "Start" : "Then"}
          </span>
          {showActions && (
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
          )}
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
            <span className="gap-detail-tight flex min-w-0 items-center">
              <strong className="type-body-em text-text-primary min-w-0 truncate">
                {presentation.title}
              </strong>
              <BlockHelpToggletip type={block.type} />
            </span>
            <p className="type-body text-text-primary m-0">{presentation.description}</p>
          </div>
        </div>
      </div>
      {block.attachedBlocks?.map((attached) => (
        <AttachedBlockCard key={attached.id} block={attached} sources={sources} />
      ))}
      {/* Footer: pills left, move up/down right */}
      {showFooter && (
        <div className="mt-detail-close gap-detail-next grid min-w-0">
          <Divider />
          <div className="gap-detail-next flex min-w-0 items-start">
            <div className="min-w-0 flex-1">
              <WorkflowBadges badges={presentation.badges} />
            </div>
            {showActions && (
              <div className="gap-detail-next flex shrink-0 items-center">
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
          <span className="gap-detail-tight flex min-w-0 items-center">
            <strong className="type-body-em text-text-primary min-w-0 truncate">
              {presentation.title}
            </strong>
            <BlockHelpToggletip type={block.type} />
          </span>
          <p className="type-body text-text-primary m-0">{presentation.description}</p>
        </div>
      </div>
    </div>
  );
}

function BlockHelpToggletip({ type }: { type: AutomationBlockType }) {
  const help = blockHelp(type);
  return (
    <Tooltip
      title={help.title}
      body={help.tooltip}
      placement="right"
      actions={
        <Link className="type-meta text-text-accent hover:underline" to={`/automation/help#${type}`}>
          Open guide
        </Link>
      }
    >
      <IconButton
        data-block-help
        type="button"
        variant="ghost"
        size="compact"
        className="size-7 border-transparent"
        aria-label={`Explain ${help.title}`}
      >
        <HelpCircle aria-hidden />
      </IconButton>
    </Tooltip>
  );
}

function WorkflowBadges({ badges }: { badges: WorkflowCanvasBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="gap-detail-next flex min-w-0 flex-wrap">
      {badges.map((badge) => {
        // Validation alerts: error/warn Pill + triangle (no colored validation ring on the card).
        if (badge.tone === "error" || badge.tone === "warn") {
          return (
            <Pill key={badge.label} tone={badge.tone} className="max-w-full">
              <span className="gap-detail-tight inline-flex max-w-full items-center">
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
                <span className="min-w-0 truncate">{badge.label}</span>
              </span>
            </Pill>
          );
        }
        return (
          <Pill key={badge.label} className="max-w-full">
            <span className="min-w-0 truncate">{badge.label}</span>
          </Pill>
        );
      })}
    </div>
  );
}
