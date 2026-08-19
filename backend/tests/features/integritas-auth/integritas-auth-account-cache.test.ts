import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";
import type { DeviceMeResult } from "../../../src/features/integritas-auth/integritas-auth.types.js";

let teardown: () => void;
let accountCache: typeof import("../../../src/features/integritas-auth/integritas-auth-account-cache.js");
let repo: typeof import("../../../src/features/integritas-auth/integritas-auth.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  accountCache = await import("../../../src/features/integritas-auth/integritas-auth-account-cache.js");
  repo = await import("../../../src/features/integritas-auth/integritas-auth.repository.js");
});

afterAll(() => {
  teardown();
});

function makeMe(overrides: Partial<DeviceMeResult> = {}): DeviceMeResult {
  return {
    user: { id: "u1", name: "Ada", email: "ada@example.com", role: "owner", status: "active" },
    plan: { name: "Pro", status: "active", endDate: null, autoRenew: true },
    usage: { apiKeyUsage: 10, apiKeyLimit: 100, apiKeyBonus: 0, apiKeyExpiresAt: null, remaining: 90 },
    devices: [
      {
        id: "d1",
        deviceId: "device-uuid",
        name: "Pi",
        deviceType: "raspberry_pi",
        status: "active",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        isCurrentDevice: true
      }
    ],
    apiKey: { id: "api-key-id", masked: "sk-****1234", expiresAt: null },
    edge: { maxDevices: 5, connectedCount: 1 },
    ...overrides
  };
}

describe("sanitizeMeForCache", () => {
  it("keeps only frontend-safe fields, dropping apiKey and edge", () => {
    const sanitized = accountCache.sanitizeMeForCache(makeMe());

    assert.deepEqual(sanitized, {
      user: { name: "Ada", email: "ada@example.com" },
      plan: { name: "Pro", status: "active" },
      usage: { remaining: 90 },
      devices: [
        {
          id: "d1",
          deviceId: "device-uuid",
          name: "Pi",
          deviceType: "raspberry_pi",
          status: "active",
          lastSeenAt: "2026-01-01T00:00:00.000Z",
          isCurrentDevice: true
        }
      ]
    });
    assert.equal((sanitized as { apiKey?: unknown }).apiKey, undefined);
  });

  it("defaults devices to an empty array when missing", () => {
    const me = makeMe();
    // @ts-expect-error simulating an API response omitting devices
    delete me.devices;
    const sanitized = accountCache.sanitizeMeForCache(me);
    assert.deepEqual(sanitized.devices, []);
  });
});

describe("parseAccountCache", () => {
  it("returns null for invalid JSON", () => {
    assert.equal(accountCache.parseAccountCache("not-json"), null);
  });

  it("returns null when required fields are missing", () => {
    assert.equal(accountCache.parseAccountCache(JSON.stringify({ user: { name: "Ada" } })), null);
  });

  it("parses a valid payload, defaulting devices to [] when absent", () => {
    const payload = { user: { name: "Ada", email: "a@x.com" }, plan: { name: "Pro", status: "active" }, usage: { remaining: 5 } };
    const parsed = accountCache.parseAccountCache(JSON.stringify(payload));
    assert.deepEqual(parsed, { ...payload, devices: [] });
  });
});

describe("accountCacheHasDevices", () => {
  it("is true when the payload has a devices array", () => {
    assert.equal(accountCache.accountCacheHasDevices(JSON.stringify({ devices: [] })), true);
  });

  it("is false when devices is missing or not an array", () => {
    assert.equal(accountCache.accountCacheHasDevices(JSON.stringify({})), false);
    assert.equal(accountCache.accountCacheHasDevices(JSON.stringify({ devices: "nope" })), false);
  });

  it("is false for invalid JSON", () => {
    assert.equal(accountCache.accountCacheHasDevices("not-json"), false);
  });
});

describe("getCachedProfile", () => {
  it("returns null when there is no cache row", () => {
    assert.equal(accountCache.getCachedProfile(), null);
  });

  it("returns null when the cached JSON is invalid", () => {
    repo.upsertAccountCache("not-json");
    assert.equal(accountCache.getCachedProfile(), null);
  });

  it("returns the parsed profile with fetchedAt from the cache row", () => {
    const sanitized = accountCache.sanitizeMeForCache(makeMe());
    repo.upsertAccountCache(JSON.stringify(sanitized));

    const profile = accountCache.getCachedProfile();
    assert.deepEqual(profile?.user, sanitized.user);
    assert.deepEqual(profile?.plan, sanitized.plan);
    assert.deepEqual(profile?.usage, sanitized.usage);
    assert.ok(profile?.fetchedAt);
  });
});
