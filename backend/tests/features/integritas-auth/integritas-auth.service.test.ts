import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const { startActivationMock, getActivationStatusMock, getMeMock, getValidAccessTokenMock } = vi.hoisted(() => ({
  startActivationMock: vi.fn(),
  getActivationStatusMock: vi.fn(),
  getMeMock: vi.fn(),
  getValidAccessTokenMock: vi.fn()
}));

vi.mock("../../../src/features/integritas-auth/integritas-auth-client.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/features/integritas-auth/integritas-auth-client.service.js")>();
  return { ...actual, startActivation: startActivationMock, getActivationStatus: getActivationStatusMock, getMe: getMeMock };
});

vi.mock("../../../src/features/integritas-auth/integritas-auth-token-manager.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/features/integritas-auth/integritas-auth-token-manager.service.js")>();
  return { ...actual, getValidAccessToken: getValidAccessTokenMock };
});

let teardown: () => void;
let service: typeof import("../../../src/features/integritas-auth/integritas-auth.service.js");
let repo: typeof import("../../../src/features/integritas-auth/integritas-auth.repository.js");
let clientService: typeof import("../../../src/features/integritas-auth/integritas-auth-client.service.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  service = await import("../../../src/features/integritas-auth/integritas-auth.service.js");
  repo = await import("../../../src/features/integritas-auth/integritas-auth.repository.js");
  clientService = await import("../../../src/features/integritas-auth/integritas-auth-client.service.js");
});

afterAll(() => {
  teardown();
});

function makeMe(overrides: Partial<{ userId: string; apiKeyId: string | null }> = {}) {
  return {
    user: { id: overrides.userId ?? "u1", name: "Ada", email: "a@x.com", role: "owner", status: "active" },
    plan: { name: "Pro", status: "active", endDate: null, autoRenew: true },
    usage: { apiKeyUsage: 0, apiKeyLimit: 100, apiKeyBonus: 0, apiKeyExpiresAt: null, remaining: 100 },
    devices: [],
    apiKey: overrides.apiKeyId === null ? undefined : { id: overrides.apiKeyId ?? "api-key-id", masked: "sk-****", expiresAt: null },
    edge: { maxDevices: 5, connectedCount: 1 }
  };
}

function clearAll() {
  repo.clearIntegritasConnectState();
}

beforeEach(() => {
  startActivationMock.mockReset();
  getActivationStatusMock.mockReset();
  getMeMock.mockReset();
  getValidAccessTokenMock.mockReset();
  clearAll();
});

describe("startConnectActivation", () => {
  it("stores the returned activation and returns a pending payload", async () => {
    startActivationMock.mockResolvedValue({
      activationId: "act-1",
      userCode: "ABCD-1234",
      verificationUrl: "https://example.com/verify",
      expiresAt: "2026-01-01T00:00:00.000Z",
      pollIntervalSeconds: 5
    });

    const result = await service.startConnectActivation("My Device");

    assert.deepEqual(result, {
      userCode: "ABCD-1234",
      verificationUrl: "https://example.com/verify",
      expiresAt: "2026-01-01T00:00:00.000Z",
      status: "pending"
    });
    assert.equal(repo.getActivation()?.activation_id, "act-1");
  });

  it("wraps a Connect error as IntegritasAuthServiceError", async () => {
    startActivationMock.mockRejectedValue(new clientService.IntegritasConnectError("boom", 502));

    await assert.rejects(() => service.startConnectActivation(), (error: unknown) => {
      assert.ok(error instanceof service.IntegritasAuthServiceError);
      assert.equal(error.status, 502);
      return true;
    });
  });
});

