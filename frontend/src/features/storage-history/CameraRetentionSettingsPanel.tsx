import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
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
  getCameraRetention,
  previewCameraRetention,
  saveCameraRetention,
  type CameraRetentionPreview,
  type CameraRetentionResponse,
} from "./cameraRetentionApi";

function size(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CameraRetentionSettingsPanel() {
  const { showToast } = useToast();
  const [response, setResponse] = useState<CameraRetentionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState("7");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<CameraRetentionPreview | null>(null);

  function populate(value: CameraRetentionResponse) {
    setResponse(value);
    setEnabled(value.settings.retentionDays !== null);
    setDays(String(value.settings.retentionDays ?? 7));
  }
  async function load() {
    setLoading(true);
    setError(null);
    try {
      populate(await getCameraRetention());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load camera retention.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only load

  async function preview() {
    if (!response) return;
    const value = Number(days);
    if (
      enabled &&
      (!days.trim() ||
        !Number.isInteger(value) ||
        value < response.limits.min ||
        value > response.limits.max)
    ) {
      setFieldError(`Enter a whole number from ${response.limits.min} to ${response.limits.max}.`);
      return;
    }
    setFieldError(undefined);
    setBusy(true);
    try {
      setProposal(
        await previewCameraRetention({ retentionDays: enabled ? value : null, paused: false }),
      );
    } catch (error) {
      showToast({
        tone: "error",
        title: "Camera retention preview unavailable",
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
      const saved = await saveCameraRetention(proposal);
      populate({ ...response, ...saved });
      setProposal(null);
      showToast({
        tone: "success",
        title: "Camera retention saved",
        message: "No files were deleted by this save. Cleanup runs at startup and hourly.",
      });
    } catch (error) {
      setProposal(null);
      showToast({
        tone: "error",
        title: "Camera retention not saved",
        message: error instanceof Error ? error.message : "Review a new preview and try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SubSection
      icon={<Camera size={13} aria-hidden />}
      title="Camera retention"
      description="Camera support is an optional extension. Proof-linked captures are always protected."
    >
      {loading ? (
        <LoadingState title="Loading camera retention" />
      ) : error ? (
        <ErrorContentState
          title="Camera retention isn't available"
          description={describeLoadFailure(error)}
          onRetry={() => void load()}
        />
      ) : response ? (
        <div className="grid gap-4">
          <p className="type-body m-0">
            {response.camera.enabled
              ? "Camera support is enabled."
              : "Camera support is disabled. Automatic camera cleanup is paused."}
          </p>
          {!response.camera.available ? (
            <p className="type-body m-0" role="alert">
              Captures and proof links could not be fully checked. Cleanup is paused until they can
              be checked safely.
            </p>
          ) : null}
          {response.camera.enabled || response.camera.fileCount > 0 ? (
            <>
              <p className="type-body m-0">
                Stored captures: {response.camera.fileCount} ({size(response.camera.bytes)}).
              </p>
              <p className="type-body m-0">
                Saved camera policy:{" "}
                {response.settings.retentionDays === null
                  ? "Keep until manually deleted"
                  : `Delete after ${response.settings.retentionDays} days`}
                .{" "}
                {response.settings.paused || !response.camera.enabled
                  ? "Cleanup is paused; review and confirm the policy after enabling camera support to resume."
                  : "The saved policy is active."}
              </p>
            </>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void load()}
          >
            Refresh camera retention
          </Button>
          {response.camera.enabled ? (
            <form
              className="grid max-w-lg gap-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void preview();
              }}
            >
              <SwitchField
                label="Automatically remove old camera captures"
                checked={enabled}
                disabled={busy}
                onChange={(event) => setEnabled(event.target.checked)}
                description="Off means keep until manually deleted. Independent of history and inbox cleanup."
              />
              {enabled ? (
                <InputField
                  label="Camera capture retention (days)"
                  description="Age is measured from the capture file's modification time. Cleanup waits while workflows are running."
                  type="number"
                  min={response.limits.min}
                  max={response.limits.max}
                  step={1}
                  value={days}
                  error={fieldError}
                  disabled={busy}
                  onChange={(event) => setDays(event.target.value)}
                />
              ) : null}
              <div>
                <Button type="submit" disabled={busy}>
                  {busy ? "Working…" : "Preview camera retention"}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
      {proposal ? (
        <Modal
          title="Confirm camera retention"
          description="File deletion cannot be undone. Save any captures you need before enabling cleanup."
          closeDisabled={busy}
          onClose={() => {
            if (!busy) setProposal(null);
          }}
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
                {busy ? "Saving…" : "Confirm camera policy"}
              </Button>
            </ButtonRow>
          }
        >
          <div className="grid gap-3">
            <p className="type-body m-0">
              {proposal.settings.retentionDays === null
                ? "Keep camera captures until manually deleted."
                : `Delete unprotected camera captures after ${proposal.settings.retentionDays} days.`}
            </p>
            <p className="type-body m-0">
              Currently eligible for cleanup: {proposal.scheduled.fileCount} files (
              {size(proposal.scheduled.bytes)}).
            </p>
            <p className="type-meta text-text-secondary m-0">
              Proof-linked files are protected. Cleanup waits for active workflows and remains
              paused while camera support is disabled. Counts can change as files age; saving does
              not delete files immediately.
            </p>
          </div>
        </Modal>
      ) : null}
    </SubSection>
  );
}
