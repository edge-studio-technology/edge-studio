import type { ReactNode } from "react";
import type { DataSource } from "../data-sources/dataSourceTypes";
import { Pill } from "../../components/Pill";
import { cx } from "../../lib/cx";
import type { AutomationBlock, AutomationBlockType } from "./automationTypes";

export type DraftWorkflowBlock = {
  id: string;
  type: AutomationBlockType;
  config: AutomationBlock["config"];
  attachedBlocks?: DraftWorkflowBlock[];
  enabled?: boolean;
  lastRunAt?: string | null;
  lastError?: string | null;
};

export type WorkflowCanvasMode = "build" | "edit" | "watch";

export type WorkflowCanvasBlock = DraftWorkflowBlock;

export type WorkflowCanvasValidationIssue = {
  level: "error" | "warning";
  message: string;
};

export type WorkflowCanvasRuntimeState = {
  status: "running" | "success" | "failed" | "skipped";
  durationMs: number | null;
  error?: string | null;
};

const mutedText = "type-meta text-text-secondary";
const shellClass = "border-stroke-primary bg-surface-always-white flex min-h-[min(760px,calc(100vh-220px))] flex-col overflow-hidden rounded-soft border shadow-[0_24px_60px_rgba(0,0,0,0.12)]";
const topbarClass = "border-stroke-secondary bg-surface-always-white px-margin-tight py-detail-close flex flex-col gap-detail-close border-b lg:flex-row lg:items-center lg:justify-between";
const gridClass = "bg-surface-secondary grid min-h-0 flex-1 gap-margin-tight p-margin-tight xl:grid-cols-[minmax(420px,1fr)_300px_360px]";
const rowActionsClass = "gap-detail-next flex flex-wrap items-center";
const statusPillClass = (good: boolean) => good ? "good" : "neutral";
const libraryClass = "bg-surface-always-white border-stroke-secondary grid max-h-[calc(100vh-260px)] content-start gap-detail-close overflow-auto rounded-soft border p-margin-tight shadow-[0_16px_40px_rgba(0,0,0,0.10)] xl:sticky xl:top-margin-tight";
const libraryGroupClass = "grid gap-detail-next";
const libraryGroupTitleClass = "type-body-em text-text-primary flex items-center justify-between";
const libraryCardClass = "border-stroke-secondary bg-surface-primary grid gap-detail-tight rounded-loose border p-detail-close text-left transition-colors hover:border-stroke-primary hover:bg-surface-always-white focus-visible:ring-stroke-active focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-text-disabled disabled:opacity-60";
const canvasClass = "min-h-0 overflow-hidden";
const canvasLaneClass = "relative flex min-h-[520px] flex-col items-center overflow-auto p-margin-relaxed";
const emptyCanvasClass = "border-stroke-primary bg-surface-secondary text-text-primary grid min-h-[180px] w-full max-w-[520px] place-items-center rounded-soft border border-dashed p-margin-relaxed text-center";
const blockBaseClass = "relative w-full max-w-[520px] cursor-pointer rounded-loose border px-detail-close py-detail-close text-text-primary transition-[border-color,box-shadow] before:absolute before:left-1/2 before:top-[-25px] before:hidden before:h-[24px] before:w-px before:-translate-x-1/2 before:bg-stroke-active focus-visible:ring-stroke-active focus-visible:ring-2 focus-visible:outline-none [&+&]:mt-detail-near [&+&]:before:block";
const selectedBlockClass = "border-stroke-active shadow-[0_0_0_1px_var(--color-stroke-active)]";
const blockActionClass = "type-meta border-stroke-secondary bg-surface-always-white text-text-primary h-6 rounded-loose border px-detail-next disabled:cursor-not-allowed disabled:text-text-disabled";

export function WorkflowWorkspaceShell({ eyebrow, title, description, actions, left, center, right, bottom, notices }: { eyebrow: string; title: string; description: ReactNode; actions?: ReactNode; left: ReactNode; center: ReactNode; right: ReactNode; bottom?: ReactNode; notices?: ReactNode }) {
  return (
    <section className={shellClass}>
      <div className={topbarClass}>
        <div className="gap-detail-next grid min-w-0">
          <p className="type-meta text-text-secondary m-0">Automation <span aria-hidden>&gt;</span> <strong className="text-text-primary">{eyebrow}</strong></p>
          <h2 className="type-title text-text-primary m-0 truncate">{title}</h2>
          {typeof description === "string" ? <p className="type-body text-text-secondary m-0 max-w-3xl">{description}</p> : description}
        </div>
        {actions && <div className={cx("relative z-10", rowActionsClass)}>{actions}</div>}
      </div>
      {notices && <div className="border-stroke-secondary bg-surface-primary px-margin-tight py-detail-next grid gap-detail-next border-b">{notices}</div>}
      <div className={gridClass}>
        {center}
        {left}
        {right}
      </div>
      {bottom && <div className="bg-surface-secondary p-margin-tight pt-0">{bottom}</div>}
    </section>
  );
}