describe("getIntegritasAuthStatus", () => {
  it("returns unauthenticated when nothing is linked and no activation exists", async () => {
    const result = await service.getIntegritasAuthStatus();
    assert.deepEqual(result, { status: "unauthenticated" });
  });

  it("returns connected (no profile) when linked but the account cache is empty", async () => {
    repo.upsertIntegritasAuth({
      connectedDeviceId: "conn-1",
      integritasUserId: "u1",
      accessTokenEnc: JSON.stringify((await import("../../../src/shared/crypto.js")).encryptSecret("access")),
      refreshTokenEnc: JSON.stringify((await import("../../../src/shared/crypto.js")).encryptSecret("refresh")),
      apiKeyEnc: null,
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    });

    const result = await service.getIntegritasAuthStatus();
    assert.deepEqual(result, { status: "connected" });
  });

  it("returns connected with profile fields when the account cache is populated", async () => {
    const crypto_ = await import("../../../src/shared/crypto.js");
    repo.upsertIntegritasAuth({
      connectedDeviceId: "conn-1",
      integritasUserId: "u1",
      accessTokenEnc: JSON.stringify(crypto_.encryptSecret("access")),
      refreshTokenEnc: JSON.stringify(crypto_.encryptSecret("refresh")),
      apiKeyEnc: null,
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    });
    repo.upsertAccountCache(JSON.stringify({ user: { name: "Ada", email: "a@x.com" }, plan: { name: "Pro", status: "active" }, usage: { remaining: 100 }, devices: [] }));

    const result = await service.getIntegritasAuthStatus();
    assert.equal(result.status, "connected");
    if (result.status === "connected") {
      assert.deepEqual(result.user, { name: "Ada", email: "a@x.com" });
    }
  });

  it("returns a terminal activation status directly when there is no stored auth", async () => {
    repo.upsertActivation({ activationId: "", userCode: "", verificationUrl: "", status: "denied", expiresAt: "" });
    const result = await service.getIntegritasAuthStatus();
    assert.deepEqual(result, { status: "denied" });
  });

  it("polls remote status and returns pending", async () => {
    repo.upsertActivation({
      activationId: "act-1",
      userCode: "ABCD-1234",
      verificationUrl: "https://example.com/verify",
      status: "pending",
      expiresAt: "2026-01-01T00:00:00.000Z"
    });
    getActivationStatusMock.mockResolvedValue({ status: "pending", expiresAt: "2026-02-01T00:00:00.000Z" });

    const result = await service.getIntegritasAuthStatus();
    assert.deepEqual(result, {
      status: "pending",
      userCode: "ABCD-1234",
      verificationUrl: "https://example.com/verify",
      expiresAt: "2026-02-01T00:00:00.000Z"
    });
  });

  it("marks the activation expired when the remote activation is missing", async () => {
    repo.upsertActivation({
      activationId: "act-1",
      userCode: "CODE",
      verificationUrl: "https://example.com",
      status: "pending",
      expiresAt: "2026-01-01T00:00:00.000Z"
    });
    getActivationStatusMock.mockRejectedValue(new clientService.IntegritasConnectError("Activation not found", 404));

    const result = await service.getIntegritasAuthStatus();
    assert.deepEqual(result, { status: "expired" });
    assert.equal(repo.getActivation()?.status, "expired");
  });

  it("wraps a generic remote status error", async () => {
    repo.upsertActivation({
      activationId: "act-1",
      userCode: "CODE",
      verificationUrl: "https://example.com",
      status: "pending",
      expiresAt: "2026-01-01T00:00:00.000Z"
    });
    getActivationStatusMock.mockRejectedValue(new clientService.IntegritasConnectError("Upstream down", 502));

    await assert.rejects(() => service.getIntegritasAuthStatus(), (error: unknown) => {
      assert.ok(error instanceof service.IntegritasAuthServiceError);
      return true;
    });
  });

  it("completes an approved activation: stores tokens, caches profile, returns connected", async () => {
    repo.upsertActivation({
      activationId: "act-1",
      userCode: "CODE",
      verificationUrl: "https://example.com",
      status: "pending",
      expiresAt: "2026-01-01T00:00:00.000Z"
    });
    getActivationStatusMock.mockResolvedValue({
      status: "approved",
      tokens: { accessToken: "at", refreshToken: "rt", expiresIn: 3600, tokenType: "Bearer" },
      device: { id: "conn-1", deviceId: "d1", name: "Pi" }
    });
    getMeMock.mockResolvedValue(makeMe({ userId: "u1", apiKeyId: "api-key-id" }));

    const result = await service.getIntegritasAuthStatus();

    assert.equal(result.status, "connected");
    if (result.status === "connected") assert.equal(result.user?.name, "Ada");
    assert.equal(repo.getIntegritasAuth()?.integritas_user_id, "u1");
    assert.equal(repo.getActivation(), undefined);
  });

  it("still reports connected (no profile) when getMe fails after tokens are saved", async () => {
    repo.upsertActivation({
      activationId: "act-1",
      userCode: "CODE",
      verificationUrl: "https://example.com",
      status: "pending",
      expiresAt: "2026-01-01T00:00:00.000Z"
    });
    getActivationStatusMock.mockResolvedValue({
      status: "approved",
      tokens: { accessToken: "at", refreshToken: "rt", expiresIn: 3600, tokenType: "Bearer" },
      device: { id: "conn-1", deviceId: "d1", name: "Pi" }
    });
    getMeMock.mockRejectedValue(new clientService.IntegritasConnectError("Upstream down", 502));

    const result = await service.getIntegritasAuthStatus();
    assert.deepEqual(result, { status: "connected" });
    assert.ok(repo.getIntegritasAuth());
  });

  it("marks the device revoked when getMe reports DEVICE_REVOKED during approval", async () => {
    repo.upsertActivation({
      activationId: "act-1",
      userCode: "CODE",
      verificationUrl: "https://example.com",
      status: "pending",
      expiresAt: "2026-01-01T00:00:00.000Z"
    });
    getActivationStatusMock.mockResolvedValue({
      status: "approved",
      tokens: { accessToken: "at", refreshToken: "rt", expiresIn: 3600, tokenType: "Bearer" },
      device: { id: "conn-1", deviceId: "d1", name: "Pi" }
    });
    getMeMock.mockRejectedValue(new clientService.IntegritasConnectError("Device revoked", 401, "DEVICE_REVOKED"));

    const result = await service.getIntegritasAuthStatus();
    assert.deepEqual(result, { status: "revoked" });
    assert.equal(repo.getIntegritasAuth(), undefined);
  });

  it("updates and returns denied/expired remote statuses", async () => {
    repo.upsertActivation({
      activationId: "act-1",
      userCode: "CODE",
      verificationUrl: "https://example.com",
      status: "pending",
      expiresAt: "2026-01-01T00:00:00.000Z"
    });
    getActivationStatusMock.mockResolvedValue({ status: "denied" });

    const result = await service.getIntegritasAuthStatus();
    assert.deepEqual(result, { status: "denied" });
    assert.equal(repo.getActivation()?.status, "denied");
  });

  it("falls back to unauthenticated when remote reports connected but nothing is stored locally", async () => {
    repo.upsertActivation({
      activationId: "act-1",
      userCode: "CODE",
      verificationUrl: "https://example.com",
      status: "pending",
      expiresAt: "2026-01-01T00:00:00.000Z"
    });
    getActivationStatusMock.mockResolvedValue({ status: "connected" });

    const result = await service.getIntegritasAuthStatus();
    assert.deepEqual(result, { status: "unauthenticated" });
    assert.equal(repo.getActivation(), undefined);
  });
});

