import { createHash } from "node:crypto";
import { statfsSync } from "node:fs";
import { env } from "../../config/env.js";
import { db } from "../../db/database.js";
import { recordAuditEvent } from "../auth/audit.service.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";
import { previewConfiguredRetention } from "./retention.repository.js";

export type RetentionSettings = {
  automaticCleanupEnabled: boolean;
  runsPerWorkflow: number;
  deletedWorkflowRunDays: number;
  dataSourceReadDays: number;
  diskWarningPercent: number;
  inboxRetentionDays: number | null;
};

export const RETENTION_LIMITS = {
  runsPerWorkflow: { min: 50, max: 10000 },
  deletedWorkflowRunDays: { min: 7, max: 3650 },
  dataSourceReadDays: { min: 7, max: 3650 },
  diskWarningPercent: { min: 50, max: 95 },
  inboxRetentionDays: { min: 7, max: 3650 },
} as const;

const defaults: RetentionSettings = {
  automaticCleanupEnabled: false,
  runsPerWorkflow: 500,
  deletedWorkflowRunDays: 90,
  dataSourceReadDays: 90,
  diskWarningPercent: 80,
  inboxRetentionDays: null,
};
const settingKey = "retention_settings";

export class RetentionValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Check the retention settings.");
  }
}

export class RetentionPreviewConflict extends Error {
  constructor() {
    super("The policy or eligible record counts changed. Review a fresh preview before saving.");
  }
}

function validateRetentionSettings(input: unknown): RetentionSettings {
  const value = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  for (const [key, range] of Object.entries(RETENTION_LIMITS)) {
    const number = value[key];
    if (key === "inboxRetentionDays" && number === null) continue;
    if (
      typeof number !== "number" ||
      !Number.isInteger(number) ||
      number < range.min ||
      number > range.max
    )
      errors[key] = `Enter a whole number from ${range.min} to ${range.max}.`;
  }
  if (typeof value.automaticCleanupEnabled !== "boolean")
    errors.automaticCleanupEnabled = "Choose whether automatic cleanup is enabled.";
  if (Object.keys(errors).length) throw new RetentionValidationError(errors);
  return {
    automaticCleanupEnabled: value.automaticCleanupEnabled as boolean,
    runsPerWorkflow: value.runsPerWorkflow as number,
    deletedWorkflowRunDays: value.deletedWorkflowRunDays as number,
    dataSourceReadDays: value.dataSourceReadDays as number,
    diskWarningPercent: value.diskWarningPercent as number,
    inboxRetentionDays: value.inboxRetentionDays as number | null,
  };
}

export function getRetentionSettings(): RetentionSettings {
  const stored = getSetting(settingKey);
  return stored
    ? validateRetentionSettings({ inboxRetentionDays: null, ...JSON.parse(stored) })
    : { ...defaults };
}

export function previewRetentionSettings(input: unknown) {
  const settings = validateRetentionSettings(input);
  return db.transaction(() => {
    const previous = getRetentionSettings();
    const eligible = previewConfiguredRetention(settings);
    const scheduled = {
      automationRuns: settings.automaticCleanupEnabled ? eligible.automationRuns : 0,
      automationBlockRuns: settings.automaticCleanupEnabled ? eligible.automationBlockRuns : 0,
      dataSourceReads: settings.automaticCleanupEnabled ? eligible.dataSourceReads : 0,
      automationInboxItems: eligible.automationInboxItems,
    };
    const previewToken = createHash("sha256")
      .update(JSON.stringify({ settings, previous, scheduled }))
      .digest("hex");
    return { settings, eligible, scheduled, previewToken };
  })();
}

export function saveRetentionSettings(
  input: unknown,
  previewToken: unknown,
  confirmed: unknown,
  userId?: string,
) {
  const settings = validateRetentionSettings(input);
  if (confirmed !== true)
    throw new RetentionValidationError({
      confirmed: "Review and confirm the retention policy before saving.",
    });
  return db
    .transaction(() => {
      const previous = getRetentionSettings();
      const proposal = previewRetentionSettings(settings);
      if (typeof previewToken !== "string" || previewToken !== proposal.previewToken)
        throw new RetentionPreviewConflict();
      saveSetting(settingKey, JSON.stringify(settings));
      recordAuditEvent("retention.settings_changed", {
        userId,
        detail: JSON.stringify({ previous, settings, scheduled: proposal.scheduled }),
      });
      return proposal;
    })
    .immediate();
}

export function getRetentionDiskUsage(threshold: number) {
  try {
    const disk = statfsSync(env.dataDir);
    if (disk.blocks <= 0) return null;
    const usedPercent = ((disk.blocks - disk.bfree) / disk.blocks) * 100;
    return { usedPercent, warning: usedPercent >= threshold };
  } catch {
    return null;
  }
}
