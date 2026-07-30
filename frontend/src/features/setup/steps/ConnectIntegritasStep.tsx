import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { APP_NAME } from "../../../app/brand";
import { Button } from "../../../components/Button";
import { ErrorAlert } from "../../../components/ErrorAlert";
import { ProgressBar } from "../../../components/ui/ProgressBar";
import { cx } from "../../../lib/cx";
import type { AdminCredentialType } from "../../auth/adminCredentials";
import { TOTP_ENABLED } from "../../auth/totpEnabled";
import {
  hasConnectedProfile,
  type IntegritasAuthStatus,
} from "../../integritas-auth/integritasAuthApi";
import { OnboardingCard } from "../components/OnboardingCard";

const connectSteps = [
  "Open Integritas Connect",
  "Log in or create an account",
  "Approve this device",
] as const;

const PREPARING_LOADER_DELAY_MS = 400;

function RetryButton({ starting, onRetry }: { starting: boolean; onRetry: () => void }) {
  return (
    <Button
      type="button"
      variant="accent"
      size="md"
      disabled={starting}
      iconStart={<RefreshCw aria-hidden="true" />}
      onClick={onRetry}
    >
      {starting ? "Starting…" : "Try again"}
    </Button>
  );
}

function ListeningPulse() {
  return (
    <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-60 motion-safe:animate-ping motion-reduce:hidden" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-600" />
    </span>
  );
}

function SetupDoneRow({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="bg-surface-always-white rounded-soft grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 border border-slate-200/80 px-3.5 py-3">
      <span className="text-text-success grid h-8 w-8 place-items-center" aria-hidden="true">
        <CheckCircle2 size={20} strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="type-body-em text-text-primary m-0">{title}</p>
        <p className="type-body text-text-secondary m-0 mt-1 leading-relaxed">{detail}</p>
      </div>
    </li>
  );
}

function ConnectInstructionRow({ index, label }: { index: number; label: string }) {
  return (
    <li className="bg-surface-primary border-stroke-secondary rounded-soft p-margin-close border">
      <div className="gap-detail-close px-detail-next py-margin-close flex items-center">
        <span className="type-body-em text-text-tertiary shrink-0 tabular-nums">
          {String(index).padStart(2, "0")}
        </span>
        <p className="type-body text-text-primary m-0 min-w-0">{label}</p>
      </div>
    </li>
  );
}

function deviceSignInDetail(credentialType: AdminCredentialType | null | undefined): string {
  if (credentialType === "pin") return "Admin PIN set for this device";
  if (credentialType === "password") return "Admin password set for this device";
  return "Device security enabled";
}

