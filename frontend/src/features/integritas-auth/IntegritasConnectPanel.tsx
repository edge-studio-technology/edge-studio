import { useEffect, useState } from "react";
import { ExternalLink, Link2, RefreshCw } from "lucide-react";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { Card } from "../../components/Card";
import { Pill } from "../../components/Pill";
import { ErrorText, MutedText } from "../../components/Text";
import type { IntegritasConfig, Tone } from "../../app/types";
import { getJson } from "../../lib/api";
import { useIntegritasAuth } from "./useIntegritasAuth";
import { hasConnectedProfile, type IntegritasAuthStatusKind } from "./integritasAuthApi";

const statusTone: Record<IntegritasAuthStatusKind, Tone> = {
  unauthenticated: "neutral",
  pending: "warn",
  connected: "good",
  denied: "warn",
  expired: "warn",
  revoked: "warn",
};

const statusLabel: Record<IntegritasAuthStatusKind, string> = {
  unauthenticated: "Not connected",
  pending: "Waiting for verification",
  connected: "Connected",
  denied: "Denied",
  expired: "Expired",
  revoked: "Revoked",
};

function formatUsageRemaining(remaining: number): string {
  return remaining.toLocaleString();
}

export function IntegritasConnectPanel({ bare = false }: { bare?: boolean } = {}) {
  const { status, loading, starting, error, notice, start, openVerification } = useIntegritasAuth({
    refreshProfileOnConnected: true,
  });
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  const kind = status?.status;

  useEffect(() => {
    getJson<IntegritasConfig>("/api/integritas/config")
      .then((config) => setPortalUrl(config.portalUrl || null))
      .catch(() => setPortalUrl(null));
  }, []);

  const content = (
    <>
      {kind && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {!bare && <h3 style={{ margin: 0 }}>Integritas Connect</h3>}
          <Pill tone={statusTone[kind]}>{statusLabel[kind]}</Pill>
          {portalUrl && (
            <a
              className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-slate-900 underline-offset-2 hover:underline"
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Integritas portal
              <ExternalLink size={14} aria-hidden />
            </a>
          )}
        </div>
      )}

      {loading && !status && <MutedText className="m-0">Checking connection…</MutedText>}

      {error && (
        <ErrorText className="m-0" style={{ marginBottom: 12 }}>
          {error}
        </ErrorText>
      )}

      {notice && !error && (
        <MutedText className="m-0" style={{ marginBottom: 12 }}>
          {notice}
        </MutedText>
      )}

      {kind === "unauthenticated" && (
        <div className="grid gap-4">
          <MutedText className="m-0">
            This Edge Workbench is not connected to your Integritas Connect account.
          </MutedText>
          <ButtonRow>
            <Button
              type="button"
              disabled={starting}
              onClick={() => void start({ openPopup: true })}
            >
              <Link2 size={14} />
              {starting ? "Starting…" : "Connect account"}
            </Button>
          </ButtonRow>
        </div>
      )}

      {status?.status === "pending" && (
        <div className="grid gap-4">
          <MutedText className="m-0 text-xs">
            Approve the pending request after connecting to your Integritas Connect account. The
            request will expire in 20 minutes for your security.
          </MutedText>

          <ButtonRow className="border-t border-slate-200 pt-4">
            <a
              className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl border border-transparent bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800"
              href={status.verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                if (openVerification()) event.preventDefault();
              }}
            >
              <ExternalLink size={14} />
              Connect account
            </a>
          </ButtonRow>
        </div>
      )}

      {status?.status === "connected" && (
        <div className="grid gap-4">
          <MutedText className="m-0 text-xs">
            To unlink, revoke this Edge Workbench from your Integritas Connect account.
          </MutedText>
          {hasConnectedProfile(status) ? (
            <>
              <dl className="m-0 grid gap-3 border-t border-slate-200 pt-4">
                <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
                  <dt className="m-0 text-sm font-medium text-slate-500">Name</dt>
                  <dd className="m-0 text-sm text-slate-800">{status.user.name}</dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
                  <dt className="m-0 text-sm font-medium text-slate-500">Email</dt>
                  <dd className="m-0 text-sm break-all text-slate-800">{status.user.email}</dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
                  <dt className="m-0 text-sm font-medium text-slate-500">Plan</dt>
                  <dd className="m-0 text-sm text-slate-800">
                    {status.plan.name}
                    {status.plan.status ? (
                      <span className="text-slate-500"> ({status.plan.status})</span>
                    ) : null}
                  </dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
                  <dt className="m-0 text-sm font-medium text-slate-500">Usage left</dt>
                  <dd className="m-0 text-sm text-slate-800">
                    {formatUsageRemaining(status.usage.remaining)}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <MutedText className="m-0">
              Connected. Profile details will appear when Connect is reachable.
            </MutedText>
          )}
        </div>
      )}

      {(kind === "denied" || kind === "expired" || kind === "revoked") && (
        <div className="grid gap-4">
          <MutedText className="m-0 text-xs">
            {kind === "denied" && "Activation was denied in Integritas Connect."}
            {kind === "expired" && "The verification code expired."}
            {kind === "revoked" && "This device was revoked in Integritas Connect."} Start again to
            link a new activation.
          </MutedText>
          <ButtonRow className="border-t border-slate-200 pt-4">
            <Button
              type="button"
              disabled={starting}
              onClick={() => void start({ openPopup: true })}
            >
              <RefreshCw size={14} />
              {starting ? "Starting…" : "Connect account"}
            </Button>
          </ButtonRow>
        </div>
      )}
    </>
  );

  return bare ? content : <Card>{content}</Card>;
}
