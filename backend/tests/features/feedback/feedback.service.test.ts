import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";
import type { SessionUser } from "../../../src/features/auth/auth.types.js";

const {
  getIntegritasAuthMock,
  getMinimaNodeStatusMock,
  getIntegritasApiKeyMock,
  getDeviceInfoMock,
  sendHostedFeedbackMock,
  fetchJsonWithTimeoutMock
} = vi.hoisted(() => ({
  getIntegritasAuthMock: vi.fn(),
  getMinimaNodeStatusMock: vi.fn(),
  getIntegritasApiKeyMock: vi.fn(),
  getDeviceInfoMock: vi.fn(),
  sendHostedFeedbackMock: vi.fn(),
  fetchJsonWithTimeoutMock: vi.fn()
}));

vi.mock("../../../src/features/integritas-auth/integritas-auth.repository.js", () => ({
  getIntegritasAuth: getIntegritasAuthMock
}));

vi.mock("../../../src/features/minima/minima.service.js", () => ({
  getMinimaNodeStatus: getMinimaNodeStatusMock
}));

vi.mock("../../../src/features/settings/secrets.service.js", () => ({
  getIntegritasApiKey: getIntegritasApiKeyMock
}));

vi.mock("../../../src/features/status/device.service.js", () => ({
  getDeviceInfo: getDeviceInfoMock
}));

vi.mock("../../../src/features/feedback/feedback.remote.js", () => ({
  HOSTED_FEEDBACK_ENDPOINT: "https://integritas.technology/api/feedback",
  sendHostedFeedback: sendHostedFeedbackMock
}));

vi.mock("../../../src/shared/http.js", () => ({
  fetchJsonWithTimeout: fetchJsonWithTimeoutMock
}));

let teardown: () => void;
let dataDir: string;
let service: typeof import("../../../src/features/feedback/feedback.service.js");

const user: SessionUser = {
  id: "user-1",
  displayName: "Admin",
  role: "admin",
  lastLogin: null,
  credentialType: "password"
};

const deviceInfo = { id: "device-1", hostname: "pi", platform: "linux", arch: "arm64" };

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "feedback-service-test-"));
  process.env.DATA_DIR = dataDir;

  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;

  service = await import("../../../src/features/feedback/feedback.service.js");
});

