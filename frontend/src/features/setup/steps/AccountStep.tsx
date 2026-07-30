import { APP_NAME } from "../../../app/brand";
import { Button } from "../../../components/Button";
import { InputField } from "../../../components/ui/InputField";
import { PinField } from "../../../components/ui/PinField";
import { ProgressBar } from "../../../components/ui/ProgressBar";
import { ToggleTabs } from "../../../components/ui/ToggleTabs";
import {
  ADMIN_PIN_LENGTH,
  type AdminCredentialType,
} from "../../auth/adminCredentials";
import { PasswordRequirements } from "../../auth/PasswordRequirements";
import { OnboardingCard } from "../components/OnboardingCard";
import type { OnboardingFormState } from "../types";

const credentialOptions = [
  { value: "pin" as const, label: "6-digit PIN" },
  { value: "password" as const, label: "Password" },
];

export function AccountStep({
  form,
  setForm,
  onSubmit,
  progressCurrent,
  progressTotal,
  canGoBack,
  onBack,
  canContinue,
  continueLabel,
  submitting,
}: {
  form: OnboardingFormState;
  setForm: (patch: Partial<OnboardingFormState>) => void;
  onSubmit: () => void;
  progressCurrent: number;
  progressTotal: number;
  canGoBack: boolean;
  onBack: () => void;
  canContinue: boolean;
  continueLabel: string;
  submitting: boolean;
}) {
  const isPin = form.credentialType === "pin";
  const confirmComplete = isPin
    ? form.confirmPassword.length === ADMIN_PIN_LENGTH
    : form.password.length > 0 && form.confirmPassword.length >= form.password.length;
  const showMismatch =
    Boolean(form.confirmPassword) && confirmComplete && form.password !== form.confirmPassword;

  const selectCredentialType = (credentialType: AdminCredentialType) => {
    setForm({ credentialType, password: "", confirmPassword: "" });
  };

  return (
    <OnboardingCard>
      <div className="gap-separator-related flex w-full flex-col">
        <ProgressBar
          current={progressCurrent}
          total={progressTotal}
          showBack={canGoBack}
          onBack={canGoBack ? onBack : undefined}
        />

        <header className="gap-detail-next grid w-full">
          <h2 className="type-title text-text-primary m-0">Choose PIN or password</h2>
          <p className="type-body text-text-secondary m-0">
            Your local credential stays on this device and unlocks {APP_NAME}.
          </p>
        </header>

        <form
          className="gap-separator-related relative flex w-full flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (canContinue && !submitting) onSubmit();
          }}
        >
          <ToggleTabs
            className="w-full"
            label="Sign in method"
            value={form.credentialType}
            options={credentialOptions}
            onChange={selectCredentialType}
          />

          {isPin ? (
            <div className="gap-detail-close flex w-full flex-col">
              <PinField
                label="PIN"
                value={form.password}
                length={ADMIN_PIN_LENGTH}
                onChange={(password) => setForm({ password })}
                autoComplete="one-time-code"
              />
              <PinField
                label="Confirm PIN"
                value={form.confirmPassword}
                length={ADMIN_PIN_LENGTH}
                onChange={(confirmPassword) => setForm({ confirmPassword })}
                error={showMismatch ? "PINs do not match" : undefined}
                autoComplete="one-time-code"
              />
            </div>
          ) : (
            <div className="gap-detail-close flex w-full flex-col">
              <InputField
                label="Password"
                type="password"
                value={form.password}
                onChange={(event) => setForm({ password: event.target.value })}
                placeholder="Password"
                autoComplete="new-password"
              />
              <InputField
                label="Confirm password"
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setForm({ confirmPassword: event.target.value })}
                placeholder="Password"
                autoComplete="new-password"
                error={showMismatch ? "Passwords do not match" : undefined}
              />
              <PasswordRequirements password={form.password} />
            </div>
          )}

          <Button
            type="submit"
            variant="accent"
            size="md"
            className="w-full"
            disabled={!canContinue || submitting}
          >
            {continueLabel}
          </Button>
        </form>
      </div>
    </OnboardingCard>
  );
}
