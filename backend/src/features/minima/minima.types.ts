import type { StructuredError } from "../../shared/structured-error.js";

export type MinimaNodeState = "running" | "stopped" | "error" | "restarting";
export type MinimaSyncStatus = "active" | "stale" | "syncing" | "unavailable";

export type MinimaResyncPhase = "starting" | "in_progress" | "recovering" | "completed" | "failed" | "unconfirmed";
export type MinimaResyncTrigger = "manual" | "console" | "auto";
export type MinimaResyncOperation = {
  id: string;
  phase: MinimaResyncPhase;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  outcome: "completed" | "failed" | "unconfirmed" | null;
  recovered: boolean;
  busy: boolean;
  message: string;
  events: { at: string; phase: MinimaResyncPhase; message: string; errorDetails?: StructuredError }[];
  errorDetails: StructuredError | null;
};

export type MinimaNodeStatus = {
  resync?: Pick<MinimaResyncOperation, "id" | "phase" | "startedAt" | "updatedAt" | "finishedAt" | "outcome" | "recovered" | "busy"> | null;
  checkedAt: string;
  state: MinimaNodeState;
  container: {
    state: string;
    status: string;
    cpuPercent: number | null;
    memory: { usage: string | null; limit: string | null } | null;
  } | null;
  rpc: {
    ok: boolean;
    error?: string;
    raw?: unknown;
  };
  sync: {
    synced: boolean | null;
    status: MinimaSyncStatus;
    block: number | null;
    blockTime: string | null;
    blockAgeSeconds: number | null;
  };
  health: {
    peerCount: number | null;
    peersKnown: number | null;
  };
  node: {
    memoryRam: string | null;
    memoryDisk: string | null;
  };
  storage: {
    dataPath: string;
    containerDisk: string | null;
    chainDataDisk: string | null;
  };
  config: {
    megammrHost: string;
    megammrHostSource: "database" | "default";
  };
  monitoring: {
    stallDetected: boolean;
    stallThresholdSeconds: number;
    autoResyncEnabled: boolean;
    lastPollerCheckAt: string | null;
    lastStallDetectedAt: string | null;
    lastAutoResyncAt: string | null;
    lastAutoResyncResult: string | null;
  };
};
