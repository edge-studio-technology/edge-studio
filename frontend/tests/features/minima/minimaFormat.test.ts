import { describe, expect, it } from "vitest";
import {
  formatBlockAge,
  formatNodeState,
  formatSyncStatus,
  nodeStateIsHealthy,
  nodeStateStatus,
  nodeStateTone,
  syncStatusTone,
} from "../../../src/features/minima/minimaFormat";

describe("formatBlockAge", () => {
  it("returns an em dash for null", () => {
    expect(formatBlockAge(null)).toBe("—");
  });

  it("formats seconds under a minute", () => {
    expect(formatBlockAge(30)).toBe("30 seconds ago");
  });

  it("formats minutes under an hour", () => {
    expect(formatBlockAge(120)).toBe("2 minutes ago");
  });

  it("formats hours under a day", () => {
    expect(formatBlockAge(7200)).toBe("2 hours ago");
  });

  it("formats days at or beyond a day", () => {
    expect(formatBlockAge(172800)).toBe("2 days ago");
  });
});

describe("formatNodeState", () => {
  it("returns an em dash for null", () => {
    expect(formatNodeState(null)).toBe("—");
  });

  it("formats running", () => {
    expect(formatNodeState("running")).toBe("Running");
  });

  it("formats stopped", () => {
    expect(formatNodeState("stopped")).toBe("Stopped");
  });

  it("formats restarting", () => {
    expect(formatNodeState("restarting")).toBe("Restarting");
  });

  it("formats error as Error", () => {
    expect(formatNodeState("error")).toBe("Error");
  });
});

describe("formatSyncStatus", () => {
  it("returns Unavailable for null/undefined/unavailable", () => {
    expect(formatSyncStatus(null)).toBe("Unavailable");
    expect(formatSyncStatus(undefined)).toBe("Unavailable");
    expect(formatSyncStatus("unavailable")).toBe("Unavailable");
  });

  it("formats active", () => {
    expect(formatSyncStatus("active")).toBe("Active");
  });

  it("formats stale", () => {
    expect(formatSyncStatus("stale")).toBe("Stale");
  });

  it("formats syncing as Syncing", () => {
    expect(formatSyncStatus("syncing")).toBe("Syncing");
  });
});

describe("nodeStateStatus", () => {
  it("maps running to success", () => {
    expect(nodeStateStatus("running")).toBe("success");
  });

  it("maps stopped to warning", () => {
    expect(nodeStateStatus("stopped")).toBe("warning");
  });

  it("maps error to error", () => {
    expect(nodeStateStatus("error")).toBe("error");
  });

  it("maps restarting/null to neutral", () => {
    expect(nodeStateStatus("restarting")).toBe("neutral");
    expect(nodeStateStatus(null)).toBe("neutral");
  });
});

describe("syncStatusTone", () => {
  it("maps active to success", () => {
    expect(syncStatusTone("active")).toBe("success");
  });

  it("maps stale to warning", () => {
    expect(syncStatusTone("stale")).toBe("warning");
  });

  it("maps syncing/unavailable/null to neutral", () => {
    expect(syncStatusTone("syncing")).toBe("neutral");
    expect(syncStatusTone("unavailable")).toBe("neutral");
    expect(syncStatusTone(null)).toBe("neutral");
    expect(syncStatusTone(undefined)).toBe("neutral");
  });
});

describe("nodeStateIsHealthy", () => {
  it("is true only for running", () => {
    expect(nodeStateIsHealthy("running")).toBe(true);
    expect(nodeStateIsHealthy("stopped")).toBe(false);
    expect(nodeStateIsHealthy("error")).toBe(false);
    expect(nodeStateIsHealthy("restarting")).toBe(false);
    expect(nodeStateIsHealthy(null)).toBe(false);
  });
});

describe("nodeStateTone", () => {
  it("maps running to good", () => {
    expect(nodeStateTone("running")).toBe("good");
  });

  it("maps stopped to warn", () => {
    expect(nodeStateTone("stopped")).toBe("warn");
  });

  it("maps error to error", () => {
    expect(nodeStateTone("error")).toBe("error");
  });

  it("maps restarting/null to neutral", () => {
    expect(nodeStateTone("restarting")).toBe("neutral");
    expect(nodeStateTone(null)).toBe("neutral");
  });
});
