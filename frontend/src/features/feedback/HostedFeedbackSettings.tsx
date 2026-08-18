import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { SwitchField } from "../../components/ui/SwitchField";
import { useToast } from "../../components/ToastProvider";
import { getJson, patchJson, postJson } from "../../lib/api";

type FeedbackConfig = {
  hostedFeedbackEnabled: boolean;
  hostedFeedbackAvailable: boolean;
  integritasApiKeyConfigured: boolean;
  endpoint: string;
};

type RetryResult = {
  sent: number;
  failed: number;
  skipped: number;
};

export function HostedFeedbackSettings() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<FeedbackConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getJson<FeedbackConfig>("/api/feedback/config")
      .then((result) => {
        if (!cancelled) setConfig(result);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Could not load feedback settings.";
        showToast({ tone: "error", title: "Could not load feedback settings", message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateHostedFeedbackEnabled(hostedFeedbackEnabled: boolean) {
    setSaving(true);
    try {
      const result = await patchJson<FeedbackConfig>("/api/feedback/config", { hostedFeedbackEnabled });
      setConfig(result);
      showToast({
        tone: "success",
        title: hostedFeedbackEnabled ? "Hosted feedback enabled" : "Hosted feedback disabled",
        message: hostedFeedbackEnabled
          ? "New feedback can be sent to Integritas after local save."
          : "New feedback will be saved locally only.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save feedback settings.";
      showToast({ tone: "error", title: "Could not save feedback settings", message });
    } finally {
      setSaving(false);
    }
  }

  async function retryPending() {
    setRetrying(true);
    try {
      const result = await postJson<RetryResult>("/api/feedback/retry-pending");
      showToast({
        tone: result.failed > 0 ? "warning" : "success",
        title: "Feedback retry complete",
        message: `${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not retry feedback delivery.";
      showToast({ tone: "error", title: "Could not retry feedback delivery", message });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="gap-detail-close grid">
      <SwitchField
        label="Send feedback directly to Integritas"
        description={descriptionFor(config, loading)}
        checked={Boolean(config?.hostedFeedbackEnabled)}
        disabled={loading || saving}
        onChange={(event) => void updateHostedFeedbackEnabled(event.target.checked)}
      />
      <Button type="button" variant="secondary" disabled={retrying || !config?.hostedFeedbackEnabled} onClick={() => void retryPending()}>
        {retrying ? "Retrying..." : "Retry pending uploads"}
      </Button>
    </div>
  );
}

function descriptionFor(config: FeedbackConfig | null, loading: boolean) {
  if (loading) return "Loading hosted feedback settings...";
  if (!config) return "Feedback will be saved locally.";
  if (config.hostedFeedbackAvailable) return "Feedback is saved locally first, then sent to Integritas after one-time consent.";
  if (config.hostedFeedbackEnabled && !config.integritasApiKeyConfigured) return "Hosted feedback requires an Integritas API key. Feedback will be saved locally.";
  return "Feedback will be saved locally.";
}
