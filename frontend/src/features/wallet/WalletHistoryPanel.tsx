import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Eye, Inbox, Repeat } from "lucide-react";
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
import { CopyableTruncatedText } from "../../components/ui/CopyableTruncatedText";
import { InputField } from "../../components/ui/InputField";
import { Pill } from "../../components/ui/Pill";
import { SelectField } from "../../components/ui/SelectField";
import { TruncatedHash } from "../../components/ui/TruncatedHash";
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { ErrorAlert } from "../../components/patterns/ErrorAlert";
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
import { cx } from "../../lib/cx";
import { describeLoadFailure } from "../../lib/errors";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../lib/paginated";
import { formatLocalDateTime } from "../../lib/time";
import { clearWalletHistoryForDebug } from "./walletApi";
import { ClearPreviousHistoryModal } from "./ClearPreviousHistoryModal";
import { HistoryDetailModal } from "./HistoryDetailModal";
import { TokenGlyph } from "./TokenGlyph";
import { useTableColumnVisibility } from "../preferences/useTableColumnVisibility";
import {
  counterpartyLabel,
  DIRECTION_LABEL,
  isCustomRangeInvalid,
  ORIGIN_LABEL,
  signedAmountLabel,
  STATUS_LABEL,
  STATUS_TONE,
  WALLET_HISTORY_DATE_OPTIONS,
  WALLET_HISTORY_DIRECTION_OPTIONS,
  WALLET_HISTORY_STATUS_OPTIONS,
  type WalletHistoryFilters,
} from "./walletHistory";
import type { WalletHistoryDirection, WalletHistoryItem, WalletHistoryPage } from "./walletTypes";
import { isNativeTokenId } from "./walletUtils";

const PAGE_SIZE_OPTIONS = DEFAULT_PAGE_SIZE_OPTIONS.map((size) => ({
  value: String(size),
  label: String(size),
}));

const WALLET_HISTORY_COLUMNS = [
  { id: "amount", label: "Amount" },
  { id: "counterparty", label: "From / To", filterable: true },
  { id: "status", label: "Status" },
  { id: "date", label: "Date" },
  { id: "token", label: "Token", defaultVisible: false, filterable: true },
  { id: "txpow", label: "TxPoW ID", defaultVisible: false, filterable: true },
  { id: "origin", label: "Origin", defaultVisible: false },
  { id: "actions", label: "Actions", dataColumn: false },
] as const satisfies readonly TableColumnDefinition[];

const DIRECTION_ICON = { in: ArrowDownLeft, out: ArrowUpRight, self: Repeat } as const;

const AMOUNT_TONE: Record<WalletHistoryDirection, string> = {
  in: "text-text-success",
  out: "text-text-primary",
  self: "text-text-secondary",
};

