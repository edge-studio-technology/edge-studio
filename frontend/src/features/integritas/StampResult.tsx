import { useEffect, useState } from "react";
import { CheckCircle2, CircleX, Clock, X } from "lucide-react";
import { useToast } from "../../components/ToastProvider";
import { contentStatePanelClass } from "../../components/patterns/EmptyContentState";
import { JsonPreview } from "../../components/patterns/JsonPreview";
import { IconButton, LinkButton } from "../../components/ui/Button";
import { cx } from "../../lib/cx";
import { getHistoryRecord } from "./integritasApi";
import { integritasErrorToast } from "./integritasErrors";
import type { IntegritasProofRecord } from "./integritasTypes";

const REFRESH_INTERVAL_MS = 15_000;
const REFRESH_TIMEOUT_MS = 5 * 60_000;

function stampStatus(record: IntegritasProofRecord) {
  if (record.proof_status === "ready") {
    return {
      Icon: CheckCircle2,
      iconClass: "text-icon-success",
      title: "Confirmed on-chain",
      description: "Your file has been stamped.",
    };
  }
  if (record.proof_status === "failed") {
    return {
      Icon: CircleX,
      iconClass: "text-icon-error",
      title: "Proof failed",
      description: record.proof_error || "The proof could not be confirmed.",
    };
  }
  return {
    Icon: Clock,
    iconClass: "text-icon-warning",
    title: "Waiting for confirmation",
    description: "Proof is pending on-chain. It will be confirmed in a few minutes.",
  };
}

export function StampResult({
  record: initialRecord,
  technicalDetails,
  onClose,
}: {
  record: IntegritasProofRecord;
  technicalDetails?: unknown;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [record, setRecord] = useState(initialRecord);

  useEffect(() => {
    setRecord(initialRecord);
  }, [initialRecord]);

  useEffect(() => {
    if (record.proof_status !== "pending") return;

    let cancelled = false;
    const startedAt = Date.now();

    async function refreshFromHistory() {
      try {
        const response = await getHistoryRecord(record.id);
        if (cancelled) return;
        setRecord(response.record);
      } catch (error) {
        const err = error as { errorCode?: string };
        if (err.errorCode === "unauthorized") {
          cancelled = true;
          const { title, message } = integritasErrorToast(error);
          showToast({ tone: "error", title, message, timeoutMs: 9000 });
        }
      }
    }

    void refreshFromHistory();
    const interval = window.setInterval(() => {
      if (Date.now() - startedAt >= REFRESH_TIMEOUT_MS) {
        window.clearInterval(interval);
        return;
      }
      void refreshFromHistory();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [record.id, record.proof_status, showToast]);

  const { Icon, iconClass, title, description } = stampStatus(record);

  return (
    <div className={cx(contentStatePanelClass, "relative min-h-64")} aria-label="Stamp result">
      <IconButton
        variant="ghost"
        size="compact"
        aria-label="Dismiss stamp result"
        onClick={onClose}
        className="top-detail-next right-detail-next enabled:hover:border-stroke-primary absolute border-transparent"
      >
        <X aria-hidden />
      </IconButton>
      <Icon aria-hidden className={cx("size-8 shrink-0", iconClass)} />
      <div className="gap-detail-tight flex flex-col">
        <p className="type-body-em text-text-primary m-0">{title}</p>
        <p className="type-body text-text-primary m-0">{description}</p>
      </div>
      <div className="gap-detail-next flex flex-wrap items-center justify-center">
        <LinkButton href="/diagnostics?tab=proofs" size="sm">
          Open in Diagnostics
        </LinkButton>
        {technicalDetails !== undefined ? (
          <JsonPreview value={technicalDetails} label="View technical details" variant="button" />
        ) : null}
      </div>
    </div>
  );
}
