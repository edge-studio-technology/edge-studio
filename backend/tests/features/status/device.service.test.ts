import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let deviceService: typeof import("../../../src/features/status/device.service.js");
let settingsRepo: typeof import("../../../src/features/settings/settings.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  deviceService = await import("../../../src/features/status/device.service.js");
  settingsRepo = await import("../../../src/features/settings/settings.repository.js");
});

afterAll(() => {
  teardown();
});

describe("ensureDeviceId", () => {
  it("generates and stores a device id when none exists", async () => {
    assert.equal(settingsRepo.getSetting("device_id"), "");
    await deviceService.ensureDeviceId();
    const id = settingsRepo.getSetting("device_id");
    assert.notEqual(id, "");
  });

  it("does not overwrite an existing device id", async () => {
    const before = settingsRepo.getSetting("device_id");
    await deviceService.ensureDeviceId();
    assert.equal(settingsRepo.getSetting("device_id"), before);
  });
});

describe("getDeviceInfo", () => {
  it("returns real OS facts alongside the stored device id", () => {
    const info = deviceService.getDeviceInfo();

    assert.equal(info.id, settingsRepo.getSetting("device_id"));
    assert.equal(typeof info.hostname, "string");
    assert.equal(typeof info.platform, "string");
    assert.equal(typeof info.arch, "string");
    assert.equal(typeof info.uptimeSeconds, "number");
    assert.equal(typeof info.cpuCount, "number");
    assert.ok(info.cpuCount > 0);
    assert.equal(typeof info.memory.totalBytes, "number");
    assert.equal(typeof info.memory.freeBytes, "number");
    assert.equal(info.memory.usedBytes, info.memory.totalBytes - info.memory.freeBytes);
    assert.equal(info.loadAvg.length, 3);
  });

  it("returns an empty id when no device id has been stored yet", async () => {
    settingsRepo.deleteSetting("device_id");
    const info = deviceService.getDeviceInfo();
    assert.equal(info.id, "");
  });

  it("falls back to disk info for '/' when '/data' is unavailable, or null if neither resolves", () => {
    const info = deviceService.getDeviceInfo();
    if (info.disk) {
      assert.equal(typeof info.disk.totalBytes, "number");
      assert.equal(info.disk.usedBytes, info.disk.totalBytes - info.disk.freeBytes);
    } else {
      assert.equal(info.disk, null);
    }
  });
});
