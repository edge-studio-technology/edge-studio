import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let repo: typeof import("../../../src/features/integritas-auth/integritas-auth.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  repo = await import("../../../src/features/integritas-auth/integritas-auth.repository.js");
});

afterAll(() => {
  teardown();
});

describe("activation", () => {
  it("returns undefined when no activation exists", () => {
    assert.equal(repo.getActivation(), undefined);
  });

  it("upsertActivation inserts a new row readable via getActivation", () => {
    repo.upsertActivation({
      activationId: "act-1",
      userCode: "ABCD-1234",
      verificationUrl: "https://example.com/verify",
      status: "pending",
      expiresAt: "2026-01-01T00:00:00.000Z"
    });

    const activation = repo.getActivation();
    assert.equal(activation?.id, "current");
    assert.equal(activation?.activation_id, "act-1");
    assert.equal(activation?.user_code, "ABCD-1234");
    assert.equal(activation?.verification_url, "https://example.com/verify");
    assert.equal(activation?.status, "pending");
    assert.equal(activation?.expires_at, "2026-01-01T00:00:00.000Z");
  });

  it("upsertActivation overwrites the single 'current' row on a second call", () => {
    repo.upsertActivation({
      activationId: "act-2",
      userCode: "WXYZ-5678",
      verificationUrl: "https://example.com/verify2",
      status: "pending",
      expiresAt: "2026-02-01T00:00:00.000Z"
    });

    const activation = repo.getActivation();
    assert.equal(activation?.activation_id, "act-2");
    assert.equal(activation?.user_code, "WXYZ-5678");
  });

  it("updateActivationStatus updates only the status field", () => {
    repo.updateActivationStatus("approved");
    const activation = repo.getActivation();
    assert.equal(activation?.status, "approved");
    assert.equal(activation?.activation_id, "act-2");
  });

  it("clearActivation removes the row", () => {
    repo.clearActivation();
    assert.equal(repo.getActivation(), undefined);
  });
});

describe("integritas_auth", () => {
  it("returns undefined when not linked", () => {
    assert.equal(repo.getIntegritasAuth(), undefined);
  });

  it("upsertIntegritasAuth inserts, setting created_at and updated_at", () => {
    repo.upsertIntegritasAuth({
      connectedDeviceId: "device-1",
      integritasUserId: "user-1",
      accessTokenEnc: "enc-access-1",
      refreshTokenEnc: "enc-refresh-1",
      apiKeyEnc: "enc-api-key-1",
      tokenExpiresAt: "2026-01-01T00:00:00.000Z"
    });

    const auth = repo.getIntegritasAuth();
    assert.equal(auth?.id, "default");
    assert.equal(auth?.connected_device_id, "device-1");
    assert.equal(auth?.integritas_user_id, "user-1");
    assert.equal(auth?.access_token_enc, "enc-access-1");
    assert.equal(auth?.refresh_token_enc, "enc-refresh-1");
    assert.equal(auth?.api_key_enc, "enc-api-key-1");
    assert.equal(auth?.token_expires_at, "2026-01-01T00:00:00.000Z");
    assert.ok(auth?.created_at);
    assert.equal(auth?.created_at, auth?.updated_at);
  });

  it("upsertIntegritasAuth on an existing row preserves created_at but updates the rest", async () => {
    const before = repo.getIntegritasAuth()!;
    await new Promise((resolve) => setTimeout(resolve, 5));

    repo.upsertIntegritasAuth({
      connectedDeviceId: "device-1",
      integritasUserId: "user-1",
      accessTokenEnc: "enc-access-2",
      refreshTokenEnc: "enc-refresh-2",
      apiKeyEnc: null,
      tokenExpiresAt: "2026-03-01T00:00:00.000Z"
    });

    const after = repo.getIntegritasAuth()!;
    assert.equal(after.created_at, before.created_at);
    assert.notEqual(after.updated_at, before.updated_at);
    assert.equal(after.access_token_enc, "enc-access-2");
    assert.equal(after.api_key_enc, null);
  });

  it("clearIntegritasAuth removes the row", () => {
    repo.clearIntegritasAuth();
    assert.equal(repo.getIntegritasAuth(), undefined);
  });
});

describe("account cache", () => {
  it("returns undefined when no cache exists", () => {
    assert.equal(repo.getAccountCache(), undefined);
  });

  it("upsertAccountCache inserts, then updates on a second call", () => {
    repo.upsertAccountCache(JSON.stringify({ a: 1 }));
    assert.equal(repo.getAccountCache()?.payload_json, JSON.stringify({ a: 1 }));

    repo.upsertAccountCache(JSON.stringify({ a: 2 }));
    const cache = repo.getAccountCache();
    assert.equal(cache?.payload_json, JSON.stringify({ a: 2 }));
    assert.equal(cache?.id, "default");
  });

  it("clearAccountCache removes the row", () => {
    repo.clearAccountCache();
    assert.equal(repo.getAccountCache(), undefined);
  });
});

describe("clearIntegritasConnectState", () => {
  it("clears auth, activation, and account cache together", () => {
    repo.upsertIntegritasAuth({
      connectedDeviceId: "device-1",
      integritasUserId: "user-1",
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      apiKeyEnc: null,
      tokenExpiresAt: "2026-01-01T00:00:00.000Z"
    });
    repo.upsertActivation({
      activationId: "act-1",
      userCode: "CODE",
      verificationUrl: "https://example.com",
      status: "pending",
      expiresAt: "2026-01-01T00:00:00.000Z"
    });
    repo.upsertAccountCache(JSON.stringify({ a: 1 }));

    repo.clearIntegritasConnectState();

    assert.equal(repo.getIntegritasAuth(), undefined);
    assert.equal(repo.getActivation(), undefined);
    assert.equal(repo.getAccountCache(), undefined);
  });
});

describe("markConnectRevoked", () => {
  it("clears auth and cache, and leaves a terminal revoked activation row", () => {
    repo.upsertIntegritasAuth({
      connectedDeviceId: "device-1",
      integritasUserId: "user-1",
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      apiKeyEnc: null,
      tokenExpiresAt: "2026-01-01T00:00:00.000Z"
    });
    repo.upsertAccountCache(JSON.stringify({ a: 1 }));

    repo.markConnectRevoked();

    assert.equal(repo.getIntegritasAuth(), undefined);
    assert.equal(repo.getAccountCache(), undefined);
    const activation = repo.getActivation();
    assert.equal(activation?.status, "revoked");
    assert.equal(activation?.activation_id, null);
    assert.equal(activation?.user_code, null);
  });

  it("overwrites an existing pending activation row with the revoked marker", () => {
    repo.upsertActivation({
      activationId: "act-pending",
      userCode: "CODE",
      verificationUrl: "https://example.com",
      status: "pending",
      expiresAt: "2026-01-01T00:00:00.000Z"
    });

    repo.markConnectRevoked();

    const activation = repo.getActivation();
    assert.equal(activation?.status, "revoked");
    assert.equal(activation?.activation_id, null);
  });
});
