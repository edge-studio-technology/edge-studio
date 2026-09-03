import { describe, expect, it } from "vitest";
import type { MinimaNodeStatus } from "../../../src/app/types";
import { mergeMinimaStatus } from "../../../src/features/minima/mergeMinimaStatus";

function status(overrides: Partial<MinimaNodeStatus> = {}): MinimaNodeStatus {
  return {
    checkedAt: "2026-08-20T00:00:00.000Z",
    state: "running",
    container: null,
    rpc: { ok: true },
    sync: { synced: true, status: "active", block: 100, blockTime: null, blockAgeSeconds: 5 },
    health: { peerCount: 4, peersKnown: 4 },
    node: { memoryRam: "1 GB", memoryDisk: "2 GB" },
    storage: { dataPath: "/data", containerDisk: "1 GB", chainDataDisk: "1 GB" },
    config: { megammrHost: "megammr.minima.global:9001", megammrHostSource: "default" },
    monitoring: {
      stallDetected: false,
      stallThresholdSeconds: 600,
      autoResyncEnabled: false,
      lastPollerCheckAt: null,
      lastStallDetectedAt: null,
      lastAutoResyncAt: null,
      lastAutoResyncResult: null,
    },
    ...overrides,
  };
}

describe("mergeMinimaStatus", () => {
  it("returns next as-is when there is no previous status", () => {
    const next = status();
    expect(mergeMinimaStatus(null, next)).toBe(next);
  });

  it("returns next as-is when next.rpc.ok is true", () => {
    const previous = status();
    const next = status({ rpc: { ok: true } });
    expect(mergeMinimaStatus(previous, next)).toBe(next);
  });

  it("returns next as-is when previous has no node metrics", () => {
    const previous = status({
      sync: { synced: null, status: "unavailable", block: null, blockTime: null, blockAgeSeconds: null },
      health: { peerCount: null, peersKnown: null },
      node: { memoryRam: null, memoryDisk: null },
    });
    const next = status({ rpc: { ok: false, error: "fetch failed" } });
    expect(mergeMinimaStatus(previous, next)).toBe(next);
  });

  it("carries forward previous sync/health/node/storage metrics when next.rpc is not ok", () => {
    const previous = status({
      state: "running",
      sync: { synced: true, status: "active", block: 100, blockTime: null, blockAgeSeconds: 5 },
      health: { peerCount: 4, peersKnown: 4 },
      node: { memoryRam: "1 GB", memoryDisk: "2 GB" },
      storage: { dataPath: "/data", containerDisk: "1 GB", chainDataDisk: "1 GB" },
      rpc: { ok: true, raw: { previous: true } },
    });
    const next = status({
      state: "error",
      sync: { synced: null, status: "unavailable", block: null, blockTime: null, blockAgeSeconds: null },
      health: { peerCount: null, peersKnown: null },
      node: { memoryRam: null, memoryDisk: null },
      storage: { dataPath: "/data", containerDisk: null, chainDataDisk: null },
      rpc: { ok: false, error: "fetch failed" },
    });

    const merged = mergeMinimaStatus(previous, next);

    expect(merged.state).toBe("running");
    expect(merged.sync).toBe(previous.sync);
    expect(merged.health).toBe(previous.health);
    expect(merged.node).toBe(previous.node);
    expect(merged.storage).toBe(previous.storage);
    expect(merged.rpc.error).toBeUndefined();
    expect(merged.rpc.raw).toEqual({ previous: true });
  });

  it("keeps next.state when previous state is not running", () => {
    const previous = status({ state: "stopped" });
    const next = status({ state: "error", rpc: { ok: false, error: "fetch failed" } });
    expect(mergeMinimaStatus(previous, next).state).toBe("error");
  });

  it("falls back to next's field when previous lacks that specific metric", () => {
    const previous = status({
      health: { peerCount: null, peersKnown: null },
      node: { memoryRam: null, memoryDisk: null },
      storage: { dataPath: "/data", containerDisk: null, chainDataDisk: null },
    });
    const next = status({
      health: { peerCount: 2, peersKnown: 2 },
      node: { memoryRam: "3 GB", memoryDisk: "4 GB" },
      storage: { dataPath: "/data", containerDisk: "5 GB", chainDataDisk: "6 GB" },
      rpc: { ok: false, error: "fetch failed" },
    });

    const merged = mergeMinimaStatus(previous, next);

    expect(merged.health).toBe(next.health);
    expect(merged.node).toBe(next.node);
    expect(merged.storage).toBe(next.storage);
  });

  it("prefers previous rpc.raw when next has none", () => {
    const previous = status({ rpc: { ok: true, raw: { a: 1 } } });
    const next = status({ rpc: { ok: false, error: "fetch failed", raw: undefined } });
    expect(mergeMinimaStatus(previous, next).rpc.raw).toEqual({ a: 1 });
  });
});
