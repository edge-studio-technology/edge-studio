import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import {
  IntegritasConnectError,
  getActivationStatus,
  getMe,
  refreshToken,
  startActivation
} from "../../../src/features/integritas-auth/integritas-auth-client.service.js";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

describe("startActivation", () => {
  it("posts to /api/device/start and maps a successful response", async () => {
    fetchMock.mockResolvedValue(
      mockResponse(200, {
        success: true,
        data: {
          activationId: "act-1",
          userCode: "ABCD-1234",
          verificationUrl: "https://example.com/verify",
          expiresAt: "2026-01-01T00:00:00.000Z",
          pollIntervalSeconds: 3
        }
      })
    );

    const result = await startActivation({ deviceId: "d1", deviceName: "Pi", deviceType: "raspberry_pi" });

    assert.equal(result.activationId, "act-1");
    assert.equal(result.pollIntervalSeconds, 3);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    assert.ok(url.endsWith("/api/device/start"));
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body as string), { deviceId: "d1", deviceName: "Pi", deviceType: "raspberry_pi" });
  });

  it("falls back to the env default poll interval when omitted", async () => {
    fetchMock.mockResolvedValue(
      mockResponse(200, {
        success: true,
        data: { activationId: "act-1", userCode: "CODE", verificationUrl: "https://example.com", expiresAt: "2026-01-01T00:00:00.000Z" }
      })
    );

    const result = await startActivation({ deviceId: "d1", deviceName: "Pi", deviceType: "raspberry_pi" });
    assert.equal(typeof result.pollIntervalSeconds, "number");
  });

  it("throws when the response is missing a required field", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { success: true, data: { activationId: "act-1" } }));

    await assert.rejects(
      () => startActivation({ deviceId: "d1", deviceName: "Pi", deviceType: "raspberry_pi" }),
      IntegritasConnectError
    );
  });
});

describe("getActivationStatus", () => {
  it("returns a pending result with expiresAt", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { success: true, data: { status: "pending", expiresAt: "2026-01-01T00:00:00.000Z" } }));

    const result = await getActivationStatus({ activationId: "act-1", deviceId: "d1" });
    assert.deepEqual(result, { status: "pending", expiresAt: "2026-01-01T00:00:00.000Z" });
  });

  it("throws when a pending status is missing expiresAt", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { success: true, data: { status: "pending" } }));
    await assert.rejects(() => getActivationStatus({ activationId: "act-1", deviceId: "d1" }), IntegritasConnectError);
  });

  it("returns an approved result with tokens and device", async () => {
    fetchMock.mockResolvedValue(
      mockResponse(200, {
        success: true,
        data: {
          status: "approved",
          tokens: { accessToken: "at", refreshToken: "rt", expiresIn: 3600, tokenType: "Bearer" },
          device: { id: "conn-1", deviceId: "d1", name: "Pi" }
        }
      })
    );

    const result = await getActivationStatus({ activationId: "act-1", deviceId: "d1" });
    assert.equal(result.status, "approved");
    if (result.status === "approved") {
      assert.equal(result.tokens.accessToken, "at");
      assert.equal(result.device.id, "conn-1");
    }
  });

  it("throws when an approved status is missing tokens or device", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { success: true, data: { status: "approved" } }));
    await assert.rejects(() => getActivationStatus({ activationId: "act-1", deviceId: "d1" }), IntegritasConnectError);
  });

  it("returns terminal statuses (denied/expired/connected) with no extra fields", async () => {
    for (const status of ["denied", "expired", "connected"]) {
      fetchMock.mockResolvedValue(mockResponse(200, { success: true, data: { status } }));
      const result = await getActivationStatus({ activationId: "act-1", deviceId: "d1" });
      assert.deepEqual(result, { status });
    }
  });

  it("throws for an unrecognized status", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { success: true, data: { status: "bogus" } }));
    await assert.rejects(() => getActivationStatus({ activationId: "act-1", deviceId: "d1" }), IntegritasConnectError);
  });

  it("passes activationId/deviceId as query parameters", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { success: true, data: { status: "denied" } }));
    await getActivationStatus({ activationId: "act-1", deviceId: "d1" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("activationId"), "act-1");
    assert.equal(parsed.searchParams.get("deviceId"), "d1");
    assert.equal(init.method, "GET");
  });
});

describe("getMe", () => {
  it("sends the access token as a bearer header and returns the data payload", async () => {
    const me = { user: { id: "u1" } };
    fetchMock.mockResolvedValue(mockResponse(200, { success: true, data: me }));

    const result = await getMe("my-access-token");

    assert.deepEqual(result, me);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer my-access-token");
  });
});

describe("refreshToken", () => {
  it("posts refreshToken/deviceId and maps a successful response", async () => {
    fetchMock.mockResolvedValue(
      mockResponse(200, { success: true, data: { accessToken: "at", refreshToken: "rt", expiresIn: 3600 } })
    );

    const result = await refreshToken({ refreshToken: "old-rt", deviceId: "d1" });

    assert.equal(result.accessToken, "at");
    assert.equal(result.refreshToken, "rt");
    assert.equal(result.tokenType, "Bearer");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    assert.deepEqual(JSON.parse(init.body as string), { refreshToken: "old-rt", deviceId: "d1" });
  });

  it("throws when the response is missing tokens", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { success: true, data: {} }));
    await assert.rejects(() => refreshToken({ refreshToken: "old-rt", deviceId: "d1" }), IntegritasConnectError);
  });
});

describe("error mapping", () => {
  it("throws with the upstream message/code when success:false", async () => {
    fetchMock.mockResolvedValue(mockResponse(401, { success: false, message: "Device revoked", code: "DEVICE_REVOKED" }));

    await assert.rejects(() => getMe("token"), (error: unknown) => {
      assert.ok(error instanceof IntegritasConnectError);
      assert.equal(error.status, 401);
      assert.equal(error.code, "DEVICE_REVOKED");
      assert.equal(error.message, "Device revoked");
      return true;
    });
  });

  it("throws an HTTP-status error for a non-ok response with no success field", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "server error" });

    await assert.rejects(() => getMe("token"), (error: unknown) => {
      assert.ok(error instanceof IntegritasConnectError);
      assert.equal(error.status, 500);
      return true;
    });
  });

  it("throws a timeout-flavored error for an AbortError", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));

    await assert.rejects(() => getMe("token"), (error: unknown) => {
      assert.ok(error instanceof IntegritasConnectError);
      assert.equal(error.status, 502);
      assert.match(error.message, /timed out/);
      return true;
    });
  });

  it("throws for a well-formed but unexpected success response shape", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { success: true }));
    await assert.rejects(() => getMe("token"), IntegritasConnectError);
  });
});