afterAll(() => {
  teardown();
  delete process.env.DATA_DIR;
  fs.rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  getIntegritasAuthMock.mockReturnValue(null);
  getMinimaNodeStatusMock.mockResolvedValue({ state: "running", checkedAt: "2026-01-01T00:00:00.000Z" });
  getIntegritasApiKeyMock.mockReturnValue("");
  getDeviceInfoMock.mockReturnValue(deviceInfo);
  sendHostedFeedbackMock.mockReset();
  fetchJsonWithTimeoutMock.mockReset();
  fs.rmSync(path.join(dataDir, "feedback"), { recursive: true, force: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

const validInput = {
  type: "bug",
  description: "Something broke",
  page: { path: "/dashboard", label: "Dashboard" },
  area: { id: "dashboard", label: "Dashboard" },
  bug: { severity: "high", reproducibility: "always" },
  hostedConsent: true
};

describe("getFeedbackExportPath", () => {
  it("points at feedback/feedback-submissions.json under dataDir", () => {
    assert.equal(service.getFeedbackExportPath(), path.join(dataDir, "feedback", "feedback-submissions.json"));
  });
});

describe("getFeedbackConfig", () => {
  it("reports hosted feedback unavailable when no API key is configured", () => {
    getIntegritasApiKeyMock.mockReturnValue("");
    const config = service.getFeedbackConfig();
    assert.equal(config.hostedFeedbackEnabled, true);
    assert.equal(config.hostedFeedbackAvailable, false);
    assert.equal(config.integritasApiKeyConfigured, false);
  });

  it("reports hosted feedback available when an API key is configured", () => {
    getIntegritasApiKeyMock.mockReturnValue("key-1");
    const config = service.getFeedbackConfig();
    assert.equal(config.hostedFeedbackAvailable, true);
  });
});

describe("getEmptyFeedbackDocument", () => {
  it("builds a document with metadata and no submissions", () => {
    getIntegritasAuthMock.mockReturnValue({ integritas_user_id: "iuser-1" });
    const doc = service.getEmptyFeedbackDocument(user, "2026-01-01T00:00:00.000Z");
    assert.equal(doc.schemaVersion, 1);
    assert.deepEqual(doc.submissions, []);
    assert.equal(doc.metadata.user.id, "user-1");
    assert.equal(doc.metadata.device, deviceInfo);
    assert.equal(doc.metadata.integritasAccount.userId, "iuser-1");
    assert.equal(doc.metadata.createdAt, "2026-01-01T00:00:00.000Z");
  });

  it("falls back to a null integritas user id when not connected", () => {
    getIntegritasAuthMock.mockReturnValue(null);
    const doc = service.getEmptyFeedbackDocument(user);
    assert.equal(doc.metadata.integritasAccount.userId, null);
  });
});

describe("appendFeedbackSubmission validation", () => {
  it("rejects an unknown feedback type", async () => {
    await assert.rejects(
      () => service.appendFeedbackSubmission({ ...validInput, type: "nope" }, user),
      /Choose a feedback type/
    );
  });

  it("rejects a missing description", async () => {
    await assert.rejects(
      () => service.appendFeedbackSubmission({ ...validInput, description: "" }, user),
      /Feedback description is required/
    );
  });

  it("rejects an over-length description", async () => {
    await assert.rejects(
      () => service.appendFeedbackSubmission({ ...validInput, description: "x".repeat(10_001) }, user),
      /10000 characters or fewer/
    );
  });

  it("rejects a missing page path", async () => {
    await assert.rejects(
      () => service.appendFeedbackSubmission({ ...validInput, page: { path: "", label: "" } }, user),
      /Page path is required/
    );
  });

  it("rejects an unknown feedback area", async () => {
    await assert.rejects(
      () => service.appendFeedbackSubmission({ ...validInput, area: { id: "nope" } }, user),
      /Choose what the feedback is about/
    );
  });

  it("rejects an invalid bug severity", async () => {
    await assert.rejects(
      () => service.appendFeedbackSubmission({ ...validInput, bug: { severity: "extreme" } }, user),
      /Choose a valid bug severity/
    );
  });

  it("rejects an invalid feature priority", async () => {
    await assert.rejects(
      () => service.appendFeedbackSubmission({ ...validInput, type: "feature_request", featureRequest: { priority: "urgent" } }, user),
      /Choose a valid feature priority/
    );
  });

  it("requires hostedConsent when hosted feedback is available", async () => {
    getIntegritasApiKeyMock.mockReturnValue("key-1");
    await assert.rejects(
      () => service.appendFeedbackSubmission({ ...validInput, hostedConsent: false }, user),
      /Confirm consent/
    );
  });
});

describe("appendFeedbackSubmission without an API key", () => {
  it("writes the submission locally with a not_configured remote delivery status", async () => {
    getIntegritasApiKeyMock.mockReturnValue("");
    const result = await service.appendFeedbackSubmission(validInput, user);

    assert.equal(result.exportUrl, "/api/feedback/export");
    assert.equal(result.submission.remoteDelivery.status, "not_configured");
    assert.equal(sendHostedFeedbackMock.mock.calls.length, 0);
    assert.equal(fs.existsSync(service.getFeedbackExportPath()), true);
  });

  it("defaults bug severity/reproducibility when the bug object is omitted", async () => {
    const result = await service.appendFeedbackSubmission({ ...validInput, bug: undefined }, user);
    assert.deepEqual(result.submission.bug, { severity: "medium", reproducibility: "not_sure", expectedBehavior: null, actualBehavior: null });
  });

  it("defaults feature request priority when the featureRequest object is omitted", async () => {
    const result = await service.appendFeedbackSubmission({ ...validInput, type: "feature_request", bug: undefined, featureRequest: undefined }, user);
    assert.deepEqual(result.submission.featureRequest, { priority: "nice_to_have", desiredOutcome: null });
  });
});

describe("appendFeedbackSubmission with an API key", () => {
  beforeEach(() => {
    getIntegritasApiKeyMock.mockReturnValue("key-1");
  });

  it("marks delivery as sent on a successful hosted submission", async () => {
    sendHostedFeedbackMock.mockResolvedValue({ ok: true, remoteId: "remote-1", receivedAt: "2026-01-01T00:00:01.000Z" });
    const result = await service.appendFeedbackSubmission(validInput, user);

    assert.equal(result.submission.remoteDelivery.status, "sent");
    assert.equal(result.submission.remoteDelivery.remoteId, "remote-1");
    assert.equal(result.submission.remoteDelivery.attemptCount, 1);

    const exported = JSON.parse(service.getFeedbackExport(user));
    assert.equal(exported.submissions[0].remoteDelivery.status, "sent");
  });

  it("marks delivery as pending on a retryable hosted failure", async () => {
    sendHostedFeedbackMock.mockResolvedValue({ ok: false, retryable: true, error: "timeout" });
    const result = await service.appendFeedbackSubmission(validInput, user);

    assert.equal(result.submission.remoteDelivery.status, "pending");
    assert.equal(result.submission.remoteDelivery.lastError, "timeout");
  });

  it("marks delivery as failed on a non-retryable hosted failure", async () => {
    sendHostedFeedbackMock.mockResolvedValue({ ok: false, retryable: false, error: "rejected" });
    const result = await service.appendFeedbackSubmission(validInput, user);

    assert.equal(result.submission.remoteDelivery.status, "failed");
  });
});

describe("appendFeedbackSubmission operational status", () => {
  it("reports the node offline when the status check throws", async () => {
    getMinimaNodeStatusMock.mockRejectedValue(new Error("rpc down"));
    const result = await service.appendFeedbackSubmission(validInput, user);
    assert.equal(result.submission.operationalStatus.node.ok, false);
    assert.equal(result.submission.operationalStatus.node.error, "rpc down");
  });

  it("reports the node offline when the state is not running", async () => {
    getMinimaNodeStatusMock.mockResolvedValue({ state: "stopped", checkedAt: "2026-01-01T00:00:00.000Z" });
    const result = await service.appendFeedbackSubmission(validInput, user);
    assert.equal(result.submission.operationalStatus.node.ok, false);
    assert.equal(result.submission.operationalStatus.node.status, "stopped");
  });

  it("reports integritas as missing_api_key when no key is configured", async () => {
    getIntegritasApiKeyMock.mockReturnValue("");
    const result = await service.appendFeedbackSubmission(validInput, user);
    assert.equal(result.submission.operationalStatus.integritas.status, "missing_api_key");
    assert.equal(fetchJsonWithTimeoutMock.mock.calls.length, 0);
  });

  it("reports integritas connected on a healthy check", async () => {
    getIntegritasApiKeyMock.mockReturnValue("key-1");
    sendHostedFeedbackMock.mockResolvedValue({ ok: true, remoteId: null, receivedAt: null });
    fetchJsonWithTimeoutMock.mockResolvedValue({ response: { ok: true, status: 200 }, body: {} });
    const result = await service.appendFeedbackSubmission(validInput, user);
    assert.equal(result.submission.operationalStatus.integritas.ok, true);
    assert.equal(result.submission.operationalStatus.integritas.status, "ok");
  });

  it("reports integritas disconnected on a non-ok health check", async () => {
    getIntegritasApiKeyMock.mockReturnValue("key-1");
    sendHostedFeedbackMock.mockResolvedValue({ ok: true, remoteId: null, receivedAt: null });
    fetchJsonWithTimeoutMock.mockResolvedValue({ response: { ok: false, status: 503 }, body: {} });
    const result = await service.appendFeedbackSubmission(validInput, user);
    assert.equal(result.submission.operationalStatus.integritas.ok, false);
    assert.equal(result.submission.operationalStatus.integritas.status, "HTTP 503");
  });

  it("reports integritas disconnected when the health check throws", async () => {
    getIntegritasApiKeyMock.mockReturnValue("key-1");
    sendHostedFeedbackMock.mockResolvedValue({ ok: true, remoteId: null, receivedAt: null });
    fetchJsonWithTimeoutMock.mockRejectedValue(new Error("timeout"));
    const result = await service.appendFeedbackSubmission(validInput, user);
    assert.equal(result.submission.operationalStatus.integritas.ok, false);
    assert.equal(result.submission.operationalStatus.integritas.error, "timeout");
  });
});

describe("retryPendingFeedback", () => {
  it("reports zero retryable submissions when no API key is configured", async () => {
    getIntegritasApiKeyMock.mockReturnValue("");
    await service.appendFeedbackSubmission(validInput, user);

    const result = await service.retryPendingFeedback(user);
    assert.deepEqual(result, { sent: 0, failed: 0, skipped: 0 });
    assert.equal(sendHostedFeedbackMock.mock.calls.length, 0);
  });

  it("counts retryable submissions when no API key is configured but a pending one exists", async () => {
    getIntegritasApiKeyMock.mockReturnValue("key-1");
    sendHostedFeedbackMock.mockResolvedValue({ ok: false, retryable: true, error: "timeout" });
    await service.appendFeedbackSubmission(validInput, user);

    getIntegritasApiKeyMock.mockReturnValue("");
    const result = await service.retryPendingFeedback(user);
    assert.deepEqual(result, { sent: 0, failed: 0, skipped: 1 });
  });

  it("retries pending/failed submissions and updates their delivery status", async () => {
    getIntegritasApiKeyMock.mockReturnValue("key-1");
    sendHostedFeedbackMock.mockResolvedValue({ ok: false, retryable: true, error: "timeout" });
    await service.appendFeedbackSubmission(validInput, user);
    await service.appendFeedbackSubmission({ ...validInput, description: "Second issue" }, user);

    sendHostedFeedbackMock.mockReset();
    sendHostedFeedbackMock
      .mockResolvedValueOnce({ ok: true, remoteId: "remote-1", receivedAt: "2026-01-01T00:00:02.000Z" })
      .mockResolvedValueOnce({ ok: false, retryable: false, error: "rejected" });

    const result = await service.retryPendingFeedback(user);
    assert.equal(result.sent, 1);
    assert.equal(result.failed, 1);
    assert.equal(result.skipped, 0);

    const exported = JSON.parse(service.getFeedbackExport(user));
    assert.equal(exported.submissions[0].remoteDelivery.status, "sent");
    assert.equal(exported.submissions[1].remoteDelivery.status, "failed");
  });

  it("skips submissions that already sent successfully", async () => {
    getIntegritasApiKeyMock.mockReturnValue("key-1");
    sendHostedFeedbackMock.mockResolvedValue({ ok: true, remoteId: "remote-1", receivedAt: "2026-01-01T00:00:02.000Z" });
    await service.appendFeedbackSubmission(validInput, user);

    sendHostedFeedbackMock.mockClear();
    const result = await service.retryPendingFeedback(user);
    assert.equal(result.skipped, 1);
    assert.equal(sendHostedFeedbackMock.mock.calls.length, 0);
  });
});

describe("getFeedbackExport", () => {
  it("returns an empty document when no file has been written yet", () => {
    const exported = JSON.parse(service.getFeedbackExport(user));
    assert.equal(exported.schemaVersion, 1);
    assert.deepEqual(exported.submissions, []);
  });

  it("returns the raw file contents once a submission has been written", async () => {
    await service.appendFeedbackSubmission(validInput, user);
    const exported = JSON.parse(service.getFeedbackExport(user));
    assert.equal(exported.submissions.length, 1);
    assert.equal(exported.submissions[0].description, "Something broke");
  });
});
