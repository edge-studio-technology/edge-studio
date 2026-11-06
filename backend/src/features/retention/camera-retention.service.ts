import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env.js";
import { db } from "../../db/database.js";
import { getActiveAutomationRunIds } from "../automation/automationRuns.repository.js";
import { recordAuditEvent } from "../auth/audit.service.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";
import { RetentionPreviewConflict, RetentionValidationError } from "./retention-settings.service.js";

type CameraRetentionSettings = { retentionDays: number | null; paused: boolean };
const key = "camera_retention_settings";
export const CAMERA_RETENTION_LIMITS = { min: 1, max: 3650 };

function validate(input: unknown): CameraRetentionSettings {
  const value = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (value.retentionDays !== null && (typeof value.retentionDays !== "number" ||
    !Number.isInteger(value.retentionDays) || value.retentionDays < CAMERA_RETENTION_LIMITS.min ||
    value.retentionDays > CAMERA_RETENTION_LIMITS.max)) {
    throw new RetentionValidationError({ retentionDays: "Choose keep forever or a whole number from 1 to 3650 days." });
  }
  if (typeof value.paused !== "boolean")
    throw new RetentionValidationError({ paused: "Choose whether camera cleanup is paused." });
  return { retentionDays: value.retentionDays as number | null, paused: value.paused };
}

export function getCameraRetentionSettings(): CameraRetentionSettings {
  const stored = getSetting(key);
  if (stored) return validate(JSON.parse(stored));
  const legacy = env.cameraRetentionDays;
  const settings = {
    retentionDays: Number.isInteger(legacy) && legacy >= 1 && legacy <= 3650 ? legacy : null,
    paused: true,
  };
  saveSetting(key, JSON.stringify(settings));
  return settings;
}

export function pauseCameraRetention(userId?: string) {
  db.transaction(() => {
    const previous = getCameraRetentionSettings();
    if (previous.paused) return;
    const settings = { ...previous, paused: true };
    saveSetting(key, JSON.stringify(settings));
    recordAuditEvent("camera.retention_paused", { userId, detail: JSON.stringify({ previous, settings }) });
  }).immediate();
}

// See ADR 0022 for the synchronous proof-link/deletion boundary.
function inspectCaptures(settings: CameraRetentionSettings, now: number) {
  const root = path.resolve(env.cameraCaptureDir);
  const files: { name: string; size: number; mtimeMs: number }[] = [];
  let available = true;
  try {
    if (!fs.lstatSync(root).isDirectory() || fs.realpathSync(root) !== root)
      return { files, candidates: [], available: false };
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(jpg|jpeg|h264)$/i.test(entry.name)) continue;
      const stat = fs.lstatSync(path.join(root, entry.name));
      if (stat.isFile()) files.push({ name: entry.name, size: stat.size, mtimeMs: stat.mtimeMs });
    }
  } catch (error) {
    available = (error as NodeJS.ErrnoException).code === "ENOENT" && !fs.existsSync(root);
    return { files, candidates: [], available };
  }
  const protectedPaths = new Set<string>();
  const reads = db.prepare("SELECT preview_json FROM data_source_reads WHERE integritas_proof_id IS NOT NULL").all() as { preview_json: string | null }[];
  for (const read of reads) {
    try {
      if (read.preview_json === null) return { files, candidates: [], available: false };
      const preview = JSON.parse(read.preview_json) as { source?: string; path?: string } | null;
      if (preview?.source === "pi-camera-helper") {
        if (typeof preview.path !== "string") return { files, candidates: [], available: false };
        protectedPaths.add(path.resolve(preview.path));
      }
    } catch {
      return { files, candidates: [], available: false };
    }
  }
  // Active-workflow file protection follows ADR 0022.
  const cutoff = settings.retentionDays === null ? -Infinity : now - settings.retentionDays * 86400000;
  const candidates = getActiveAutomationRunIds().length ? [] : files.filter((file) =>
    file.mtimeMs < cutoff && !protectedPaths.has(path.join(root, file.name)));
  candidates.sort((a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name));
  return { files, candidates, available };
}

export function previewCameraRetention(input: unknown, now = Date.now()) {
  const settings = validate(input);
  const previous = getCameraRetentionSettings();
  const inspected = inspectCaptures(settings, now);
  const enabled = env.cameraEnabled;
  const active = enabled && !settings.paused && settings.retentionDays !== null;
  const scheduled = active && inspected.available ? inspected.candidates : [];
  const summary = (files: { size: number }[]) => ({ fileCount: files.length, bytes: files.reduce((sum, file) => sum + file.size, 0) });
  return {
    settings,
    camera: { enabled, available: inspected.available, ...summary(inspected.files) },
    eligible: summary(inspected.candidates),
    scheduled: summary(scheduled),
    previewToken: createHash("sha256").update(JSON.stringify({ settings, previous, enabled, available: inspected.available, scheduled })).digest("hex"),
  };
}

export function saveCameraRetention(input: unknown, previewToken: unknown, confirmed: unknown, userId?: string) {
  const settings = validate(input);
  if (confirmed !== true) throw new RetentionValidationError({ confirmed: "Preview and confirm camera retention first." });
  if (!env.cameraEnabled && !settings.paused)
    throw new RetentionValidationError({ paused: "Camera support is disabled; cleanup must remain paused." });
  return db.transaction(() => {
    const previous = getCameraRetentionSettings();
    const proposal = previewCameraRetention(settings);
    if (previewToken !== proposal.previewToken) throw new RetentionPreviewConflict();
    saveSetting(key, JSON.stringify(settings));
    recordAuditEvent("camera.retention_changed", {
      userId, detail: JSON.stringify({ previous, settings, scheduled: proposal.scheduled }),
    });
    return proposal;
  }).immediate();
}

export function pruneCameraCaptures(batchSize = 500, now = Date.now()) {
  if (!env.cameraEnabled) {
    pauseCameraRetention();
    return 0;
  }
  const settings = getCameraRetentionSettings();
  if (settings.paused || settings.retentionDays === null) return 0;
  const inspected = inspectCaptures(settings, now);
  if (!inspected.available) return 0;
  let deleted = 0;
  for (const file of inspected.candidates.slice(0, batchSize)) {
    try {
      fs.unlinkSync(path.join(env.cameraCaptureDir, file.name));
      deleted += 1;
    } catch {
      // Retry files that could not be removed on the next sweep.
    }
  }
  return deleted;
}
