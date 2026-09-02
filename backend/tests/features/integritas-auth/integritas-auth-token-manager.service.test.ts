import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const { getMeMock, refreshTokenMock } = vi.hoisted(() => ({
  getMeMock: vi.fn(),
  refreshTokenMock: vi.fn()
}));

vi.mock("../../../src/features/integritas-auth/integritas-auth-client.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/features/integritas-auth/integritas-auth-client.service.js")>();
  return { ...actual, getMe: getMeMock, refreshToken: refreshTokenMock };
});

let teardown: () => void;
let tokenManager: typeof import("../../../src/features/integritas-auth/integritas-auth-token-manager.service.js");
let repo: typeof import("../../../src/features/integritas-auth/integritas-auth.repository.js");
let crypto_: typeof import("../../../src/features/integritas-auth/integritas-auth-crypto.service.js");
let clientService: typeof import("../../../src/features/integritas-auth/integritas-auth-client.service.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  tokenManager = await import("../../../src/features/integritas-auth/integritas-auth-token-manager.service.js");
  repo = await import("../../../src/features/integritas-auth/integritas-auth.repository.js");
  crypto_ = await import("../../../src/features/integritas-auth/integritas-auth-crypto.service.js");
  clientService = await import("../../../src/features/integritas-auth/integritas-auth-client.service.js");
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  getMeMock.mockReset();
  refreshTokenMock.mockReset();
  getMeMock.mockResolvedValue({
    user: { id: "u1", name: "Ada", email: "a@x.com", role: "owner", status: "active" },
    plan: { name: "Pro", status: "active", endDate: null, autoRenew: true },
    usage: { apiKeyUsage: 0, apiKeyLimit: 100, apiKeyBonus: 0, apiKeyExpiresAt: null, remaining: 100 },
    devices: [],
    apiKey: { id: "api-key-id", masked: "sk-****", expiresAt: null },
    edge: { maxDevices: 5, connectedCount: 1 }
  });
});

function seedAuth(overrides: Partial<{ tokenExpiresAt: string; accessTokenEnc: string; refreshTokenEnc: string; apiKeyEnc: string | null }> = {}) {
  repo.upsertIntegritasAuth({
    connectedDeviceId: "conn-1",
    integritasUserId: "u1",
    accessTokenEnc: overrides.accessTokenEnc ?? crypto_.encryptIntegritasToken("valid-access"),
    refreshTokenEnc: overrides.refreshTokenEnc ?? crypto_.encryptIntegritasToken("valid-refresh"),
    apiKeyEnc: overrides.apiKeyEnc ?? null,
    tokenExpiresAt: overrides.tokenExpiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });
}

describe("assertStoredTokensDecryptable", () => {
  it("does not throw when both tokens decrypt cleanly", () => {
    seedAuth();
    const auth = repo.getIntegritasAuth()!;
    assert.doesNotThrow(() => tokenManager.assertStoredTokensDecryptable(auth));
  });

  it("clears connect state and throws TOKEN_DECRYPT_FAILED on corrupt ciphertext", () => {
    seedAuth({ accessTokenEnc: "not-valid-ciphertext" });
    const auth = repo.getIntegritasAuth()!;

    assert.throws(
      () => tokenManager.assertStoredTokensDecryptable(auth),
      (error: unknown) => {
        assert.ok(error instanceof tokenManager.IntegritasTokenManagerError);
        assert.equal(error.code, tokenManager.TOKEN_DECRYPT_FAILED);
        assert.equal(error.status, 403);
        return true;
      }
    );
    assert.equal(repo.getIntegritasAuth(), undefined);
  });
});

