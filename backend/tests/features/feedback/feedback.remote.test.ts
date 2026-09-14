import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { HOSTED_FEEDBACK_ENDPOINT, sendHostedFeedback } from "../../../src/features/feedback/feedback.remote.js";
import type { FeedbackDocument, FeedbackSubmission } from "../../../src/features/feedback/feedback.service.js";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

const metadata = {
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  app: { name: "edge-studio" as const, version: "1.0.0" },
  user: { id: "user-1", displayName: "Admin", role: "admin" },
  device: null,
  integritasAccount: { userId: null }
} as unknown as FeedbackDocument["metadata"];

const submission = {
  id: "sub-1",
  submittedAt: "2026-01-01T00:00:00.000Z",
  page: { path: "/dashboard", label: null },
  area: { id: "dashboard", label: null },
  type: "bug",
  description: "Something broke",
  browser: { userAgent: null, language: null, languages: [], timezone: null, viewport: { width: null, height: null, devicePixelRatio: null } },
  stats: { dataSources: 0, dataReads: 0, integritasProofs: 0, automationWorkflows: 0 },
  operationalStatus: {
    node: { label: "Node online", ok: true, status: "ok", checkedAt: null, error: null },
    integritas: { label: "Integritas connected", ok: true, status: "ok", checkedAt: null, error: null }
  },
  remoteDelivery: { status: "pending", remoteId: null, endpoint: HOSTED_FEEDBACK_ENDPOINT, lastAttemptAt: null, lastSuccessAt: null, attemptCount: 0, lastError: null }
} as unknown as FeedbackSubmission;

describe("sendHostedFeedback", () => {
  it("posts to the hosted endpoint without the remoteDelivery field", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true, remoteId: "remote-1", receivedAt: "2026-01-01T00:00:01.000Z" }));

    const result = await sendHostedFeedback({ apiKey: "key-1", metadata, submission });

    assert.deepEqual(result, { ok: true, remoteId: "remote-1", receivedAt: "2026-01-01T00:00:01.000Z" });
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    assert.equal(url, HOSTED_FEEDBACK_ENDPOINT);
    assert.equal(options.method, "POST");
    assert.equal((options.headers as Record<string, string>)["x-api-key"], "key-1");
    const body = JSON.parse(options.body as string);
    assert.equal(body.submission.remoteDelivery, undefined);
    assert.equal(body.submission.id, "sub-1");
  });

  it("returns remoteId/receivedAt as null when the response omits them", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    const result = await sendHostedFeedback({ apiKey: "key-1", metadata, submission });

    assert.deepEqual(result, { ok: true, remoteId: null, receivedAt: null });
  });

  it("treats a 200 response with ok:false as a non-retryable rejection", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: false, error: "Submission rejected" }));

    const result = await sendHostedFeedback({ apiKey: "key-1", metadata, submission });

    assert.deepEqual(result, { ok: false, retryable: false, error: "Submission rejected" });
  });

  it("marks 5xx responses as retryable", async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { message: "Service unavailable" }));

    const result = await sendHostedFeedback({ apiKey: "key-1", metadata, submission });

    assert.equal(result.ok, false);
    assert.equal((result as { retryable: boolean }).retryable, true);
    assert.equal((result as { error: string }).error, "Service unavailable");
  });

  it("marks 429 as retryable", async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, {}));

    const result = await sendHostedFeedback({ apiKey: "key-1", metadata, submission });

    assert.equal((result as { retryable: boolean }).retryable, true);
  });

  it("marks 4xx (other than 408/429) as not retryable", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, {}));

    const result = await sendHostedFeedback({ apiKey: "key-1", metadata, submission });

    assert.equal((result as { retryable: boolean }).retryable, false);
    assert.equal((result as { error: string }).error, "Hosted feedback rejected the submission with HTTP 400.");
  });

  it("falls back to a plain-text error body", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "internal error" });

    const result = await sendHostedFeedback({ apiKey: "key-1", metadata, submission });

    assert.equal((result as { error: string }).error, "internal error");
  });

  it("treats network/abort errors as retryable", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await sendHostedFeedback({ apiKey: "key-1", metadata, submission });

    assert.deepEqual(result, { ok: false, retryable: true, error: "network down" });
  });
});
