import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env.js";
import { db } from "../../db/database.js";
import { fetchJsonWithTimeout } from "../../shared/http.js";
import type { SessionUser } from "../auth/auth.types.js";
import { getIntegritasAuth } from "../integritas-auth/integritas-auth.repository.js";
import { getMinimaNodeStatus } from "../minima/minima.service.js";
import { getIntegritasApiKey } from "../settings/secrets.service.js";
import { getDeviceInfo } from "../status/device.service.js";
import { HOSTED_FEEDBACK_ENDPOINT, sendHostedFeedback } from "./feedback.remote.js";

const FEEDBACK_DIR = "feedback";
const FEEDBACK_FILE = "feedback-submissions.json";
const SCHEMA_VERSION = 1;
const MAX_DESCRIPTION_LENGTH = 10_000;
const MAX_SHORT_TEXT_LENGTH = 1_000;
const MAX_PAGE_PATH_LENGTH = 500;
const MAX_PAGE_LABEL_LENGTH = 120;
const INTEGRITAS_CHECK_TIMEOUT_MS = 3_000;
const feedbackTypes = new Set(["bug", "ux_issue", "feature_request", "question", "other"]);
const feedbackAreas = new Set(["current_page", "dashboard", "node", "wallet", "integritas", "data", "automation", "diagnostics", "setup_login", "install_update", "other"]);
const bugSeverities = new Set(["low", "medium", "high", "blocking"]);
const bugReproducibilities = new Set(["always", "sometimes", "once", "not_sure"]);
const featurePriorities = new Set(["nice_to_have", "important", "blocking_workflow"]);

type FeedbackType = "bug" | "ux_issue" | "feature_request" | "question" | "other";
type FeedbackArea = "current_page" | "dashboard" | "node" | "wallet" | "integritas" | "data" | "automation" | "diagnostics" | "setup_login" | "install_update" | "other";
type BugSeverity = "low" | "medium" | "high" | "blocking";
type BugReproducibility = "always" | "sometimes" | "once" | "not_sure";
type FeaturePriority = "nice_to_have" | "important" | "blocking_workflow";
type RemoteDeliveryStatus = "not_enabled" | "not_configured" | "pending" | "sent" | "failed";

export type RemoteDelivery = {
  status: RemoteDeliveryStatus;
  remoteId: string | null;
  endpoint: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  attemptCount: number;
  lastError: string | null;
};

export type FeedbackSubmission = {
  id: string;
  submittedAt: string;
  page: {
    path: string;
    label: string | null;
  };
  area: {
    id: FeedbackArea;
    label: string | null;
  };
  type: FeedbackType;
  description: string;
  bug?: {
    severity: BugSeverity;
    reproducibility: BugReproducibility;
    expectedBehavior: string | null;
    actualBehavior: string | null;
  };
  featureRequest?: {
    priority: FeaturePriority;
    desiredOutcome: string | null;
  };
  browser: {
    userAgent: string | null;
    language: string | null;
    languages: string[];
    timezone: string | null;
    viewport: {
      width: number | null;
      height: number | null;
      devicePixelRatio: number | null;
    };
  };
  stats: {
    dataSources: number;
    dataReads: number;
    integritasProofs: number;
    automationWorkflows: number;
  };
  operationalStatus: {
    node: {
      label: string;
      ok: boolean | null;
      status: string;
      checkedAt: string | null;
      error: string | null;
    };
    integritas: {
      label: string;
      ok: boolean | null;
      status: string;
      checkedAt: string | null;
      error: string | null;
    };
  };
  remoteDelivery: RemoteDelivery;
};

export type FeedbackDocument = {
  schemaVersion: 1;
  metadata: {
    createdAt: string;
    updatedAt: string;
    app: {
      name: "edge-studio";
      version: string;
    };
    user: {
      id: string;
      displayName: string;
      role: string;
    };
    device: ReturnType<typeof getDeviceInfo>;
    integritasAccount: {
      userId: string | null;
    };
  };
  submissions: FeedbackSubmission[];
};

