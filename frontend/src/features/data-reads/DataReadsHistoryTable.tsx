import { useState } from "react";
import { Eye, Inbox } from "lucide-react";
import {
  DataTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableIconButton,
  TableRow,
  TableWrap,
} from "../../components/patterns/DataTable";
import { CopyableCode } from "../../components/patterns/CopyableCode";
import { DetailList, DetailRow } from "../../components/patterns/DetailList";
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { ErrorDetailPanel } from "../../components/patterns/ErrorDetailPanel";
import { JsonPreviewContent } from "../../components/JsonPreview";
import { LoadingState } from "../../components/patterns/LoadingState";
import { Disclosure } from "../../components/ui/Disclosure";
import { Modal } from "../../components/ui/Modal";
import { Text } from "../../components/ui/Text";
import { Pill } from "../../components/ui/Pill";
import { TruncatedHash } from "../../components/ui/TruncatedHash";
import { DEFAULT_PAGE_SIZE } from "../../lib/paginated";
import { formatLocalDateTime } from "../../lib/time";
import type { DataSourceRead } from "./dataReadTypes";

function proofHistoryLink(proofId: string) {
  const params = new URLSearchParams({
    tab: "proofs",
    page: "1",
    pageSize: String(DEFAULT_PAGE_SIZE),
    q: proofId,
  });
  return `/diagnostics?${params.toString()}`;
}

export function DataReadsHistoryTable({
  items,
  filtered,
  loading = false,
  onClearFilters,
}: {
  items: DataSourceRead[];
  filtered?: boolean;
  loading?: boolean;
  onClearFilters?: () => void;
}) {
  const [detailsItem, setDetailsItem] = useState<DataSourceRead | null>(null);

  if (loading)
    return (
      <LoadingState
        title="Fetching your read history"
        description="This should take a few seconds."
      />
    );

  if (items.length === 0)
    return (
      <EmptyContentState
        icon={Inbox}
        title={filtered ? "No matching read history" : "No reads recorded yet"}
        description={
          filtered
            ? "Try another status or search, or clear filters."
            : "Reads from your devices will be added to your history here."
        }
        actionLabel={filtered && onClearFilters ? "Clear filters" : undefined}
        actionVariant="secondary"
        onAction={filtered ? onClearFilters : undefined}
      />
    );

  return (
    <TableWrap>
      <DataTable aria-label="Read history" className="min-w-255">
        <TableHead>
          <TableHeaderCell>Read time</TableHeaderCell>
          <TableHeaderCell>Source</TableHeaderCell>
          <TableHeaderCell>Trigger</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Hash</TableHeaderCell>
          <TableHeaderCell>Integritas proof</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <time className="type-meta text-text-secondary" dateTime={item.createdAt}>
                  {formatLocalDateTime(item.createdAt)}
                </time>
              </TableCell>
              <TableCell className="max-w-56 min-w-0">
                <div className="gap-detail-tight flex min-w-0 flex-col">
                  <span className="type-body-em text-text-primary truncate">{item.sourceName}</span>
                  <code
                    className="type-mono text-text-secondary block truncate"
                    title={item.sourceUrl}
                  >
                    {item.sourceUrl}
                  </code>
                </div>
              </TableCell>
              <TableCell>
                <Pill>{item.triggerType}</Pill>
              </TableCell>
              <TableCell>
                {item.status === "success" ? (
                  <Pill tone="good" indicator>
                    Success
                  </Pill>
                ) : (
                  <Pill tone="error" indicator>
                    Failed
                  </Pill>
                )}
              </TableCell>
              <TableCell className="max-w-48 min-w-0">
                {item.hash ? (
                  <TruncatedHash value={item.hash} />
                ) : (
                  <span className="text-text-secondary">No hash</span>
                )}
              </TableCell>
              <TableCell className="max-w-40 min-w-0">
                {item.integritasProofId ? (
                  <Text.Link to={proofHistoryLink(item.integritasProofId)} title="Go to proof">
                    Go to proof
                  </Text.Link>
                ) : (
                  <span className="text-text-secondary">No proof</span>
                )}
              </TableCell>
              <TableCell className="w-px whitespace-nowrap">
                <TableIconButton
                  title="View details"
                  aria-label={`View details for read at ${formatLocalDateTime(item.createdAt)}`}
                  onClick={() => setDetailsItem(item)}
                >
                  <Eye size={16} aria-hidden />
                </TableIconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
      {detailsItem ? (
        <ReadDetailsModal item={detailsItem} onClose={() => setDetailsItem(null)} />
      ) : null}
    </TableWrap>
  );
}

/** "View details" modal — key facts, then the preview/error in an expandable disclosure. */
function ReadDetailsModal({ item, onClose }: { item: DataSourceRead; onClose: () => void }) {
  return (
    <Modal title="Read details" onClose={onClose}>
      <div className="gap-detail-near grid">
        <DetailList>
          <DetailRow label="Read time" value={formatLocalDateTime(item.createdAt)} />
          <DetailRow
            label="Source"
            value={
              <div className="gap-detail-tight flex min-w-0 flex-col">
                <span className="type-body-em text-text-primary truncate">{item.sourceName}</span>
                <code
                  className="type-mono text-text-secondary block truncate"
                  title={item.sourceUrl}
                >
                  {item.sourceUrl}
                </code>
              </div>
            }
          />
          <DetailRow label="Trigger" value={<Pill>{item.triggerType}</Pill>} />
          <DetailRow
            label="Status"
            value={
              item.status === "success" ? (
                <Pill tone="good" indicator>
                  Success
                </Pill>
              ) : (
                <Pill tone="error" indicator>
                  Failed
                </Pill>
              )
            }
          />
          <DetailRow
            label="Hash"
            value={
              item.hash ? (
                <CopyableCode value={item.hash} />
              ) : (
                <span className="text-text-secondary">No hash</span>
              )
            }
          />
          <DetailRow
            label="Integritas proof"
            value={
              item.integritasProofId ? (
                <Text.Link to={proofHistoryLink(item.integritasProofId)} title="Go to proof">
                  Go to proof
                </Text.Link>
              ) : (
                <span className="text-text-secondary">No proof</span>
              )
            }
          />
        </DetailList>
        <Disclosure title="Preview">
          {item.preview ? (
            <JsonPreviewContent value={item.preview} />
          ) : item.error ? (
            <ErrorDetailPanel error={item.errorDetails ?? item.error} />
          ) : (
            <EmptyContentState
              icon={Inbox}
              title="No data"
              description="This read did not capture a preview."
            />
          )}
        </Disclosure>
      </div>
    </Modal>
  );
}