export function WorkflowBlockLibrary({ mode = "build", hasStartBlock, selectedBlock, canAddRecordTriggerEvent = true, onSelectStartBlock, onAddBlock, onAttachStamp }: { mode?: "build" | "edit"; hasStartBlock: boolean; selectedBlock: DraftWorkflowBlock | undefined; canAddRecordTriggerEvent?: boolean; onSelectStartBlock: (type: AutomationBlockType) => void; onAddBlock: (type: AutomationBlockType) => void; onAttachStamp: (parentId: string) => void }) {
  const canAddMainBlock = hasStartBlock;
  return (
    <aside className={libraryClass}>
      <div className="grid gap-detail-next">
        <strong className="type-body-em text-text-primary">Toolkit</strong>
        <p className={cx(mutedText, "m-0")}>{mode === "build" ? "Choose a sequence of blocks from the toolkit, then add logic to build your workflow." : "Add blocks to this workflow. Select a block on the canvas to configure it."}</p>
      </div>
      {mode === "build" && !hasStartBlock && <ToolkitGroup title="Start blocks">
        <LibraryCard onClick={() => onSelectStartBlock("manual_start")} title="Manual run" description="Run only when an operator starts it." />
        <LibraryCard onClick={() => onSelectStartBlock("schedule_start")} title="Schedule" description="Run repeatedly on an interval." />
        <LibraryCard onClick={() => onSelectStartBlock("gpio_event_start")} title="GPIO input event" description="Start from a configured GPIO input device." />
        <LibraryCard onClick={() => onSelectStartBlock("webhook_event_start")} title="Webhook received" description="Start when JSON arrives at a webhook URL." />
        <LibraryCard onClick={() => onSelectStartBlock("mqtt_event_start")} title="MQTT message received" description="Start when JSON arrives on an MQTT topic." />
      </ToolkitGroup>}
      {mode === "build" && hasStartBlock && <p className={cx(mutedText, "m-0")}>Start block selected. Data and logic blocks can now be added.</p>}
      <ToolkitGroup title="Data blocks">
        <LibraryCard disabled={!canAddMainBlock || !canAddRecordTriggerEvent} onClick={() => onAddBlock("record_trigger_event")} title="Record trigger event" description="Store the trigger payload as data." />
        <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("fetch_data_source")} title="Fetch data source" description="Read a configured source such as HTTP JSON or BME sensor." />
        <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("capture_camera")} title="Capture camera" description="Capture media from a configured Raspberry Pi Camera." />
        <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("set_variable")} title="Add variable" description="Save a value for later blocks." />
      </ToolkitGroup>
      <ToolkitGroup title="Logic blocks">
        <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("if_payload_field_equals")} title="If field matches" description="Stop unless a trigger field or variable matches." />
        <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("wait")} title="Wait" description="Pause before the next block." />
      </ToolkitGroup>
      <ToolkitGroup title="Action blocks">
        <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("show_preview")} title="Show preview" description="Display a message, JSON, link, or image in the Pi UI." />
        <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("control_output")} title="Control device" description="Send a command to a configured output target." />
        <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("send_transaction")} title="Send payment" description="Send funds to a saved recipient." />
      </ToolkitGroup>
      <ToolkitGroup title="Attached actions">
        <LibraryCard disabled={!selectedBlock || !isDataBlock(selectedBlock.type) || Boolean(selectedBlock.attachedBlocks?.some((block) => block.type === "stamp_integritas"))} onClick={() => selectedBlock && onAttachStamp(selectedBlock.id)} title="Stamp data" description="Create an Integritas proof for recorded or fetched data." />
      </ToolkitGroup>
    </aside>
  );
}

function ToolkitGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className={libraryGroupClass}><strong className={libraryGroupTitleClass}>{title}<span aria-hidden>⌄</span></strong>{children}</div>;
}

