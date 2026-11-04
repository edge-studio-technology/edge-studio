import { getJson, postJson } from "../../lib/api";

type RetentionSettings = {
  automaticCleanupEnabled: boolean;
  runsPerWorkflow: number;
  deletedWorkflowRunDays: number;
  dataSourceReadDays: number;
  diskWarningPercent: number;
  inboxRetentionDays: number | null;
};
type RetentionCounts = {
  automationRuns: number;
  automationBlockRuns: number;
  dataSourceReads: number;
  automationInboxItems: number;
};
export type RetentionPreview = {
  settings: RetentionSettings;
  eligible: RetentionCounts;
  scheduled: RetentionCounts;
  previewToken: string;
};
export type RetentionResponse = RetentionPreview & {
  limits: Record<
    Exclude<keyof RetentionSettings, "automaticCleanupEnabled">,
    { min: number; max: number }
  >;
  diskUsage: { usedPercent: number; warning: boolean } | null;
};

export function getRetentionSettings() {
  return getJson<RetentionResponse>("/api/retention/settings");
}
export function previewRetentionSettings(settings: RetentionSettings) {
  return postJson<RetentionPreview>("/api/retention/settings/preview", settings);
}
export function saveRetentionSettings(proposal: RetentionPreview) {
  return postJson<RetentionPreview>("/api/retention/settings", {
    settings: proposal.settings,
    previewToken: proposal.previewToken,
    confirmed: true,
  });
}
