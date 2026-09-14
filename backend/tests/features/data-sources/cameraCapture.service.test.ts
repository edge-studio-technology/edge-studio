import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import type { DataSourceRecord } from "../../../src/features/data-sources/dataSources.repository.js";

const envMock = vi.hoisted(() => ({
  cameraEnabled: true,
  cameraCaptureDir: "/captures",
  cameraHelperUrl: "http://camera-helper",
  cameraHelperToken: "camera-token",
  cameraRetentionDays: 7
}));
vi.mock("../../../src/config/env.js", () => ({ env: envMock }));

const repoMock = vi.hoisted(() => ({ getDataSource: vi.fn() }));
vi.mock("../../../src/features/data-sources/dataSources.repository.js", () => repoMock);

const fsMock = vi.hoisted(() => ({
  readFile: vi.fn(),
  stat: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn()
}));
vi.mock("node:fs/promises", () => ({ default: fsMock }));

const { getCameraCapability, capturePiCamera } = await import("../../../src/features/data-sources/cameraCapture.service.js");

const fetchMock = vi.fn();

function makeRecord(overrides: Partial<DataSourceRecord> = {}): DataSourceRecord {
  return {
    id: "src-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    name: "Pi Camera",
    type: "pi-camera",
    status: "active",
    description: null,
    config: JSON.stringify({ mode: "photo" }),
    last_read_at: null,
    last_error: null,
    last_preview: null,
    last_hash: null,
    ...overrides
  };
}

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

beforeEach(() => {
  envMock.cameraEnabled = true;
  envMock.cameraCaptureDir = "/captures";
  envMock.cameraHelperUrl = "http://camera-helper";
  envMock.cameraHelperToken = "camera-token";
  envMock.cameraRetentionDays = 7;
  repoMock.getDataSource.mockReset();
  fsMock.readFile.mockReset();
  fsMock.stat.mockReset();
  fsMock.readdir.mockReset().mockResolvedValue([]);
  fsMock.unlink.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getCameraCapability", () => {
  it("reports disabled without calling the helper when the camera is off", async () => {
    envMock.cameraEnabled = false;
    const result = await getCameraCapability();
    assert.deepEqual(result, { available: false, enabled: false, captureDir: "/captures", reason: "Camera support is disabled. Enable it from Devices -> Hardware support." });
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("merges the helper's capabilities response when health and capabilities succeed", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, { up: true }))
      .mockResolvedValueOnce(mockResponse(200, { available: true, resolutions: ["1280x720"] }));

    const result = await getCameraCapability();
    assert.deepEqual(result, { enabled: true, captureDir: "/captures", available: true, resolutions: ["1280x720"] });

    const [healthUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    assert.equal(healthUrl, "http://camera-helper/health");
  });

  it("reports unavailable with a reason when the helper is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("connection refused"));
    const result = await getCameraCapability();
    assert.equal(result.available, false);
    assert.equal(result.enabled, true);
    assert.match(result.reason!, /Camera helper is unavailable at http:\/\/camera-helper: connection refused/);
  });
});

