import { useEffect, useMemo, useRef, useState } from "react";
import { APP_NAME } from "../../app/brand";
import { BrandMark } from "../../components/BrandMark";
import { Button } from "../../components/Button";
import { ErrorText } from "../../components/Text";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { isValidAdminCredential } from "../auth/adminCredentials";
import { TOTP_ENABLED } from "../auth/totpEnabled";
import { useIntegritasAuth } from "../integritas-auth/useIntegritasAuth";
import { completeSetup, initTotp, verifyTotp } from "./api";
import { onboardingSteps, onboardingWorkSteps } from "./steps";
import { AccountStep } from "./steps/AccountStep";
import { ConnectIntegritasStep } from "./steps/ConnectIntegritasStep";
import { TwoFactorStep } from "./steps/TwoFactorStep";
import { WelcomeStep } from "./steps/WelcomeStep";
import type { CheckState, OnboardingFormState, OnboardingStepId } from "./types";

const initialForm: OnboardingFormState = {
  credentialType: "pin",
  password: "",
  confirmPassword: "",
  twoFactorCode: "",
};

const connectAccountStepIndex = onboardingSteps.findIndex((step) => step.id === "connectAccount");

export function OnboardingWizard({
  onComplete,
  resumeAtConnect = false,
}: {
  onComplete: () => void;
  resumeAtConnect?: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(() =>
    resumeAtConnect ? Math.max(0, connectAccountStepIndex) : 0,
  );
  const [form, setFormState] = useState<OnboardingFormState>(initialForm);
  const [totpCheck, setTotpCheck] = useState<CheckState>("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localAdminReady, setLocalAdminReady] = useState(resumeAtConnect);
  const connectStartRequested = useRef(false);

  const {
    status,
    loading: connectLoading,
    starting,
    error: connectError,

    start,
    openVerification,
  } = useIntegritasAuth({
    enabled: localAdminReady,
    refreshProfileOnConnected: true,
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const currentStep = onboardingSteps[stepIndex];
  const workStepIndex = onboardingWorkSteps.findIndex((step) => step.id === currentStep.id);
  const isWorkStep = workStepIndex >= 0;
  const connectReady = currentStep.id === "connectAccount" && status?.status === "connected";

  const setForm = (patch: Partial<OnboardingFormState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
    if ("twoFactorCode" in patch) {
      setTotpCheck("idle");
    }
  };

  useEffect(() => {
    if (currentStep.id !== "twofa") return;
    if (qrCode || loadingQr) return;

    setLoadingQr(true);
    setQrError(null);
    initTotp()
      .then((result) => {
        setQrCode(result.qrCodePngBase64);
        setTotpSecret(result.secret);
      })
      .catch((err: Error) => setQrError(err.message))
      .finally(() => setLoadingQr(false));
  }, [currentStep.id, qrCode, loadingQr]);

  // After local admin exists: start Connect activation on the account screen.
  useEffect(() => {
    if (!localAdminReady || currentStep.id !== "connectAccount") return;
    if (connectLoading || starting || connectStartRequested.current || connectError) return;
    if (!status || status.status !== "unauthenticated") return;

    connectStartRequested.current = true;
    void start();
  }, [localAdminReady, currentStep.id, connectLoading, starting, connectError, status, start]);

  const canContinue = useMemo(() => {
    switch (currentStep.id) {
      case "welcome":
        return true;
      case "account":
        return (
          isValidAdminCredential(form.credentialType, form.password) &&
          form.password === form.confirmPassword
        );
      case "twofa":
        return totpCheck === "ok" && Boolean(qrCode) && !qrError;
      case "connectAccount":
        return status?.status === "connected";
      default:
        return false;
    }
  }, [currentStep.id, form, totpCheck, qrCode, qrError, status?.status]);

  const shouldCreateLocalAdmin = (stepId: OnboardingStepId) => {
    if (localAdminReady) return false;
    if (TOTP_ENABLED) return stepId === "twofa";
    return stepId === "account";
  };

  const goNext = async () => {
    if (connectReady) {
      onComplete();
      return;
    }

    if (shouldCreateLocalAdmin(currentStep.id)) {
      setSubmitting(true);
      setSubmitError(null);
      try {
        await completeSetup({ password: form.password });
        setLocalAdminReady(true);
        connectStartRequested.current = false;
        setStepIndex((index) => index + 1);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Setup failed");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (stepIndex < onboardingSteps.length - 1) {
      setStepIndex((index) => index + 1);
    }
  };

  const goBack = () => {
    if (localAdminReady) return;
    if (stepIndex > 0) setStepIndex((index) => index - 1);
  };

  const verifyTotpCode = async () => {
    setTotpCheck("checking");
    try {
      await verifyTotp(form.twoFactorCode);
      setTotpCheck("ok");
    } catch {
      setTotpCheck("error");
    }
  };

  const retryConnect = () => {
    void start({ openPopup: true });
  };

  const hideContinue = currentStep.id === "connectAccount" && status?.status !== "connected";
  const canGoBack = stepIndex > 0 && !localAdminReady;
  const isFinalOnboardingView = currentStep.id === "connectAccount";
  const continueLabel = submitting
    ? "Securing device…"
    : connectReady
      ? "Enter Edge Studio"
      : "Continue";
  const progressCurrent = connectReady
    ? onboardingWorkSteps.length
    : Math.max(workStepIndex + 1, 1);

  return (
    <div
      className="text-text-primary fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden overscroll-contain"
      style={
        isFinalOnboardingView
          ? {
              background:
                "linear-gradient(180deg, var(--color-surface-inverse, #000) 30%, var(--color-surface-accent, #6D48DC) 100%)",
            }
          : { background: "var(--color-surface-secondary)" }
      }
    >
      <div
        className="px-margin-tight py-margin-relaxed relative z-10 flex h-full min-h-0 w-full flex-col items-center overflow-hidden"
        role="main"
        aria-label="Setup Wizard"
      >
        <div className="size-6 shrink-0" aria-hidden="true" />

        <div className="flex min-h-0 w-full flex-1 [scrollbar-width:thin] flex-col items-center justify-center overflow-y-auto">
          <div className="gap-detail-close flex w-full max-w-[480px] flex-col py-4">
            {isWorkStep && currentStep.id !== "account" && currentStep.id !== "connectAccount" ? (
              <ProgressBar
                current={progressCurrent}
                total={onboardingWorkSteps.length}
                showBack={canGoBack}
                onBack={canGoBack ? goBack : undefined}
              />
            ) : null}

            {currentStep.id === "welcome" && <WelcomeStep onContinue={() => void goNext()} />}
            {currentStep.id === "account" && (
              <AccountStep
                form={form}
                setForm={setForm}
                onSubmit={() => {
                  if (canContinue && !submitting) void goNext();
                }}
                progressCurrent={progressCurrent}
                progressTotal={onboardingWorkSteps.length}
                canGoBack={canGoBack}
                onBack={goBack}
                canContinue={canContinue}
                continueLabel={continueLabel}
                submitting={submitting}
              />
            )}
            {currentStep.id === "twofa" && (
              <TwoFactorStep
                form={form}
                setForm={setForm}
                qrCode={qrCode}
                totpSecret={totpSecret}
                loadingQr={loadingQr}
                qrError={qrError}
                checkState={totpCheck}
                onVerifyCode={() => void verifyTotpCode()}
              />
            )}
            {currentStep.id === "connectAccount" && (
              <ConnectIntegritasStep
                status={status}
                starting={starting || connectLoading}
                error={connectError}
                onVerify={openVerification}
                onRetry={retryConnect}
                credentialType={resumeAtConnect ? null : form.credentialType}
                progressCurrent={progressCurrent}
                progressTotal={onboardingWorkSteps.length}
                canGoBack={canGoBack}
                onBack={goBack}
              />
            )}

            {isWorkStep && currentStep.id !== "account" && !hideContinue ? (
              <Button
                type="button"
                variant="accent"
                size="md"
                className="w-full"
                disabled={!canContinue || submitting}
                onClick={() => void goNext()}
              >
                {continueLabel}
              </Button>
            ) : null}

            {submitError ? <ErrorText role="alert">{submitError}</ErrorText> : null}
          </div>
        </div>

        <div className="gap-detail-close flex shrink-0 items-center">
          <div
            className={
              isFinalOnboardingView
                ? "bg-overlay-light text-icon-inverse border-stroke-always-white/20 flex size-8 shrink-0 items-center justify-center rounded border"
                : "bg-surface-always-black text-icon-inverse flex size-8 shrink-0 items-center justify-center rounded"
            }
          >
            <BrandMark size={20} variant="white" />
          </div>
          <p className={isFinalOnboardingView ? "type-title text-text-inverse m-0" : "type-title text-surface-always-black m-0"}>
            {APP_NAME}
          </p>
        </div>
      </div>
    </div>
  );
}
