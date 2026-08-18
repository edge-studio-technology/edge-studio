import { env } from "../../config/env.js";
import { parseResponseBody } from "../../shared/http.js";
import type { FeedbackDocument, FeedbackSubmission } from "./feedback.service.js";

export const HOSTED_FEEDBACK_ENDPOINT = "https://qa.integritas.technology/api/feedback";

export type FeedbackRemoteResult =
  | { ok: true; remoteId: string | null; receivedAt: string | null }
  | { ok: false; retryable: boolean; error: string };

export async function sendHostedFeedback({
  apiKey,
  metadata,
  submission,
}: {
  apiKey: string;
  metadata: FeedbackDocument["metadata"];
  submission: FeedbackSubmission;
}): Promise<FeedbackRemoteResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.integritasRequestTimeoutMs);
  const startedAt = Date.now();
  const logContext = {
    endpoint: HOSTED_FEEDBACK_ENDPOINT,
    submissionId: submission.id,
    feedbackType: submission.type,
    feedbackArea: submission.area.id,
    integritasAccountId: metadata.integritasAccount.userId,
  };

  try {
    console.info("Sending hosted feedback", logContext);
    const response = await fetch(HOSTED_FEEDBACK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": env.integritasRequestId,
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ schemaVersion: 1, metadata, submission: stripRemoteDelivery(submission) }),
      signal: controller.signal,
    });

    const responseText = await response.text();
    const parsed = parseResponseBody(responseText);
    console.info("Hosted feedback response received", {
      ...logContext,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
    });
    if (response.ok) {
      const body = typeof parsed === "object" && parsed ? parsed as { ok?: unknown; remoteId?: unknown; receivedAt?: unknown } : {};
      if (body.ok === false) {
        return {
          ok: false,
          retryable: false,
          error: hostedErrorMessage(parsed, "Hosted feedback rejected the submission."),
        };
      }
      return {
        ok: true,
        remoteId: typeof body.remoteId === "string" ? body.remoteId : null,
        receivedAt: typeof body.receivedAt === "string" ? body.receivedAt : null,
      };
    }

    return {
      ok: false,
      retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      error: hostedErrorMessage(parsed, `Hosted feedback rejected the submission with HTTP ${response.status}.`),
    };
  } catch (error) {
    console.warn("Hosted feedback request failed", {
      ...logContext,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Hosted feedback request failed.",
    });
    return {
      ok: false,
      retryable: true,
      error: error instanceof Error ? error.message : "Hosted feedback request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function stripRemoteDelivery(submission: FeedbackSubmission) {
  const { remoteDelivery: _remoteDelivery, ...payload } = submission;
  return payload;
}

function hostedErrorMessage(parsed: unknown, fallback: string) {
  if (typeof parsed === "object" && parsed) {
    const body = parsed as { error?: unknown; message?: unknown };
    if (typeof body.error === "string") return body.error;
    if (typeof body.message === "string") return body.message;
  }
  if (typeof parsed === "string" && parsed.trim()) return parsed.slice(0, 500);
  return fallback;
}