function LibraryCard({ title, description, disabled, onClick }: { title: string; description: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className={libraryCardClass} disabled={disabled} onClick={onClick}><span className="type-body-em">{title}</span><small className="type-meta text-text-secondary">{description}</small></button>;
}

export function WorkflowCanvas({ mode, blocks, sources, selectedBlockId, statusLabel, statusGood, dimmed = false, validationByBlockId = {}, runtimeByBlockId = {}, onSelectBlock, onMoveBlock, onRemoveBlock }: { mode: WorkflowCanvasMode; blocks: WorkflowCanvasBlock[]; sources: DataSource[]; selectedBlockId: string; statusLabel: string; statusGood: boolean; dimmed?: boolean; validationByBlockId?: Record<string, WorkflowCanvasValidationIssue[]>; runtimeByBlockId?: Record<string, WorkflowCanvasRuntimeState>; onSelectBlock: (id: string) => void; onMoveBlock: (id: string, direction: -1 | 1) => void; onRemoveBlock: (id: string) => void }) {
  const isBuild = mode === "build";
  const actionLabels = isBuild ? { up: "Up", down: "Down", remove: "Remove" } : { up: "Move up", down: "Move down", remove: "Remove" };
  return (
    <section className={canvasClass}>
      <div className="sr-only">
        <h3>{isBuild ? "Draft canvas" : "Workflow canvas"}</h3>
        <p>{isBuild ? "This is the starter chain that will be created." : "Select a block to edit or inspect it. Move and remove actions apply immediately."}</p>
      </div>
      <div className={cx(canvasLaneClass, dimmed && "after:bg-overlay-light after:pointer-events-none after:absolute after:inset-0 after:z-20")}>
        <div className="absolute right-margin-tight top-margin-tight z-10">
          <Pill tone={statusPillClass(statusGood)}>{statusLabel}</Pill>
        </div>
        {blocks.length === 0 && <div className={emptyCanvasClass}><div className="grid gap-detail-next"><span className="type-title text-text-tertiary">+</span><strong className="type-body-em">{isBuild ? "Click from the toolkit to add a start block" : "No blocks"}</strong><p className={cx(mutedText, "m-0")}>{isBuild ? "Start with Manual, Schedule, GPIO, Webhook, or MQTT. Then add data and logic blocks." : "Add a start block by creating a new workflow."}</p></div></div>}
        {blocks.map((block, index) => (
          <WorkflowBlockCard key={block.id} block={block} index={index} sources={sources} selected={block.id === selectedBlockId} canMoveUp={index > 1} canMoveDown={index > 0 && index < blocks.length - 1} actionLabels={actionLabels} validationIssues={validationByBlockId[block.id] ?? []} runtime={runtimeByBlockId[block.id]} onSelect={() => onSelectBlock(block.id)} onMoveUp={() => onMoveBlock(block.id, -1)} onMoveDown={() => onMoveBlock(block.id, 1)} onRemove={() => onRemoveBlock(block.id)} />
        ))}
      </div>
    </section>
  );
}

function WorkflowBlockCard({ block, index, sources, selected, canMoveUp, canMoveDown, actionLabels, validationIssues, runtime, onSelect, onMoveUp, onMoveDown, onRemove }: { block: DraftWorkflowBlock; index: number; sources: DataSource[]; selected: boolean; canMoveUp: boolean; canMoveDown: boolean; actionLabels: { up: string; down: string; remove: string }; validationIssues: WorkflowCanvasValidationIssue[]; runtime?: WorkflowCanvasRuntimeState; onSelect: () => void; onMoveUp: () => void; onMoveDown: () => void; onRemove: () => void }) {
  const presentation = blockPresentation(block, sources, validationIssues, runtime);
  return (
    <div className={cx(blockBaseClass, presentation.className, selected && selectedBlockClass)} onClick={onSelect} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(); }}>
      <span className="type-meta text-text-secondary mb-detail-tight block uppercase">{index === 0 ? "Start" : "Then"}</span>
      <div className="flex items-start justify-between gap-detail-close">
        <div className="min-w-0">
          <strong className="type-body-em block text-text-primary">{presentation.title}</strong>
          <p className="type-meta text-text-primary mt-detail-tight mb-0">{presentation.description}</p>
        </div>
        <WorkflowBadges badges={presentation.badges.slice(0, 3)} />
      </div>
      {presentation.badges.length > 3 && <WorkflowBadges badges={presentation.badges.slice(3)} />}
      {block.attachedBlocks?.map((attached) => <AttachedBlockCard key={attached.id} block={attached} sources={sources} />)}
      {!block.type.endsWith("_start") && <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" className={blockActionClass} disabled={!canMoveUp} onClick={(event) => { event.stopPropagation(); onMoveUp(); }}>{actionLabels.up}</button>
        <button type="button" className={blockActionClass} disabled={!canMoveDown} onClick={(event) => { event.stopPropagation(); onMoveDown(); }}>{actionLabels.down}</button>
        <button type="button" className={blockActionClass} onClick={(event) => { event.stopPropagation(); onRemove(); }}>{actionLabels.remove}</button>
      </div>}
    </div>
  );
}

