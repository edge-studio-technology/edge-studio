import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const { getDeviceInfoMock } = vi.hoisted(() => ({
  getDeviceInfoMock: vi.fn()
}));

vi.mock("../../../src/features/status/device.service.js", () => ({
  getDeviceInfo: getDeviceInfoMock
}));

let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let identity: typeof import("../../../src/features/integritas-auth/integritas-auth-device-identity.service.js");
let settingsRepo: typeof import("../../../src/features/settings/settings.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  identity = await import("../../../src/features/integritas-auth/integritas-auth-device-identity.service.js");
  settingsRepo = await import("../../../src/features/settings/settings.repository.js");
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  getDeviceInfoMock.mockReset();
});

function clearDeviceState() {
  db.prepare("DELETE FROM integritas_device WHERE id = 'default'").run();
  settingsRepo.deleteSetting("device_id");
}

function baseInfo(overrides: Partial<{ hostname: string; platform: string; arch: string }> = {}) {
  return { hostname: "my-host", platform: "linux", arch: "x64", ...overrides };
}

describe("getOrCreateDevice", () => {
  beforeEach(() => {
    clearDeviceState();
  });

  it("creates a device on first call, deriving device_id from a newly generated settings.device_id", () => {
    getDeviceInfoMock.mockReturnValue(baseInfo());

    const device = identity.getOrCreateDevice();

    assert.ok(device.deviceId);
    assert.equal(device.deviceName, "my-host");
    assert.equal(device.deviceType, "self_hosted");
    assert.equal(settingsRepo.getSetting("device_id"), device.deviceId);
  });

  it("reuses an existing settings.device_id instead of generating a new one", () => {
    settingsRepo.saveSetting("device_id", "pre-existing-id");
    getDeviceInfoMock.mockReturnValue(baseInfo());

    const device = identity.getOrCreateDevice();

    assert.equal(device.deviceId, "pre-existing-id");
  });

  it("returns the same row on a second call without recreating it", () => {
    getDeviceInfoMock.mockReturnValue(baseInfo({ hostname: "first-host" }));
    const first = identity.getOrCreateDevice();

    getDeviceInfoMock.mockReturnValue(baseInfo({ hostname: "second-host" }));
    const second = identity.getOrCreateDevice();

    assert.equal(second.deviceId, first.deviceId);
    assert.equal(second.deviceName, "first-host");
  });

  it("syncs a drifted settings.device_id back to the existing device row's id", () => {
    getDeviceInfoMock.mockReturnValue(baseInfo());
    const created = identity.getOrCreateDevice();

    settingsRepo.saveSetting("device_id", "some-other-uuid");
    const again = identity.getOrCreateDevice();

    assert.equal(again.deviceId, created.deviceId);
    assert.equal(settingsRepo.getSetting("device_id"), created.deviceId);
  });
});

describe("getOrCreateDevice — device type classification", () => {
  beforeEach(() => {
    clearDeviceState();
  });

  it("classifies linux + arm as raspberry_pi", () => {
    getDeviceInfoMock.mockReturnValue(baseInfo({ platform: "linux", arch: "arm" }));
    assert.equal(identity.getOrCreateDevice().deviceType, "raspberry_pi");
  });

  it("classifies linux + arm64 as raspberry_pi", () => {
    getDeviceInfoMock.mockReturnValue(baseInfo({ platform: "linux", arch: "arm64" }));
    assert.equal(identity.getOrCreateDevice().deviceType, "raspberry_pi");
  });

  it("classifies linux + aarch64 as raspberry_pi", () => {
    getDeviceInfoMock.mockReturnValue(baseInfo({ platform: "linux", arch: "aarch64" }));
    assert.equal(identity.getOrCreateDevice().deviceType, "raspberry_pi");
  });

  it("classifies linux + x64 as self_hosted", () => {
    getDeviceInfoMock.mockReturnValue(baseInfo({ platform: "linux", arch: "x64" }));
    assert.equal(identity.getOrCreateDevice().deviceType, "self_hosted");
  });

  it("classifies non-linux arm platforms as self_hosted", () => {
    getDeviceInfoMock.mockReturnValue(baseInfo({ platform: "darwin", arch: "arm64" }));
    assert.equal(identity.getOrCreateDevice().deviceType, "self_hosted");
  });
});
