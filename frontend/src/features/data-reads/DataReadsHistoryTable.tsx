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
import {
  orderedColumns,
  TableColumnVisibilityButton,
  type TableColumnDefinition,
  type TableColumnFilters,
  type TableColumnOrder,
  type TableColumnVisibility,
} from "../../components/patterns/TableColumnVisibility";
import { TableControls } from "../../components/patterns/TableControls";
import { Disclosure } from "../../components/ui/Disclosure";
import { Modal } from "../../components/ui/Modal";
import { Text } from "../../components/ui/Text";
import { Pill } from "../../components/ui/Pill";
import { TruncatedHash } from "../../components/ui/TruncatedHash";
import { DEFAULT_PAGE_SIZE } from "../../lib/paginated";
import { formatLocalDateTime } from "../../lib/time";
import { useTableColumnVisibility } from "../preferences/useTableColumnVisibility";
import type { DataSourceRead } from "./dataReadTypes";

export const READ_COLUMNS = [
  { id: "readTime", label: "Read time" },
  { id: "source", label: "Source", filterable: true },
  { id: "trigger", label: "Trigger" },
  { id: "status", label: "Status" },
  { id: "hash", label: "Hash", filterable: true },
  { id: "proof", label: "Integritas proof", filterable: true },
  { id: "actions", label: "Actions", dataColumn: false },
] as const satisfies readonly TableColumnDefinition[];

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
  columnVisibility,
  columnOrder: controlledColumnOrder,
  columnFilters: controlledColumnFilters,
  onColumnVisibilityChange,
  onColumnOrderChange,
  onColumnFiltersChange,
  showColumnControls = true,
}: {
  items: DataSourceRead[];
  filtered?: boolean;
  loading?: boolean;
  onClearFilters?: () => void;
  columnVisibility?: TableColumnVisibility;
  columnOrder?: TableColumnOrder;
  columnFilters?: TableColumnFilters;
  onColumnVisibilityChange?: (next: TableColumnVisibility) => void;
  onColumnOrderChange?: (next: TableColumnOrder) => void;
  onColumnFiltersChange?: (next: TableColumnFilters) => void;
  showColumnControls?: boolean;
}) {
  const [detailsItem, setDetailsItem] = useState<DataSourceRead | null>(null);
  const internalColumns = useTableColumnVisibility("diagnostics-reads", READ_COLUMNS);
  const visibility = columnVisibility ?? internalColumns.visibility;
  const setVisibility = onColumnVisibilityChange ?? internalColumns.setVisibility;
  const columnOrder = controlledColumnOrder ?? internalColumns.columnOrder;
  const setColumnOrder = onColumnOrderChange ?? internalColumns.setColumnOrder;
  const filters = controlledColumnFilters ?? internalColumns.filters;
  const setFilters = onColumnFiltersChange ?? internalColumns.setFilters;
  const visibleColumns = orderedColumns(READ_COLUMNS, columnOrder).filter(
    (column) => visibility[column.id],
  );
  const visibleColumnCount = visibleColumns.length;

  const controls = showColumnControls ? (
    <TableControls
      utilities={
        <TableColumnVisibilityButton
          tableLabel="Read history"
          columns={READ_COLUMNS}
          visibility={visibility}
          columnOrder={columnOrder}
          filters={filters}
          onChange={setVisibility}
          onOrderChange={setColumnOrder}
          onFiltersChange={setFilters}
        />
      }
    />
  ) : null;

  if (loading)
    return (
      <>
        {controls}
        <LoadingState
          title="Fetching your read history"
          description="This should take a few seconds."
        />
      </>
    );

  if (items.length === 0)
    return (
      <>
        {controls}
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
      </>
    );

  return (
    <>
      {controls}
      <TableWrap>
        <DataTable
          aria-label="Read history"
          className={visibleColumnCount > 3 ? "min-w-245" : undefined}
        >
          <TableHead>
            {visibleColumns.map((column) => (
              <TableHeaderCell key={column.id} sticky={column.id === "actions"}>{column.label}</TableHeaderCell>
            ))}
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                {visibleColumns.map((column) => (
                  <ReadHistoryCell key={column.id} columnId={column.id} item={item} onView={() => setDetailsItem(item)} />
                ))}
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
        {detailsItem ? (
          <ReadDetailsModal item={detailsItem} onClose={() => setDetailsItem(null)} />
        ) : null}
      </TableWrap>
    </>
  );
}

function ReadHistoryCell({
  columnId,
  item,
  onView,
}: {
  columnId: string;
  item: DataSourceRead;
  onView: () => void;
}) {
  if (columnId === "readTime") {
    return (
      <TableCell>
        <time className="type-meta text-text-secondary" dateTime={item.createdAt}>
          {formatLocalDateTime(item.createdAt)}
        </time>
      </TableCell>
    );
  }
  if (columnId === "source") {
    return (
      <TableCell className="max-w-56 min-w-0">
        <div className="gap-detail-tight flex min-w-0 flex-col">
          <span className="type-body-em text-text-primary truncate">{item.sourceName}</span>
          <code className="type-mono text-text-secondary block truncate" title={item.sourceUrl}>
            {item.sourceUrl}
          </code>
        </div>
      </TableCell>
    );
  }
  if (columnId === "trigger") {
    return (
      <TableCell>
        <Pill>{item.triggerType}</Pill>
      </TableCell>
    );
  }
  if (columnId === "status") {
    return (
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
    );
  }
  if (columnId === "hash") {
    return (
      <TableCell className="max-w-48 min-w-0">
        {item.hash ? <TruncatedHash value={item.hash} /> : <span className="text-text-secondary">No hash</span>}
      </TableCell>
    );
  }
  if (columnId === "proof") {
    return (
      <TableCell className="max-w-40 min-w-0">
        {item.integritasProofId ? (
          <Text.Link to={proofHistoryLink(item.integritasProofId)} title="Go to proof">
            Go to proof
          </Text.Link>
        ) : (
          <span className="text-text-secondary">No proof</span>
        )}
      </TableCell>
    );
  }
  if (columnId === "actions") {
    return (
      <TableCell sticky className="w-px whitespace-nowrap">
        <TableIconButton
          title="View details"
          aria-label={`View details for read at ${formatLocalDateTime(item.createdAt)}`}
          onClick={onView}
        >
          <Eye size={16} aria-hidden />
        </TableIconButton>
      </TableCell>
    );
  }
  return null;
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
