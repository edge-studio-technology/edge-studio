import { useEffect, useState } from "react";
import { ExternalLink, Link2, RefreshCw } from "lucide-react";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { Card } from "../../components/Card";
import { DetailList, DetailRow } from "../../components/patterns/DetailList";
import { ErrorText, MutedText } from "../../components/Text";
import type { IntegritasConfig, Tone } from "../../app/types";
import { getJson } from "../../lib/api";
import type { UseIntegritasAuthResult } from "./useIntegritasAuth";
import { hasConnectedProfile, type IntegritasAuthStatusKind } from "./integritasAuthApi";

export const statusTone: Record<IntegritasAuthStatusKind, Tone> = {
  unauthenticated: "neutral",
  pending: "warn",
  connected: "good",
  denied: "warn",
  expired: "warn",
  revoked: "warn",
};

export const statusLabel: Record<IntegritasAuthStatusKind, string> = {
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

export function IntegritasConnectPanel({
  bare = false,
  auth,
}: {
  bare?: boolean;
  auth: UseIntegritasAuthResult;
}) {
  const { status, loading, starting, error, notice, start, openVerification } = auth;
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  const kind = status?.status;

  useEffect(() => {
    getJson<IntegritasConfig>("/api/integritas/config")
      .then((config) => setPortalUrl(config.portalUrl || null))
      .catch(() => setPortalUrl(null));
  }, []);

  const content = (
    <>
      {(!bare || portalUrl) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {!bare && <h3 style={{ margin: 0 }}>Integritas Connect</h3>}
          {portalUrl && (
            <Button
              type="button"
              iconEnd={<ExternalLink aria-hidden="true" />}
              onClick={() => window.open(portalUrl, "_blank", "noopener,noreferrer")}
            >
              Open Integritas portal
            </Button>
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
            <Button
              type="button"
              iconStart={<ExternalLink aria-hidden="true" />}
              onClick={() => {
                if (!openVerification()) {
                  window.open(status.verificationUrl, "_blank", "noopener,noreferrer");
                }
              }}
            >
              Connect account
            </Button>
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
              <DetailList>
                <DetailRow label="Name" value={status.user.name} />
                <DetailRow label="Email" value={status.user.email} />
                <DetailRow
                  label="Plan"
                  value={
                    <>
                      {status.plan.name}
                      {status.plan.status ? (
                        <span className="text-slate-500"> ({status.plan.status})</span>
                      ) : null}
                    </>
                  }
                />
                <DetailRow label="Usage left" value={formatUsageRemaining(status.usage.remaining)} />
              </DetailList>
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
