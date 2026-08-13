import { useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  LogOut,
  MessageSquare,
  MousePointerClick,
  PanelLeft,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button, LinkButton } from "../components/Button";
import { ButtonRow } from "../components/ButtonRow";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Page } from "../components/Page";
import { SubSection } from "../components/patterns/SubSection";
import { ErrorText } from "../components/Text";
import { Disclosure } from "../components/ui/Disclosure";
import { InputField } from "../components/ui/InputField";
import { SwitchField } from "../components/ui/SwitchField";
import {
  closeModalOnOutsideClickSetting,
  sidebarStartCollapsedSetting,
} from "../lib/behaviourSettings";
import { initTotpReset, verifyTotpReset } from "../features/auth/api";
import { ChangeCredentialPanel } from "../features/auth/ChangeCredentialPanel";
import { TOTP_ENABLED } from "../features/auth/totpEnabled";
import { useAuth } from "../features/auth/hooks";
import { FeedbackAuditButton } from "../features/feedback/FeedbackAuditButton";

type TotpResetPhase = "idle" | "scan" | "done";

const formClass = "grid max-w-md gap-3";

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
  const navigate = useNavigate();

  const closeModalOnOutsideClick = useSyncExternalStore(
    closeModalOnOutsideClickSetting.subscribe,
    closeModalOnOutsideClickSetting.get,
  );
  const sidebarStartCollapsed = useSyncExternalStore(
    sidebarStartCollapsedSetting.subscribe,
    sidebarStartCollapsedSetting.get,
  );

  return (
    <Page
      title="Settings"
      desc="Manage your admin credentials, interface preferences, and software updates."
      action={
        <Button type="button" iconStart={<LogOut aria-hidden />} onClick={() => void signOut()}>
          Log out
        </Button>
      }
    >
      <Card className="grid w-full gap-4 divide-y divide-slate-200">
        <Disclosure
          title={
            <span className="flex items-center gap-2">
              <h2 className="type-title text-text-primary m-0">Credentials</h2>
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen={false}
        >
          <div className="gap-detail-close my-detail-close grid">
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
                      <p className="m-0 flex items-center gap-2 text-sm text-amber-800">
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
                            <span className="text-text-secondary text-xs font-bold tracking-wide uppercase">
                              Manual setup key
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowManualKey((v) => !v)}
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
                            </Button>
                          </div>
                          <p className="type-meta text-text-secondary m-0">
                            Issuer: <strong>Edge Studio</strong>, Account:{" "}
                            <strong>Edge Studio</strong>
                          </p>
                          <div className="flex gap-2">
                            <Input
                              readOnly
                              value={
                                showManualKey
                                  ? totpSecret
                                  : "•".repeat(Math.min(totpSecret.length, 32))
                              }
                              className="font-mono text-sm"
                              aria-label="Authenticator setup key"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              onClick={() => void copyManualKey()}
                            >
                              <Copy size={13} />
                              {copyState === "copied" ? "Copied" : "Copy"}
                            </Button>
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
                      <p className="m-0 flex items-center gap-2 text-sm text-emerald-700">
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
              <h2 className="type-title text-text-primary m-0">Behaviour</h2>
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen={false}
        >
          <div className="gap-detail-close mt-2 grid">
            <SubSection
              icon={<MousePointerClick size={13} />}
              title="Modals"
              description="Control how modal dialogs respond to clicks outside their content."
            >
              <SwitchField
                label="Close modal when clicking outside it"
                description="Turn off if you'd rather only close modals with the X button or Escape."
                checked={closeModalOnOutsideClick}
                onChange={(e) => closeModalOnOutsideClickSetting.set(e.target.checked)}
              />
            </SubSection>

            <SubSection
              icon={<PanelLeft size={13} />}
              title="Sidebar"
              description="Control whether the sidebar starts collapsed or expanded on page load."
            >
              <SwitchField
                label="Start sidebar collapsed"
                description="Applies on page load at desktop widths. The collapse/expand button still works as normal in between."
                checked={sidebarStartCollapsed}
                onChange={(e) => sidebarStartCollapsedSetting.set(e.target.checked)}
              />
            </SubSection>
          </div>
        </Disclosure>

        <Disclosure
          title={
            <span className="flex items-center gap-2">
              <h2 className="type-title text-text-primary m-0">App</h2>
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen
        >
          <div className="gap-detail-close mt-2 grid">
            <SubSection
              icon={<MessageSquare size={13} />}
              title="Feedback"
              description="Download the local feedback export file to share with the Integritas team, or view exactly what's stored."
            >
              <ButtonRow>
                <LinkButton href="/api/feedback/export" iconStart={<Download aria-hidden />}>
                  Export feedback JSON
                </LinkButton>
                <FeedbackAuditButton />
              </ButtonRow>
            </SubSection>

            <SubSection
              icon={<RefreshCw size={13} aria-hidden />}
              title="Software update"
              description="Check for and install the latest Edge Studio update."
            >
              <ButtonRow>
                <Button type="button" onClick={() => navigate("/update")}>
                  Check for updates
                </Button>
              </ButtonRow>
            </SubSection>
          </div>
        </Disclosure>

        {/* Version box deprecated in favor of the version indicator in the sidebar
          corner and the "Check for updates" button next to Sign out. Left commented,
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
