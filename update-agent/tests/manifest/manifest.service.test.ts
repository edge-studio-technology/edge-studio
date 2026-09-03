import { describe, it, beforeEach, afterEach, vi } from "vitest";
import * as assert from "node:assert/strict";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const manifestPublicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;

const mockEnv = {
  manifestUrl: "https://primary.example.com/release/manifest.json",
  manifestPublicKey: manifestPublicKeyPem
};

vi.mock("../../src/config/env.js", () => ({ env: mockEnv }));

const getLastAppliedManifestTimestamp = vi.fn<() => Promise<number | null>>();
vi.mock("../../src/manifest/manifest-state.js", () => ({
  getLastAppliedManifestTimestamp: () => getLastAppliedManifestTimestamp()
}));

const { fetchVerifiedManifest } = await import("../../src/manifest/manifest.service.js");
type Manifest = Awaited<ReturnType<typeof fetchVerifiedManifest>>;

const FALLBACK_URL =
  "https://raw.githubusercontent.com/edge-studio-technology/edge-studio-manifests/main/edge-studio/release/manifest.json";

function signManifest(manifest: Manifest): { bytes: Buffer; signatureBase64: string } {
  const bytes = Buffer.from(JSON.stringify(manifest));
  const signature = cryptoSign(null, bytes, privateKey);
  return { bytes, signatureBase64: signature.toString("base64") };
}

function okResponse(body: Buffer | string) {
  const buf = typeof body === "string" ? Buffer.from(body) : body;
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    text: async () => buf.toString("utf8")
  } as Response;
}

function errorResponse(status: number) {
  return { ok: false, status, arrayBuffer: async () => new ArrayBuffer(0), text: async () => "" } as Response;
}

function baseManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    frontend: "sha256:frontend",
    backend: "sha256:backend",
    updateAgent: "sha256:update-agent",
    version: "1.2.3",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides
  };
}

