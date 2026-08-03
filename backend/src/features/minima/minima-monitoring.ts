import { env } from "../../config/env.js";
import type { MinimaNodeState, MinimaNodeStatus } from "./minima.types.js";

export type MinimaMonitoringSnapshot = {
  lastPollerCheckAt: string | null;
  lastStallDetectedAt: string | null;
  lastAutoResyncAt: string | null;
  lastAutoResyncResult: string | null;
  lastNodeState: MinimaNodeState | "unknown";
};

const snapshot: MinimaMonitoringSnapshot = {
  lastPollerCheckAt: null,
  lastStallDetectedAt: null,
  lastAutoResyncAt: null,
  lastAutoResyncResult: null,
  lastNodeState: "unknown"
};

type MinimaStatusForMonitoring = Pick<MinimaNodeStatus, "state" | "sync">;

export function detectStall(status: MinimaStatusForMonitoring) {
  return (
    status.state === "running" &&
    status.sync.blockAgeSeconds !== null &&
    status.sync.blockAgeSeconds > env.minimaStallBlockAgeSeconds
  );
}

export function getMinimaMonitoringSnapshot(): MinimaMonitoringSnapshot {
  return { ...snapshot };
}

export function buildMinimaMonitoring(status: MinimaStatusForMonitoring) {
  const pollerSnapshot = getMinimaMonitoringSnapshot();
  return {
    stallDetected: detectStall(status),
    stallThresholdSeconds: env.minimaStallBlockAgeSeconds,
    autoResyncEnabled: env.minimaAutoResync,
    ...pollerSnapshot
  };
}

export function recordPollerCheck(checkedAt: string, state: MinimaMonitoringSnapshot["lastNodeState"]) {
  snapshot.lastPollerCheckAt = checkedAt;
  snapshot.lastNodeState = state;
}

export function recordStallDetected() {
  snapshot.lastStallDetectedAt = new Date().toISOString();
}

export function recordAutoResync(result: string) {
  snapshot.lastAutoResyncAt = new Date().toISOString();
  snapshot.lastAutoResyncResult = result;
}

export function canAutoResync() {
  if (!snapshot.lastAutoResyncAt) return true;
  const cooldownMs = env.minimaAutoResyncCooldownMinutes * 60 * 1000;
  return Date.now() - new Date(snapshot.lastAutoResyncAt).getTime() >= cooldownMs;
}

export type MinimaOperationType = "restart" | "resync" | "backup" | "restore";

// Must exceed the longest operation's real duration (restart's graceful wait, see
// docs/adr/0001-minima-graceful-node-restart.md) or the UI drops back to "error" mid-operation.
const MINIMA_OPERATION_MAX_WINDOW_MS = 6 * 60 * 1000;

let currentOperation: { type: MinimaOperationType; startedAt: number } | null = null;

export class MinimaOperationConflictError extends Error {
  constructor(inProgressType: MinimaOperationType) {
    super(`A Minima ${inProgressType} is already in progress`);
  }
}

export function beginMinimaOperation(type: MinimaOperationType) {
  if (isMinimaOperationInProgress()) {
    throw new MinimaOperationConflictError(currentOperation!.type);
  }
  currentOperation = { type, startedAt: Date.now() };
}

export function endMinimaOperation() {
  currentOperation = null;
}

export function isMinimaOperationInProgress(): boolean {
  if (!currentOperation) return false;
  if (Date.now() - currentOperation.startedAt > MINIMA_OPERATION_MAX_WINDOW_MS) {
    currentOperation = null;
    return false;
  }
  return true;
}
