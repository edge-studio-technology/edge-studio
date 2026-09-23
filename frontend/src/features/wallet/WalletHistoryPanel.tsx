import { useState } from "react";
import { Eye, Inbox } from "lucide-react";
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
import { Button } from "../../components/ui/Button";
import { Pill } from "../../components/ui/Pill";
import { TruncatedHash } from "../../components/ui/TruncatedHash";
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { ErrorContentState } from "../../components/patterns/ErrorContentState";
import { ListPaginationFooter } from "../../components/patterns/ListPaginationFooter";
import { ListFilterBar } from "../../components/patterns/ListFilterBar";
import { LoadingState } from "../../components/patterns/LoadingState";
import {
  applyColumnFilters,
  orderedColumns,
  TableColumnFilterSummary,
  TableColumnVisibilityButton,
  type TableColumnDefinition,
} from "../../components/patterns/TableColumnVisibility";
import { TableControls } from "../../components/patterns/TableControls";
import { useToast } from "../../components/ToastProvider";
import { describeLoadFailure } from "../../lib/errors";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../lib/paginated";
import { formatMinimaAmount, shortHash } from "../../lib/format";
import { formatLocalDateTime } from "../../lib/time";
import { clearWalletHistoryForDebug } from "./walletApi";
import { HistoryDetailModal } from "./HistoryDetailModal";
import { TokenGlyph } from "./TokenGlyph";
import { useTableColumnVisibility } from "../preferences/useTableColumnVisibility";
import type { WalletSendHistoryItem } from "./walletTypes";
import { isNativeTokenId } from "./walletUtils";

const HISTORY_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "failed", label: "Failed" },
] as const;

const PAGE_SIZE_OPTIONS = DEFAULT_PAGE_SIZE_OPTIONS.map((size) => ({
  value: String(size),
  label: String(size),
}));

const WALLET_HISTORY_COLUMNS = [
  { id: "amount", label: "Amount" },
  { id: "to", label: "To", filterable: true },
  { id: "status", label: "Status" },
  { id: "date", label: "Date" },
  { id: "token", label: "Token", defaultVisible: false, filterable: true },
  { id: "txpow", label: "TxPoW ID", defaultVisible: false, filterable: true },
  { id: "actions", label: "Actions", dataColumn: false },
] as const satisfies readonly TableColumnDefinition[];

function historyStatusTone(status: WalletSendHistoryItem["status"]) {
  return status === "failed" ? "error" : "good";
}

function historyStatusLabel(status: WalletSendHistoryItem["status"]) {
  return status === "submitted" ? "Submitted" : "Failed";
}

