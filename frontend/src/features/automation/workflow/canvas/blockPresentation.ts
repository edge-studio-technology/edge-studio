import type { Tone } from "../../../../app/types";
import type { AddressBookEntry } from "../../../address-book/addressBookTypes";
import type { DataSource } from "../../../data-sources/dataSourceTypes";
import type { AutomationBlock, AutomationBlockType } from "../../automationTypes";
import { blockHelp } from "../workflowBlockHelp";
import { blockSummary } from "../workflowBlockSummaries";
import type {
  DraftWorkflowBlock,
  WorkflowCanvasBlock,
  WorkflowCanvasRuntimeState,
  WorkflowCanvasValidationIssue,
} from "./types";

export type WorkflowCanvasBadge = {
  label: string;
  tone?: Tone;
  alert?: boolean;
};

export function blockPresentation(
  block: DraftWorkflowBlock,
  sources: DataSource[],
  addressBook: AddressBookEntry[],
  validationIssues: WorkflowCanvasValidationIssue[],
  runtime?: WorkflowCanvasRuntimeState,
) {
  const validationErrors = validationIssues.filter((issue) => issue.level === "error");
  const validationWarnings = validationIssues.filter((issue) => issue.level === "warning");
  const badges: WorkflowCanvasBadge[] = [];

  if (validationErrors.length > 0)
    badges.push({
      label: `${validationErrors.length} validation error${validationErrors.length === 1 ? "" : "s"}`,
      tone: "error",
      alert: true,
    });
  if (validationWarnings.length > 0)
    badges.push({
      label: `${validationWarnings.length} warning${validationWarnings.length === 1 ? "" : "s"}`,
      tone: "warn",
      alert: true,
    });
  for (const label of capabilityBadges(block)) badges.push({ label });
  // Only surface Disabled — Enabled is the default and would noise every card.
  if (block.enabled === false) badges.push({ label: "Disabled", tone: "neutral", alert: true });
  if (block.lastRunAt) badges.push({ label: `Ran ${new Date(block.lastRunAt).toLocaleString()}` });
  if (block.lastError) badges.push({ label: "Error", tone: "error", alert: true });
  if (runtime)
    badges.push({
      label:
        runtime.durationMs === null
          ? runtime.status
          : `${runtime.status} · ${formatDuration(runtime.durationMs)}`,
    });
  if (runtime?.error) badges.push({ label: "Run error", tone: "error", alert: true });

  return {
    title: draftBlockTitle(block),
    description: draftBlockDescription(block, sources, addressBook),
    badges,
    // Neutral shell for all types; category color moved to the canvas icon badge.
    className: [
      blockShellClass,
      runtimeClass(runtime),
      block.enabled === false ? "opacity-60" : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function automationBlockToCanvasBlock(
  block: AutomationBlock,
  allBlocks: AutomationBlock[],
): WorkflowCanvasBlock {
  return {
    id: block.id,
    type: block.type,
    config: block.config,
    enabled: block.enabled,
    lastRunAt: block.lastRunAt,
    lastError: block.lastError,
    attachedBlocks: allBlocks
      .filter((item) => item.parentBlockId === block.id)
      .map((attached) => ({
        id: attached.id,
        type: attached.type,
        config: attached.config,
        enabled: attached.enabled,
        lastRunAt: attached.lastRunAt,
        lastError: attached.lastError,
      })),
  };
}

export function isDataBlock(type: AutomationBlockType) {
  return (
    type === "record_trigger_event" || type === "fetch_data_source" || type === "capture_camera"
  );
}

export function draftBlockTitle(block: { type: AutomationBlockType }) {
  return blockHelp(block.type).title;
}

export function draftBlockDescription(
  block: { type: AutomationBlockType; config: AutomationBlock["config"] },
  sources: DataSource[],
  addressBook: AddressBookEntry[] = [],
) {
  return blockSummary(block, { sources, addressBook }).sentence;
}

function capabilityBadges(block: DraftWorkflowBlock) {
  const badges: string[] = [];
  if (block.type.endsWith("_start")) badges.push("Provides trigger event");
  if (isDataBlock(block.type)) badges.push("Provides latest data");
  if (block.type === "if_payload_field_equals")
    badges.push(
      (block.config.source ?? "trigger") === "variable" ? "Reads variable" : "Reads trigger event",
    );
  if (block.type === "stamp_integritas") badges.push("Reads parent data");
  return badges;
}

/** Shared neutral chrome — category is conveyed by icons, not fill color. */
export const blockShellClass = "border-stroke-primary bg-surface-always-white";

function runtimeClass(runtime?: WorkflowCanvasRuntimeState) {
  if (!runtime) return "";
  if (runtime.status === "running") return "shadow-[0_0_0_2px_#4f9cff]";
  if (runtime.status === "success") return "shadow-[0_0_0_2px_var(--color-stroke-success)]";
  if (runtime.status === "failed") return "shadow-[0_0_0_2px_var(--color-stroke-error)]";
  if (runtime.status === "skipped") return "opacity-80";
  return "";
}

function formatDuration(ms: number | null) {
  if (ms === null) return "running";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
