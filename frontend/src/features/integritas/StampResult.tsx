import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../../components/ToastProvider";
import { ButtonRow } from "../../components/ButtonRow";
import { JsonPreview } from "../../components/patterns/JsonPreview";
import { Pill } from "../../components/ui/Pill";
import { ResultShell } from "./ResultShell";
import { getHistoryRecord } from "./integritasApi";
import { integritasErrorToast } from "./integritasErrors";
import type { IntegritasProofRecord } from "./integritasTypes";

const REFRESH_INTERVAL_MS = 15_000;
const REFRESH_TIMEOUT_MS = 5 * 60_000;

function ResultField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="gap-detail-tight border-stroke-secondary py-detail-close flex min-w-0 flex-col border-t first:border-t-0 first:pt-0 last:pb-0">
      <dt className="type-meta text-text-secondary m-0 leading-none">{label}</dt>
      <dd className="m-0 min-w-0">
        {mono ? (
          <code className="type-mono text-text-primary break-all">{value}</code>
        ) : (
          <span className="type-body text-text-primary break-all">{value}</span>
        )}
      </dd>
    </div>
  );
}

function statusTone(record: IntegritasProofRecord): "good" | "warn" | "error" {
  if (record.proof_status === "ready") return "good";
  if (record.proof_status === "failed") return "error";
  return "warn";
}

function statusBadge(record: IntegritasProofRecord) {
  if (record.proof_status === "ready") {
    return (
      <Pill tone="good" indicator>
        Confirmed on-chain
      </Pill>
    );
  }
  if (record.proof_status === "failed") {
    return (
      <Pill tone="error" indicator>
        Proof failed
      </Pill>
    );
  }
  return (
    <Pill tone="warn" indicator>
      Waiting for on-chain confirmation
    </Pill>
  );
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

  return (
    <ResultShell
      title="Timestamp proof submitted"
      ariaLabel="Stamp result"
      tone={statusTone(record)}
      badge={statusBadge(record)}
      onClose={onClose}
      actions={
        <ButtonRow>
          <Link
            className="type-meta rounded-loose bg-surface-secondary px-detail-close text-text-primary hover:border-stroke-primary inline-flex h-8 w-fit items-center border border-transparent no-underline transition-colors duration-200"
            to="/diagnostics?tab=proofs"
          >
            Open in Diagnostics
          </Link>
          {technicalDetails !== undefined ? (
            <JsonPreview value={technicalDetails} label="View technical details" variant="button" />
          ) : null}
        </ButtonRow>
      }
    >
      <dl className="m-0 flex flex-col">
        {record.file_name ? <ResultField label="File" value={record.file_name} /> : null}
        {record.proof_uid ? <ResultField label="Proof UID" value={record.proof_uid} mono /> : null}
        <ResultField label="Data hash" value={record.hash} mono />
        {record.proof_status === "failed" && record.proof_error ? (
          <ResultField label="Error" value={record.proof_error} />
        ) : null}
      </dl>
    </ResultShell>
  );
}
