import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "../../components/Button";
import {
  DataTable,
  RowActions,
  TableIconButton,
  TableWrap,
  tableCellClass,
  tableHeaderCellClass,
  tableHeadRowClass,
  tableRowClass,
} from "../../components/DataTable";
import { ListPagerFilterBar } from "../../components/ListPagerFilterBar";
import { TablePager } from "../../components/TablePager";
import { ErrorText, MutedText } from "../../components/Text";
import { useToast } from "../../components/ToastProvider";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../lib/paginated";
import { clearWalletHistoryForDebug } from "./walletApi";
import { HistoryDetailModal } from "./HistoryDetailModal";
import { TokenGlyph } from "./TokenGlyph";
import type { WalletSendHistoryItem } from "./walletTypes";
import { isNativeTokenId, shortAddress } from "./walletUtils";

const HISTORY_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "failed", label: "Failed" },
] as const;

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
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="type-title">History</p>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">Sent</p>
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl px-3 py-2 text-xs"
            onClick={() => {
              void onRefresh();
            }}
            disabled={loading || actionsBlocked}
          >
            Refresh
          </Button>
        </div>
      </div>
      <ListPagerFilterBar
        page={historyCurrentPage}
        pageSize={historyPageSize}
        total={filteredHistory.length}
        totalPages={historyTotalPages}
        status={historyStatus}
        q={historyQuery}
        statusOptions={HISTORY_STATUS_OPTIONS}
        statusLabel="Status"
        searchPlaceholder="Address, token, or txpow ID"
        disabled={loading || actionsBlocked}
        onPageChange={setHistoryPage}
        onPageSizeChange={(size) => {
          setHistoryPageSize(size);
          setHistoryPage(1);
        }}
        onStatusChange={(status) => {
          setHistoryStatus(status);
          setHistoryPage(1);
        }}
        onQueryChange={(q) => {
          setHistoryQuery(q);
          setHistoryPage(1);
        }}
      />
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : (
        <TableWrap>
          <DataTable>
            <thead>
              <tr className={tableHeadRowClass}>
                <th className={tableHeaderCellClass}>Amount</th>
                <th className={tableHeaderCellClass}>To</th>
                <th className={tableHeaderCellClass}>Status</th>
                <th className={tableHeaderCellClass}>Date</th>
                <th className={`${tableHeaderCellClass} w-px whitespace-nowrap`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading || actionsBlocked ? (
                <tr className={tableRowClass}>
                  <td colSpan={5} className="p-0">
                    <div className="flex justify-center py-10">
                      <Loader2 className="size-10 animate-spin text-slate-400" aria-hidden="true" />
                    </div>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr className={tableRowClass}>
                  <td colSpan={5} className="p-0">
                    <div className="p-margin-tight py-pad-relaxed">
                      <MutedText>
                        {historyStatus || trimmedHistoryQuery
                          ? "No matching history."
                          : "No send activity yet."}
                      </MutedText>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedHistory.map((entry) => (
                  <tr key={entry.id} className={tableRowClass}>
                    <td className={tableCellClass}>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                        <TokenGlyph isNative={isNativeTokenId(entry.tokenId)} />
                        {entry.amount} {entry.tokenName}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      <code className="font-mono text-xs text-slate-500">
                        {shortAddress(entry.toAddress)}
                      </code>
                    </td>
                    <td className={tableCellClass}>
                      <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        {entry.status}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      <span className="text-xs text-slate-500">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </td>
                    <td className={`${tableCellClass} w-px whitespace-nowrap`}>
                      <RowActions>
                        <TableIconButton
                          type="button"
                          title="View details"
                          aria-label="View history item"
                          onClick={() => setSelectedHistoryItem(entry)}
                        >
                          <Eye size={16} />
                        </TableIconButton>
                      </RowActions>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
        </TableWrap>
      )}
      <div className="mt-3">
        <TablePager
          page={historyCurrentPage}
          pageSize={historyPageSize}
          total={filteredHistory.length}
          totalPages={historyTotalPages}
          disabled={loading || actionsBlocked}
          onPageChange={setHistoryPage}
          onPageSizeChange={(size) => {
            setHistoryPageSize(size);
            setHistoryPage(1);
          }}
        />
      </div>
      {isDev && (
        <div className="mt-4 flex justify-start">
          <Button
            type="button"
            variant="secondary"
            onClick={handleDebugClearWalletHistory}
            disabled={debugClearingHistory}
            title="Dev-only: clears wallet_send_history table"
          >
            {debugClearingHistory ? "Clearing…" : "Debug: clear history"}
          </Button>
        </div>
      )}
      {selectedHistoryItem && (
        <HistoryDetailModal
          item={selectedHistoryItem}
          onClose={() => setSelectedHistoryItem(null)}
        />
      )}
    </>
  );
}
