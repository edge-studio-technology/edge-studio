import { env } from "../config/env.js";
import { recordAppliedManifest } from "../manifest/manifest-state.js";
import { getUpdateStatus } from "../status/status.service.js";
import { launchSelfUpdate } from "../self-update/self-update.service.js";
import { updateService } from "./service-update.js";
import type { ServiceUpdateResult } from "./update.types.js";

// How long a dry run stays "running" before resolving — long enough for the
// waitroom page's poll loop to observe at least one "running" state.
const DRY_RUN_DELAY_MS = 4000;

export async function applyUpdates(): Promise<ServiceUpdateResult[]> {
  const { manifest, services } = await getUpdateStatus();

  if (env.dryRun) {
    console.warn("[update-agent] UPDATE_DRY_RUN is set — simulating apply, no containers will be pulled or swapped");
    await new Promise((resolve) => setTimeout(resolve, DRY_RUN_DELAY_MS));
    // Mirrors the real loop below: update-agent itself never appears in
    // results (self-update is separate and skipped entirely here), and the
    // manifest is deliberately never recorded as applied — see
    // docs/adr/0003-update-dry-run.md for why that's the point, not a bug.
    return services
      .filter((status) => status.service !== "update-agent")
      .map((status) => ({
        service: status.service,
        updated: !status.upToDate,
        reason: status.upToDate ? "already up to date" : "dry run — no changes applied"
      }));
  }

  const results: ServiceUpdateResult[] = [];

  for (const status of services) {
    // update-agent doesn't go through the generic pull/health-check/swap loop
    // — it updates itself via a separate ephemeral orchestrator, launched
    // after everything else here has finished (see below).
    if (status.service === "update-agent") continue;

    if (status.upToDate) {
      results.push({ service: status.service, updated: false, reason: "already up to date" });
      continue;
    }

    console.log(`[update-agent] ${status.service}: updating to ${status.targetImage}`);

    const result = await updateService(status.service, status.targetImage);

    console.log(`[update-agent] ${status.service}: ${result.updated ? "updated" : "not updated"} — ${result.reason}`);

    results.push(result);
  }

  // Only record the manifest as applied if nothing failed — a partial
  // failure must remain retryable against the same manifest.
  const anyFailed = results.some((result) => !result.updated && result.reason !== "already up to date");
  if (!anyFailed) {
    await recordAppliedManifest(manifest.createdAt, manifest.version);
  }

  // Fire-and-forget: launched after everything else succeeds, runs
  // independently of this request/job (it may end up killing this very
  // process). Failures are logged by the orchestrator itself and surface as
  // a stuck "not up to date" update-agent entry in the status list, not as a
  // failure of this apply job.
  if (!anyFailed) {
    void launchSelfUpdate(manifest.updateAgent).catch((error) => {
      console.error("[update-agent] self-update launch failed:", error);
    });
  }

  return results;
}
