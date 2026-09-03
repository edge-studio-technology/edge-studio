import { describe, expect, it } from "vitest";
import type { MinimaNodeStatus } from "../../../src/app/types";
import {
  isTransientMinimaRpcError,
  shouldShowMinimaRpcError,
} from "../../../src/features/minima/minimaStatusDisplay";

function status(overrides: Partial<MinimaNodeStatus> = {}): MinimaNodeStatus {
  return {
    checkedAt: "2026-08-20T00:00:00.000Z",
    state: "error",
    container: null,
    rpc: { ok: false, error: "boom" },
    sync: { synced: null, status: "unavailable", block: null, blockTime: null, blockAgeSeconds: null },
    health: { peerCount: null, peersKnown: null },
    node: { memoryRam: null, memoryDisk: null },
    storage: { dataPath: "/data", containerDisk: null, chainDataDisk: null },
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

describe("isTransientMinimaRpcError", () => {
  it("is false for undefined", () => {
    expect(isTransientMinimaRpcError(undefined)).toBe(false);
  });

  it.each([
    "fetch failed",
    "temporarily unreachable",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "socket hang up",
    "request aborted",
  ])("is true for %s", (message) => {
    expect(isTransientMinimaRpcError(message)).toBe(true);
  });

  it("is false for an unrelated message", () => {
    expect(isTransientMinimaRpcError("invalid credentials")).toBe(false);
  });
});

describe("shouldShowMinimaRpcError", () => {
  it("is false when status is null", () => {
    expect(shouldShowMinimaRpcError(null)).toBe(false);
  });

  it("is false when there is no rpc.error", () => {
    expect(shouldShowMinimaRpcError(status({ rpc: { ok: false, error: undefined } }))).toBe(false);
  });

  it("is false when rpc.ok is true even with an error field set", () => {
    expect(shouldShowMinimaRpcError(status({ rpc: { ok: true, error: "boom" } }))).toBe(false);
  });

  it("is false when metrics exist and the error is transient", () => {
    const s = status({
      rpc: { ok: false, error: "fetch failed" },
      health: { peerCount: 3, peersKnown: 3 },
    });
    expect(shouldShowMinimaRpcError(s)).toBe(false);
  });

  it("is true when metrics exist but the error is not transient", () => {
    const s = status({
      rpc: { ok: false, error: "invalid credentials" },
      health: { peerCount: 3, peersKnown: 3 },
    });
    expect(shouldShowMinimaRpcError(s)).toBe(true);
  });

  it("is true when there are no display metrics, even for a transient error", () => {
    const s = status({ rpc: { ok: false, error: "fetch failed" } });
    expect(shouldShowMinimaRpcError(s)).toBe(true);
  });
});