function AttachedBlockCard({ block, sources }: { block: DraftWorkflowBlock; sources: DataSource[] }) {
  const presentation = blockPresentation(block, sources, [], undefined);
  return <div className="border-stroke-secondary bg-surface-always-white mt-detail-close grid gap-detail-tight rounded-loose border p-detail-close"><strong className="type-body-em text-text-primary">{presentation.title}</strong><p className="type-meta text-text-primary m-0">{presentation.description}</p><WorkflowBadges badges={presentation.badges} /></div>;
}

function WorkflowBadges({ badges }: { badges: string[] }) {
  if (badges.length === 0) return null;
  return <div className="gap-detail-tight flex shrink-0 flex-wrap justify-end">{badges.map((badge) => <Pill key={badge}>{badge}</Pill>)}</div>;
}

function blockPresentation(block: DraftWorkflowBlock, sources: DataSource[], validationIssues: WorkflowCanvasValidationIssue[], runtime?: WorkflowCanvasRuntimeState) {
  const validationErrors = validationIssues.filter((issue) => issue.level === "error");
  const validationWarnings = validationIssues.filter((issue) => issue.level === "warning");
  const badges = capabilityBadges(block);

  if (typeof block.enabled === "boolean") badges.push(block.enabled ? "Enabled" : "Disabled");
  if (block.lastRunAt) badges.push(`Ran ${new Date(block.lastRunAt).toLocaleString()}`);
  if (block.lastError) badges.push("Error");
  if (validationErrors.length > 0) badges.push(`${validationErrors.length} validation error${validationErrors.length === 1 ? "" : "s"}`);
  if (validationWarnings.length > 0) badges.push(`${validationWarnings.length} warning${validationWarnings.length === 1 ? "" : "s"}`);
  if (runtime) badges.push(runtime.durationMs === null ? runtime.status : `${runtime.status} · ${formatDuration(runtime.durationMs)}`);
  if (runtime?.error) badges.push("Run error");

  return {
    title: draftBlockTitle(block),
    description: draftBlockDescription(block, sources),
    badges,
    className: [blockCategoryClass(block.type), validationErrors.length > 0 ? "outline outline-4 outline-offset-4 outline-red-500/50" : "", validationWarnings.length > 0 ? "outline outline-4 outline-offset-4 outline-amber-500/50" : "", runtimeClass(runtime)].filter(Boolean).join(" ")
  };
}

export function automationBlockToCanvasBlock(block: AutomationBlock, allBlocks: AutomationBlock[]): WorkflowCanvasBlock {
  return {
    id: block.id,
    type: block.type,
    config: block.config,
    enabled: block.enabled,
    lastRunAt: block.lastRunAt,
    lastError: block.lastError,
    attachedBlocks: allBlocks.filter((item) => item.parentBlockId === block.id).map((attached) => ({
      id: attached.id,
      type: attached.type,
      config: attached.config,
      enabled: attached.enabled,
      lastRunAt: attached.lastRunAt,
      lastError: attached.lastError
    }))
  };
}

function capabilityBadges(block: DraftWorkflowBlock) {
  const badges: string[] = [];
  if (block.type.endsWith("_start")) badges.push("Provides trigger event");
  if (isDataBlock(block.type)) badges.push("Provides latest data");
  if (block.type === "if_payload_field_equals") badges.push((block.config.source ?? "trigger") === "variable" ? "Reads variable" : "Reads trigger event");
  if (block.type === "stamp_integritas") badges.push("Reads parent data");
  return badges;
}