describe("capturePiCamera", () => {
  it("throws when the camera is unavailable", async () => {
    envMock.cameraEnabled = false;
    await assert.rejects(capturePiCamera({ sourceId: "src-1" }), /Camera support is disabled/);
  });

  it("throws when the source does not exist", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { available: true }));
    repoMock.getDataSource.mockReturnValue(undefined);
    await assert.rejects(capturePiCamera({ sourceId: "missing" }), /requires a Pi Camera device/);
  });

  it("throws when the source is not a pi-camera type", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { available: true }));
    repoMock.getDataSource.mockReturnValue(makeRecord({ type: "mqtt" }));
    await assert.rejects(capturePiCamera({ sourceId: "src-1" }), /requires a Pi Camera device/);
  });

  it("captures, hashes bytes, and prunes old captures", async () => {
    repoMock.getDataSource.mockReturnValue(makeRecord());
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, { up: true }))
      .mockResolvedValueOnce(mockResponse(200, { available: true }))
      .mockResolvedValueOnce(mockResponse(200, {
        source: "pi-camera-helper",
        mode: "photo",
        fileName: "capture-1.jpg",
        path: "/captures/capture-1.jpg",
        mediaType: "image/jpeg",
        sizeBytes: 0,
        sha3: "",
        capturedAt: "2026-01-01T00:00:00.000Z",
        width: 1280,
        height: 720,
        durationMs: 1000
      }));

    fsMock.readFile.mockResolvedValue(Buffer.from("jpeg-bytes"));
    const capturePath = path.resolve("/captures/capture-1.jpg");
    fsMock.stat.mockImplementation(async (filePath: string) => (filePath === capturePath ? { size: 10, isFile: () => true, mtimeMs: Date.now() } : { size: 1, isFile: () => true, mtimeMs: 0 }));

    const result = await capturePiCamera({ sourceId: "src-1" });

    assert.equal(result.contentType, "image/jpeg");
    assert.equal(result.sizeBytes, 10);
    assert.ok(result.bytesHash);
    assert.equal(result.preview.path, capturePath);
    assert.equal(result.preview.sizeBytes, 10);

    const captureCall = fetchMock.mock.calls[2] as [string, RequestInit];
    assert.equal(captureCall[0], "http://camera-helper/capture");
    const capturePayload = JSON.parse(captureCall[1].body as string) as Record<string, unknown>;
    assert.equal(capturePayload.mode, "photo");
    assert.equal(capturePayload.sourceName, "Pi Camera");
  });

  it("rejects a helper-returned path outside the capture directory", async () => {
    repoMock.getDataSource.mockReturnValue(makeRecord());
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, { up: true }))
      .mockResolvedValueOnce(mockResponse(200, { available: true }))
      .mockResolvedValueOnce(mockResponse(200, {
        path: "/etc/passwd",
        mode: "photo",
        mediaType: "image/jpeg",
        width: 1280,
        height: 720,
        durationMs: 1000
      }));

    await assert.rejects(capturePiCamera({ sourceId: "src-1" }), /path outside the capture directory/);
  });

  it("prunes files older than the retention window and leaves newer ones", async () => {
    repoMock.getDataSource.mockReturnValue(makeRecord());
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, { up: true }))
      .mockResolvedValueOnce(mockResponse(200, { available: true }))
      .mockResolvedValueOnce(mockResponse(200, {
        path: "/captures/capture-1.jpg",
        mode: "photo",
        mediaType: "image/jpeg",
        width: 1280,
        height: 720,
        durationMs: 1000
      }));

    fsMock.readFile.mockResolvedValue(Buffer.from("bytes"));
    const capturePath = path.resolve("/captures/capture-1.jpg");
    const oldPath = path.join("/captures", "old.jpg");
    const now = Date.now();
    const old = now - 10 * 24 * 60 * 60 * 1000;
    fsMock.stat.mockImplementation(async (filePath: string) => {
      if (filePath === capturePath) return { size: 5, isFile: () => true, mtimeMs: now };
      if (filePath === oldPath) return { size: 5, isFile: () => true, mtimeMs: old };
      return { size: 5, isFile: () => true, mtimeMs: now };
    });
    fsMock.readdir.mockResolvedValue(["capture-1.jpg", "old.jpg", "recent.jpg"]);

    await capturePiCamera({ sourceId: "src-1" });

    assert.deepEqual(fsMock.unlink.mock.calls.map((call) => call[0]), [oldPath]);
  });

  it("does not prune when retention is disabled", async () => {
    envMock.cameraRetentionDays = 0;
    repoMock.getDataSource.mockReturnValue(makeRecord());
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, { up: true }))
      .mockResolvedValueOnce(mockResponse(200, { available: true }))
      .mockResolvedValueOnce(mockResponse(200, {
        path: "/captures/capture-1.jpg",
        mode: "photo",
        mediaType: "image/jpeg",
        width: 1280,
        height: 720,
        durationMs: 1000
      }));
    fsMock.readFile.mockResolvedValue(Buffer.from("bytes"));
    fsMock.stat.mockResolvedValue({ size: 5, isFile: () => true, mtimeMs: Date.now() });

    await capturePiCamera({ sourceId: "src-1" });
    assert.equal(fsMock.readdir.mock.calls.length, 0);
  });
});
