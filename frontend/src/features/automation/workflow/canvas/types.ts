import type { AutomationBlock, AutomationBlockType } from "../../automationTypes";

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
