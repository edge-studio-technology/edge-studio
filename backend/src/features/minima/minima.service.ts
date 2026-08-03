import { getBoolSetting, getSetting, saveSetting, setBoolSetting } from "../settings/settings.repository.js";
import { getMinimaContainerStats, getMinimaStorageInfo } from "./minima.docker.js";
import {
  beginMinimaOperation,
  buildMinimaMonitoring,
  endMinimaOperation,
  isMinimaOperationInProgress
} from "./minima-monitoring.js";
import {
  deriveSyncStatus,
  normalizePeerslist,
  parseBlockCommandResponse,
  parsePeersListResponse,
  parsePeersResponse,
  parseStatusResponse
} from "./minima.parse.js";
import { fetchMinimaStatus, runMinimaPathCommand } from "./minima.rpc.js";
import {
  getContainerRestartBaseline,
  restartComposeService,
  startComposeService,
  waitForContainerRestart,
  type ContainerRestartBaseline
} from "../status/docker.control.js";
import { getComposeServiceContainer } from "../status/docker.service.js";
import { normalizeMinimaRpcError } from "./minima.errors.js";
import type { MinimaNodeState, MinimaNodeStatus } from "./minima.types.js";

const megammrHostSetting = "minima_megammr_host";
const defaultMegammrHost = "megammr.minima.global:9001";

export function getMinimaConfig() {
  const storedMegammrHost = getSetting(megammrHostSetting).trim();
  return {
    megammrHost: storedMegammrHost || defaultMegammrHost,
    megammrHostSource: storedMegammrHost ? ("database" as const) : ("default" as const)
  };
}

export function saveMinimaConfig({ megammrHost }: { megammrHost: string }) {
  const trimmedMegammrHost = megammrHost.trim();
  if (!trimmedMegammrHost) throw new Error("megammrHost is required");
  saveSetting(megammrHostSetting, trimmedMegammrHost);
  return getMinimaConfig();
}

function deriveNodeState(
  container: { state: string } | null,
  rpcReachable: boolean,
  rpcOk: boolean
): MinimaNodeState {
  if (container && container.state !== "running") return "stopped";
  if (!rpcReachable || !rpcOk) return "error";
  return "running";
}

function applyOperationOverride(state: MinimaNodeState): MinimaNodeState {
  if (state === "running") {
    endMinimaOperation();
    return state;
  }
  return isMinimaOperationInProgress() ? "restarting" : state;
}

function emptyNodeStatusFields() {
  return {
    sync: { synced: null, status: "unavailable" as const, block: null, blockTime: null, blockAgeSeconds: null },
    health: { peerCount: null, peersKnown: null },
    node: { memoryRam: null, memoryDisk: null }
  };
}

export async function getMinimaNodeStatus(): Promise<MinimaNodeStatus> {
  const checkedAt = new Date().toISOString();
  const config = getMinimaConfig();

  const [containerStats, rpcResult] = await Promise.all([
    getMinimaContainerStats().catch(() => null),
    fetchMinimaStatus().catch((error) => ({
      failed: true as const,
      error: normalizeMinimaRpcError(error instanceof Error ? error.message : "Unknown error")
    }))
  ]);

  if ("failed" in rpcResult) {
    const state = applyOperationOverride(
      containerStats && containerStats.state !== "running" ? "stopped" : "error"
    );
    const empty = emptyNodeStatusFields();
    const status = {
      checkedAt,
      state,
      container: containerStats
        ? {
            state: containerStats.state,
            status: containerStats.status,
            cpuPercent: containerStats.cpuPercent,
            memory: containerStats.memory
          }
        : null,
      rpc: { ok: false, error: rpcResult.error },
      ...empty,
      storage: getMinimaStorageInfo(containerStats?.containerDisk),
      config
    };
    return { ...status, monitoring: buildMinimaMonitoring(status) };
  }

  const parsed = parseStatusResponse(rpcResult.body);
  let { block, blockTime, blockAgeSeconds, syncStatus } = parsed;
  let synced = parsed.synced;
  let peerCount = parsed.peerCount;
  let peersKnown: number | null = null;

  if (blockAgeSeconds === null && parsed.rpcOk && block !== null) {
    try {
      const blockResult = await runMinimaPathCommand("block");
      const blockParsed = parseBlockCommandResponse(blockResult.body);
      if (blockParsed.blockAgeSeconds !== null) {
        blockTime = blockParsed.blockTime;
        blockAgeSeconds = blockParsed.blockAgeSeconds;
      }
      if (block === null && blockParsed.block !== null) block = blockParsed.block;
    } catch {
      // Keep status-derived values only.
    }
  }

  if (peerCount === null && parsed.rpcOk) {
    try {
      const peersResult = await runMinimaPathCommand("peers");
      peersKnown = parsePeersResponse(peersResult.body);
      if (peerCount === null) peerCount = peersKnown;
    } catch {
      peersKnown = null;
    }
  }

  const sync = deriveSyncStatus({ rpcOk: parsed.rpcOk, blockAgeSeconds });
  synced = sync.synced;
  syncStatus = sync.status;

  const rpcReachable = rpcResult.ok;
  const state = applyOperationOverride(deriveNodeState(containerStats, rpcReachable, parsed.rpcOk));

  const status = {
    checkedAt,
    state,
    container: containerStats
      ? {
          state: containerStats.state,
          status: containerStats.status,
          cpuPercent: containerStats.cpuPercent,
          memory: containerStats.memory
        }
      : null,
    rpc: {
      ok: rpcReachable && parsed.rpcOk,
      error: !rpcReachable ? `HTTP ${rpcResult.status}` : parsed.rpcOk ? undefined : "Minima RPC returned status: false",
      raw: rpcResult.body
    },
    sync: {
      synced,
      status: syncStatus,
      block,
      blockTime,
      blockAgeSeconds
    },
    health: { peerCount, peersKnown },
    node: {
      memoryRam: parsed.nodeMemory.ram,
      memoryDisk: parsed.nodeMemory.disk
    },
    storage: getMinimaStorageInfo(containerStats?.containerDisk, {
      dataPath: parsed.dataPath,
      chainDataDisk: parsed.nodeMemory.disk
    }),
    config
  };

  return { ...status, monitoring: buildMinimaMonitoring(status) };
}

