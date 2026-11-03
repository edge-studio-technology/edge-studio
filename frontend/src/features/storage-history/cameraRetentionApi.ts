import { getJson, postJson } from "../../lib/api";

type CameraRetentionSettings = { retentionDays: number | null; paused: boolean };
export type CameraRetentionPreview = {
  settings: CameraRetentionSettings;
  camera: { enabled: boolean; available: boolean; fileCount: number; bytes: number };
  eligible: { fileCount: number; bytes: number };
  scheduled: { fileCount: number; bytes: number };
  previewToken: string;
};
export type CameraRetentionResponse = CameraRetentionPreview & {
  limits: { min: number; max: number };
};

export function getCameraRetention() {
  return getJson<CameraRetentionResponse>("/api/retention/camera");
}
export function previewCameraRetention(settings: CameraRetentionSettings) {
  return postJson<CameraRetentionPreview>("/api/retention/camera/preview", settings);
}
export function saveCameraRetention(proposal: CameraRetentionPreview) {
  return postJson<CameraRetentionPreview>("/api/retention/camera", {
    settings: proposal.settings,
    previewToken: proposal.previewToken,
    confirmed: true,
  });
}
