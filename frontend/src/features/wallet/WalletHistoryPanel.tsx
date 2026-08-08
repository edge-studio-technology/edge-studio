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
import { ErrorAlert } from "../../components/patterns/ErrorAlert";
import { ListPaginationFooter } from "../../components/patterns/ListPaginationFooter";
import { ListFilterBar } from "../../components/patterns/ListFilterBar";
import { LoadingState } from "../../components/patterns/LoadingState";
import { useToast } from "../../components/ToastProvider";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../lib/paginated";
import { formatMinimaAmount, shortHash } from "../../lib/format";
import { formatLocalDateTime } from "../../lib/time";
import { clearWalletHistoryForDebug } from "./walletApi";
import { HistoryDetailModal } from "./HistoryDetailModal";
import { TokenGlyph } from "./TokenGlyph";
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
  const isDev = import.meta.env.DEV;

  const trimmedHistoryQuery = historyQuery.trim().toLowerCase();
  const filtersActive = Boolean(historyStatus || trimmedHistoryQuery);
  const pagerDisabled = loading || actionsBlocked;
  const showLoading = loading || actionsBlocked;
  const filteredHistory = items.filter((entry) => {
    if (historyStatus && entry.status !== historyStatus) return false;
    if (!trimmedHistoryQuery) return true;
    return (
      entry.toAddress.toLowerCase().includes(trimmedHistoryQuery) ||
      entry.tokenName.toLowerCase().includes(trimmedHistoryQuery) ||
      (entry.txpowId ?? "").toLowerCase().includes(trimmedHistoryQuery)
    );
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
      <div className="[&>div]:mb-0">
        <ListFilterBar
          filter={historyStatus}
          q={historyQuery}
          filterOptions={HISTORY_STATUS_OPTIONS}
          filterLabel="Status"
          searchPlaceholder="Address, token, or txpow ID"
          disabled={pagerDisabled}
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

      {error ? (
        <ErrorAlert title="Couldn't load history" className="w-full max-w-none">
          {error}
        </ErrorAlert>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {showLoading
          ? "Loading send history."
          : filtersActive
            ? `${filteredHistory.length} matching ${filteredHistory.length === 1 ? "send" : "sends"}.`
            : `${filteredHistory.length} ${filteredHistory.length === 1 ? "send" : "sends"} in history.`}
      </p>

      {showLoading ? (
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
        <div className="gap-detail-close flex flex-col">
          <TableWrap>
            <DataTable aria-label="Send history">
              <TableHead>
                <TableHeaderCell>Amount</TableHeaderCell>
                <TableHeaderCell>To</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="whitespace-nowrap">Date</TableHeaderCell>
                <TableHeaderCell className="w-px whitespace-nowrap">Actions</TableHeaderCell>
              </TableHead>
              <TableBody>
                {pagedHistory.map((entry) => {
                  const amountLabel = formatMinimaAmount(entry.amount, 12);
                  const toShort = shortHash(entry.toAddress);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="min-w-0">
                        <span className="gap-detail-next inline-flex max-w-full min-w-0 items-center">
                          <TokenGlyph isNative={isNativeTokenId(entry.tokenId)} />
                          <span className="gap-detail-tight flex min-w-0 flex-col">
                            <span className="type-mono text-text-primary truncate tabular-nums">
                              {amountLabel}
                            </span>
                            {/* <span className="type-meta text-text-secondary truncate">
                            {entry.tokenName}
                          </span> */}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="min-w-0">
                        <TruncatedHash value={entry.toAddress} />
                      </TableCell>
                      <TableCell>
                        <Pill tone={historyStatusTone(entry.status)} indicator>
                          {historyStatusLabel(entry.status)}
                        </Pill>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <time className="type-meta text-text-secondary" dateTime={entry.createdAt}>
                          {formatLocalDateTime(entry.createdAt)}
                        </time>
                      </TableCell>
                      <TableCell className="w-px whitespace-nowrap">
                        <RowActions>
                          <TableIconButton
                            type="button"
                            title="View details"
                            aria-label={`View send of ${amountLabel} ${entry.tokenName} to ${toShort}`}
                            onClick={() => setSelectedHistoryItem(entry)}
                          >
                            <Eye size={16} aria-hidden />
                          </TableIconButton>
                        </RowActions>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </DataTable>
          </TableWrap>

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
        </div>
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
