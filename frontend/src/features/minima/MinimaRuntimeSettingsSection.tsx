import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import type { MinimaRuntimeSettingsResponse } from "../../app/types";
import { Button } from "../../components/Button";
import { SubSection } from "../../components/patterns/SubSection";
import { ErrorContentState } from "../../components/patterns/ErrorContentState";
import { LoadingState } from "../../components/patterns/LoadingState";
import { InputField } from "../../components/ui/InputField";
import { SwitchField } from "../../components/ui/SwitchField";
import { useToast } from "../../components/ToastProvider";
import { describeLoadFailure } from "../../lib/errors";
import { getMinimaRuntimeSettings, saveMinimaRuntimeSettings } from "./minimaApi";

const fields = [
  { key: "healthPollIntervalSeconds", label: "Health-check interval (seconds)" },
  {
    key: "stallBlockAgeSeconds",
    label: "Stall threshold (seconds)",
    description: "A running node is considered stalled when its latest block is older than this.",
  },
  {
    key: "autoResyncCooldownMinutes",
    label: "Automatic resync cooldown (minutes)",
    description: "Minimum time between automatic resync attempts.",
  },
] as const;

export function MinimaRuntimeSettingsSection() {
  const { showToast } = useToast();
  const [response, setResponse] = useState<MinimaRuntimeSettingsResponse | null>(null);
  const [inputs, setInputs] = useState({
    healthPollIntervalSeconds: "",
    stallBlockAgeSeconds: "",
    autoResyncCooldownMinutes: "",
  });
  const [autoResyncEnabled, setAutoResyncEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function populate(value: MinimaRuntimeSettingsResponse) {
    setResponse(value);
    setInputs({
      healthPollIntervalSeconds: String(value.settings.healthPollIntervalSeconds),
      stallBlockAgeSeconds: String(value.settings.stallBlockAgeSeconds),
      autoResyncCooldownMinutes: String(value.settings.autoResyncCooldownMinutes),
    });
    setAutoResyncEnabled(value.settings.autoResyncEnabled);
  }

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      populate(await getMinimaRuntimeSettings());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load monitoring settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only load

  async function save() {
    if (!response) return;
    const fieldErrors: Record<string, string> = {};
    for (const field of fields) {
      const range = response.limits[field.key];
      const number = Number(inputs[field.key]);
      if (
        !inputs[field.key].trim() ||
        !Number.isInteger(number) ||
        number < range.min ||
        number > range.max
      ) {
        fieldErrors[field.key] = `Enter a whole number from ${range.min} to ${range.max}.`;
      }
    }
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setSaving(true);
    try {
      populate(
        await saveMinimaRuntimeSettings({
          healthPollIntervalSeconds: Number(inputs.healthPollIntervalSeconds),
          stallBlockAgeSeconds: Number(inputs.stallBlockAgeSeconds),
          autoResyncCooldownMinutes: Number(inputs.autoResyncCooldownMinutes),
          autoResyncEnabled,
        }),
      );
      showToast({
        tone: "success",
        title: "Monitoring settings saved",
        message: "Changes apply without restarting Minima.",
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Could not save monitoring settings",
        message: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SubSection
      icon={<Activity size={13} aria-hidden />}
      title="Monitoring & automatic resync"
      description="Manage health checks and recovery while Minima is running or stopped. Changes apply without a restart and do not cancel a resync already in progress."
    >
      {loading ? (
        <LoadingState title="Fetching monitoring settings" />
      ) : loadError ? (
        <ErrorContentState
          title="Monitoring settings aren't available"
          description={describeLoadFailure(loadError)}
          onRetry={() => void load()}
        />
      ) : response ? (
        <form
          className="grid max-w-md gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <SwitchField
            label="Automatically resync a stalled node"
            description="Resync can temporarily interrupt node-dependent workflows. Existing resync safeguards and the cooldown still apply."
            checked={autoResyncEnabled}
            disabled={saving}
            onChange={(event) => setAutoResyncEnabled(event.target.checked)}
          />
          {fields.map((field) => (
            <InputField
              key={field.key}
              label={field.label}
              description={"description" in field ? field.description : undefined}
              type="number"
              step={1}
              min={response.limits[field.key].min}
              max={response.limits[field.key].max}
              value={inputs[field.key]}
              error={errors[field.key]}
              disabled={saving}
              onChange={(event) =>
                setInputs((previous) => ({ ...previous, [field.key]: event.target.value }))
              }
            />
          ))}
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save monitoring settings"}
            </Button>
          </div>
        </form>
      ) : null}
    </SubSection>
  );
}