export type FeedbackInput = {
  type?: unknown;
  description?: unknown;
  area?: {
    id?: unknown;
    label?: unknown;
  };
  page?: {
    path?: unknown;
    label?: unknown;
  };
  bug?: {
    severity?: unknown;
    reproducibility?: unknown;
    expectedBehavior?: unknown;
    actualBehavior?: unknown;
  };
  featureRequest?: {
    priority?: unknown;
    desiredOutcome?: unknown;
  };
  browser?: {
    userAgent?: unknown;
    language?: unknown;
    languages?: unknown;
    timezone?: unknown;
    viewport?: {
      width?: unknown;
      height?: unknown;
      devicePixelRatio?: unknown;
    };
  };
  hostedConsent?: unknown;
};

export type FeedbackConfig = {
  hostedFeedbackEnabled: boolean;
  hostedFeedbackAvailable: boolean;
  integritasApiKeyConfigured: boolean;
  endpoint: string;
};

export class FeedbackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedbackValidationError";
  }
}

export function getFeedbackExportPath() {
  return path.join(env.dataDir, FEEDBACK_DIR, FEEDBACK_FILE);
}

export function getFeedbackConfig(): FeedbackConfig {
  const integritasApiKeyConfigured = Boolean(getIntegritasApiKey());
  return {
    hostedFeedbackEnabled: true,
    hostedFeedbackAvailable: integritasApiKeyConfigured,
    integritasApiKeyConfigured,
    endpoint: HOSTED_FEEDBACK_ENDPOINT,
  };
}

export function getEmptyFeedbackDocument(user: SessionUser, now = new Date().toISOString()): FeedbackDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: buildMetadata(user, now, now),
    submissions: []
  };
}

export async function appendFeedbackSubmission(input: FeedbackInput, user: SessionUser) {
  const parsed = parseFeedbackInput(input);
  const now = new Date().toISOString();
  const filePath = getFeedbackExportPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const config = getFeedbackConfig();
  const apiKey = getIntegritasApiKey();
  if (config.hostedFeedbackAvailable && input.hostedConsent !== true) {
    throw new FeedbackValidationError("Confirm consent before sending feedback to Integritas.");
  }

  const existing = readFeedbackDocument(filePath, user, now);
  const submission: FeedbackSubmission = {
    id: crypto.randomUUID(),
    submittedAt: now,
    page: parsed.page,
    area: parsed.area,
    type: parsed.type,
    description: parsed.description,
    ...(parsed.bug ? { bug: parsed.bug } : {}),
    ...(parsed.featureRequest ? { featureRequest: parsed.featureRequest } : {}),
    browser: parsed.browser,
    stats: getFeedbackStats(),
    operationalStatus: await getFeedbackOperationalStatus(apiKey),
    remoteDelivery: buildInitialRemoteDelivery(config),
  };

  const createdAt = existing.metadata.createdAt || now;
  const document: FeedbackDocument = {
    schemaVersion: SCHEMA_VERSION,
    metadata: buildMetadata(user, createdAt, now),
    submissions: [...existing.submissions, submission]
  };

  writeJsonAtomically(filePath, document);
  if (!config.hostedFeedbackAvailable || !apiKey) {
    return { submission, fileName: FEEDBACK_FILE, exportUrl: "/api/feedback/export" };
  }

  const remoteDelivery = await deliverSubmission(document.metadata, submission, apiKey);
  const updatedSubmission = updateSubmissionRemoteDelivery(filePath, user, submission.id, remoteDelivery);
  return { submission: updatedSubmission ?? { ...submission, remoteDelivery }, fileName: FEEDBACK_FILE, exportUrl: "/api/feedback/export" };
}

