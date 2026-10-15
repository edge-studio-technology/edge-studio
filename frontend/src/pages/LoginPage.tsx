import { useState } from "react";
import { APP_NAME, BRAND_GRADIENT } from "../app/brand";
import { BrandLockup } from "../components/patterns/BrandLockup";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { CredentialField } from "../components/ui/CredentialField";
import { login } from "../features/auth/api";
import { isAdminCredentialEntryReady, type AdminCredentialType } from "../features/auth/adminCredentials";

export function LoginPage({ onSuccess, sessionNotice, credentialType = null }: {
  onSuccess: () => void;
  sessionNotice?: string | null;
  credentialType?: AdminCredentialType | null;
}) {
  const [credential, setCredential] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const credentialLabel = credentialType === "pin" ? "PIN" : credentialType === "password" ? "Password" : "PIN or password";

  const credentialsValid = isAdminCredentialEntryReady(credentialType, credential);

  const signIn = async () => {
    if (signingIn || !credentialsValid) return;
    setSigningIn(true);
    setError(null);
    try {
      await login({ password: credential });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Log in failed");
    } finally {
      setSigningIn(false);
    }
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

            <form
              className="gap-separator-related flex w-full flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                if (credentialsValid && !signingIn) void signIn();
              }}
            >
              <header className="gap-detail-next grid w-full text-center">
                <h2 className="type-heading text-text-primary m-0">Welcome back</h2>
                <p className="type-body text-text-secondary m-0">
                  Enter your {credentialType === "password" ? "password" : credentialLabel} to continue.
                </p>
              </header>

              {sessionNotice && (
                <p className="type-meta border-border-subtle bg-surface-subtle text-text-secondary rounded-card-inner m-0 border p-pad-tight text-center">
                  {sessionNotice}
                </p>
              )}

              <div className="gap-detail-close flex w-full flex-col">
                <CredentialField
                  credentialType={credentialType}
                  label={credentialLabel}
                  value={credential}
                  onChange={(value) => {
                    setCredential(value);
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
                  {signingIn ? "Logging in…" : "Log In"}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <BrandLockup size={40} tone="on-dark" className="shrink-0" />
      </div>
    </div>
  );
}
