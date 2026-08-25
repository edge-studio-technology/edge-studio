import type { DataSource } from "../../../data-sources/dataSourceTypes";
import type { AddressBookEntry } from "../../../address-book/addressBookTypes";
import { Pill } from "../../../../components/Pill";
import { IconButton } from "../../../../components/ui/Button";
import { Divider } from "../../../../components/ui/Divider";
import { ScrollArea } from "../../../../components/ui/ScrollArea";
import { cx } from "../../../../lib/cx";
import { ChevronDown, ChevronUp, Trash2, TriangleAlert } from "lucide-react";
import { WorkflowBlockTypeIcon } from "./blockIcons";
import { blockPresentation, type WorkflowCanvasBadge } from "./blockPresentation";
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

export function WorkflowCanvas({
  mode,
  blocks,
  sources,
  addressBook,
  selectedBlockId,
  statusLabel,
  statusGood = false,
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
  addressBook: AddressBookEntry[];
  selectedBlockId: string;
  statusLabel?: string;
  statusGood?: boolean;
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
        {statusLabel ? (
          <div className="top-pad-tight absolute right-[calc(360px+var(--spacing-pad-relaxed)+var(--spacing-pad-tight))] z-10">
            <Pill tone={statusPillClass(statusGood)}>{statusLabel}</Pill>
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
              addressBook={addressBook}
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
  addressBook,
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
  addressBook: AddressBookEntry[];
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
  const presentation = blockPresentation(block, sources, addressBook, validationIssues, runtime);
  const showActions = !block.type.endsWith("_start");
  const showFooter = presentation.badges.length > 0 || showActions;
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
          <WorkflowBlockTypeIcon type={block.type} className="mt-detail-fine" />
          <div className="gap-detail-tight grid min-w-0 flex-1">
            <strong className="type-body-em text-text-primary">{presentation.title}</strong>
            <p className="type-body text-text-primary m-0">{presentation.description}</p>
          </div>
        </div>
      </div>
      {block.attachedBlocks?.map((attached) => (
        <AttachedBlockCard
          key={attached.id}
          block={attached}
          sources={sources}
          addressBook={addressBook}
        />
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
  addressBook,
}: {
  block: DraftWorkflowBlock;
  sources: DataSource[];
  addressBook: AddressBookEntry[];
}) {
  const presentation = blockPresentation(block, sources, addressBook, [], undefined);
  return (
    <div
      className={cx(
        "border-stroke-secondary bg-surface-secondary mt-detail-close gap-detail-next rounded-soft p-margin-close grid border",
        block.enabled === false && "opacity-60",
      )}
    >
      <span className="type-meta text-text-secondary uppercase">
        {block.enabled === false ? "Attached · Disabled" : "Attached"}
      </span>
      <div className="gap-detail-next flex items-start">
        <WorkflowBlockTypeIcon type={block.type} className="mt-detail-fine" />
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
        // Disabled / other status: Pill with status dot so it reads as state, not plain meta.
        if (badge.alert) {
          return (
            <Pill key={badge.label} tone={badge.tone ?? "neutral"} indicator className="max-w-full">
              <span className="min-w-0 truncate">{badge.label}</span>
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
