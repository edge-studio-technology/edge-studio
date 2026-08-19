import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { DetailList, DetailRow } from "../../components/patterns/DetailList";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { CheckboxField } from "../../components/ui/CheckboxField";
import { Disclosure } from "../../components/ui/Disclosure";
import { InputField } from "../../components/ui/InputField";
import { Modal } from "../../components/ui/Modal";
import { SelectField } from "../../components/ui/SelectField";
import { TextareaField } from "../../components/ui/TextareaField";
import { getJson, postJson } from "../../lib/api";
import { useToast } from "../../components/ToastProvider";

const FEEDBACK_FORM_ID = "feedback-form";

const feedbackTypes = [
  { value: "bug", label: "Bug" },
  { value: "ux_issue", label: "UX issue" },
  { value: "feature_request", label: "Feature request" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
];

const feedbackAreas = [
  { value: "current_page", label: "Current page" },
  { value: "dashboard", label: "Dashboard" },
  { value: "node", label: "Minima" },
  { value: "wallet", label: "Wallet" },
  { value: "integritas", label: "Integritas" },
  { value: "data", label: "Devices" },
  { value: "automation", label: "Workflows" },
  { value: "diagnostics", label: "Diagnostics" },
  { value: "setup_login", label: "Setup / Login" },
  { value: "install_update", label: "Install / Update" },
  { value: "other", label: "Other" },
];

const bugSeverities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "blocking", label: "Blocking" },
];

const bugReproducibilities = [
  { value: "always", label: "Always" },
  { value: "sometimes", label: "Sometimes" },
  { value: "once", label: "Once" },
  { value: "not_sure", label: "Not sure" },
];

const featurePriorities = [
  { value: "nice_to_have", label: "Nice to have" },
  { value: "important", label: "Important" },
  { value: "blocking_workflow", label: "Blocking workflow" },
];

type FeedbackSubmitResponse = {
  id: string;
  remoteDelivery: RemoteDelivery;
};

type RemoteDelivery = {
  status: "not_enabled" | "not_configured" | "pending" | "sent" | "failed";
  remoteId: string | null;
  endpoint: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  attemptCount: number;
  lastError: string | null;
};

type FeedbackConfig = {
  hostedFeedbackEnabled: boolean;
  hostedFeedbackAvailable: boolean;
  integritasApiKeyConfigured: boolean;
  endpoint: string;
};