export async function retryPendingFeedback(user: SessionUser) {
  const config = getFeedbackConfig();
  const apiKey = getIntegritasApiKey();
  if (!config.hostedFeedbackEnabled || !apiKey) {
    const document = readFeedbackDocument(getFeedbackExportPath(), user, new Date().toISOString());
    return { sent: 0, failed: 0, skipped: countRetryableSubmissions(document) };
  }

  const filePath = getFeedbackExportPath();
  const now = new Date().toISOString();
  const document = readFeedbackDocument(filePath, user, now);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const submission of document.submissions) {
    if (!isRetryableSubmission(submission)) {
      skipped += 1;
      continue;
    }
    const remoteDelivery = await deliverSubmission(document.metadata, submission, apiKey);
    updateSubmissionRemoteDelivery(filePath, user, submission.id, remoteDelivery);
    if (remoteDelivery.status === "sent") sent += 1;
    else failed += 1;
  }

  return { sent, failed, skipped };
}

export function getFeedbackExport(user: SessionUser) {
  const filePath = getFeedbackExportPath();
  if (!fs.existsSync(filePath)) {
    return JSON.stringify(getEmptyFeedbackDocument(user), null, 2) + "\n";
  }
  return fs.readFileSync(filePath, "utf8");
}

function parseFeedbackInput(input: FeedbackInput): Pick<FeedbackSubmission, "type" | "description" | "page" | "area" | "browser"> & Pick<Partial<FeedbackSubmission>, "bug" | "featureRequest"> {
  const type = typeof input.type === "string" ? input.type : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const pagePath = typeof input.page?.path === "string" ? input.page.path.trim() : "";
  const pageLabel = typeof input.page?.label === "string" ? input.page.label.trim() : "";
  const areaId = typeof input.area?.id === "string" ? input.area.id : "current_page";
  const areaLabel = typeof input.area?.label === "string" ? input.area.label.trim() : "";

  if (!feedbackTypes.has(type)) throw new FeedbackValidationError("Choose a feedback type.");
  if (!description) throw new FeedbackValidationError("Feedback description is required.");
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new FeedbackValidationError(`Feedback description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }
  if (!pagePath) throw new FeedbackValidationError("Page path is required.");
  if (pagePath.length > MAX_PAGE_PATH_LENGTH) {
    throw new FeedbackValidationError(`Page path must be ${MAX_PAGE_PATH_LENGTH} characters or fewer.`);
  }
  if (pageLabel.length > MAX_PAGE_LABEL_LENGTH) {
    throw new FeedbackValidationError(`Page label must be ${MAX_PAGE_LABEL_LENGTH} characters or fewer.`);
  }
  if (!feedbackAreas.has(areaId)) throw new FeedbackValidationError("Choose what the feedback is about.");
  if (areaLabel.length > MAX_PAGE_LABEL_LENGTH) {
    throw new FeedbackValidationError(`Feedback area label must be ${MAX_PAGE_LABEL_LENGTH} characters or fewer.`);
  }

  return {
    type: type as FeedbackType,
    description,
    page: {
      path: pagePath,
      label: pageLabel || null
    },
    area: {
      id: areaId as FeedbackArea,
      label: areaLabel || null
    },
    ...(type === "bug" ? { bug: parseBugDetails(input.bug) } : {}),
    ...(type === "feature_request" ? { featureRequest: parseFeatureRequestDetails(input.featureRequest) } : {}),
    browser: parseBrowserContext(input.browser)
  };
}

function parseBugDetails(input: FeedbackInput["bug"]): FeedbackSubmission["bug"] {
  const severity = typeof input?.severity === "string" ? input.severity : "medium";
  const reproducibility = typeof input?.reproducibility === "string" ? input.reproducibility : "not_sure";
  if (!bugSeverities.has(severity)) throw new FeedbackValidationError("Choose a valid bug severity.");
  if (!bugReproducibilities.has(reproducibility)) throw new FeedbackValidationError("Choose a valid bug reproducibility.");

  return {
    severity: severity as BugSeverity,
    reproducibility: reproducibility as BugReproducibility,
    expectedBehavior: parseOptionalShortText(input?.expectedBehavior, "Expected behavior"),
    actualBehavior: parseOptionalShortText(input?.actualBehavior, "Actual behavior")
  };
}

function parseFeatureRequestDetails(input: FeedbackInput["featureRequest"]): FeedbackSubmission["featureRequest"] {
  const priority = typeof input?.priority === "string" ? input.priority : "nice_to_have";
  if (!featurePriorities.has(priority)) throw new FeedbackValidationError("Choose a valid feature priority.");

  return {
    priority: priority as FeaturePriority,
    desiredOutcome: parseOptionalShortText(input?.desiredOutcome, "Desired outcome")
  };
}

function parseBrowserContext(input: FeedbackInput["browser"]): FeedbackSubmission["browser"] {
  const languages = Array.isArray(input?.languages)
    ? input.languages.filter((item): item is string => typeof item === "string").slice(0, 10)
    : [];

  return {
    userAgent: parseOptionalShortText(input?.userAgent, "Browser user agent", 500),
    language: parseOptionalShortText(input?.language, "Browser language", 80),
    languages: languages.map((item) => item.slice(0, 80)),
    timezone: parseOptionalShortText(input?.timezone, "Browser timezone", 120),
    viewport: {
      width: parseOptionalNumber(input?.viewport?.width),
      height: parseOptionalNumber(input?.viewport?.height),
      devicePixelRatio: parseOptionalNumber(input?.viewport?.devicePixelRatio)
    }
  };
}

function parseOptionalShortText(value: unknown, label: string, maxLength = MAX_SHORT_TEXT_LENGTH) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) throw new FeedbackValidationError(`${label} must be ${maxLength} characters or fewer.`);
  return trimmed;
}

function parseOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readFeedbackDocument(filePath: string, user: SessionUser, now: string): FeedbackDocument {
  if (!fs.existsSync(filePath)) return getEmptyFeedbackDocument(user, now);

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<FeedbackDocument>;
  if (parsed.schemaVersion !== SCHEMA_VERSION || !parsed.metadata || !Array.isArray(parsed.submissions)) {
    throw new Error("Existing feedback file has an unsupported format.");
  }

  return parsed as FeedbackDocument;
}

function writeJsonAtomically(filePath: string, document: FeedbackDocument) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(document, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tempPath, filePath);
}

async function deliverSubmission(metadata: FeedbackDocument["metadata"], submission: FeedbackSubmission, apiKey: string): Promise<RemoteDelivery> {
  const attemptedAt = new Date().toISOString();
  const result = await sendHostedFeedback({ apiKey, metadata, submission });
  if (result.ok) {
    return {
      status: "sent",
      remoteId: result.remoteId,
      endpoint: HOSTED_FEEDBACK_ENDPOINT,
      lastAttemptAt: attemptedAt,
      lastSuccessAt: result.receivedAt ?? new Date().toISOString(),
      attemptCount: submission.remoteDelivery.attemptCount + 1,
      lastError: null,
    };
  }

  return {
    status: result.retryable ? "pending" : "failed",
    remoteId: submission.remoteDelivery.remoteId,
    endpoint: HOSTED_FEEDBACK_ENDPOINT,
    lastAttemptAt: attemptedAt,
    lastSuccessAt: submission.remoteDelivery.lastSuccessAt,
    attemptCount: submission.remoteDelivery.attemptCount + 1,
    lastError: result.error,
  };
}

function buildInitialRemoteDelivery(config: FeedbackConfig): RemoteDelivery {
  return {
    status: config.hostedFeedbackEnabled ? (config.integritasApiKeyConfigured ? "pending" : "not_configured") : "not_enabled",
    remoteId: null,
    endpoint: HOSTED_FEEDBACK_ENDPOINT,
    lastAttemptAt: null,
    lastSuccessAt: null,
    attemptCount: 0,
    lastError: null,
  };
}

function updateSubmissionRemoteDelivery(filePath: string, user: SessionUser, submissionId: string, remoteDelivery: RemoteDelivery) {
  const now = new Date().toISOString();
  const existing = readFeedbackDocument(filePath, user, now);
  let updatedSubmission: FeedbackSubmission | null = null;
  const submissions = existing.submissions.map((submission) => {
    if (submission.id !== submissionId) return submission;
    updatedSubmission = { ...submission, remoteDelivery };
    return updatedSubmission;
  });
  if (!updatedSubmission) return null;
  writeJsonAtomically(filePath, { ...existing, metadata: buildMetadata(user, existing.metadata.createdAt || now, now), submissions });
  return updatedSubmission;
}

function isRetryableSubmission(submission: FeedbackSubmission) {
  return submission.remoteDelivery?.status === "pending" || submission.remoteDelivery?.status === "failed";
}

function countRetryableSubmissions(document: FeedbackDocument) {
  return document.submissions.filter(isRetryableSubmission).length;
}

function buildMetadata(user: SessionUser, createdAt: string, updatedAt: string): FeedbackDocument["metadata"] {
  return {
    createdAt,
    updatedAt,
    app: {
      name: "edge-studio",
      version: getAppVersion()
    },
    user: {
      id: user.id,
      displayName: user.displayName,
      role: user.role
    },
    device: getDeviceInfo(),
    integritasAccount: {
      userId: getIntegritasAuth()?.integritas_user_id ?? null
    }
  };
}

// update-agent is the single source of truth for the installed app version:
// install.sh writes this file at install time from the signed manifest, and
// update-agent keeps it current after every applied update. Read-only mount,
// see docker-compose.yml (`UPDATE_AGENT_STATE_DIR` -> `/update-agent-state`).
const UPDATE_AGENT_STATE_DIR = "/update-agent-state";

function getAppVersion() {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(UPDATE_AGENT_STATE_DIR, "last-applied-manifest.json"), "utf8")) as { version?: string };
    if (parsed.version) return parsed.version;
  } catch {
    // Not recorded yet — native dev, a from-source build, or update-agent has never
    // applied/recorded a manifest. Report this plainly rather than falling back to a
    // package.json version, which would misrepresent an unverified build as a real release
    // version (backend/package.json's own version, unrelated to the app release version).
  }

  return "Unknown version";
}

function getFeedbackStats(): FeedbackSubmission["stats"] {
  return {
    dataSources: countRows("data_sources"),
    dataReads: countRows("data_source_reads"),
    integritasProofs: countRows("integritas_proofs"),
    automationWorkflows: countRows("automation_workflows")
  };
}

function countRows(table: string) {
  const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
  return row.count;
}

async function getFeedbackOperationalStatus(apiKey: string): Promise<FeedbackSubmission["operationalStatus"]> {
  const [node, integritas] = await Promise.all([getFeedbackNodeStatus(), getFeedbackIntegritasStatus(apiKey)]);
  return { node, integritas };
}

async function getFeedbackNodeStatus(): Promise<FeedbackSubmission["operationalStatus"]["node"]> {
  try {
    const status = await getMinimaNodeStatus();
    const ok = status.state === "running";
    return {
      label: ok ? "Node online" : "Node offline",
      ok,
      status: ok ? "ok" : status.state,
      checkedAt: status.checkedAt,
      error: null,
    };
  } catch (error) {
    return {
      label: "Node offline",
      ok: false,
      status: "error",
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function getFeedbackIntegritasStatus(apiKey: string): Promise<FeedbackSubmission["operationalStatus"]["integritas"]> {
  if (!apiKey) {
    return {
      label: "Integritas disconnected",
      ok: false,
      status: "missing_api_key",
      checkedAt: new Date().toISOString(),
      error: "Integritas API key is not configured",
    };
  }

  try {
    const { response } = await fetchJsonWithTimeout(
      `${env.integritasBaseUrl}/v1/web/check/health`,
      { headers: { "x-request-id": env.integritasRequestId, "x-api-key": apiKey } },
      INTEGRITAS_CHECK_TIMEOUT_MS,
    );
    return {
      label: response.ok ? "Integritas connected" : "Integritas disconnected",
      ok: response.ok,
      status: response.ok ? "ok" : `HTTP ${response.status}`,
      checkedAt: new Date().toISOString(),
      error: null,
    };
  } catch (error) {
    return {
      label: "Integritas disconnected",
      ok: false,
      status: "error",
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
