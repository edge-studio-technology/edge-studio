import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let secrets: typeof import("../../../src/features/settings/secrets.service.js");
let crypto: typeof import("../../../src/features/integritas-auth/integritas-auth-crypto.service.js");
let repo: typeof import("../../../src/features/integritas-auth/integritas-auth.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  secrets = await import("../../../src/features/settings/secrets.service.js");
  crypto = await import("../../../src/features/integritas-auth/integritas-auth-crypto.service.js");
  repo = await import("../../../src/features/integritas-auth/integritas-auth.repository.js");
});

afterAll(() => {
  teardown();
});

afterEach(() => {
  repo.clearIntegritasAuth();
});

function upsertAuth(apiKeyEnc: string | null) {
  repo.upsertIntegritasAuth({
    connectedDeviceId: "device-1",
    integritasUserId: "user-1",
    accessTokenEnc: crypto.encryptIntegritasToken("access-token"),
    refreshTokenEnc: crypto.encryptIntegritasToken("refresh-token"),
    apiKeyEnc,
    tokenExpiresAt: new Date(Date.now() + 60_000).toISOString()
  });
}

describe("getConnectedIntegritasApiKey", () => {
  it("returns an empty string when there is no integritas_auth row", () => {
    assert.equal(secrets.getConnectedIntegritasApiKey(), "");
  });

  it("returns an empty string when api_key_enc is null", () => {
    upsertAuth(null);
    assert.equal(secrets.getConnectedIntegritasApiKey(), "");
  });

  it("decrypts and returns the stored API key", () => {
    upsertAuth(crypto.encryptIntegritasToken("sk-real-key"));
    assert.equal(secrets.getConnectedIntegritasApiKey(), "sk-real-key");
  });

  it("returns an empty string when the stored ciphertext is malformed", () => {
    upsertAuth("not-valid-ciphertext");
    assert.equal(secrets.getConnectedIntegritasApiKey(), "");
  });
});

describe("getIntegritasApiKey", () => {
  it("mirrors getConnectedIntegritasApiKey", () => {
    upsertAuth(crypto.encryptIntegritasToken("sk-mirror-key"));
    assert.equal(secrets.getIntegritasApiKey(), "sk-mirror-key");
  });
});

describe("integritasApiKeySource", () => {
  it("returns 'none' when there is no connected API key", () => {
    assert.equal(secrets.integritasApiKeySource(), "none");
  });

  it("returns 'connect' when a connected API key is present", () => {
    upsertAuth(crypto.encryptIntegritasToken("sk-source-key"));
    assert.equal(secrets.integritasApiKeySource(), "connect");
  });
});
