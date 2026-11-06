import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { SubSection } from "../../components/patterns/SubSection";
import { LoadingState } from "../../components/patterns/LoadingState";
import { ErrorContentState } from "../../components/patterns/ErrorContentState";
import { InputField } from "../../components/ui/InputField";
import { SwitchField } from "../../components/ui/SwitchField";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ToastProvider";
import { describeLoadFailure } from "../../lib/errors";
import {
  getRetentionSettings,
  previewRetentionSettings,
  saveRetentionSettings,
  type RetentionPreview,
  type RetentionResponse,
} from "./retentionApi";

const fields = [
  {
    key: "runsPerWorkflow",
    label: "Runs to keep per workflow",
    description:
      "Keep the newest runs separately for each existing workflow. Active runs are protected; their block runs stay with them.",
  },
  {
    key: "deletedWorkflowRunDays",
    label: "Deleted-workflow run retention (days)",
    description: "For deleted workflows, keep runs until this many days after the run started.",
  },
  {
    key: "dataSourceReadDays",
    label: "Data-source read retention (days)",
    description: "Readings linked to an Integritas proof are always protected.",
  },
  {
    key: "diskWarningPercent",
    label: "Disk warning threshold (%)",
    description:
      "Warn here when the application data filesystem reaches this usage. A warning never triggers extra deletion.",
  },
] as const;

