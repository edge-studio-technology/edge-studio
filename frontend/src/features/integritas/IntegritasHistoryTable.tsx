import { useState } from "react";
import {
  DataTable,
  RowActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableIconButton,
  TableRow,
  TableWrap,
} from "../../components/patterns/DataTable";
import { JsonPreview } from "../../components/patterns/JsonPreview";
import { Button } from "../../components/ui/Button";
import { CheckboxField } from "../../components/ui/CheckboxField";
import { Modal } from "../../components/ui/Modal";
import { Pill } from "../../components/ui/Pill";
import { formatLocalDateTime } from "../../lib/time";
import { Download, Trash2 } from "lucide-react";
import type { IntegritasProofRecord } from "./integritasTypes";

export function IntegritasHistoryTable({
  records,
  selectedIds,
  filtered,
  onToggle,
  onToggleAllVisible,
  onVerify,
  onDownload,
  onClearSelection,
  onDeleteSelected,
  onDownloadSelected,
  busy,
  bulkBusy = null,
  verifyingId = null,
}: {
  records: IntegritasProofRecord[];
  selectedIds: string[];
  filtered?: boolean;
  onToggle: (id: string) => void;
  onToggleAllVisible: () => void;
  onVerify: (record: IntegritasProofRecord) => void;
  onDownload: (record: IntegritasProofRecord) => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onDownloadSelected: () => void;
  busy: boolean;
  bulkBusy?: "download" | "delete" | null;
  verifyingId?: string | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selectedCount = selectedIds.length;
  const selectedOnPage = records.filter((record) => selectedIds.includes(record.id)).length;
  const allVisibleSelected = records.length > 0 && selectedOnPage === records.length;
  const someVisibleSelected = selectedOnPage > 0 && !allVisibleSelected;

  return (
    <div className="gap-detail-close flex flex-col">
      {selectedCount > 0 ? (
        <div
          role="region"
          aria-label="Selected proofs"
          className="border-stroke-secondary bg-surface-secondary gap-detail-close rounded-soft p-pad-tight flex flex-wrap items-center justify-between border"
        >
          <div className="gap-detail-close flex min-w-0 flex-wrap items-center">
            <p className="type-body-em text-text-primary m-0" aria-live="polite">
              {selectedCount} selected
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onClearSelection}
            >
              Clear
            </Button>
          </div>
          <div className="gap-detail-next flex flex-wrap items-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              iconStart={<Download aria-hidden />}
              onClick={onDownloadSelected}
            >
              {bulkBusy === "download" ? "Downloading…" : "Download"}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={busy}
              iconStart={<Trash2 aria-hidden />}
              onClick={() => setConfirmDelete(true)}
            >
              {bulkBusy === "delete" ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <Modal
          title={selectedCount === 1 ? "Delete this proof?" : `Delete ${selectedCount} proofs?`}
          description={
            selectedCount === 1
              ? "This permanently removes the selected proof record. This cannot be undone."
              : `This permanently removes ${selectedCount} proof records. This cannot be undone.`
          }
          onClose={() => {
            if (!busy) setConfirmDelete(false);
          }}
          closeDisabled={busy}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={busy}
                iconStart={<Trash2 aria-hidden />}
                onClick={() => {
                  setConfirmDelete(false);
                  onDeleteSelected();
                }}
              >
                {bulkBusy === "delete" ? "Deleting…" : "Delete"}
              </Button>
            </>
          }
        />
      ) : null}

      <TableWrap>
        <DataTable aria-label="Proof history" className="min-w-[1020px]">
          <TableHead>
            <TableHeaderCell className="w-px whitespace-nowrap">
              <CheckboxField
                label={null}
                aria-label="Select all proofs on this page"
                checked={allVisibleSelected}
                indeterminate={someVisibleSelected}
                disabled={busy || records.length === 0}
                onChange={onToggleAllVisible}
              />
            </TableHeaderCell>
            <TableHeaderCell className="whitespace-nowrap">Timestamp</TableHeaderCell>
            <TableHeaderCell>UID</TableHeaderCell>
            <TableHeaderCell>Data hash</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell className="w-px whitespace-nowrap">Payload</TableHeaderCell>
            <TableHeaderCell className="w-px whitespace-nowrap">
              <span className="sr-only">Download</span>
            </TableHeaderCell>
            <TableHeaderCell className="w-px whitespace-nowrap">Actions</TableHeaderCell>
          </TableHead>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <td colSpan={8} className="p-0">
                  <div className="p-margin-tight py-pad-relaxed">
                    <p className="type-body text-text-secondary m-0">
                      {filtered ? "No matching proof history." : "No proof history yet."}
                    </p>
                  </div>
                </td>
              </TableRow>
            ) : (
              records.map((record) => {
                const hasPayload = Boolean(record.proof_payload);
                const selected = selectedIds.includes(record.id);
                return (
                  <TableRow key={record.id}>
                    <TableCell className="w-px whitespace-nowrap">
                      <CheckboxField
                        label={null}
                        aria-label={`Select proof ${record.proof_uid ?? record.id}`}
                        checked={selected}
                        disabled={busy}
                        onChange={() => onToggle(record.id)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <time className="type-meta text-text-secondary" dateTime={record.created_at}>
                        {formatLocalDateTime(record.created_at)}
                      </time>
                    </TableCell>
                    <TableCell className="max-w-40 min-w-0">
                      <code
                        className="type-mono text-text-secondary block truncate"
                        title={record.proof_uid ?? undefined}
                      >
                        {record.proof_uid ?? "—"}
                      </code>
                    </TableCell>
                    <TableCell className="max-w-48 min-w-0">
                      <code
                        className="type-mono text-text-secondary block truncate"
                        title={record.hash}
                      >
                        {record.hash}
                      </code>
                    </TableCell>
                    <TableCell>
                      <ProofStatusPill status={record.proof_status} />
                    </TableCell>
                    <TableCell className="w-px whitespace-nowrap">
                      {hasPayload ? (
                        <JsonPreview
                          label="View"
                          title="Proof payload"
                          value={JSON.parse(record.proof_payload!)}
                        />
                      ) : (
                        <span className="type-meta text-text-secondary">Not ready</span>
                      )}
                    </TableCell>
                    <TableCell className="w-px whitespace-nowrap">
                      <TableIconButton
                        title="Download proof"
                        aria-label={`Download proof ${record.proof_uid ?? record.id}`}
                        disabled={!hasPayload}
                        onClick={() => onDownload(record)}
                      >
                        <Download aria-hidden />
                      </TableIconButton>
                    </TableCell>
                    <TableCell className="w-px whitespace-nowrap">
                      <RowActions>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy || verifyingId !== null || !hasPayload}
                          aria-busy={verifyingId === record.id || undefined}
                          className="min-w-28"
                          onClick={() => onVerify(record)}
                        >
                          {verifyingId === record.id ? "Verifying…" : "Verify"}
                        </Button>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </DataTable>
      </TableWrap>
    </div>
  );
}

function ProofStatusPill({ status }: { status: string | null }) {
  const normalized = status ?? "unknown";
  const tone =
    normalized === "completed" ||
    normalized === "confirmed" ||
    normalized === "success" ||
    normalized === "on-chain"
      ? "good"
      : normalized === "failed" || normalized === "error"
        ? "error"
        : "neutral";
  return (
    <Pill tone={tone} indicator>
      {normalized}
    </Pill>
  );
}
