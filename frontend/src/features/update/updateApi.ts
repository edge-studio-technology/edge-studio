import type { UpdateStatus, UpdateStatusSummary } from "../../app/types";
import { getJson, postJson } from "../../lib/api";

export function getUpdateStatusSummary() {
  return getJson<UpdateStatusSummary>("/update/status/summary");
}

/** Live manifest check (signature-verified), for the Update page — heavier than the cached summary above. */
export function getUpdateStatus() {
  return getJson<UpdateStatus>("/update/status");
}

/**
 * Starts the update job; callers then navigate to update-agent's own page
 * (`/update/`) to watch progress. See docs/adr/0002-update-page-split.md.
 */
export function startUpdateApply() {
  return postJson<{ status: "running" }>("/update/apply");
}
