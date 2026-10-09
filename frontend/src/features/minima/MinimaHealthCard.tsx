import { Terminal } from "lucide-react";
import type { MinimaNodeStatus, MinimaResyncSummary } from "../../app/types";
import { JsonPreview } from "../../components/patterns/JsonPreview";
import { LoadingDots } from "../../components/ui/LoadingDots";
import { ErrorText } from "../../components/ui/ErrorText";
import { Pill } from "../../components/ui/Pill";
import { resyncPhaseLabel, resyncPhaseTone } from "./minimaResync";
import { formatBlockAge } from "./minimaFormat";
import { shouldShowMinimaRpcError } from "./minimaStatusDisplay";
import { MinimaStatCell, MinimaStatGrid } from "./MinimaStatCell";
import { formatLocalTime } from "../../lib/time";

export function MinimaHealthCard({
  status,
  loading,
  refreshing,
  resync,
}: {
  status: MinimaNodeStatus | null;
  loading: boolean;
  refreshing: boolean;
  resync?: MinimaResyncSummary | null;
}) {
  const effectiveStatus = refreshing ? null : status;
  const effectiveLoading = loading || refreshing;

  const memoryLabel = effectiveStatus?.node.memoryRam ?? (effectiveLoading ? <LoadingDots /> : "—");
  const peerLabel =
    effectiveStatus?.health.peerCount != null ? (
      String(effectiveStatus.health.peerCount)
    ) : effectiveLoading ? (
      <LoadingDots />
    ) : (
      "—"
    );
  const blockAgeLabel =
    effectiveStatus?.sync.blockAgeSeconds != null ? (
      formatBlockAge(effectiveStatus.sync.blockAgeSeconds)
    ) : effectiveStatus?.sync.blockTime ? (
      formatLocalTime(effectiveStatus.sync.blockTime)
    ) : effectiveLoading ? (
      <LoadingDots />
    ) : (
      "—"
    );
  const currentBlockLabel =
    effectiveStatus?.sync.block != null ? (
      String(effectiveStatus.sync.block)
    ) : effectiveLoading ? (
      <LoadingDots />
    ) : (
      "—"
    );

  const monitoring = effectiveStatus?.monitoring;

  const footer = (
    <>
      {status && !status.rpc.ok ? <p className="type-meta text-text-tertiary m-0">RPC unavailable · Metrics last observed {formatLocalTime(status.metricsObservedAt ?? status.checkedAt)}.</p> : null}
      {shouldShowMinimaRpcError(effectiveStatus) && (
        <ErrorText className="mb-2">{effectiveStatus?.rpc.error}</ErrorText>
      )}
      <JsonPreview
        value={effectiveStatus?.rpc.raw}
        label="View RPC debug"
        variant="button"
        className="w-full"
        icon={<Terminal size={16} />}
        disabled={effectiveStatus?.rpc.raw === undefined}
      />
    </>
  );

  return (
    <div className="flex h-full min-w-0 flex-col gap-4">
      {!resync?.busy && monitoring?.stallDetected && (
        <p className="mb-0 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Chain stall detected — last block is older than {monitoring.stallThresholdSeconds}s.
          {monitoring.autoResyncEnabled
            ? monitoring.lastAutoResyncAt
              ? ` Last auto-resync: ${formatLocalTime(monitoring.lastAutoResyncAt)} (${monitoring.lastAutoResyncResult ?? "no details"}).`
              : " Auto-resync is enabled; the backend poller will attempt resync when cooldown allows."
            : " Consider a manual Megammr resync or check peer connectivity."}
        </p>
      )}

      <div className="min-h-0 flex-1">
        <MinimaStatGrid title="Node health" badge={resync?.busy ? <Pill className="!h-auto min-h-6 max-w-full" tone={resyncPhaseTone(resync.phase)} indicator>{resyncPhaseLabel[resync.phase]}</Pill> : null} footer={footer}>
          <MinimaStatCell label="Node memory" value={memoryLabel} />
          <MinimaStatCell label="Active peers" value={peerLabel} />
          <MinimaStatCell label="Last block" value={blockAgeLabel} />
          <MinimaStatCell label="Current block" value={currentBlockLabel} />
        </MinimaStatGrid>
      </div>
    </div>
  );
}
