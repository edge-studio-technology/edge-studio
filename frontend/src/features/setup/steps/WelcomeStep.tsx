import { Link2, LockKeyhole, Shield } from "lucide-react";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { TOTP_ENABLED } from "../../auth/totpEnabled";
import { onboardingWorkSteps } from "../steps";

const stepMeta: Record<string, { icon: typeof LockKeyhole; detail: string }> = {
  credentials: {
    icon: Shield,
    detail: TOTP_ENABLED
      ? "Setup a local admin PIN or password, then two-factor auth."
      : "Setup a local admin PIN or password for this device.",
  },
  twofa: {
    icon: LockKeyhole,
    detail: "Setup an authenticator app for two-factor sign-in.",
  },
  connectAccount: {
    icon: Link2,
    detail: "Connect Integritas for data stamping and verification.",
  },
};

export function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  const upcoming = onboardingWorkSteps;

  return (
    <Card className="w-full max-w-[480px] shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
      <div className="gap-detail-near flex w-full flex-col">
        <header className="gap-detail-next grid w-full">
          <h2 id="welcome-ahead-heading" className="type-title text-text-primary m-0">
            Setup guide
          </h2>
          <p className="type-body text-text-secondary m-0">
            A few steps to secure this device and connect it to Integritas.
          </p>
        </header>

        <section className="gap-detail-close grid w-full" aria-labelledby="welcome-ahead-heading">
          <ol className="gap-detail-close m-0 grid list-none p-0">
            {upcoming.map((step) => {
              const meta = stepMeta[step.id] ?? {
                icon: Link2,
                detail: step.label,
              };
              const Icon = meta.icon;

              return (
                <li
                  key={step.id}
                  className="bg-surface-primary border-stroke-secondary rounded-soft p-margin-close border"
                >
                  <div className="gap-detail-close px-detail-next py-margin-close flex items-center">
                    <span className="text-icon-primary inline-flex size-4 shrink-0 items-center justify-center">
                      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <div className="gap-detail-tight grid min-w-0 flex-1">
                      <p className="type-body-em text-text-primary m-0">{step.label}</p>
                      <p className="type-body text-text-primary m-0">{meta.detail}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <Button type="button" variant="accent" size="md" className="w-full" onClick={onContinue}>
          Get started
        </Button>
      </div>
    </Card>
  );
}
