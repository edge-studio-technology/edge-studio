import { HardDrive, Layers3, RefreshCw, RotateCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { MinimaNodeStatus, Status } from "../../app/types";
import { Button } from "../../components/Button";
import { LoadingDots } from "../../components/LoadingDots";
import { Card } from "../../components/ui/Card";
import { cx } from "../../lib/cx";
import { formatLocalTime, formatUtcTime } from "../../lib/time";
import { formatNodeState, formatSyncStatus, nodeStateStatus, syncStatusTone } from "./minimaFormat";

// TODO: use shared `statusValueClass` from `MetricCard`
const statusValueClass: Record<Status, string> = {
  neutral: "text-text-primary",
  success: "text-text-success",
  warning: "text-text-warning",
  error: "text-text-error",
};

function SummaryCard({
  icon: Icon,
  title,
  text,
  detail,
  loading = false,
  status = "neutral",
  children,
}: {
  icon: LucideIcon;
  title: string;
  text?: ReactNode;
  detail?: ReactNode;
  loading?: boolean;
  status?: Status;
  children?: ReactNode;
}) {
  const displayValue = loading ? <LoadingDots /> : text;

  return (
    <Card size="Compact" className="gap-detail-close flex h-full w-full flex-col">
      <div className="gap-detail-next flex w-full flex-col items-start">
        <p className="type-meta text-text-primary m-0">{title}</p>
        <div className="gap-detail-next flex w-full min-w-0 items-center">
          <span
            className="text-icon-secondary flex size-5 shrink-0 items-center justify-center overflow-clip"
            aria-hidden="true"
          >
            <Icon size={20} />
          </span>
          <div
            className={cx(
              "type-callout min-w-0 truncate tracking-[-0.02em]",
              loading ? "text-text-tertiary" : statusValueClass[status],
            )}
          >
            {displayValue}
          </div>
        </div>
      </div>
      {detail || children ? (
        <div className="gap-detail-close mt-auto flex w-full flex-col">
          {detail ? <p className="type-meta text-text-tertiary m-0 w-full">{detail}</p> : null}
          {children}
        </div>
      ) : null}
    </Card>
  );
}

export function MinimaSummaryGrid({
  status,
  loading,
  busy,
  refreshing,
  onResync,
}: {
  status: MinimaNodeStatus | null;
  loading: boolean;
  busy: boolean;
  refreshing: boolean;
  onResync: () => void;
}) {
  const effectiveStatus = refreshing ? null : status;
  const effectiveLoading = loading || refreshing;

  const chainDataValue = effectiveStatus?.storage.chainDataDisk
    ? `${effectiveStatus.storage.chainDataDisk} chain data`
    : effectiveStatus?.node.memoryDisk
      ? `${effectiveStatus.node.memoryDisk} chain data`
      : "Unavailable";
  const containerDiskLabel = effectiveStatus?.storage.containerDisk
    ? `${effectiveStatus.storage.containerDisk} Docker container`
    : null;
  const checkedLabel = effectiveStatus?.checkedAt
    ? `Checked ${formatLocalTime(effectiveStatus.checkedAt)} local · ${formatUtcTime(effectiveStatus.checkedAt)} UTC`
    : null;

  return (
    <div className="gap-detail-close grid w-full md:grid-cols-2 lg:grid-cols-3">
      <SummaryCard
        icon={Layers3}
        title="Minima"
        loading={effectiveLoading && !effectiveStatus?.state}
        text={formatNodeState(effectiveStatus?.state ?? null)}
        status={nodeStateStatus(effectiveStatus?.state ?? null)}
        detail={checkedLabel}
      />

      <SummaryCard
        icon={RefreshCw}
        title="Sync status"
        loading={effectiveLoading && !effectiveStatus?.sync.status}
        text={formatSyncStatus(effectiveStatus?.sync.status)}
        status={syncStatusTone(effectiveStatus?.sync.status)}
      >
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={onResync}
        >
          <RotateCw size={16} />
          Resync
        </Button>
      </SummaryCard>

      <SummaryCard
        icon={HardDrive}
        title="Local storage"
        loading={
          effectiveLoading &&
          !effectiveStatus?.storage.chainDataDisk &&
          !effectiveStatus?.node.memoryDisk
        }
        text={chainDataValue}
        detail={containerDiskLabel}
      />
    </div>
  );
}
