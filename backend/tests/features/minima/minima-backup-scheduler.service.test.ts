import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

const { createBackupMock, getAutoBackupEnabledMock, hasBackupPasswordMock } = vi.hoisted(() => ({
  createBackupMock: vi.fn(),
  getAutoBackupEnabledMock: vi.fn(),
  hasBackupPasswordMock: vi.fn()
}));

vi.mock("../../../src/features/minima/minima-backup.service.js", () => ({
  createBackup: createBackupMock,
  getAutoBackupEnabled: getAutoBackupEnabledMock,
  hasBackupPassword: hasBackupPasswordMock
}));

const { getAutoRestartEnabledMock, restartMinimaContainerMock } = vi.hoisted(() => ({
  getAutoRestartEnabledMock: vi.fn(),
  restartMinimaContainerMock: vi.fn()
}));

vi.mock("../../../src/features/minima/minima.service.js", () => ({
  getAutoRestartEnabled: getAutoRestartEnabledMock,
  restartMinimaContainer: restartMinimaContainerMock
}));

let scheduler: typeof import("../../../src/features/minima/minima-backup-scheduler.service.js");

async function loadModule() {
  vi.resetModules();
  scheduler = await import("../../../src/features/minima/minima-backup-scheduler.service.js");
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  createBackupMock.mockReset();
  getAutoBackupEnabledMock.mockReset();
  hasBackupPasswordMock.mockReset();
  getAutoRestartEnabledMock.mockReset();
  restartMinimaContainerMock.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
  await loadModule();
});

afterEach(() => {
  scheduler.stopMinimaAutoBackupScheduler();
  vi.useRealTimers();
});

describe("startMinimaAutoBackupScheduler", () => {
  it("schedules exactly one timer, even if called twice", () => {
    scheduler.startMinimaAutoBackupScheduler();
    scheduler.startMinimaAutoBackupScheduler();
    assert.equal(vi.getTimerCount(), 1);
  });

  it("runs the nightly auto-backup once enabled and configured", async () => {
    getAutoBackupEnabledMock.mockReturnValue(true);
    hasBackupPasswordMock.mockReturnValue(true);
    createBackupMock.mockResolvedValue({ ok: true, fileName: "minima-auto-x.bak" });

    scheduler.startMinimaAutoBackupScheduler();
    await vi.advanceTimersByTimeAsync(25 * 60 * 60 * 1000);

    assert.equal(createBackupMock.mock.calls.length, 1);
    assert.deepEqual(createBackupMock.mock.calls[0][0], { auto: true });
  });

  it("does not back up when auto-backup is disabled", async () => {
    getAutoBackupEnabledMock.mockReturnValue(false);
    hasBackupPasswordMock.mockReturnValue(true);

    scheduler.startMinimaAutoBackupScheduler();
    await vi.advanceTimersByTimeAsync(25 * 60 * 60 * 1000);

    assert.equal(createBackupMock.mock.calls.length, 0);
  });

  it("does not back up when no password is configured", async () => {
    getAutoBackupEnabledMock.mockReturnValue(true);
    hasBackupPasswordMock.mockReturnValue(false);

    scheduler.startMinimaAutoBackupScheduler();
    await vi.advanceTimersByTimeAsync(25 * 60 * 60 * 1000);

    assert.equal(createBackupMock.mock.calls.length, 0);
  });

  it("swallows a failed backup and still reschedules the next tick", async () => {
    getAutoBackupEnabledMock.mockReturnValue(true);
    hasBackupPasswordMock.mockReturnValue(true);
    createBackupMock.mockRejectedValueOnce(new Error("boom"));
    createBackupMock.mockResolvedValue({ ok: true, fileName: "minima-auto-y.bak" });

    scheduler.startMinimaAutoBackupScheduler();
    await vi.advanceTimersByTimeAsync(25 * 60 * 60 * 1000);
    assert.equal(createBackupMock.mock.calls.length, 1);

    await vi.advanceTimersByTimeAsync(ONE_DAY_MS);
    assert.equal(createBackupMock.mock.calls.length, 2);
  });
});

describe("stopMinimaAutoBackupScheduler", () => {
  it("prevents the nightly tick from ever running", async () => {
    getAutoBackupEnabledMock.mockReturnValue(true);
    hasBackupPasswordMock.mockReturnValue(true);

    scheduler.startMinimaAutoBackupScheduler();
    scheduler.stopMinimaAutoBackupScheduler();
    await vi.advanceTimersByTimeAsync(25 * 60 * 60 * 1000);

    assert.equal(createBackupMock.mock.calls.length, 0);
    assert.equal(vi.getTimerCount(), 0);
  });
});
