import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { APP_NAME, BRAND_GRADIENT } from "../app/brand";
import { BrandLockup } from "../components/patterns/BrandLockup";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { InputField } from "../components/ui/InputField";
import { PinField } from "../components/ui/PinField";
import { login } from "../features/auth/api";
import { TOTP_ENABLED } from "../features/auth/totpEnabled";

type LoginPhase = "credentials" | "twofa";

const TOTP_CODE_LENGTH = 6;

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [phase, setPhase] = useState<LoginPhase>("credentials");
  const [credential, setCredential] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const credentialsValid = credential.length > 0;
  const twoFactorValid = twoFactorCode.length === TOTP_CODE_LENGTH;

  const continueToTwoFactor = () => {
    if (!credentialsValid) return;
    setError(null);
    setPhase("twofa");
    setTwoFactorCode("");
  };

  const signIn = async (totpToken = "") => {
    if (signingIn) return;
    if (TOTP_ENABLED && !twoFactorValid) return;
    setSigningIn(true);
    setError(null);
    try {
      await login({
        password: credential,
        ...(TOTP_ENABLED ? { totpToken } : {}),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Log in failed");
    } finally {
      setSigningIn(false);
    }
  };

  const backToCredentials = () => {
    setPhase("credentials");
    setTwoFactorCode("");
    setSigningIn(false);
    setError(null);
  };

  return (
    <div
      className="text-text-primary fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden overscroll-contain"
      style={{ background: BRAND_GRADIENT }}
    >
      <div
        className="px-margin-tight py-margin-relaxed relative z-10 flex h-full min-h-0 w-full flex-col items-center overflow-hidden"
        role="main"
        aria-label="Log in"
      >
        <div className="size-8 shrink-0" aria-hidden="true" />

        <div className="flex min-h-0 w-full flex-1 [scrollbar-width:thin] flex-col items-center justify-center overflow-y-auto">
          <Card className="w-full max-w-120 shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
            <h1 className="sr-only">{APP_NAME}</h1>

            {phase === "credentials" ? (
              <form
                className="gap-separator-related flex w-full flex-col"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (TOTP_ENABLED) {
                    continueToTwoFactor();
                    return;
                  }
                  if (credentialsValid && !signingIn) void signIn();
                }}
              >
                <header className="gap-detail-next grid w-full text-center">
                  <h2 className="type-heading text-text-primary m-0">Welcome back</h2>
                  <p className="type-body text-text-secondary m-0">
                    Enter your password or PIN to continue.
                  </p>
                </header>

                <div className="gap-detail-close flex w-full flex-col">
                  <InputField
                    label="Password / PIN"
                    type="password"
                    value={credential}
                    onChange={(event) => {
                      setCredential(event.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    autoFocus
                    error={error ?? undefined}
                  />

                  <Button
                    type="submit"
                    variant="accent"
                    size="md"
                    className="w-full"
                    disabled={!credentialsValid || signingIn}
                  >
                    {signingIn ? "Logging in…" : TOTP_ENABLED ? "Continue" : "Log In"}
                  </Button>
                </div>
              </form>
            ) : (
              <form
                className="gap-separator-related flex w-full flex-col"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (twoFactorValid && !signingIn) void signIn(twoFactorCode);
                }}
              >
                <header className="gap-detail-next grid w-full text-center">
                  <h2 className="type-heading text-text-primary m-0">Enter your code</h2>
                  <p className="type-callout text-text-secondary m-0">
                    Open your authenticator app and enter the {TOTP_CODE_LENGTH}-digit code for{" "}
                    {APP_NAME}.
                  </p>
                </header>

                <div className="gap-detail-close flex w-full flex-col">
                  <PinField
                    label="Authentication code"
                    value={twoFactorCode}
                    length={TOTP_CODE_LENGTH}
                    onChange={(nextCode) => {
                      setTwoFactorCode(nextCode);
                      if (error) setError(null);
                    }}
                    autoComplete="one-time-code"
                    autoFocus
                    error={error ?? undefined}
                  />

                  <Button
                    type="submit"
                    variant="accent"
                    size="md"
                    className="w-full"
                    disabled={!twoFactorValid || signingIn}
                  >
                    {signingIn ? "Logging in…" : "Log In"}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    className="w-full"
                    iconStart={<ArrowLeft />}
                    onClick={backToCredentials}
                  >
                    Back
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>

        <BrandLockup size={40} tone="on-dark" className="shrink-0" />
      </div>
    </div>
  );
}
