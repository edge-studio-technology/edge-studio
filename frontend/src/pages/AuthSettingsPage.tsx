import { useState } from "react";
import {
  CheckCircle2,
  Copy,
  Database,
  Eye,
  EyeOff,
  Link2,
  LogOut,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type { MinimaNodeState } from "../app/types";
import { Button } from "../components/Button";
import { ButtonRow } from "../components/ButtonRow";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Page } from "../components/Page";
import { Pill } from "../components/Pill";
import { SubSection } from "../components/patterns/SubSection";
import { ErrorText } from "../components/Text";
import { Disclosure } from "../components/ui/Disclosure";
import { InputField } from "../components/ui/InputField";
import { initTotpReset, verifyTotpReset } from "../features/auth/api";
import { ChangeCredentialPanel } from "../features/auth/ChangeCredentialPanel";
import { TOTP_ENABLED } from "../features/auth/totpEnabled";
import { useAuth } from "../features/auth/hooks";
import {
  IntegritasConnectPanel,
  statusLabel as integritasStatusLabel,
  statusTone as integritasStatusTone,
} from "../features/integritas-auth/IntegritasConnectPanel";
import { useIntegritasAuth } from "../features/integritas-auth/useIntegritasAuth";
import { MinimaBackupPanel } from "../features/minima/MinimaBackupPanel";
import { formatNodeState, nodeStateTone } from "../features/minima/minimaFormat";
import { MinimaSettingsPanel } from "../features/minima/MinimaSettingsPanel";
import { useMinimaStatusRefresh } from "../features/minima/useMinimaStatusRefresh";
import { useUpdateStatusRefresh } from "../features/update/useUpdateStatusRefresh";
import { WalletSettingsPanel } from "../features/wallet/WalletSettingsPanel";

type TotpResetPhase = "idle" | "scan" | "done";

const formClass = "grid gap-3";

export function AuthSettingsPage() {
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

  const integritasAuth = useIntegritasAuth({ refreshProfileOnConnected: true });
  const integritasKind = integritasAuth.status?.status;

  const [minimaState, setMinimaState] = useState<MinimaNodeState | null>(null);
  useMinimaStatusRefresh(
    (status) => setMinimaState(status.state),
    () => {},
  );

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
              <h2 className="type-title text-text-primary m-0">User settings</h2>
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen={true}
        >
          <div className="mt-2 grid gap-10">
            <ChangeCredentialPanel />

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
                    <InputField
                      label="Current PIN or password"
                      type="password"
                      value={resetCurrentPassword}
                      onChange={(e) => {
                        setResetCurrentPassword(e.target.value);
                        setResetError(null);
                      }}
                      placeholder="Your current credential"
                      autoComplete="current-password"
                    />
                    <InputField
                      label="Current 2FA code"
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
                      <InputField
                        label="Confirmation code"
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
              <h2 className="type-title text-text-primary m-0">Integritas settings</h2>
              {integritasKind && (
                <Pill tone={integritasStatusTone[integritasKind]}>
                  {integritasStatusLabel[integritasKind]}
                </Pill>
              )}
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen={true}
        >
          <div className="mt-2 grid gap-10">
            <SubSection
              icon={<Link2 size={13} />}
              title="Integritas Connect"
              description="Stamp proofs and sync plan usage with your Integritas Connect account."
            >
              <IntegritasConnectPanel bare auth={integritasAuth} />
            </SubSection>
          </div>
        </Disclosure>

        <Disclosure
          title={
            <span className="flex items-center gap-2">
              <h2 className="type-title text-text-primary m-0">Minima settings</h2>
              <Pill tone={minimaState ? nodeStateTone(minimaState) : "neutral"}>
                {minimaState ? formatNodeState(minimaState) : "Checking…"}
              </Pill>
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen={true}
        >
          <div className="mt-2 grid gap-10">
            <MinimaSettingsPanel bare minimaState={minimaState} />

            <SubSection icon={<Database size={13} />} title="Node backup & restore">
              <MinimaBackupPanel bare minimaState={minimaState} />
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
