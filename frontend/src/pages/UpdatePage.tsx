import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ButtonRow } from "../components/patterns/ButtonRow";
import { ErrorAlert } from "../components/patterns/ErrorAlert";
import { Page } from "../components/patterns/Page";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorText } from "../components/ui/ErrorText";
import { LoadingDots } from "../components/ui/LoadingDots";
import { Pill } from "../components/ui/Pill";
import { ChangelogPreview } from "../features/update/ChangelogPreview";
import { getUpdateStatus, startUpdateApply } from "../features/update/updateApi";
import type { ApiError } from "../lib/api";
import type { UpdateStatus } from "../app/types";

export function UpdatePage() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getUpdateStatus()
      .then(setStatus)
      .catch((error: ApiError) => setLoadError(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startUpdate = async () => {
    setStarting(true);
    setStartError(null);
    try {
      await startUpdateApply();
      // update-agent's own page (trailing slash). See docs/adr/0002-update-page-split.md.
      window.location.assign("/update/");
    } catch (error) {
      setStartError((error as ApiError).message);
      setStarting(false);
    }
  };

  const outOfDate = status?.services.filter((service) => !service.upToDate) ?? [];
  const upToDate = Boolean(status) && outOfDate.length === 0;

  return (
    <Page
      title="Software update"
      desc="Check for and apply software updates."
      action={
        status && upToDate ? (
          <Button
            variant="secondary"
            size="sm"
            iconStart={<RefreshCw aria-hidden />}
            onClick={load}
          >
            Check again
          </Button>
        ) : undefined
      }
    >
      <Card className="gap-detail-close flex w-full flex-col">
        {loading ? (
          <div className="gap-detail-next flex items-center">
            <LoadingDots />
            <span className="type-body text-text-secondary">Checking for updates…</span>
          </div>
        ) : loadError ? (
          <ErrorAlert
            title="Couldn't check for updates"
            action={
              <Button variant="secondary" size="sm" onClick={load}>
                Retry
              </Button>
            }
          >
            {loadError}
          </ErrorAlert>
        ) : status ? (
          <>
            <div className="gap-detail-tight flex flex-col">
              <div className="gap-detail-next flex items-center">
                <h2 className="type-title text-text-primary m-0">
                  {upToDate ? "Up to date" : "Update available"}
                </h2>
                <Pill tone={upToDate ? "good" : "warn"} indicator>
                  {upToDate ? "Current" : "Update"}
                </Pill>
              </div>
              <p className="type-body text-text-secondary m-0 mb-2">
                {upToDate
                  ? `Running version ${status.currentVersion ?? status.manifest.version}.`
                  : status.currentVersion
                    ? `${status.currentVersion} → ${status.manifest.version}`
                    : `Version ${status.manifest.version} is available.`}
              </p>
              {!upToDate ? (
                <ButtonRow>
                  <Button variant="primary" onClick={() => void startUpdate()} disabled={starting}>
                    {starting ? "Starting…" : "Update now"}
                  </Button>
                </ButtonRow>
              ) : null}
              {startError ? <ErrorText>{startError}</ErrorText> : null}
            </div>

            <div className="border-stroke-secondary gap-detail-close pt-detail-close flex flex-col border-t">
              <h3 className="type-title text-text-primary m-0">What's new</h3>
              <ChangelogPreview />
            </div>
          </>
        ) : null}
      </Card>
    </Page>
  );
}
