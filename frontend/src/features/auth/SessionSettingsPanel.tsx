import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "../../components/Button";
import { SubSection } from "../../components/patterns/SubSection";
import { LoadingState } from "../../components/patterns/LoadingState";
import { ErrorContentState } from "../../components/patterns/ErrorContentState";
import { InputField } from "../../components/ui/InputField";
import { CredentialField } from "../../components/ui/CredentialField";
import { useToast } from "../../components/ToastProvider";
import { describeLoadFailure } from "../../lib/errors";
import { adminCredentialLabel, isAdminCredentialEntryReady } from "./adminCredentials";
import { useAuth } from "./hooks";
import { getSessionSettings, saveSessionSettings, type SessionSettingsResponse } from "./api";

const fields = [
  { key: "maxAgeDays", label: "Maximum session lifetime (days)" },
  { key: "idleHours", label: "Session inactivity timeout (hours)" },
] as const;

export function SessionSettingsPanel() {
  const { user, refreshSession } = useAuth();
  const { showToast } = useToast();
  const credentialType = user?.credentialType ?? null;
  const [response, setResponse] = useState<SessionSettingsResponse | null>(null);
  const [inputs, setInputs] = useState({ maxAgeDays: "", idleHours: "" });
  const [currentPassword, setCurrentPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const value = await getSessionSettings();
      setResponse(value);
      setInputs({
        maxAgeDays: String(value.settings.maxAgeDays),
        idleHours: String(value.settings.idleHours),
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load session settings.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!response || busy) return;
    const fieldErrors: Record<string, string> = {};
    for (const field of fields) {
      const value = Number(inputs[field.key]);
      const range = response.limits[field.key];
      if (
        !inputs[field.key].trim() ||
        !Number.isInteger(value) ||
        value < range.min ||
        value > range.max
      )
        fieldErrors[field.key] = `Enter a whole number from ${range.min} to ${range.max}.`;
    }
    setErrors(fieldErrors);
    if (
      Object.keys(fieldErrors).length ||
      !isAdminCredentialEntryReady(credentialType, currentPassword)
    )
      return;
    setBusy(true);
    try {
      const result = await saveSessionSettings(
        { maxAgeDays: Number(inputs.maxAgeDays), idleHours: Number(inputs.idleHours) },
        currentPassword,
      );
      setResponse({ ...response, settings: result.settings });
      showToast({
        tone: "success",
        title: "Session settings saved",
        message: result.currentSessionExpired
          ? "Your session has expired under the new limits. Log in again."
          : "The new limits now apply. Existing session expiry dates are never extended.",
      });
      if (result.currentSessionExpired) await refreshSession();
    } catch (error) {
      showToast({
        tone: "error",
        title: "Session settings not saved",
        message: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setCurrentPassword("");
      setBusy(false);
    }
  }

  return (
    <SubSection
      icon={<Shield size={13} aria-hidden />}
      title="Login sessions"
      description="Choose when a fresh login is required."
    >
      {loading ? (
        <LoadingState title="Loading session settings" />
      ) : loadError ? (
        <ErrorContentState
          title="Session settings aren't available"
          description={describeLoadFailure(loadError)}
          onRetry={() => void load()}
        />
      ) : response ? (
        <form
          className="grid max-w-lg gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {fields.map((field) => (
            <InputField
              key={field.key}
              label={field.label}
              type="number"
              min={response.limits[field.key].min}
              max={response.limits[field.key].max}
              step={1}
              value={inputs[field.key]}
              error={errors[field.key]}
              disabled={busy}
              onChange={(event) =>
                setInputs((previous) => ({ ...previous, [field.key]: event.target.value }))
              }
            />
          ))}
          <p className="type-body text-text-secondary m-0">
            The maximum lifetime runs from login, even while using the app. Inactivity means no
            authenticated requests: background polling counts as activity, so an open app may stay
            signed in until the maximum lifetime expires. Whichever limit comes first applies.
          </p>
          <p className="type-body text-text-secondary m-0">
            Shorter limits apply to existing sessions and may sign you out. Longer maximum lifetimes
            apply to new logins; inactivity changes apply to all sessions. Existing expiry dates are
            never extended, and expired sessions are not restored.
          </p>
          <CredentialField
            label={`Confirm current ${adminCredentialLabel(credentialType)}`}
            credentialType={credentialType}
            value={currentPassword}
            onChange={setCurrentPassword}
            disabled={busy}
            autoComplete="current-password"
          />
          <div>
            <Button
              type="submit"
              disabled={busy || !isAdminCredentialEntryReady(credentialType, currentPassword)}
            >
              {busy ? "Saving…" : "Confirm and save session settings"}
            </Button>
          </div>
        </form>
      ) : null}
    </SubSection>
  );
}