export function ConnectIntegritasStep({
  status,
  starting,
  error,
  onVerify,
  onRetry,
  credentialType,
  progressCurrent,
  progressTotal,
  canGoBack,
  onBack,
}: {
  status: IntegritasAuthStatus | null;
  starting: boolean;
  error: string | null;
  onVerify: () => boolean;
  onRetry: () => void;
  /** Known when this session created the credential; omit on resume. */
  credentialType?: AdminCredentialType | null;
  progressCurrent: number;
  progressTotal: number;
  canGoBack: boolean;
  onBack: () => void;
}) {
  const [listening, setListening] = useState(false);
  const [showPreparingLoader, setShowPreparingLoader] = useState(false);
  const pendingStatus = status?.status === "pending" ? status : null;
  const connectedStatus = status?.status === "connected" ? status : null;
  const terminalKind =
    status?.status === "denied" || status?.status === "expired" || status?.status === "revoked"
      ? status.status
      : null;
  const connectedProfile =
    connectedStatus && hasConnectedProfile(connectedStatus) ? connectedStatus : null;
  const verificationUrl = pendingStatus?.verificationUrl;
  const isPreparing = !connectedStatus && !pendingStatus && !terminalKind && !error;

  useEffect(() => {
    setListening(false);
  }, [verificationUrl]);

  useEffect(() => {
    if (!isPreparing) {
      setShowPreparingLoader(false);
      return;
    }
    const timer = window.setTimeout(() => setShowPreparingLoader(true), PREPARING_LOADER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isPreparing]);

  if (connectedStatus) {
    const connectDetail = connectedProfile
      ? `Connected as ${connectedProfile.user.email}`
      : "Connected to Integritas Connect";

    return (
      <OnboardingCard>
        <div className="gap-detail-near flex w-full flex-col">
          <header className="gap-detail-next grid w-full">
            <h2 className="type-title text-text-primary m-0">{APP_NAME} is ready</h2>
            <p className="type-body text-text-secondary m-0">
              Setup is complete. Open the dashboard to start using {APP_NAME} services.
            </p>
          </header>

          <ul
            className="m-0 grid max-w-xl list-none gap-2 p-0"
            aria-live="polite"
            aria-atomic="true"
          >
            <SetupDoneRow title="Device secured" detail={deviceSignInDetail(credentialType)} />
            {TOTP_ENABLED ? (
              <SetupDoneRow title="Two-factor auth" detail="Authenticator ready for sign-in" />
            ) : null}
            <SetupDoneRow title="Integritas Connected" detail={connectDetail} />
          </ul>
        </div>
      </OnboardingCard>
    );
  }

  const terminalMessage =
    terminalKind === "denied"
      ? "Activation was denied in Integritas Connect."
      : terminalKind === "expired"
        ? "The verification session expired."
        : terminalKind === "revoked"
          ? "This device was revoked in Integritas Connect."
          : null;

  return (
    <OnboardingCard>
      <div className="gap-separator-related flex w-full flex-col">
        <ProgressBar
          current={progressCurrent}
          total={progressTotal}
          showBack={canGoBack}
          onBack={canGoBack ? onBack : undefined}
        />

        <div className="gap-separator-related flex w-full flex-col">
          <header className="gap-detail-next grid w-full">
            <h2 className="type-title text-text-primary m-0">Connect your Integritas account</h2>
            <p className="type-body text-text-secondary m-0">
              Connect your Integritas account to unlock your plan and Integritas services on this
              device.
            </p>
          </header>

          {terminalKind && terminalMessage ? (
            <ErrorAlert
              title="Connect session failed"
              action={<RetryButton starting={starting} onRetry={onRetry} />}
            >
              {terminalMessage}
            </ErrorAlert>
          ) : pendingStatus ? (
            <div className="gap-detail-close grid w-full" aria-live="polite">
              {listening ? (
                <div className="bg-surface-primary border-stroke-secondary rounded-soft flex items-start gap-3 border p-3.5">
                  <ListeningPulse />
                  <div>
                    <strong className="type-body-em text-text-primary">
                      Listening for approval…
                    </strong>
                    <p className="type-body text-text-secondary m-0 mt-1">
                      Finish in the Integritas Connect window. We&apos;ll continue automatically
                      when you approve this device.
                    </p>
                  </div>
                </div>
              ) : (
                <ol className="gap-detail-close m-0 grid list-none p-0">
                  {connectSteps.map((label, index) => (
                    <ConnectInstructionRow key={label} index={index + 1} label={label} />
                  ))}
                </ol>
              )}

              {error ? <ErrorAlert>{error}</ErrorAlert> : null}

              <div className={cx("gap-detail-close grid w-full", !listening && "pt-detail-close")}>
                <Button
                  type="button"
                  variant="accent"
                  size="md"
                  className="w-full"
                  iconStart={<ExternalLink aria-hidden="true" />}
                  onClick={() => {
                    setListening(true);
                    if (!onVerify()) {
                      window.open(pendingStatus.verificationUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                >
                  {listening ? "Reopen Integritas Connect" : "Open Integritas Connect"}
                </Button>

                {!listening ? (
                  <p className="type-meta text-text-secondary m-0">
                    The password you use to sign in to Integritas stays with Integritas and is never
                    stored on this device. The link expires in about 20 minutes.
                  </p>
                ) : (
                  <p className="type-meta text-text-secondary m-0">
                    The password you use to sign in to Integritas Connect stays with Integritas and
                    is never stored on this device.
                  </p>
                )}
              </div>
            </div>
          ) : error ? (
            <ErrorAlert
              title="Couldn't start Integritas Connect"
              action={<RetryButton starting={starting} onRetry={onRetry} />}
            >
              {error}
            </ErrorAlert>
          ) : showPreparingLoader ? (
            <div className="grid max-w-xl gap-3" aria-live="polite">
              <div className="bg-surface-primary border-stroke-secondary rounded-soft flex items-start gap-3 border p-3.5">
                <Loader2
                  className="text-text-secondary mt-0.5 shrink-0 animate-spin motion-reduce:animate-none"
                  size={20}
                  aria-hidden="true"
                />
                <div>
                  <strong className="type-body-em text-text-primary">
                    Connecting to Integritas…
                  </strong>
                  <p className="type-body text-text-secondary m-0 mt-1">
                    Preparing a secure Connect session for this device.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="sr-only" aria-live="polite">
              Preparing Integritas Connect…
            </div>
          )}
        </div>
      </div>
    </OnboardingCard>
  );
}
