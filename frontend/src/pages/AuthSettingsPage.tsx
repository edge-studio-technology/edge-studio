import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  EyeOff,
  Stamp,
  KeyRound,
  Link2,
  LogOut,
  RotateCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { Button } from "../components/Button";
import { ButtonRow } from "../components/ButtonRow";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Page } from "../components/Page";
import { SubSection } from "../components/patterns/SubSection";
import { ErrorText } from "../components/Text";
import { Disclosure } from "../components/ui/Disclosure";
import { changePassword, initTotpReset, verifyTotpReset } from "../features/auth/api";
import {
  isValidAdminCredential,
  sanitizePinInput,
  type AdminCredentialType,
} from "../features/auth/adminCredentials";
import { PasswordRequirements } from "../features/auth/PasswordRequirements";
import { TOTP_ENABLED } from "../features/auth/totpEnabled";
import { useAuth } from "../features/auth/hooks";
import { IntegritasConnectPanel } from "../features/integritas-auth/IntegritasConnectPanel";
import { MinimaBackupPanel } from "../features/minima/MinimaBackupPanel";
import { MinimaSettingsPanel } from "../features/minima/MinimaSettingsPanel";
import { useUpdateStatusRefresh } from "../features/update/useUpdateStatusRefresh";
import { WalletSettingsPanel } from "../features/wallet/WalletSettingsPanel";

type TotpResetPhase = "idle" | "scan" | "done";

const formClass = "grid gap-3";
const labelClass = "grid gap-3 font-bold text-slate-700";

