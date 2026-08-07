import type { DataSource } from "../../data-sources/dataSourceTypes";
import { Pill } from "../../../components/Pill";
import { ScrollArea } from "../../../components/ui/ScrollArea";
import { cx } from "../../../lib/cx";
import { blockPresentation } from "./blockPresentation";
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
  "relative flex h-full min-h-[360px] flex-col items-center px-detail-close py-margin-relaxed md:min-h-0 md:px-margin-relaxed md:py-margin-relaxed";
const canvasContentClass =
  "flex min-h-full w-full flex-col items-center [justify-content:safe_center]";
const canvasEndSpacerClass = "h-[40px] w-px shrink-0";
const emptyCanvasClass =
  "border-stroke-primary bg-surface-secondary text-text-primary grid min-h-[180px] w-full max-w-[520px] place-items-center rounded-soft border border-dashed p-margin-relaxed text-center";
const blockBaseClass =
  "relative w-full max-w-[520px] cursor-pointer rounded-loose border px-detail-close py-detail-close text-text-primary transition-[border-color,box-shadow] before:absolute before:left-1/2 before:top-[-25px] before:hidden before:h-[24px] before:w-px before:-translate-x-1/2 before:bg-stroke-active focus-visible:ring-stroke-active focus-visible:ring-2 focus-visible:outline-none [&+&]:mt-detail-near [&+&]:before:block";
const selectedBlockClass = "border-stroke-active shadow-[0_0_0_1px_var(--color-stroke-active)]";
const blockActionClass =
  "type-meta border-stroke-secondary bg-surface-always-white text-text-primary h-6 rounded-loose border px-detail-next disabled:cursor-not-allowed disabled:text-text-disabled";

export function WorkflowCanvas({
  mode,
  blocks,
  sources,
  selectedBlockId,
  statusLabel,
  statusGood,
  dimmed = false,
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
  dimmed?: boolean;
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
      <ScrollArea
        className={cx(
          canvasLaneClass,
          dimmed &&
            "xl:after:bg-overlay-light after:pointer-events-none after:absolute after:inset-0 after:z-20",
        )}
      >
        <div className="right-margin-tight top-margin-tight absolute z-10">
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
      <span className="type-meta text-text-secondary mb-detail-tight block uppercase">
        {index === 0 ? "Start" : "Then"}
      </span>
      <div className="gap-detail-close flex items-start justify-between">
        <div className="min-w-0">
          <strong className="type-body-em text-text-primary block">{presentation.title}</strong>
          <p className="type-meta text-text-primary mt-detail-tight mb-0">
            {presentation.description}
          </p>
        </div>
        <WorkflowBadges badges={presentation.badges.slice(0, 3)} />
      </div>
      {presentation.badges.length > 3 && <WorkflowBadges badges={presentation.badges.slice(3)} />}
      {block.attachedBlocks?.map((attached) => (
        <AttachedBlockCard key={attached.id} block={attached} sources={sources} />
      ))}
      {!block.type.endsWith("_start") && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            className={blockActionClass}
            disabled={!canMoveUp}
            onClick={(event) => {
              event.stopPropagation();
              onMoveUp();
            }}
          >
            {actionLabels.up}
          </button>
          <button
            type="button"
            className={blockActionClass}
            disabled={!canMoveDown}
            onClick={(event) => {
              event.stopPropagation();
              onMoveDown();
            }}
          >
            {actionLabels.down}
          </button>
          <button
            type="button"
            className={blockActionClass}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            {actionLabels.remove}
          </button>
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
  return (
    <div className="border-stroke-secondary bg-surface-always-white mt-detail-close gap-detail-tight rounded-loose p-detail-close grid border">
      <strong className="type-body-em text-text-primary">{presentation.title}</strong>
      <p className="type-meta text-text-primary m-0">{presentation.description}</p>
      <WorkflowBadges badges={presentation.badges} />
    </div>
  );
}

function WorkflowBadges({ badges }: { badges: string[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="gap-detail-tight flex shrink-0 flex-wrap justify-end">
      {badges.map((badge) => (
        <Pill key={badge}>{badge}</Pill>
      ))}
    </div>
  );
}