export async function getWalletBalance() {
  return runMinimaPathCommand("balance");
}

export async function resyncMegammr() {
  const { megammrHost } = getMinimaConfig();
  const command = `megammrsync action:resync host:${megammrHost}`;
  beginMinimaOperation("resync");
  try {
    return await runMinimaPathCommand(command, 30000);
  } catch (error) {
    endMinimaOperation();
    throw error;
  }
}

export async function getMinimaPeers() {
  const result = await runMinimaPathCommand("peers");
  const parsed = parsePeersListResponse(result.body);
  return {
    ok: result.ok && parsed.count !== null,
    source: result.source,
    command: result.command,
    count: parsed.count,
    peers: parsed.peers,
    body: result.body
  };
}

export async function addMinimaPeers(peerslist: string) {
  const normalized = normalizePeerslist(peerslist);
  const command = `peers action:addpeers peerslist:${normalized}`;
  return runMinimaPathCommand(command);
}

const autoRestartSetting = "minima_auto_restart_enabled";

// Checked by minima-backup-scheduler.service.ts's nightly tick, not a standalone timer —
// see the "reuse the scheduler" note there.
export function getAutoRestartEnabled() {
  return getBoolSetting(autoRestartSetting);
}

export function setAutoRestartEnabled(enabled: boolean) {
  setBoolSetting(autoRestartSetting, enabled);
  return { autoRestartEnabled: enabled };
}

// See docs/adr/0001-minima-graceful-node-restart.md for why this is 5 minutes, not seconds.
const MINIMA_GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5 * 60 * 1000;
const MINIMA_GRACEFUL_SHUTDOWN_POLL_MS = 1000;

async function performGracefulRestart(containerId: string, baseline: ContainerRestartBaseline) {
  try {
    // `quit` has no dedicated console catalog entry (see .claude/rules/minima.md) — narrow,
    // wrapped internal use only, never a raw whitelist-able console command.
    await runMinimaPathCommand("quit compact:true", 5000);
  } catch {
    // Expected: the node closes the RPC connection as part of shutting down.
  }

  const cycled = await waitForContainerRestart(
    containerId,
    baseline,
    MINIMA_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
    MINIMA_GRACEFUL_SHUTDOWN_POLL_MS
  );

  if (cycled) {
    // Idempotent confirmation — `unless-stopped` has typically already relaunched it.
    await startComposeService("minima").catch(() => undefined);
  } else {
    await restartComposeService("minima");
  }
}

export async function restartMinimaContainer(options: { awaitCompletion?: boolean } = {}) {
  beginMinimaOperation("restart");
  const container = await getComposeServiceContainer("minima");
  if (!container) {
    endMinimaOperation();
    throw new Error('Docker container not found for service "minima"');
  }

  let baseline: ContainerRestartBaseline;
  try {
    baseline = await getContainerRestartBaseline(container.Id);
  } catch (error) {
    endMinimaOperation();
    throw error;
  }

  const restartCompleted = performGracefulRestart(container.Id, baseline).catch((error) => {
    endMinimaOperation();
    console.error("Minima graceful restart failed:", error instanceof Error ? error.message : error);
    throw error;
  });

  if (options.awaitCompletion) {
    await restartCompleted;
  } else {
    void restartCompleted.catch(() => undefined);
  }

  return {
    ok: true as const,
    state: "restarting" as const,
    service: "minima",
    containerId: container.Id.slice(0, 12)
  };
}