export function WalletHistoryPanel({
  items,
  loading,
  error,
  actionsBlocked,
  onRefresh,
}: {
  items: WalletSendHistoryItem[];
  loading: boolean;
  error: string | null;
  actionsBlocked: boolean;
  onRefresh: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(DEFAULT_PAGE_SIZE_OPTIONS[0]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<WalletSendHistoryItem | null>(
    null,
  );
  const [debugClearingHistory, setDebugClearingHistory] = useState(false);
  const { visibility, columnOrder, filters, setVisibility, setColumnOrder, setFilters } = useTableColumnVisibility(
    "wallet-history",
    WALLET_HISTORY_COLUMNS,
  );
  const visibleColumns = orderedColumns(WALLET_HISTORY_COLUMNS, columnOrder).filter(
    (column) => visibility[column.id],
  );
  const visibleColumnCount = visibleColumns.length;
  const isDev = import.meta.env.DEV;

  const trimmedHistoryQuery = historyQuery.trim().toLowerCase();
  const filtersActive = Boolean(historyStatus || trimmedHistoryQuery || Object.keys(filters).length > 0);
  const pagerDisabled = loading;
  const showLoading = loading;
  const searchFilteredHistory = items.filter((entry) => {
    if (historyStatus && entry.status !== historyStatus) return false;
    if (!trimmedHistoryQuery) return true;
    return (
      entry.toAddress.toLowerCase().includes(trimmedHistoryQuery) ||
      entry.tokenName.toLowerCase().includes(trimmedHistoryQuery) ||
      (entry.txpowId ?? "").toLowerCase().includes(trimmedHistoryQuery)
    );
  });
  const filteredHistory = applyColumnFilters(searchFilteredHistory, filters, {
    to: (entry) => entry.toAddress,
    token: (entry) => entry.tokenName,
    txpow: (entry) => entry.txpowId,
  });
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
  const historyCurrentPage = Math.min(historyPage, historyTotalPages);
  const pagedHistory = filteredHistory.slice(
    (historyCurrentPage - 1) * historyPageSize,
    historyCurrentPage * historyPageSize,
  );

  function clearFilters() {
    setHistoryStatus("");
    setHistoryQuery("");
    setHistoryPage(1);
  }

  async function handleDebugClearWalletHistory() {
    const confirmed = window.confirm(
      "Clear wallet send history from SQLite? This is a dev-only debug action and cannot be undone.",
    );
    if (!confirmed) return;
    setDebugClearingHistory(true);
    try {
      const result = await clearWalletHistoryForDebug();
      await onRefresh();
      showToast({
        tone: "success",
        title: "Wallet history cleared",
        message: `Deleted ${result.deleted} history item(s).`,
      });
    } catch (err) {
      showToast({
        tone: "error",
        title: "Clear failed",
        message: err instanceof Error ? err.message : "Could not clear wallet history.",
      });
    } finally {
      setDebugClearingHistory(false);
    }
  }

  return (
    <div className="gap-detail-close flex flex-col">
      {error ? null : (
        <TableControls
          utilities={
            <TableColumnVisibilityButton
              tableLabel="Send history"
              columns={WALLET_HISTORY_COLUMNS}
              visibility={visibility}
              columnOrder={columnOrder}
              filters={filters}
              onChange={setVisibility}
              onOrderChange={setColumnOrder}
              onFiltersChange={setFilters}
            />
          }
        >
          <div className="[&>div]:mb-0">
            <ListFilterBar
              filter={historyStatus}
              q={historyQuery}
              filterOptions={HISTORY_STATUS_OPTIONS}
              searchPlaceholder="Address, token, or txpow ID"
              disabled={pagerDisabled || items.length === 0}
              onFilterChange={(status) => {
                setHistoryStatus(status);
                setHistoryPage(1);
              }}
              onQueryChange={(q) => {
                setHistoryQuery(q);
                setHistoryPage(1);
              }}
            />
          </div>
        </TableControls>
      )}

      {!error ? (
        <p className="sr-only" aria-live="polite">
          {showLoading
            ? "Loading send history."
            : filtersActive
              ? `${filteredHistory.length} matching ${filteredHistory.length === 1 ? "send" : "sends"}.`
              : `${filteredHistory.length} ${filteredHistory.length === 1 ? "send" : "sends"} in history.`}
        </p>
      ) : null}

      {error ? null : (
        <TableColumnFilterSummary
          columns={WALLET_HISTORY_COLUMNS}
          filters={filters}
          onRemove={(columnId) => setFilters({ ...filters, [columnId]: undefined })}
          onClear={() => setFilters({})}
        />
      )}

      {error ? (
        <ErrorContentState
          title="Send history isn't available"
          description={describeLoadFailure(error)}
          onRetry={() => void onRefresh()}
        />
      ) : showLoading ? (
        <LoadingState
          title="Fetching your send history"
          description="This should take a few seconds."
        />
      ) : filteredHistory.length === 0 ? (
        <EmptyContentState
          icon={Inbox}
          title={filtersActive ? "No matching sends" : "No send activity yet"}
          description={
            filtersActive
              ? "Try another status or search, or clear filters."
              : "Payments you send from this wallet will be added to your history here."
          }
          actionLabel={filtersActive ? "Clear filters" : undefined}
          actionVariant="secondary"
          onAction={filtersActive ? clearFilters : undefined}
        />
      ) : (
        <TableWrap>
          <DataTable aria-label="Send history" className={visibleColumnCount > 3 ? "min-w-245" : undefined}>
            <TableHead>
              {visibleColumns.map((column) => (
                <TableHeaderCell
                  key={column.id}
                  className={column.id === "actions" ? "w-px whitespace-nowrap" : undefined}
                >
                  {column.label}
                </TableHeaderCell>
              ))}
            </TableHead>
            <TableBody>
              {pagedHistory.map((entry) => {
                const amountLabel = formatMinimaAmount(entry.amount, 12);
                const toShort = shortHash(entry.toAddress);
                return (
                  <TableRow key={entry.id}>
                    {visibleColumns.map((column) => (
                      <WalletHistoryCell
                        key={column.id}
                        columnId={column.id}
                        entry={entry}
                        amountLabel={amountLabel}
                        toShort={toShort}
                        onView={() => setSelectedHistoryItem(entry)}
                      />
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        </TableWrap>
      )}

      {error ? null : (
        <ListPaginationFooter
          page={historyCurrentPage}
          pageSize={historyPageSize}
          total={filteredHistory.length}
          totalPages={historyTotalPages}
          disabled={pagerDisabled}
          onPageChange={setHistoryPage}
          onPageSizeChange={(size) => {
            setHistoryPageSize(size);
            setHistoryPage(1);
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      )}

      {/* {isDev ? (
        <div className="flex justify-start">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleDebugClearWalletHistory}
            disabled={debugClearingHistory}
            title="Dev-only: clears wallet_send_history table"
          >
            {debugClearingHistory ? "Clearing…" : "Debug: clear history"}
          </Button>
        </div>
      ) : null} */}

      {selectedHistoryItem ? (
        <HistoryDetailModal
          item={selectedHistoryItem}
          onClose={() => setSelectedHistoryItem(null)}
        />
      ) : null}
    </div>
  );
}

function WalletHistoryCell({
  columnId,
  entry,
  amountLabel,
  toShort,
  onView,
}: {
  columnId: string;
  entry: WalletSendHistoryItem;
  amountLabel: string;
  toShort: string;
  onView: () => void;
}) {
  if (columnId === "amount") {
    return (
      <TableCell className="min-w-0">
        <span className="gap-detail-next inline-flex max-w-full min-w-0 items-center">
          <TokenGlyph isNative={isNativeTokenId(entry.tokenId)} />
          <span className="gap-detail-tight flex min-w-0 flex-col">
            <span className="type-mono text-text-primary truncate tabular-nums">{amountLabel}</span>
          </span>
        </span>
      </TableCell>
    );
  }
  if (columnId === "to") return <TableCell className="min-w-0"><TruncatedHash value={entry.toAddress} /></TableCell>;
  if (columnId === "status") {
    return (
      <TableCell>
        <Pill tone={historyStatusTone(entry.status)} indicator>
          {historyStatusLabel(entry.status)}
        </Pill>
      </TableCell>
    );
  }
  if (columnId === "date") {
    return (
      <TableCell className="whitespace-nowrap">
        <time className="type-meta text-text-secondary" dateTime={entry.createdAt}>{formatLocalDateTime(entry.createdAt)}</time>
      </TableCell>
    );
  }
  if (columnId === "token") return <TableCell className="max-w-48 min-w-0"><span className="block truncate" title={entry.tokenName}>{entry.tokenName}</span></TableCell>;
  if (columnId === "txpow") {
    return (
      <TableCell className="max-w-48 min-w-0">
        {entry.txpowId ? <TruncatedHash value={entry.txpowId} /> : <span className="text-text-secondary">None</span>}
      </TableCell>
    );
  }
  if (columnId === "actions") {
    return (
      <TableCell className="w-px whitespace-nowrap">
        <RowActions>
          <TableIconButton
            type="button"
            title="View details"
            aria-label={`View send of ${amountLabel} ${entry.tokenName} to ${toShort}`}
            onClick={onView}
          >
            <Eye size={16} aria-hidden />
          </TableIconButton>
        </RowActions>
      </TableCell>
    );
  }
  return null;
}