describe("getUserProfile", () => {
  it("throws NOT_CONNECTED when there is no valid access token", async () => {
    getValidAccessTokenMock.mockResolvedValue({ ok: false, status: "unauthenticated" });

    await assert.rejects(() => service.getUserProfile(), (error: unknown) => {
      assert.ok(error instanceof service.IntegritasAuthServiceError);
      assert.equal(error.status, 404);
      assert.equal(error.code, "NOT_CONNECTED");
      return true;
    });
  });

  it("throws DEVICE_REVOKED when the token manager reports revoked", async () => {
    getValidAccessTokenMock.mockResolvedValue({ ok: false, status: "revoked" });

    await assert.rejects(() => service.getUserProfile(), (error: unknown) => {
      assert.ok(error instanceof service.IntegritasAuthServiceError);
      assert.equal(error.status, 403);
      assert.equal(error.code, "DEVICE_REVOKED");
      return true;
    });
  });

  it("returns the cached profile without calling getMe when the cache already has devices", async () => {
    getValidAccessTokenMock.mockResolvedValue({ ok: true, accessToken: "at" });
    repo.upsertIntegritasAuth({
      connectedDeviceId: "conn-1",
      integritasUserId: "u1",
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      apiKeyEnc: null,
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    });
    repo.upsertAccountCache(
      JSON.stringify({ user: { name: "Ada", email: "a@x.com" }, plan: { name: "Pro", status: "active" }, usage: { remaining: 100 }, devices: [{ id: "d1" }] })
    );

    const profile = await service.getUserProfile();

    assert.equal(profile.user.name, "Ada");
    assert.equal(getMeMock.mock.calls.length, 0);
  });

  it("fetches and caches a fresh profile when no cached devices exist", async () => {
    getValidAccessTokenMock.mockResolvedValue({ ok: true, accessToken: "at" });
    repo.upsertIntegritasAuth({
      connectedDeviceId: "conn-1",
      integritasUserId: "u1",
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      apiKeyEnc: null,
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    });
    getMeMock.mockResolvedValue(makeMe());

    const profile = await service.getUserProfile();

    assert.equal(profile.user.name, "Ada");
    assert.equal(getMeMock.mock.calls.length, 1);
    assert.equal(getMeMock.mock.calls[0][0], "at");
  });

  it("always calls getMe when refresh:true is requested", async () => {
    getValidAccessTokenMock.mockResolvedValue({ ok: true, accessToken: "at" });
    repo.upsertIntegritasAuth({
      connectedDeviceId: "conn-1",
      integritasUserId: "u1",
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      apiKeyEnc: null,
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    });
    repo.upsertAccountCache(
      JSON.stringify({ user: { name: "Old", email: "old@x.com" }, plan: { name: "Pro", status: "active" }, usage: { remaining: 1 }, devices: [{ id: "d1" }] })
    );
    getMeMock.mockResolvedValue(makeMe());

    const profile = await service.getUserProfile({ refresh: true });

    assert.equal(getMeMock.mock.calls.length, 1);
    assert.equal(profile.user.name, "Ada");
  });

  it("falls back to a stale cached profile when a refresh fetch fails non-fatally", async () => {
    getValidAccessTokenMock.mockResolvedValue({ ok: true, accessToken: "at" });
    repo.upsertIntegritasAuth({
      connectedDeviceId: "conn-1",
      integritasUserId: "u1",
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      apiKeyEnc: null,
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    });
    repo.upsertAccountCache(
      JSON.stringify({ user: { name: "Cached", email: "c@x.com" }, plan: { name: "Pro", status: "active" }, usage: { remaining: 1 }, devices: [{ id: "d1" }] })
    );
    getMeMock.mockRejectedValue(new clientService.IntegritasConnectError("Upstream down", 502));

    const profile = await service.getUserProfile({ refresh: true });

    assert.equal(profile.user.name, "Cached");
    assert.equal((profile as { stale?: boolean }).stale, true);
  });

  it("rethrows a fatal DEVICE_REVOKED error from a refresh fetch without falling back to cache", async () => {
    getValidAccessTokenMock.mockResolvedValue({ ok: true, accessToken: "at" });
    repo.upsertIntegritasAuth({
      connectedDeviceId: "conn-1",
      integritasUserId: "u1",
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      apiKeyEnc: null,
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    });
    repo.upsertAccountCache(
      JSON.stringify({ user: { name: "Cached", email: "c@x.com" }, plan: { name: "Pro", status: "active" }, usage: { remaining: 1 }, devices: [{ id: "d1" }] })
    );
    getMeMock.mockRejectedValue(new clientService.IntegritasConnectError("Device revoked", 401, "DEVICE_REVOKED"));

    await assert.rejects(() => service.getUserProfile({ refresh: true }), (error: unknown) => {
      assert.ok(error instanceof service.IntegritasAuthServiceError);
      assert.equal(error.code, "DEVICE_REVOKED");
      return true;
    });
  });

  it("rethrows when a refresh fetch fails and there is no cache to fall back to", async () => {
    getValidAccessTokenMock.mockResolvedValue({ ok: true, accessToken: "at" });
    repo.upsertIntegritasAuth({
      connectedDeviceId: "conn-1",
      integritasUserId: "u1",
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      apiKeyEnc: null,
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    });
    getMeMock.mockRejectedValue(new clientService.IntegritasConnectError("Upstream down", 502));

    await assert.rejects(() => service.getUserProfile({ refresh: true }), service.IntegritasAuthServiceError);
  });
});