export function AuthSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newCredentialType, setNewCredentialType] = useState<AdminCredentialType>("pin");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwTotpToken, setPwTotpToken] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const [totpPhase, setTotpPhase] = useState<TotpResetPhase>("idle");
  const [resetCurrentPassword, setResetCurrentPassword] = useState("");
  const [resetCurrentToken, setResetCurrentToken] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [showManualKey, setShowManualKey] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  useUpdateStatusRefresh((status) => setCurrentVersion(status?.currentVersion ?? null));

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change credential");
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleInitTotpReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetSubmitting(true);
    setResetError(null);
    try {
      const result = await initTotpReset({
        currentPassword: resetCurrentPassword,
        totpToken: resetCurrentToken,
      });
      setQrCode(result.qrCodePngBase64);
      setTotpSecret(result.secret);
      setTotpPhase("scan");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to start 2FA reset");
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleVerifyTotpReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifySubmitting(true);
    setVerifyError(null);
    try {
      await verifyTotpReset({ totpToken: verifyCode });
      setQrCode(null);
      setTotpSecret(null);
      setTotpPhase("done");
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Invalid code — try again");
    } finally {
      setVerifySubmitting(false);
    }
  };

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

  const resetTotpFlow = () => {
    setTotpPhase("idle");
    setResetCurrentPassword("");
    setResetCurrentToken("");
    setVerifyCode("");
    setVerifyError(null);
    setResetError(null);
    setShowManualKey(false);
  };

  const newCredentialIsPin = newCredentialType === "pin";
  const newCredentialLabel = newCredentialIsPin ? "PIN" : "password";
  const newCredentialsMatch = !confirmNewPassword || newPassword === confirmNewPassword;
  const passwordFormReady =
    currentPassword.length > 0 &&
    isValidAdminCredential(newCredentialType, newPassword) &&
    newPassword === confirmNewPassword &&
    (!TOTP_ENABLED || pwTotpToken.length === 6);

  const { signOut } = useAuth();

  return (
    <Page
      eyebrow="Admin account"
      title={
        <>
          Account settings{" "}
          <span className="text-sm font-normal text-slate-400">
            {currentVersion ?? "Unknown version"}
          </span>
        </>
      }
      action={
        <ButtonRow>
          <Button type="button" variant="ghost" onClick={() => void signOut()}>
            <LogOut size={16} /> Sign out
          </Button>
          <Button type="button" onClick={() => window.location.assign("/update")}>
            Check for updates
          </Button>
        </ButtonRow>
      }
    >
      <Card className="grid w-full gap-4 divide-y divide-slate-200">
        <Disclosure
          title={
            <span className="flex items-center gap-2">
              <UserCog size={18} /> User settings
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen={false}
        >
          <div className="mt-2 grid gap-6">
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
                <div
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"
                  style={{ marginBottom: 16 }}
                >
                  <p
                    className="flex items-center gap-2 text-sm text-emerald-700"
                    style={{ margin: 0 }}
                  >
                    <Check size={14} /> Credential changed successfully.
                  </p>
                </div>
              )}

              <form onSubmit={(e) => void handleChangePassword(e)} className={formClass}>
                <label className={labelClass}>
                  Current PIN or password
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setPwError(null);
                      setPwSuccess(false);
                    }}
                    placeholder="Your current credential"
                    autoComplete="current-password"
                  />
                </label>
                <fieldset className="grid gap-2 border-0 p-0">
                  <legend className="mb-2 font-bold text-slate-700">New credential type</legend>
                  <div className="grid max-w-md grid-cols-2 gap-2">
                    {(["pin", "password"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${
                          newCredentialType === type
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-300 bg-white text-slate-700"
                        }`}
                        aria-pressed={newCredentialType === type}
                        onClick={() => {
                          setNewCredentialType(type);
                          setNewPassword("");
                          setConfirmNewPassword("");
                          setPwError(null);
                          setPwSuccess(false);
                        }}
                      >
                        {type === "pin" ? "6-digit PIN" : "Password"}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className={labelClass}>
                  New {newCredentialLabel}
                  <Input
                    type="password"
                    inputMode={newCredentialIsPin ? "numeric" : "text"}
                    pattern={newCredentialIsPin ? "[0-9]*" : undefined}
                    maxLength={newCredentialIsPin ? 6 : undefined}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(
                        newCredentialIsPin ? sanitizePinInput(e.target.value) : e.target.value,
                      );
                      setPwError(null);
                      setPwSuccess(false);
                    }}
                    placeholder={newCredentialIsPin ? "000000" : "Create a strong password"}
                    autoComplete="new-password"
                  />
                </label>
                {!newCredentialIsPin && <PasswordRequirements password={newPassword} />}
                <label className={labelClass}>
                  Confirm new {newCredentialLabel}
                  <Input
                    type="password"
                    inputMode={newCredentialIsPin ? "numeric" : "text"}
                    pattern={newCredentialIsPin ? "[0-9]*" : undefined}
                    maxLength={newCredentialIsPin ? 6 : undefined}
                    value={confirmNewPassword}
                    onChange={(e) => {
                      setConfirmNewPassword(
                        newCredentialIsPin ? sanitizePinInput(e.target.value) : e.target.value,
                      );
                      setPwError(null);
                      setPwSuccess(false);
                    }}
                    placeholder={`Repeat new ${newCredentialLabel}`}
                    autoComplete="new-password"
                  />
                  {!newCredentialsMatch && (
                    <span className="text-sm font-medium text-amber-700">
                      {newCredentialIsPin ? "PINs" : "Passwords"} do not match
                    </span>
                  )}
                </label>
                {TOTP_ENABLED ? (
                  <label className={labelClass}>
                    2FA code
                    <Input
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
                  </label>
                ) : null}
                {pwError && <ErrorText className="m-0">{pwError}</ErrorText>}
                <ButtonRow>
                  <Button type="submit" disabled={pwSubmitting || !passwordFormReady}>
                    {pwSubmitting ? "Updating…" : "Change credential"}
                  </Button>
                </ButtonRow>
              </form>
            </SubSection>

            {TOTP_ENABLED ? (
              <SubSection
                icon={<ShieldCheck size={13} />}
                title="Reset two-factor authentication"
                description="Generates a new TOTP secret. The QR code is shown once — save it in your authenticator before closing."
              >
                {totpPhase === "idle" && (
                  <form onSubmit={(e) => void handleInitTotpReset(e)} className={formClass}>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p
                        className="flex items-center gap-2"
                        style={{ margin: 0, fontSize: "0.875rem", color: "#92400e" }}
                      >
                        <ShieldAlert size={14} />
                        Your current 2FA secret will be replaced. Make sure your authenticator app
                        is available before continuing.
                      </p>
                    </div>
                    <label className={labelClass}>
                      Current PIN or password
                      <Input
                        type="password"
                        value={resetCurrentPassword}
                        onChange={(e) => {
                          setResetCurrentPassword(e.target.value);
                          setResetError(null);
                        }}
                        placeholder="Your current credential"
                        autoComplete="current-password"
                      />
                    </label>
                    <label className={labelClass}>
                      Current 2FA code
                      <Input
                        value={resetCurrentToken}
                        onChange={(e) => {
                          setResetCurrentToken(e.target.value.replace(/\D/g, "").slice(0, 6));
                          setResetError(null);
                        }}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        maxLength={6}
                      />
                    </label>
                    {resetError && <ErrorText className="m-0">{resetError}</ErrorText>}
                    <ButtonRow>
                      <Button
                        type="submit"
                        disabled={
                          resetSubmitting ||
                          resetCurrentPassword.length === 0 ||
                          resetCurrentToken.length !== 6
                        }
                      >
                        {resetSubmitting ? "Verifying…" : "Start 2FA reset"}
                      </Button>
                    </ButtonRow>
                  </form>
                )}

                {totpPhase === "scan" && qrCode && (
                  <div className="grid gap-6">
                    <div className="flex flex-wrap items-start gap-6">
                      <img
                        src={qrCode}
                        alt="TOTP QR code"
                        style={{
                          width: 160,
                          height: 160,
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                        }}
                      />
                      {totpSecret && (
                        <div className="grid min-w-0 flex-1 gap-3">
                          <div className="flex items-center justify-between gap-3">
                            <span
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                color: "#64748b",
                              }}
                            >
                              Manual setup key
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowManualKey((v) => !v)}
                              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                            >
                              {showManualKey ? (
                                <>
                                  <EyeOff size={12} /> Hide
                                </>
                              ) : (
                                <>
                                  <Eye size={12} /> Show
                                </>
                              )}
                            </button>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
                            Issuer: <strong>Integritas Pi</strong>, Account:{" "}
                            <strong>Edge Workbench</strong>
                          </p>
                          <div className="flex gap-2">
                            <Input
                              readOnly
                              value={
                                showManualKey
                                  ? totpSecret
                                  : "•".repeat(Math.min(totpSecret.length, 32))
                              }
                              style={{
                                fontFamily: "ui-monospace, monospace",
                                fontSize: "0.875rem",
                              }}
                              aria-label="Authenticator setup key"
                            />
                            <button
                              type="button"
                              onClick={() => void copyManualKey()}
                              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                            >
                              <Copy size={13} />
                              {copyState === "copied" ? "Copied" : "Copy"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <form onSubmit={(e) => void handleVerifyTotpReset(e)} className={formClass}>
                      <label className={labelClass}>
                        Confirmation code
                        <Input
                          value={verifyCode}
                          onChange={(e) => {
                            setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setVerifyError(null);
                          }}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="000000"
                          maxLength={6}
                        />
                      </label>
                      {verifyError && <ErrorText className="m-0">{verifyError}</ErrorText>}
                      <ButtonRow>
                        <Button
                          type="submit"
                          disabled={verifySubmitting || verifyCode.length !== 6}
                        >
                          {verifySubmitting ? "Verifying…" : "Confirm new 2FA"}
                        </Button>
                      </ButtonRow>
                    </form>
                  </div>
                )}

                {totpPhase === "done" && (
                  <div className="grid gap-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <p
                        className="flex items-center gap-2"
                        style={{ margin: 0, fontSize: "0.875rem", color: "#065f46" }}
                      >
                        <CheckCircle2 size={14} />
                        Two-factor authentication has been reset. Your authenticator app is now
                        linked to the new secret.
                      </p>
                    </div>
                    <ButtonRow>
                      <Button type="button" onClick={resetTotpFlow}>
                        <RotateCcw size={14} /> Reset again
                      </Button>
                    </ButtonRow>
                  </div>
                )}
              </SubSection>
            ) : null}
          </div>
        </Disclosure>

        <Disclosure
          title={
            <span className="flex items-center gap-2">
              <Stamp size={18} /> Integritas settings
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen={false}
        >
          <div className="mt-2 grid gap-6">
            <SubSection
              icon={<Link2 size={13} />}
              title="Integritas Connect"
              description="Stamp proofs and sync plan usage with your Integritas Connect account."
            >
              <IntegritasConnectPanel bare />
            </SubSection>
          </div>
        </Disclosure>

        <Disclosure
          title={
            <span className="flex items-center gap-2">
              <Server size={18} /> Minima settings
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen={false}
        >
          <div className="mt-2 grid gap-6">
            <MinimaSettingsPanel bare />

            <SubSection icon={<Database size={13} />} title="Node backup & restore">
              <MinimaBackupPanel bare />
            </SubSection>

            {/* Deprecated in favor of Node backup & restore above (superset: full node backup
                vs. wallet-keys-only). Seed-phrase-only restore is still a distinct recovery path
                (no backup file needed) and is planned as a "coming soon" option in
                MinimaBackupPanel for v1.5 — see docs/TASKS.md. Left commented, not deleted, for
                an easy revert. */}
            {/* <WalletSettingsPanel /> */}
          </div>
        </Disclosure>

        {/* Version box deprecated in favor of the version indicator next to the page
          heading and the "Check for updates" button next to Sign out. Left commented,
          not deleted, for an easy revert. */}
        {/* <Disclosure title="Version" className="pt-4" defaultOpen={false}>
        <p className="mt-2 tabular-nums text-slate-500">{currentVersion ?? "Unknown"}</p>
        <ButtonRow className="mt-3">
          <a
            href="/update"
            className="inline-flex w-fit items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Check for updates
          </a>
        </ButtonRow>
      </Disclosure> */}
      </Card>
    </Page>
  );
}
