import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { beforeEach, describe, it, vi } from "vitest";

const { fetchJsonWithTimeoutMock, getIntegritasApiKeyMock } = vi.hoisted(() => ({
  fetchJsonWithTimeoutMock: vi.fn(),
  getIntegritasApiKeyMock: vi.fn()
}));

vi.mock("../../../src/config/env.js", () => ({
  env: {
    integritasBaseUrl: "https://integritas.example",
    integritasRequestId: "req-1",
    databasePath: "/data/test.db",
    hostFilesRoot: "/host-files"
  }
}));
vi.mock("../../../src/shared/http.js", () => ({ fetchJsonWithTimeout: fetchJsonWithTimeoutMock }));
vi.mock("../../../src/features/settings/secrets.service.js", () => ({ getIntegritasApiKey: getIntegritasApiKeyMock }));
vi.mock("../../../src/features/minima/minima.service.js", () => ({ getMinimaNodeStatus: vi.fn(async () => ({ state: "running", checkedAt: "2026-01-01T00:00:00.000Z", sync: {}, health: {}, container: {} })) }));
vi.mock("../../../src/features/status/docker.service.js", () => ({ dockerServiceResources: vi.fn(async () => []), diskUsage: vi.fn(async () => ({})) }));
vi.mock("../../../src/features/status/device.service.js", () => ({ getDeviceInfo: vi.fn(() => ({ hostname: "pi" })) }));
vi.mock("../../../src/features/auth/setup.service.js", () => ({ isSetupComplete: vi.fn(() => true) }));

/** `status.routes.ts` memoizes the Integritas check in a module-level cache with a one-hour TTL and no exported reset, so each case needs a fresh module instance. */
async function loadStatusApp() {
  vi.resetModules();
  const { statusRouter } = await import("../../../src/features/status/status.routes.js");
  const app = express();
  app.use("/api/status", statusRouter);
  return app;
}

function okResponse(status: number, body: unknown) {
  return { response: { ok: status >= 200 && status < 300, status }, body };
}

describe("status routes integritas connection check", () => {
  beforeEach(() => {
    fetchJsonWithTimeoutMock.mockReset();
    getIntegritasApiKeyMock.mockReset().mockReturnValue("api-key-1");
  });

  it("reports integritasConnected false when Integritas rejects the key", async () => {
    fetchJsonWithTimeoutMock.mockResolvedValue(okResponse(401, { error: "unauthorized" }));

    const response = await request(await loadStatusApp()).get("/api/status");

    assert.equal(response.status, 200);
    assert.equal(response.body.app.integritasConfigured, true);
    assert.equal(response.body.app.integritasConnected, false);
  });

  it("reports the failing status code on the overview", async () => {
    fetchJsonWithTimeoutMock.mockResolvedValue(okResponse(403, { error: "forbidden" }));

    const response = await request(await loadStatusApp()).get("/api/status/overview");

    const integritas = (response.body.services as { name: string; ok: boolean; status: string }[]).find((service) => service.name === "integritas");
    assert.equal(integritas?.ok, false);
    assert.equal(integritas?.status, "HTTP 403");
  });

  it("reports integritasConnected true when the health check succeeds", async () => {
    fetchJsonWithTimeoutMock.mockResolvedValue(okResponse(200, { status: "ok" }));

    const response = await request(await loadStatusApp()).get("/api/status");

    assert.equal(response.body.app.integritasConnected, true);
  });

  it("reports an error status when the health check throws", async () => {
    fetchJsonWithTimeoutMock.mockRejectedValue(new Error("connect ETIMEDOUT"));

    const response = await request(await loadStatusApp()).get("/api/status/overview");

    const integritas = (response.body.services as { name: string; ok: boolean; status: string; error?: string }[]).find((service) => service.name === "integritas");
    assert.equal(integritas?.ok, false);
    assert.equal(integritas?.status, "error");
    assert.equal(integritas?.error, "connect ETIMEDOUT");
  });

  it("reports missing_api_key without calling Integritas when no key is configured", async () => {
    getIntegritasApiKeyMock.mockReturnValue(null);

    const response = await request(await loadStatusApp()).get("/api/status/overview");

    const integritas = (response.body.services as { name: string; status: string }[]).find((service) => service.name === "integritas");
    assert.equal(integritas?.status, "missing_api_key");
    assert.equal(fetchJsonWithTimeoutMock.mock.calls.length, 0);
  });

  it("reuses the cached check across requests within the TTL", async () => {
    fetchJsonWithTimeoutMock.mockResolvedValue(okResponse(200, { status: "ok" }));
    const app = await loadStatusApp();

    await request(app).get("/api/status");
    await request(app).get("/api/status/overview");

    assert.equal(fetchJsonWithTimeoutMock.mock.calls.length, 1);
  });
});
