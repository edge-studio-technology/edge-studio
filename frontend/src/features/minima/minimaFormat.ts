import type { MinimaNodeState, MinimaSyncStatus, Status } from "../../app/types";

export function formatBlockAge(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function formatNodeState(state: MinimaNodeState | null) {
  if (!state) return "—";
  if (state === "running") return "Running";
  if (state === "stopped") return "Stopped";
  if (state === "restarting") return "Restarting";
  return "Error";
}

export function formatSyncStatus(status: MinimaSyncStatus | null | undefined) {
  if (!status || status === "unavailable") return "Unavailable";
  if (status === "active") return "Active";
  if (status === "stale") return "Stale";
  return "Syncing";
}

export function nodeStateStatus(state: MinimaNodeState | null): Status {
  if (state === "running") return "success";
  if (state === "stopped") return "warning";
  if (state === "error") return "error";
  return "neutral"; // restarting | null
}

export function syncStatusTone(status: MinimaSyncStatus | null | undefined): Status {
  if (status === "active") return "success";
  if (status === "stale") return "warning";
  return "neutral"; // syncing | unavailable | null
}

export function nodeStateIsHealthy(state: MinimaNodeState | null) {
  return state === "running";
}