describe("getValidAccessToken", () => {
  it("returns unauthenticated when nothing is linked", async () => {
    const result = await tokenManager.getValidAccessToken();
    assert.deepEqual(result, { ok: false, status: "unauthenticated" });
  });

  it("returns the decrypted access token without refreshing when not near expiry", async () => {
    seedAuth({ tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() });

    const result = await tokenManager.getValidAccessToken();

    assert.deepEqual(result, { ok: true, accessToken: "valid-access" });
    assert.equal(refreshTokenMock.mock.calls.length, 0);
  });

  it("clears connect state when the current access token cannot be decrypted", async () => {
    seedAuth({ accessTokenEnc: "not-valid-ciphertext", tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    await assert.rejects(
      () => tokenManager.getValidAccessToken(),
      (error: unknown) => error instanceof tokenManager.IntegritasTokenManagerError && error.code === tokenManager.TOKEN_DECRYPT_FAILED
    );
    assert.equal(repo.getIntegritasAuth(), undefined);
  });

  it("refreshes when within the skew window of expiry and stores the rotated tokens", async () => {
    seedAuth({ tokenExpiresAt: new Date(Date.now() + 60 * 1000).toISOString() });
    refreshTokenMock.mockResolvedValue({ accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 3600, tokenType: "Bearer" });

    const result = await tokenManager.getValidAccessToken();

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.accessToken, "new-access");
    assert.equal(refreshTokenMock.mock.calls.length, 1);
    assert.equal(getMeMock.mock.calls[0][0], "new-access");

    const stored = repo.getIntegritasAuth()!;
    assert.equal(crypto_.decryptIntegritasToken(stored.access_token_enc), "new-access");
    assert.equal(crypto_.decryptIntegritasToken(stored.refresh_token_enc), "new-refresh");
    assert.equal(stored.integritas_user_id, "u1");
  });

  it("refreshes when the stored expiry is unparseable", async () => {
    seedAuth({ tokenExpiresAt: "not-a-date" });
    refreshTokenMock.mockResolvedValue({ accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 3600, tokenType: "Bearer" });

    const result = await tokenManager.getValidAccessToken();
    assert.equal(result.ok, true);
    assert.equal(refreshTokenMock.mock.calls.length, 1);
  });

  it("clears connect state when the refresh token cannot be decrypted", async () => {
    seedAuth({ refreshTokenEnc: "not-valid-ciphertext", tokenExpiresAt: new Date(Date.now() + 60 * 1000).toISOString() });
    await assert.rejects(
      () => tokenManager.getValidAccessToken(),
      (error: unknown) => error instanceof tokenManager.IntegritasTokenManagerError && error.code === tokenManager.TOKEN_DECRYPT_FAILED
    );
    assert.equal(refreshTokenMock.mock.calls.length, 0);
    assert.equal(repo.getIntegritasAuth(), undefined);
  });

  it("marks the device revoked and returns a revoked result when refresh reports DEVICE_REVOKED", async () => {
    seedAuth({ tokenExpiresAt: new Date(Date.now() + 60 * 1000).toISOString() });
    refreshTokenMock.mockRejectedValue(new clientService.IntegritasConnectError("Device revoked", 401, "DEVICE_REVOKED"));

    const result = await tokenManager.getValidAccessToken();

    assert.deepEqual(result, { ok: false, status: "revoked" });
    assert.equal(repo.getIntegritasAuth(), undefined);
    assert.equal(repo.getActivation()?.status, "revoked");
  });

  it("wraps a generic Connect refresh error as IntegritasTokenManagerError", async () => {
    seedAuth({ tokenExpiresAt: new Date(Date.now() + 60 * 1000).toISOString() });
    refreshTokenMock.mockRejectedValue(new clientService.IntegritasConnectError("Upstream down", 502));

    await assert.rejects(
      () => tokenManager.getValidAccessToken(),
      (error: unknown) => {
        assert.ok(error instanceof tokenManager.IntegritasTokenManagerError);
        assert.equal(error.status, 502);
        return true;
      }
    );
  });

  it("preserves a non-Connect refresh error", async () => {
    seedAuth({ tokenExpiresAt: new Date(Date.now() + 60 * 1000).toISOString() });
    const upstreamError = new TypeError("connection reset");
    refreshTokenMock.mockRejectedValue(upstreamError);
    await assert.rejects(() => tokenManager.getValidAccessToken(), (error: unknown) => error === upstreamError);
  });

  it("marks the device revoked when the post-refresh account lookup reports DEVICE_REVOKED", async () => {
    seedAuth({ tokenExpiresAt: new Date(Date.now() + 60 * 1000).toISOString() });
    refreshTokenMock.mockResolvedValue({ accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 3600, tokenType: "Bearer" });
    getMeMock.mockRejectedValue(new clientService.IntegritasConnectError("Device revoked", 401, "DEVICE_REVOKED"));

    const result = await tokenManager.getValidAccessToken();
    assert.deepEqual(result, { ok: false, status: "revoked" });
    assert.equal(repo.getIntegritasAuth(), undefined);
    assert.equal(repo.getActivation()?.status, "revoked");
  });

  it("preserves stored account identifiers when the post-refresh response omits them", async () => {
    const storedApiKey = crypto_.encryptIntegritasToken("existing-api-key");
    seedAuth({ apiKeyEnc: storedApiKey, tokenExpiresAt: new Date(Date.now() + 60 * 1000).toISOString() });
    refreshTokenMock.mockResolvedValue({ accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 3600, tokenType: "Bearer" });
    getMeMock.mockResolvedValue({
      user: { id: undefined, name: "Ada", email: "a@x.com", role: "owner", status: "active" },
      plan: { name: "Pro", status: "active", endDate: null, autoRenew: true },
      usage: { apiKeyUsage: 0, apiKeyLimit: 100, apiKeyBonus: 0, apiKeyExpiresAt: null, remaining: 100 },
      devices: [],
      apiKey: undefined,
      edge: { maxDevices: 5, connectedCount: 1 }
    });

    const result = await tokenManager.getValidAccessToken();
    const stored = repo.getIntegritasAuth()!;
    assert.deepEqual(result, { ok: true, accessToken: "new-access" });
    assert.equal(stored.integritas_user_id, "u1");
    assert.equal(crypto_.decryptIntegritasToken(stored.api_key_enc!), "existing-api-key");
  });

  it("shares one in-flight refresh across concurrent callers", async () => {
    seedAuth({ tokenExpiresAt: new Date(Date.now() + 60 * 1000).toISOString() });
    let resolveRefresh: (value: { accessToken: string; refreshToken: string; expiresIn: number; tokenType: string }) => void = () => {};
    refreshTokenMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        })
    );

    const first = tokenManager.getValidAccessToken();
    const second = tokenManager.getValidAccessToken();
    resolveRefresh({ accessToken: "shared-access", refreshToken: "shared-refresh", expiresIn: 3600, tokenType: "Bearer" });
    const [firstResult, secondResult] = await Promise.all([first, second]);

    assert.equal(refreshTokenMock.mock.calls.length, 1);
    assert.deepEqual(firstResult, secondResult);
  });
});
