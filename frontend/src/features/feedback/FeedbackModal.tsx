import { useState, type FormEvent } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { Button, LinkButton } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { InputField } from "../../components/ui/InputField";
import { Modal } from "../../components/ui/Modal";
import { SelectField } from "../../components/ui/SelectField";
import { TextareaField } from "../../components/ui/TextareaField";
import { postJson } from "../../lib/api";
import { useToast } from "../../components/ToastProvider";

const FEEDBACK_FORM_ID = "feedback-form";

const feedbackTypes = [
  { value: "bug", label: "Bug" },
  { value: "ux_issue", label: "UX issue" },
  { value: "feature_request", label: "Feature request" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" }
];

const feedbackAreas = [
  { value: "current_page", label: "Current page" },
  { value: "dashboard", label: "Dashboard" },
  { value: "node", label: "Minima" },
  { value: "wallet", label: "Wallet" },
  { value: "integritas", label: "Integritas" },
  { value: "data", label: "Devices" },
  { value: "automation", label: "Automation" },
  { value: "diagnostics", label: "Diagnostics" },
  { value: "setup_login", label: "Setup / Login" },
  { value: "install_update", label: "Install / Update" },
  { value: "other", label: "Other" }
];

const bugSeverities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "blocking", label: "Blocking" }
];

const bugReproducibilities = [
  { value: "always", label: "Always" },
  { value: "sometimes", label: "Sometimes" },
  { value: "once", label: "Once" },
  { value: "not_sure", label: "Not sure" }
];

const featurePriorities = [
  { value: "nice_to_have", label: "Nice to have" },
  { value: "important", label: "Important" },
  { value: "blocking_workflow", label: "Blocking workflow" }
];

type FeedbackSubmitResponse = {
  id: string;
  fileName: string;
  exportUrl: string;
};

export function FeedbackModal({ pagePath, pageLabel, onClose }: { pagePath: string; pageLabel: string; onClose: () => void }) {
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
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<FeedbackSubmitResponse | null>(null);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setError("Describe the feedback before submitting.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const result = await postJson<FeedbackSubmitResponse>("/api/feedback", {
        type,
        area: { id: area, label: feedbackAreas.find((item) => item.value === area)?.label ?? area },
        description: trimmedDescription,
        page: { path: pagePath, label: pageLabel },
        ...(type === "bug" ? {
          bug: {
            severity: bugSeverity,
            reproducibility: bugReproducibility,
            expectedBehavior,
            actualBehavior
          }
        } : {}),
        ...(type === "feature_request" ? {
          featureRequest: {
            priority: featurePriority,
            desiredOutcome
          }
        } : {}),
        browser: getBrowserContext()
      });
      setSaved(result);
      showToast({ tone: "success", title: "Feedback saved locally", message: "Download the JSON file when you are ready to share it." });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Could not save feedback.";
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
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <LinkButton href={saved.exportUrl} iconStart={<Download aria-hidden />}>
              Download feedback JSON
            </LinkButton>
          </>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form={FEEDBACK_FORM_ID} disabled={submitting}>
              {submitting ? "Saving..." : "Save feedback"}
            </Button>
          </>
        )
      }
    >
      {saved ? (
        <div className="gap-detail-close grid">
          <div className="border-stroke-success bg-surface-always-white rounded-soft relative flex items-start overflow-clip border">
            <div className="bg-feedback-positive pointer-events-none absolute inset-0 opacity-20" aria-hidden />
            <div className="gap-detail-close p-margin-tight relative flex min-w-0 flex-1 items-start">
              <div className="grid size-5 shrink-0 place-items-center">
                <CheckCircle2 className="text-icon-success" size={20} aria-hidden />
              </div>
              <div className="gap-detail-tight grid min-w-0 flex-1">
                <strong className="type-body-em text-text-primary">Feedback saved locally</strong>
                <p className="type-body text-text-secondary m-0">
                  Your feedback was appended to <code className="type-mono">{saved.fileName}</code>. Download the
                  aggregate JSON file and send it manually to the Integritas team.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form className="gap-detail-close grid" id={FEEDBACK_FORM_ID} onSubmit={submitFeedback}>
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

          <p className="type-meta text-text-secondary m-0">
            The local JSON export includes app/device metadata and a small stats snapshot. It does not include
            passwords, TOTP secrets, session cookies, Integritas API keys, or wallet seed phrases.
          </p>
        </form>
      )}
    </Modal>
  );
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
      devicePixelRatio: window.devicePixelRatio
    }
  };
}