type FeedbackExportDoc = {
  metadata: {
    app: { version: string };
    user: { id: string; displayName: string; role: string };
    device: {
      id: string;
      hostname: string;
      platform: string;
      arch: string;
      cpuCount: number;
      memory: { totalBytes: number };
      disk: { totalBytes: number } | null;
    };
    integritasAccount: { userId: string | null };
  };
};

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${bytes} B`;
}

export function FeedbackModal({
  pagePath,
  pageLabel,
  onClose,
}: {
  pagePath: string;
  pageLabel: string;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [type, setType] = useState("bug");
  const [area, setArea] = useState("current_page");
  const [bugSeverity, setBugSeverity] = useState("medium");
  const [bugReproducibility, setBugReproducibility] = useState("not_sure");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");
  const [featurePriority, setFeaturePriority] = useState("nice_to_have");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<FeedbackSubmitResponse | null>(null);
  const [exportDoc, setExportDoc] = useState<FeedbackExportDoc | null>(null);
  const [config, setConfig] = useState<FeedbackConfig | null>(null);
  const [hostedConsent, setHostedConsent] = useState(false);
  const browser = useState(getBrowserContext)[0];

  useEffect(() => {
    let cancelled = false;
    getJson<FeedbackExportDoc>("/api/feedback/export")
      .then((result) => {
        if (!cancelled) setExportDoc(result);
      })
      .catch(() => {
        // Leave exportDoc null; the disclosure rows fall back to "—".
      });
    getJson<FeedbackConfig>("/api/feedback/config")
      .then((result) => {
        if (!cancelled) setConfig(result);
      })
      .catch(() => {
        // Local save still works if config loading fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setError("Describe the feedback before submitting.");
      return;
    }
    if (config?.hostedFeedbackAvailable && !hostedConsent) {
      setConsentError("Confirm consent before sending feedback to Integritas.");
      return;
    }

    setError(null);
    setConsentError(null);
    setSubmitting(true);
    try {
      const result = await postJson<FeedbackSubmitResponse>("/api/feedback", {
        type,
        area: { id: area, label: feedbackAreas.find((item) => item.value === area)?.label ?? area },
        description: trimmedDescription,
        page: { path: pagePath, label: pageLabel },
        ...(type === "bug"
          ? {
              bug: {
                severity: bugSeverity,
                reproducibility: bugReproducibility,
                expectedBehavior,
                actualBehavior,
              },
            }
          : {}),
        ...(type === "feature_request"
          ? {
              featureRequest: {
                priority: featurePriority,
                desiredOutcome,
              },
            }
          : {}),
        browser,
        hostedConsent,
      });
      setSaved(result);
      const outcome = outcomeFor(result.remoteDelivery);
      showToast({
        tone: outcome.tone,
        title: outcome.title,
        message: outcome.message,
      });
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Could not save feedback.";
      showToast({ tone: "error", title: "Feedback was not saved", message });
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Send feedback"
      onClose={onClose}
      footer={
        saved ? (
          <Button variant="secondary" onClick={onClose}>
              Close
          </Button>
        ) : (
          <>
            <div className="basis-full">
              <CheckboxField
                label="I agree to send this feedback, device metadata, browser context, and non-secret usage stats to Integritas."
                checked={hostedConsent}
                disabled={!config?.hostedFeedbackAvailable || submitting}
                onChange={(event) => {
                  setHostedConsent(event.target.checked);
                  if (event.target.checked) setConsentError(null);
                }}
              />
              {consentError ? <p className="type-body text-text-error mt-detail-fine mb-0">{consentError}</p> : null}
            </div>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form={FEEDBACK_FORM_ID} disabled={submitting || !config?.hostedFeedbackAvailable}>
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </>
        )
      }
    >
      {saved ? (
        <div className="gap-detail-close grid">
          <div className="border-stroke-success bg-surface-always-white rounded-soft relative flex items-start overflow-clip border">
            <div
              className="bg-feedback-positive pointer-events-none absolute inset-0 opacity-20"
              aria-hidden
            />
            <div className="gap-detail-close p-margin-tight relative flex min-w-0 flex-1 items-start">
              <div className="grid size-5 shrink-0 place-items-center">
                <CheckCircle2 className="text-icon-success" size={20} aria-hidden />
              </div>
              <div className="gap-detail-tight grid min-w-0 flex-1">
                <strong className="type-body-em text-text-primary">{outcomeFor(saved.remoteDelivery).title}</strong>
                <p className="type-body text-text-secondary m-0">
                  {outcomeFor(saved.remoteDelivery).message}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form className="gap-detail-close grid" id={FEEDBACK_FORM_ID} onSubmit={submitFeedback}>
          <Disclosure
            title={
              <span className="gap-detail-tight flex items-center">
                <Info aria-hidden className="text-icon-secondary size-4 shrink-0" />
                What we save with this feedback
              </span>
            }
            defaultOpen={false}
            className="mx-2 mt-2"
          >
            <DetailList>
              <DetailRow label="Browser / OS" value={browser.userAgent} />
              <DetailRow label="Language" value={browser.language} />
              <DetailRow label="Timezone" value={browser.timezone ?? "Unknown"} />
              <DetailRow
                label="Viewport"
                value={`${browser.viewport.width} × ${browser.viewport.height} @ ${browser.viewport.devicePixelRatio}x`}
              />
              <DetailRow label="App version" value={exportDoc?.metadata.app.version ?? "—"} />
              <DetailRow
                label="Account"
                value={
                  exportDoc
                    ? `${exportDoc.metadata.user.displayName} (${exportDoc.metadata.user.role})`
                    : "—"
                }
              />
              <DetailRow
                label="Integritas account ID"
                value={exportDoc?.metadata.integritasAccount?.userId ?? "Not connected"}
                mono
              />
              <DetailRow label="Device ID" value={exportDoc?.metadata.device.id ?? "—"} mono />
              <DetailRow label="Hostname" value={exportDoc?.metadata.device.hostname ?? "—"} />
              <DetailRow
                label="Platform / arch"
                value={
                  exportDoc
                    ? `${exportDoc.metadata.device.platform} / ${exportDoc.metadata.device.arch}`
                    : "—"
                }
              />
              <DetailRow label="CPU cores" value={exportDoc?.metadata.device.cpuCount ?? "—"} />
              <DetailRow
                label="Memory"
                value={exportDoc ? formatBytes(exportDoc.metadata.device.memory.totalBytes) : "—"}
              />
              <DetailRow
                label="Disk"
                value={
                  exportDoc
                    ? exportDoc.metadata.device.disk
                      ? formatBytes(exportDoc.metadata.device.disk.totalBytes)
                      : "Unknown"
                    : "—"
                }
              />
              <DetailRow
                label="Not included"
                value="Passwords, TOTP secrets, session cookies, Integritas API keys, or wallet seed phrases."
              />
            </DetailList>
          </Disclosure>

          <Card size="Compact" className="border-stroke-secondary gap-detail-tight grid border">
            <p className="type-body text-text-secondary m-0">{preSubmitMessage(config)}</p>
          </Card>

          <Card size="Compact" className="border-stroke-secondary gap-detail-tight grid border">
            <p className="type-meta text-text-secondary m-0">Current page</p>
            <p className="type-body-em text-text-primary m-0">{pageLabel}</p>
            <code className="type-mono text-text-secondary bg-surface-primary rounded-loose px-detail-next py-detail-tight block break-all">
              {pagePath}
            </code>
          </Card>

          <SelectField
            label="Feedback type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            options={feedbackTypes}
          />

          <SelectField
            label="What is this about?"
            value={area}
            onChange={(event) => setArea(event.target.value)}
            options={feedbackAreas}
          />

          {type === "bug" && (
            <Card size="Compact" className="border-stroke-secondary gap-detail-close grid border">
              <div className="gap-detail-close grid sm:grid-cols-2">
                <SelectField
                  label="Severity"
                  value={bugSeverity}
                  onChange={(event) => setBugSeverity(event.target.value)}
                  options={bugSeverities}
                />
                <SelectField
                  label="Reproducibility"
                  value={bugReproducibility}
                  onChange={(event) => setBugReproducibility(event.target.value)}
                  options={bugReproducibilities}
                />
              </div>
              <InputField
                label="Expected behavior"
                maxLength={1000}
                value={expectedBehavior}
                onChange={(event) => setExpectedBehavior(event.target.value)}
                placeholder="What did you expect to happen?"
              />
              <InputField
                label="Actual behavior"
                maxLength={1000}
                value={actualBehavior}
                onChange={(event) => setActualBehavior(event.target.value)}
                placeholder="What happened instead?"
              />
            </Card>
          )}

          {type === "feature_request" && (
            <Card size="Compact" className="border-stroke-secondary gap-detail-close grid border">
              <SelectField
                label="Priority"
                value={featurePriority}
                onChange={(event) => setFeaturePriority(event.target.value)}
                options={featurePriorities}
              />
              <InputField
                label="Desired outcome"
                maxLength={1000}
                value={desiredOutcome}
                onChange={(event) => setDesiredOutcome(event.target.value)}
                placeholder="What should this help you do?"
              />
            </Card>
          )}

          <TextareaField
            label="Description"
            maxLength={10000}
            placeholder="What happened, what did you expect, or what would you like to improve?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            error={error ?? undefined}
          />
        </form>
      )}
    </Modal>
  );
}

function preSubmitMessage(config: FeedbackConfig | null) {
  if (config?.hostedFeedbackAvailable) return "Feedback will be sent to Integritas.";
  if (config?.hostedFeedbackEnabled && !config.integritasApiKeyConfigured) return "Feedback requires an Integritas API key before it can be submitted.";
  return "Feedback delivery is unavailable.";
}

function outcomeFor(remoteDelivery: RemoteDelivery): { tone: "success" | "warning"; title: string; message: string } {
  if (remoteDelivery.status === "sent") {
    return { tone: "success", title: "Feedback submitted", message: "Feedback was sent to Integritas." };
  }
  if (remoteDelivery.status === "pending" || remoteDelivery.status === "failed") {
    return { tone: "warning", title: "Feedback not submitted", message: "Feedback could not reach Integritas. Try again later." };
  }
  return { tone: "warning", title: "Feedback not submitted", message: "Feedback requires an Integritas API key before it can be submitted." };
}

function getBrowserContext() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
  };
}