export function WalletHistoryPanel({
  history,
  filters,
  loading,
  error,
  actionsBlocked,
  onFiltersChange,
  onRefresh,
}: {
  history: WalletHistoryPage;
  filters: WalletHistoryFilters;
  loading: boolean;
  error: string | null;
  actionsBlocked: boolean;
  onFiltersChange: (patch: Partial<WalletHistoryFilters>) => void;
  onRefresh: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<WalletHistoryItem | null>(null);
  const [clearPreviousOpen, setClearPreviousOpen] = useState(false);
  const [debugClearingHistory, setDebugClearingHistory] = useState(false);
  const {
    visibility,
    columnOrder,
    filters: columnFilters,
    setVisibility,
    setColumnOrder,
    setFilters: setColumnFilters,
  } = useTableColumnVisibility("wallet-history", WALLET_HISTORY_COLUMNS);
  const visibleColumns = orderedColumns(WALLET_HISTORY_COLUMNS, columnOrder).filter(
    (column) => visibility[column.id],
  );
  const visibleColumnCount = visibleColumns.length;
  const isDev = import.meta.env.DEV;

  const rangeInvalid = isCustomRangeInvalid(filters);
  const filtersActive = Boolean(
    filters.status ||
      filters.direction ||
      filters.datePreset ||
      filters.q.trim() ||
      Object.keys(columnFilters).length > 0,
  );
  const items = applyColumnFilters(history.items, columnFilters, {
    counterparty: (entry) => [entry.counterpartyLabel, entry.counterparty].join(" "),
    token: (entry) => entry.tokenName,
    txpow: (entry) => entry.txpowId,
  });

  function clearFilters() {
    onFiltersChange({ status: "", direction: "", q: "", datePreset: "", customFrom: "", customTo: "" });
    setColumnFilters({});
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
      {!error && history.previousWalletItems > 0 ? (
        <ErrorAlert
          status="warning"
          title="History from a previous wallet"
          className="w-full max-w-none"
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={actionsBlocked}
              onClick={() => setClearPreviousOpen(true)}
            >
              Clear
            </Button>
          }
        >
          {history.previousWalletItems === 1
            ? "1 item was recorded under a wallet this node no longer uses."
            : `${history.previousWalletItems} items were recorded under a wallet this node no longer uses.`}
        </ErrorAlert>
      ) : null}

      {error ? null : (
        <div className="flex w-full min-w-0 flex-wrap items-start gap-3">
          <div className="gap-detail-tight flex w-full min-w-0 flex-col sm:w-40 sm:shrink-0">
            <SelectField
              label="Filter"
              className="w-full min-w-0"
              value={filters.status}
              options={WALLET_HISTORY_STATUS_OPTIONS.map((opt) => ({ ...opt }))}
              onChange={(event) => onFiltersChange({ status: event.target.value as WalletHistoryFilters["status"] })}
            />
          </div>
          <div className="gap-detail-tight flex w-full min-w-0 flex-col sm:w-40 sm:shrink-0">
            <SelectField
              label="Type"
              className="w-full min-w-0"
              value={filters.direction}
              options={WALLET_HISTORY_DIRECTION_OPTIONS.map((opt) => ({ ...opt }))}
              onChange={(event) =>
                onFiltersChange({ direction: event.target.value as WalletHistoryFilters["direction"] })
              }
            />
          </div>
          <div className="gap-detail-tight flex w-full min-w-0 flex-col sm:w-44 sm:shrink-0">
            <SelectField
              label="Date"
              className="w-full min-w-0"
              value={filters.datePreset}
              options={WALLET_HISTORY_DATE_OPTIONS.map((opt) => ({ ...opt }))}
              onChange={(event) =>
                onFiltersChange({ datePreset: event.target.value as WalletHistoryFilters["datePreset"] })
              }
            />
          </div>
          {filters.datePreset === "custom" ? (
            <>
              <InputField
                label="From"
                type="date"
                className="w-full min-w-0 sm:w-44"
                value={filters.customFrom}
                max={filters.customTo || undefined}
                onChange={(event) => onFiltersChange({ customFrom: event.target.value })}
              />
              <InputField
                label="To"
                type="date"
                className="w-full min-w-0 sm:w-44"
                value={filters.customTo}
                min={filters.customFrom || undefined}
                error={rangeInvalid ? "Pick a date on or after From." : undefined}
                onChange={(event) => onFiltersChange({ customTo: event.target.value })}
              />
            </>
          ) : null}
        </div>
      )}

      {error ? null : (
        <TableControls
          utilities={
            <TableColumnVisibilityButton
              tableLabel="Wallet history"
              columns={WALLET_HISTORY_COLUMNS}
              visibility={visibility}
              columnOrder={columnOrder}
              filters={columnFilters}
              onChange={setVisibility}
              onOrderChange={setColumnOrder}
              onFiltersChange={setColumnFilters}
            />
          }
        >
          <div className="[&>div]:mb-0">
            <ListFilterBar
              q={filters.q}
              searchPlaceholder="Contact, address, token, or ID"
              onQueryChange={(q) => onFiltersChange({ q })}
            />
          </div>
        </TableControls>
      )}

      {!error ? (
        <p className="sr-only" aria-live="polite">
          {loading
            ? "Loading wallet history."
            : filtersActive
              ? `${history.total} matching ${history.total === 1 ? "item" : "items"}.`
              : `${history.total} ${history.total === 1 ? "item" : "items"} in history.`}
        </p>
      ) : null}

      {error ? null : (
        <TableColumnFilterSummary
          columns={WALLET_HISTORY_COLUMNS}
          filters={columnFilters}
          onRemove={(columnId) => setColumnFilters({ ...columnFilters, [columnId]: undefined })}
          onClear={() => setColumnFilters({})}
        />
      )}

      {error ? (
        <ErrorContentState
          title="Wallet history isn't available"
          description={describeLoadFailure(error)}
          onRetry={() => void onRefresh()}
        />
      ) : loading ? (
        <LoadingState
          title="Fetching your wallet history"
          description="This should take a few seconds."
        />
      ) : items.length === 0 ? (
        <EmptyContentState
          icon={Inbox}
          title={filtersActive ? "No matching history" : "No wallet activity yet"}
          description={
            filtersActive
              ? "Try another filter or search, or clear filters."
              : "Payments this wallet sends or receives will be added to your history here."
          }
          actionLabel={filtersActive ? "Clear filters" : undefined}
          actionVariant="secondary"
          onAction={filtersActive ? clearFilters : undefined}
        />
      ) : (
        <TableWrap>
          <DataTable aria-label="Wallet history" className={visibleColumnCount > 3 ? "min-w-245" : undefined}>
            <TableHead>
              {visibleColumns.map((column) => (
                <TableHeaderCell
                  key={column.id}
                  sticky={column.id === "actions"}
                  className={column.id === "actions" ? "w-px whitespace-nowrap" : undefined}
                >
                  {column.label}
                </TableHeaderCell>
              ))}
            </TableHead>
            <TableBody>
              {items.map((entry) => (
                <TableRow key={entry.id}>
                  {visibleColumns.map((column) => (
                    <WalletHistoryCell
                      key={column.id}
                      columnId={column.id}
                      entry={entry}
                      onView={() => setSelectedHistoryItem(entry)}
                    />
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      )}

      {error ? null : (
        <ListPaginationFooter
          page={history.page}
          pageSize={filters.pageSize}
          total={history.total}
          totalPages={Math.max(1, history.totalPages)}
          disabled={loading}
          onPageChange={(page) => onFiltersChange({ page })}
          onPageSizeChange={(pageSize) => onFiltersChange({ pageSize })}
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

      {clearPreviousOpen ? (
        <ClearPreviousHistoryModal
          itemCount={history.previousWalletItems}
          onClose={() => setClearPreviousOpen(false)}
          onCleared={async (deleted) => {
            setClearPreviousOpen(false);
            showToast({
              tone: "success",
              title: "Previous wallet history cleared",
              message: `Deleted ${deleted} ${deleted === 1 ? "item" : "items"}.`,
            });
            await onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

function WalletHistoryCell({
  columnId,
  entry,
  onView,
}: {
  columnId: string;
  entry: WalletHistoryItem;
  onView: () => void;
}) {
  if (columnId === "amount") {
    const DirectionIcon = DIRECTION_ICON[entry.direction];
    return (
      <TableCell className="min-w-0">
        <span className="gap-detail-next inline-flex max-w-full min-w-0 items-center">
          <DirectionIcon size={16} className="text-icon-secondary shrink-0" aria-hidden />
          <span className="sr-only">{DIRECTION_LABEL[entry.direction]}</span>
          <TokenGlyph isNative={isNativeTokenId(entry.tokenId)} />
          <span className={cx("type-mono truncate tabular-nums", AMOUNT_TONE[entry.direction])}>
            {signedAmountLabel(entry)}
          </span>
        </span>
      </TableCell>
    );
  }
  if (columnId === "counterparty") {
    const label = counterpartyLabel(entry);
    return (
      <TableCell className="min-w-0">
        {entry.direction !== "self" && entry.counterparty && !entry.counterpartyLabel ? (
          <TruncatedHash value={entry.counterparty} />
        ) : label ? (
          <CopyableTruncatedText value={label} />
        ) : (
          <span className="text-text-secondary">Unknown</span>
        )}
      </TableCell>
    );
  }
  if (columnId === "status") {
    return (
      <TableCell>
        <span className="gap-detail-tight inline-flex flex-wrap items-center">
          <Pill tone={STATUS_TONE[entry.status]} indicator>
            {STATUS_LABEL[entry.status]}
          </Pill>
          {entry.isPreviousWallet ? <Pill>Previous wallet</Pill> : null}
        </span>
      </TableCell>
    );
  }
  if (columnId === "date") {
    return (
      <TableCell className="whitespace-nowrap">
        <time className="type-meta text-text-secondary" dateTime={entry.time}>{formatLocalDateTime(entry.time)}</time>
      </TableCell>
    );
  }
  if (columnId === "token") return <TableCell className="max-w-48 min-w-0"><CopyableTruncatedText value={entry.tokenName} /></TableCell>;
  if (columnId === "txpow") {
    return (
      <TableCell className="max-w-48 min-w-0">
        {entry.txpowId ? <TruncatedHash value={entry.txpowId} /> : <span className="text-text-secondary">None</span>}
      </TableCell>
    );
  }
  if (columnId === "origin") {
    return (
      <TableCell className="whitespace-nowrap">
        {entry.origin ? ORIGIN_LABEL[entry.origin] : <span className="text-text-secondary">None</span>}
      </TableCell>
    );
  }
  if (columnId === "actions") {
    return (
      <TableCell sticky className="w-px whitespace-nowrap">
        <RowActions>
          <TableIconButton
            type="button"
            title="View details"
            aria-label={`View ${DIRECTION_LABEL[entry.direction].toLowerCase()} ${signedAmountLabel(entry)} ${entry.tokenName}`}
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
