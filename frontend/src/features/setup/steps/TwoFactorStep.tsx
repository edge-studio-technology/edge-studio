import { useState } from "react";
import { CheckCircle2, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { ErrorText } from "../../../components/Text";
import { cx } from "../../../lib/cx";
import { OnboardingCard } from "../components/OnboardingCard";
import type { CheckState, OnboardingFormState } from "../types";

const TOTP_ACCOUNT_LABEL = "Edge Studio";

type PillTone = "neutral" | "good" | "warn";

const pillToneClass: Record<PillTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  good: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
};

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: PillTone }) {
  return (
    <span
      className={cx(
        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold",
        pillToneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

export function TwoFactorStep({
  form,
  setForm,
  qrCode,
  totpSecret,
  loadingQr,
  qrError,
  checkState,
  onVerifyCode,
}: {
  form: OnboardingFormState;
  setForm: (patch: Partial<OnboardingFormState>) => void;
  qrCode: string | null;
  totpSecret: string | null;
  loadingQr: boolean;
  qrError: string | null;
  checkState: CheckState;
  onVerifyCode: () => void;
}) {
  const [showManualKey, setShowManualKey] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const copyManualKey = async () => {
    if (!totpSecret) return;
    try {
      await navigator.clipboard.writeText(totpSecret);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("idle");
    }
  };

  return (
    <OnboardingCard>
      <div className="gap-detail-near flex w-full flex-col">
        <header className="gap-detail-next grid w-full">
          <h2 className="type-title text-text-primary m-0">Set up two-factor authentication</h2>
          <p className="type-body text-text-secondary m-0">
            Scan the QR code with your authenticator app, or enter the setup key manually if
            scanning fails. Then enter the current 6-digit code to confirm it is working.
          </p>
        </header>

        <div className="grid max-w-2xl gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          {loadingQr ? (
            <p className="type-body text-text-secondary m-0">Generating QR code…</p>
          ) : qrError ? (
            <ErrorText>{qrError}</ErrorText>
          ) : qrCode ? (
            <img
              src={qrCode}
              alt="TOTP QR code"
              className="h-48 w-48 rounded-xl border border-slate-200 bg-white p-2"
            />
          ) : null}

          <div className="grid max-w-[520px] gap-2.5">
            {totpSecret ? (
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    className="grid gap-2 m-0 font-bold text-slate-700"
                    htmlFor="setup-manual-key"
                  >
                    Manual setup key
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    iconStart={showManualKey ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                    onClick={() => setShowManualKey((visible) => !visible)}
                    aria-pressed={showManualKey}
                  >
                    {showManualKey ? "Hide key" : "Show key"}
                  </Button>
                </div>
                <p className="text-sm font-medium text-slate-500">
                  Use issuer <strong>Edge Studio</strong> and account{" "}
                  <strong>{TOTP_ACCOUNT_LABEL}</strong> if your app asks for them.
                </p>
                <div className="flex flex-wrap items-stretch gap-2">
                  <Input
                    id="setup-manual-key"
                    className="min-w-0 flex-1 font-mono tracking-wide"
                    readOnly
                    value={showManualKey ? totpSecret : "•".repeat(Math.min(totpSecret.length, 32))}
                    aria-label="Authenticator setup key"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    iconStart={<Copy aria-hidden />}
                    onClick={() => void copyManualKey()}
                    title="Copy setup key"
                  >
                    {copyState === "copied" ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            ) : null}

            <label className="grid gap-2 font-bold text-slate-700">
              Confirmation code
              <Input
                className="max-w-[12rem] text-center text-lg tracking-[0.35em] tabular-nums"
                value={form.twoFactorCode}
                onChange={(event) =>
                  setForm({
                    twoFactorCode: event.target.value.replace(/\D/g, "").slice(0, 6),
                  })
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
              />
            </label>
          </div>
        </div>

        <div className="grid max-w-2xl gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <strong>Authenticator check</strong>
              <p className="mt-1 mb-0 text-slate-500">Confirms your app is generating valid codes.</p>
            </div>
            <Pill
              tone={
                checkState === "ok"
                  ? "good"
                  : checkState === "checking"
                    ? "warn"
                    : checkState === "error"
                      ? "warn"
                      : "neutral"
              }
            >
              {checkState === "ok"
                ? "Verified"
                : checkState === "checking"
                  ? "Verifying…"
                  : checkState === "error"
                    ? "Invalid code"
                    : "Not verified"}
            </Pill>
          </div>
          {checkState === "ok" && (
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 p-2.5 text-sm text-emerald-700">
              <CheckCircle2 size={18} />
              <div>
                <strong>Authenticator linked</strong>
                <p className="mt-1 mb-0 text-slate-500">You can continue with the rest of setup.</p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="accent"
              size="md"
              onClick={onVerifyCode}
              disabled={form.twoFactorCode.length !== 6 || checkState === "checking" || !qrCode}
            >
              {checkState === "checking" ? "Verifying…" : "Verify code"}
            </Button>
          </div>
        </div>
      </div>
    </OnboardingCard>
  );
}