export function isDataBlock(type: AutomationBlockType) {
  return type === "record_trigger_event" || type === "fetch_data_source" || type === "capture_camera";
}

export function draftBlockTitle(block: { type: AutomationBlockType }) {
  if (block.type === "manual_start") return "Manual run";
  if (block.type === "schedule_start") return "Schedule";
  if (block.type === "gpio_event_start") return "GPIO input event";
  if (block.type === "webhook_event_start") return "Webhook received";
  if (block.type === "mqtt_event_start") return "MQTT message received";
  if (block.type === "record_trigger_event") return "Record trigger event";
  if (block.type === "fetch_data_source") return "Fetch data source";
  if (block.type === "capture_camera") return "Capture camera";
  if (block.type === "set_variable") return "Set variable";
  if (block.type === "show_preview") return "Show preview";
  if (block.type === "stamp_integritas") return "Stamp data";
  if (block.type === "control_output") return "Control device";
  if (block.type === "send_transaction") return "Send payment";
  return block.type;
}

export function draftBlockDescription(block: { type: AutomationBlockType; config: AutomationBlock["config"] }, sources: DataSource[]) {
  if (block.type === "schedule_start") return `Every ${formatInterval(Number(block.config.intervalSeconds ?? 60)).replace("Every ", "")}`;
  const sourceId = block.config.sourceId ?? block.config.targetId;
  const source = sourceId ? sources.find((item) => item.id === sourceId) : undefined;
  if (source) return `${source.name} - ${sourceLabel(source)}`;
  if (block.type === "manual_start") return "Runs only from a manual test/action.";
  if (block.type === "record_trigger_event") return "Stores the trigger payload as a data read.";
  if (block.type === "fetch_data_source") return "Fetches JSON and creates a hash.";
  if (block.type === "capture_camera") return "Captures media, hashes the file bytes, and stores capture metadata.";
  if (block.type === "set_variable") return `Save ${block.config.variableName || "a variable"} for later blocks.`;
  if (block.type === "show_preview") return `Display ${block.config.previewFormat ?? "text"} in the Automation inbox.`;
  if (block.type === "stamp_integritas") return "Stamp this data block's hash.";
  if (block.type === "control_output") return "Send a command to a configured output target.";
  if (block.type === "send_transaction") return `Send ${block.config.amount || "?"} to a saved recipient.`;
  return "Select a source in Setup.";
}

function blockCategoryClass(type: AutomationBlockType) {
  if (type.endsWith("_start")) return "border-feedback-warning bg-[#fff0c7]";
  if (type === "record_trigger_event" || type === "fetch_data_source" || type === "capture_camera") return "border-[#4f9cff] bg-[#cfe8ff]";
  if (type === "set_variable" || type === "if_payload_field_equals" || type === "wait") return "border-[#d35cff] bg-[#ead1ff]";
  if (type === "stamp_integritas") return "border-[#63c893] bg-[#bee9d4]";
  return "border-[#ff7f9b] bg-[#ffc4d3]";
}

function runtimeClass(runtime?: WorkflowCanvasRuntimeState) {
  if (!runtime) return "";
  if (runtime.status === "running") return "shadow-[0_0_0_2px_#4f9cff]";
  if (runtime.status === "success") return "shadow-[0_0_0_2px_var(--color-stroke-success)]";
  if (runtime.status === "failed") return "shadow-[0_0_0_2px_var(--color-stroke-error)]";
  if (runtime.status === "skipped") return "opacity-80";
  return "";
}

function sourceLabel(source: DataSource) {
  if (source.type === "webhook") return "Webhook receive URL";
  if (source.type === "mqtt") return `${source.config.brokerUrl ?? "MQTT broker"} ${source.config.topic ?? ""}`;
  if (source.type === "gpio-input") return `${source.config.profile === "pir-motion" ? "PIR motion " : ""}${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"}`;
  if (source.type === "gpio-output") return `${source.config.profile ?? "led"} ${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"}`;
  if (source.type === "pi-camera") return `${source.config.mode ?? "photo"} ${source.config.width ?? 1280}x${source.config.height ?? 720}`;
  return source.config.url ?? "HTTP JSON Source";
}

function formatInterval(seconds: number) {
  if (seconds < 60) return `Every ${seconds}s`;
  if (seconds < 3600) return `Every ${seconds / 60}m`;
  return `Every ${seconds / 3600}h`;
}

function formatDuration(ms: number | null) {
  if (ms === null) return "running";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