export function RetentionSettingsPanel() {
  const { showToast } = useToast();
  const [response, setResponse] = useState<RetentionResponse | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [inboxEnabled, setInboxEnabled] = useState(false);
  const [inboxDays, setInboxDays] = useState("90");
  const [inputs, setInputs] = useState({
    runsPerWorkflow: "",
    deletedWorkflowRunDays: "",
    dataSourceReadDays: "",
    diskWarningPercent: "",
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [proposal, setProposal] = useState<RetentionPreview | null>(null);
  const [busy, setBusy] = useState(false);

  function populate(value: RetentionResponse) {
    setResponse({
      ...value,
      diskUsage: value.diskUsage
        ? {
            ...value.diskUsage,
            warning: value.diskUsage.usedPercent >= value.settings.diskWarningPercent,
          }
        : null,
    });
    setEnabled(value.settings.automaticCleanupEnabled);
    setInboxEnabled(value.settings.inboxRetentionDays !== null);
    setInboxDays(String(value.settings.inboxRetentionDays ?? 90));
    setInputs({
      runsPerWorkflow: String(value.settings.runsPerWorkflow),
      deletedWorkflowRunDays: String(value.settings.deletedWorkflowRunDays),
      dataSourceReadDays: String(value.settings.dataSourceReadDays),
      diskWarningPercent: String(value.settings.diskWarningPercent),
    });
  }
  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      populate(await getRetentionSettings());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load retention settings.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only load

  async function preview() {
    if (!response) return;
    const fieldErrors: Record<string, string> = {};
    for (const field of fields) {
      const number = Number(inputs[field.key]);
      const range = response.limits[field.key];
      if (
        !inputs[field.key].trim() ||
        !Number.isInteger(number) ||
        number < range.min ||
        number > range.max
      )
        fieldErrors[field.key] = `Enter a whole number from ${range.min} to ${range.max}.`;
    }
    if (inboxEnabled) {
      const range = response.limits.inboxRetentionDays;
      const number = Number(inboxDays);
      if (
        !inboxDays.trim() ||
        !Number.isInteger(number) ||
        number < range.min ||
        number > range.max
      ) {
        fieldErrors.inboxRetentionDays = `Enter a whole number from ${range.min} to ${range.max}.`;
      }
    }
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setBusy(true);
    try {
      setProposal(
        await previewRetentionSettings({
          automaticCleanupEnabled: enabled,
          runsPerWorkflow: Number(inputs.runsPerWorkflow),
          deletedWorkflowRunDays: Number(inputs.deletedWorkflowRunDays),
          dataSourceReadDays: Number(inputs.dataSourceReadDays),
          diskWarningPercent: Number(inputs.diskWarningPercent),
          inboxRetentionDays: inboxEnabled ? Number(inboxDays) : null,
        }),
      );
    } catch (error) {
      showToast({
        tone: "error",
        title: "Preview unavailable",
        message: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!proposal || !response) return;
    setBusy(true);
    try {
      const saved = await saveRetentionSettings(proposal);
      populate({ ...response, ...saved });
      setProposal(null);
      showToast({
        tone: "success",
        title: "Retention policy saved",
        message:
          saved.settings.automaticCleanupEnabled || saved.settings.inboxRetentionDays !== null
            ? "Automatic cleanup runs at startup and hourly. Records are not deleted by this save."
            : "Automatic history cleanup is off.",
      });
    } catch (error) {
      setProposal(null);
      showToast({
        tone: "error",
        title: "Retention policy not saved",
        message: error instanceof Error ? error.message : "Review a new preview and try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SubSection
      icon={<SlidersHorizontal size={13} aria-hidden />}
      title="Automatic retention"
      description="Keep history until you explicitly enable automatic cleanup. Export anything you need before enabling it or lowering limits."
    >
      {loading ? (
        <LoadingState title="Loading retention settings" />
      ) : loadError ? (
        <ErrorContentState
          title="Retention settings aren't available"
          description={describeLoadFailure(loadError)}
          onRetry={() => void load()}
        />
      ) : response ? (
        <div className="grid gap-4">
          <p className="type-body m-0">
            Run and read cleanup is currently{" "}
            {response.settings.automaticCleanupEnabled ? "on" : "off"}. Preview and confirm to apply
            changes.
          </p>
          <p
            className="type-body text-text-secondary m-0"
            role={response.diskUsage?.warning ? "alert" : undefined}
          >
            {response.diskUsage
              ? `Data filesystem usage: ${response.diskUsage.usedPercent.toFixed(1)}%.${response.diskUsage.warning ? " Disk warning threshold reached." : ""}`
              : "Data filesystem usage is unavailable."}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void load()}
          >
            Refresh policy and disk usage
          </Button>
          <form
            className="grid max-w-lg gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void preview();
            }}
          >
            <SwitchField
              label="Enable automatic run and read cleanup"
              checked={enabled}
              disabled={busy}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            {fields.map((field) => (
              <InputField
                key={field.key}
                label={field.label}
                description={field.description}
                type="number"
                min={response.limits[field.key].min}
                max={response.limits[field.key].max}
                step={1}
                value={inputs[field.key]}
                disabled={busy}
                error={errors[field.key]}
                onChange={(event) =>
                  setInputs((previous) => ({ ...previous, [field.key]: event.target.value }))
                }
              />
            ))}
            <SwitchField
              label="Automatically remove old inbox items"
              description="Separate opt-in policy. Off means keep until manually deleted, even when run and read cleanup is on."
              checked={inboxEnabled}
              disabled={busy}
              onChange={(event) => setInboxEnabled(event.target.checked)}
            />
            <p className="type-meta text-text-secondary m-0">
              Saved inbox policy:{" "}
              {response.settings.inboxRetentionDays === null
                ? "Keep until manually deleted"
                : `Delete after ${response.settings.inboxRetentionDays} days from creation`}
              . Preview and confirm to apply changes.
            </p>
            {inboxEnabled ? (
              <InputField
                label="Inbox item retention (days)"
                description="Applies to read and unread items based on creation time. Active-run items and linked files are protected."
                type="number"
                step={1}
                min={response.limits.inboxRetentionDays.min}
                max={response.limits.inboxRetentionDays.max}
                value={inboxDays}
                error={errors.inboxRetentionDays}
                disabled={busy}
                onChange={(event) => setInboxDays(event.target.value)}
              />
            ) : null}
            <p className="type-meta text-text-secondary m-0">
              Wallet history, proof history, imported archives, and audit events are retained. Inbox
              items expire only when their separate policy is enabled. This cleanup does not delete
              files or change camera retention.
            </p>
            <div>
              <Button type="submit" disabled={busy}>
                {busy ? "Working…" : "Preview retention changes"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
      {proposal ? (
        <Modal
          title="Confirm retention policy"
          description="Automatic deletion cannot be undone. Export history first if you need to keep it."
          onClose={() => {
            if (!busy) setProposal(null);
          }}
          closeDisabled={busy}
          footer={
            <ButtonRow>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setProposal(null)}
              >
                Cancel
              </Button>
              <Button type="button" disabled={busy} onClick={() => void confirm()}>
                {busy ? "Saving…" : "Confirm and save policy"}
              </Button>
            </ButtonRow>
          }
        >
          <div className="grid gap-3">
            <p className="type-body m-0">
              {proposal.settings.automaticCleanupEnabled
                ? "Run and read cleanup will be enabled with these limits:"
                : "Run and read cleanup will be off. These limits will be saved:"}
            </p>
            <ul className="type-body m-0 pl-5">
              {fields.map((field) => (
                <li key={field.key}>
                  {field.label}: {proposal.settings[field.key]}
                </li>
              ))}
            </ul>
            <p className="type-body m-0">
              Inbox policy:{" "}
              {proposal.settings.inboxRetentionDays === null
                ? "Keep until manually deleted"
                : `Delete read and unread items after ${proposal.settings.inboxRetentionDays} days from creation`}
              . Items linked to active runs and linked files are protected.
            </p>
            <p className="type-body m-0">
              Currently eligible for the next sweep: {proposal.scheduled.automationRuns} workflow
              runs, {proposal.scheduled.automationBlockRuns} block runs, and{" "}
              {proposal.scheduled.dataSourceReads} data-source reads. Inbox items:{" "}
              {proposal.scheduled.automationInboxItems}.
            </p>
            <p className="type-meta text-text-secondary m-0">
              Counts are a snapshot and can change as records age. Active runs and proof-linked
              reads are protected. Block runs are removed together with their parent run. Saving
              does not delete records immediately or shrink the SQLite file.
            </p>
          </div>
        </Modal>
      ) : null}
    </SubSection>
  );
}
