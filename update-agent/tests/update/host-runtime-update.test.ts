import { createHash } from "node:crypto";
import { beforeEach, describe, it, vi } from "vitest";
import * as assert from "node:assert/strict";

const mockEnv = {
  hostAgentUrl: "http://host-agent:38182",
  hostAgentToken: "host-token"
};

vi.mock("../../src/config/env.js", () => ({ env: mockEnv }));

const { updateHostRuntime } = await import("../../src/update/host-runtime-update.js");

function okResponse(body: Buffer | string = "{}") {
  const buf = typeof body === "string" ? Buffer.from(body) : body;
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    json: async () => JSON.parse(buf.toString("utf8"))
  } as Response;
}

function errorResponse(status: number, body: unknown = {}) {
  return {
    ok: false,
    status,
    arrayBuffer: async () => new ArrayBuffer(0),
    json: async () => body
  } as Response;
}

describe("host-runtime-update", () => {
  beforeEach(() => {
    mockEnv.hostAgentUrl = "http://host-agent:38182";
    mockEnv.hostAgentToken = "host-token";
    vi.unstubAllGlobals();
  });

  it("returns a failure when host-agent config is missing", async () => {
    mockEnv.hostAgentUrl = "";

    const result = await updateHostRuntime({ url: "https://example.com/runtime.tar.gz", sha256: "a".repeat(64) });

    assert.deepEqual(result, { service: "host-runtime", updated: false, reason: "HOST_AGENT_URL is not configured" });
  });

  it("verifies the artifact hash before posting to the host-agent", async () => {
    const artifact = Buffer.from("artifact");
    const sha256 = createHash("sha256").update(artifact).digest("hex");
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === "https://example.com/runtime.tar.gz") return okResponse(artifact);
      if (url === "http://host-agent:38182/updates/host-runtime/apply") return okResponse(JSON.stringify({ updated: true, restarts: [] }));
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateHostRuntime({ url: "https://example.com/runtime.tar.gz", sha256 });

    assert.deepEqual(result, { service: "host-runtime", updated: true, reason: "updated host runtime" });
    assert.equal(fetchMock.mock.calls.length, 2);
    const applyInit = fetchMock.mock.calls[1][1] as RequestInit;
    assert.equal((applyInit.headers as Record<string, string>).Authorization, "Bearer host-token");
  });

  it("does not post to the host-agent when the artifact hash mismatches", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(Buffer.from("artifact"))));

    const result = await updateHostRuntime({ url: "https://example.com/runtime.tar.gz", sha256: "b".repeat(64) });

    assert.deepEqual(result, { service: "host-runtime", updated: false, reason: "host runtime artifact SHA-256 did not match manifest" });
  });

  it("returns the host-agent error message when apply fails", async () => {
    const artifact = Buffer.from("artifact");
    const sha256 = createHash("sha256").update(artifact).digest("hex");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "https://example.com/runtime.tar.gz") return okResponse(artifact);
        return errorResponse(400, { error: "bad host runtime" });
      })
    );

    const result = await updateHostRuntime({ url: "https://example.com/runtime.tar.gz", sha256 });

    assert.deepEqual(result, { service: "host-runtime", updated: false, reason: "bad host runtime" });
  });

  it("returns failure when the host-agent reports a failed restart", async () => {
    const artifact = Buffer.from("artifact");
    const sha256 = createHash("sha256").update(artifact).digest("hex");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "https://example.com/runtime.tar.gz") return okResponse(artifact);
        return okResponse(JSON.stringify({ updated: true, restarts: [{ service: "edge-studio-host-agent.service", ok: false, message: "restart failed" }] }));
      })
    );

    const result = await updateHostRuntime({ url: "https://example.com/runtime.tar.gz", sha256 });

    assert.deepEqual(result, { service: "host-runtime", updated: false, reason: "host runtime updated but edge-studio-host-agent.service restart failed: restart failed" });
  });
});