describe("manifest.service", () => {
  beforeEach(() => {
    mockEnv.manifestUrl = "https://primary.example.com/release/manifest.json";
    mockEnv.manifestPublicKey = manifestPublicKeyPem;
    getLastAppliedManifestTimestamp.mockReset();
    getLastAppliedManifestTimestamp.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("fetchVerifiedManifest", () => {
    it("throws when MANIFEST_URL is not configured", async () => {
      mockEnv.manifestUrl = "";

      await assert.rejects(fetchVerifiedManifest(), /MANIFEST_URL is not configured/);
    });

    it("throws when the manifest public key is not configured", async () => {
      mockEnv.manifestPublicKey = "";

      await assert.rejects(fetchVerifiedManifest(), /MANIFEST_PUBLIC_KEY is not configured/);
    });

    it("fetches, verifies, and returns a validly-signed manifest", async () => {
      const manifest = baseManifest();
      const { bytes, signatureBase64 } = signManifest(manifest);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url === mockEnv.manifestUrl) return okResponse(bytes);
          if (url === `${mockEnv.manifestUrl}.sig`) return okResponse(signatureBase64);
          throw new Error(`unexpected url ${url}`);
        })
      );

      const result = await fetchVerifiedManifest();

      assert.deepEqual(result, manifest);
    });

    it("requests the signature at the manifest URL's path with .sig appended, preserving the query string", async () => {
      mockEnv.manifestUrl = "https://primary.example.com/release/manifest.json?token=abc";
      const manifest = baseManifest();
      const { bytes, signatureBase64 } = signManifest(manifest);
      const fetchMock = vi.fn(async (url: string) => {
        if (url === mockEnv.manifestUrl) return okResponse(bytes);
        if (url === "https://primary.example.com/release/manifest.json.sig?token=abc") return okResponse(signatureBase64);
        throw new Error(`unexpected url ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      await fetchVerifiedManifest();

      assert.equal(fetchMock.mock.calls.length, 2);
    });

    it("throws when the signature response is not ok", async () => {
      const manifest = baseManifest();
      const { bytes } = signManifest(manifest);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url === mockEnv.manifestUrl) return okResponse(bytes);
          return errorResponse(500);
        })
      );

      await assert.rejects(fetchVerifiedManifest(), /Failed to fetch manifest signature: HTTP 500/);
    });

    it("falls back to the well-known manifest URL when the primary URL fails", async () => {
      const manifest = baseManifest();
      const { bytes, signatureBase64 } = signManifest(manifest);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url === mockEnv.manifestUrl || url === `${mockEnv.manifestUrl}.sig`) return errorResponse(500);
          if (url === FALLBACK_URL) return okResponse(bytes);
          if (url === `${FALLBACK_URL}.sig`) return okResponse(signatureBase64);
          throw new Error(`unexpected url ${url}`);
        })
      );

      const result = await fetchVerifiedManifest();

      assert.deepEqual(result, manifest);
    });

    it("throws the primary error when both the primary and fallback URLs fail", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => errorResponse(500)));

      await assert.rejects(fetchVerifiedManifest(), /Failed to fetch manifest: HTTP 500/);
    });

    it("does not attempt a second fetch when the primary URL is already the fallback URL", async () => {
      mockEnv.manifestUrl = FALLBACK_URL;
      const fetchMock = vi.fn(async () => errorResponse(500));
      vi.stubGlobal("fetch", fetchMock);

      await assert.rejects(fetchVerifiedManifest(), /Failed to fetch manifest: HTTP 500/);
      assert.equal(fetchMock.mock.calls.length, 2);
    });

    it("throws when the signature does not verify against the manifest bytes", async () => {
      const manifest = baseManifest();
      const { bytes } = signManifest(manifest);
      const wrongSignature = cryptoSign(null, Buffer.from("tampered"), privateKey).toString("base64");
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url === mockEnv.manifestUrl) return okResponse(bytes);
          return okResponse(wrongSignature);
        })
      );

      await assert.rejects(fetchVerifiedManifest(), /Manifest signature verification failed/);
    });

    it("throws when the manifest is missing a required field", async () => {
      const incomplete = { ...baseManifest(), updateAgent: undefined };
      delete (incomplete as Record<string, unknown>).updateAgent;
      const bytes = Buffer.from(JSON.stringify(incomplete));
      const signatureBase64 = cryptoSign(null, bytes, privateKey).toString("base64");
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url === mockEnv.manifestUrl) return okResponse(bytes);
          return okResponse(signatureBase64);
        })
      );

      await assert.rejects(fetchVerifiedManifest(), /Manifest is missing required fields/);
    });

    it("throws when createdAt is not a parseable date", async () => {
      const manifest = baseManifest({ createdAt: "not-a-date" });
      const { bytes, signatureBase64 } = signManifest(manifest);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url === mockEnv.manifestUrl) return okResponse(bytes);
          return okResponse(signatureBase64);
        })
      );

      await assert.rejects(fetchVerifiedManifest(), /Manifest is missing required fields/);
    });

    it("throws when the manifest is strictly older than the last applied manifest", async () => {
      const manifest = baseManifest({ createdAt: "2026-08-01T00:00:00.000Z" });
      const { bytes, signatureBase64 } = signManifest(manifest);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url === mockEnv.manifestUrl) return okResponse(bytes);
          return okResponse(signatureBase64);
        })
      );
      getLastAppliedManifestTimestamp.mockResolvedValue(Date.parse("2026-08-02T00:00:00.000Z"));

      await assert.rejects(fetchVerifiedManifest(), /refusing to apply a replayed or downgraded manifest/);
    });

    it("allows a manifest with the same createdAt as the last applied manifest", async () => {
      const manifest = baseManifest({ createdAt: "2026-08-01T00:00:00.000Z" });
      const { bytes, signatureBase64 } = signManifest(manifest);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url === mockEnv.manifestUrl) return okResponse(bytes);
          return okResponse(signatureBase64);
        })
      );
      getLastAppliedManifestTimestamp.mockResolvedValue(Date.parse("2026-08-01T00:00:00.000Z"));

      const result = await fetchVerifiedManifest();

      assert.deepEqual(result, manifest);
    });

    it("allows a manifest newer than the last applied manifest", async () => {
      const manifest = baseManifest({ createdAt: "2026-08-02T00:00:00.000Z" });
      const { bytes, signatureBase64 } = signManifest(manifest);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url === mockEnv.manifestUrl) return okResponse(bytes);
          return okResponse(signatureBase64);
        })
      );
      getLastAppliedManifestTimestamp.mockResolvedValue(Date.parse("2026-08-01T00:00:00.000Z"));

      const result = await fetchVerifiedManifest();

      assert.deepEqual(result, manifest);
    });
  });
});
