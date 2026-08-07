import type { Tone } from "../../app/types";
import type { AutomationRun } from "./automationTypes";

export const RUN_STATUS: Record<AutomationRun["status"], { tone: Tone; label: string }> = {
  success: { tone: "good", label: "Success" },
  failed: { tone: "error", label: "Failed" },
  running: { tone: "neutral", label: "Running" },
};

export function formatRunDuration(ms: number | null) {
  if (ms === null) return "Running";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
