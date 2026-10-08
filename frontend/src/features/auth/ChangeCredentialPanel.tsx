import { useState } from "react";
import { Check, KeyRound } from "lucide-react";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { SubSection } from "../../components/patterns/SubSection";
import { ErrorText } from "../../components/Text";
import { InputField } from "../../components/ui/InputField";
import { CredentialField } from "../../components/ui/CredentialField";
import { ToggleTabs } from "../../components/ui/ToggleTabs";
import { changePassword } from "./api";
import {
  adminCredentialLabel,
  isAdminCredentialEntryReady,
  isValidAdminCredential,
  type AdminCredentialType,
} from "./adminCredentials";
import { PasswordRequirements } from "./PasswordRequirements";
import { TOTP_ENABLED } from "./totpEnabled";
import { useAuth } from "./hooks";

export function ChangeCredentialPanel({
  onCredentialChanged,
}: {
  onCredentialChanged?: () => void;
}) {
  const { user } = useAuth();
  const credentialType = user?.credentialType ?? null;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newCredentialType, setNewCredentialType] = useState<AdminCredentialType>("pin");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwTotpToken, setPwTotpToken] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const newCredentialIsPin = newCredentialType === "pin";
  const newCredentialLabel = newCredentialIsPin ? "PIN" : "password";
  const newCredentialsMatch = !confirmNewPassword || newPassword === confirmNewPassword;
  const passwordFormReady =
    isAdminCredentialEntryReady(credentialType, currentPassword) &&
    isValidAdminCredential(newCredentialType, newPassword) &&
    newPassword === confirmNewPassword &&
    (!TOTP_ENABLED || pwTotpToken.length === 6);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordFormReady || pwSubmitting) return;
    setPwSubmitting(true);
    setPwError(null);
    setPwSuccess(false);
    try {
      await changePassword({
        currentPassword,
        newPassword,
        ...(TOTP_ENABLED ? { totpToken: pwTotpToken } : {}),
      });
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPwTotpToken("");
      onCredentialChanged?.();
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change credential");
    } finally {
      setPwSubmitting(false);
    }
  };

  return (
    <SubSection
      icon={<KeyRound size={13} />}
      title="Change PIN or password"
      description={
        TOTP_ENABLED
          ? "Choose a 6-digit PIN or a strong password. A valid 2FA code is also required."
          : "Choose a 6-digit PIN or a strong password."
      }
    >
      {pwSuccess && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="m-0 flex items-center gap-2 text-sm text-emerald-700">
            <Check size={14} /> Credential changed. Signing you out — log in again with your new
            PIN or password.
          </p>
        </div>
      )}

      <form onSubmit={(e) => void handleChangePassword(e)} className="grid max-w-md gap-3">
        <CredentialField
          credentialType={credentialType}
          label={`Current ${adminCredentialLabel(credentialType)}`}
          value={currentPassword}
          onChange={(value) => {
            setCurrentPassword(value);
            setPwError(null);
            setPwSuccess(false);
          }}
          placeholder="Your current credential"
          autoComplete="current-password"
        />
        <ToggleTabs
          className="w-full max-w-md"
          label="New credential type"
          value={newCredentialType}
          options={[
            { value: "pin", label: "6-digit PIN" },
            { value: "password", label: "Password" },
          ]}
          onChange={(type) => {
            setNewCredentialType(type);
            setNewPassword("");
            setConfirmNewPassword("");
            setPwError(null);
            setPwSuccess(false);
          }}
        />
        <CredentialField
          credentialType={newCredentialType}
          label={`New ${newCredentialLabel}`}
          value={newPassword}
          onChange={(value) => {
            setNewPassword(value);
            setPwError(null);
            setPwSuccess(false);
          }}
          placeholder={newCredentialIsPin ? undefined : "Create a strong password"}
          autoComplete="new-password"
        />
        {!newCredentialIsPin && <PasswordRequirements password={newPassword} />}
        <CredentialField
          credentialType={newCredentialType}
          label={`Confirm new ${newCredentialLabel}`}
          value={confirmNewPassword}
          onChange={(value) => {
            setConfirmNewPassword(value);
            setPwError(null);
            setPwSuccess(false);
          }}
          placeholder={newCredentialIsPin ? undefined : "Repeat new password"}
          autoComplete="new-password"
          error={
            !newCredentialsMatch
              ? newCredentialIsPin ? "PINs do not match" : "Passwords do not match"
              : undefined
          }
        />
        {TOTP_ENABLED ? (
          <InputField
            label="2FA code"
            value={pwTotpToken}
            onChange={(e) => {
              setPwTotpToken(e.target.value.replace(/\D/g, "").slice(0, 6));
              setPwError(null);
              setPwSuccess(false);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
          />
        ) : null}
        {pwError && <ErrorText className="m-0">{pwError}</ErrorText>}
        <ButtonRow>
          <Button type="submit" disabled={pwSubmitting || !passwordFormReady}>
            {pwSubmitting ? "Updating…" : "Change credential"}
          </Button>
        </ButtonRow>
      </form>
    </SubSection>
  );
}
