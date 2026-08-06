import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ErrorAlert } from "../components/patterns/ErrorAlert";
import { ListFilterBar } from "../components/patterns/ListFilterBar";
import { ListPaginationFooter } from "../components/patterns/ListPaginationFooter";
import { Page } from "../components/patterns/Page";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { TabList } from "../components/ui/TabList";
import { useToast } from "../components/ToastProvider";
import { listAutomationRuns } from "../features/automation/automationApi";
import { AutomationRunsTable } from "../features/automation/AutomationRunsTable";
import type { AutomationRun } from "../features/automation/automationTypes";
import { listDataReads } from "../features/data-reads/dataReadsApi";
import { DataReadsHistoryTable } from "../features/data-reads/DataReadsHistoryTable";
import type { DataSourceRead } from "../features/data-reads/dataReadTypes";
import {
  deleteSelected,
  downloadSelected,
  getHistory,
  verifyRecord,
} from "../features/integritas/integritasApi";
import { integritasErrorToast } from "../features/integritas/integritasErrors";
import { IntegritasHistoryTable } from "../features/integritas/IntegritasHistoryTable";
import type {
  IntegritasHistoryPage,
  IntegritasProofRecord,
} from "../features/integritas/integritasTypes";
import { extractVerifyMatch } from "../features/integritas/VerifyResult";
import { useIntegritasHistoryAutoRefresh } from "../features/integritas/useIntegritasHistoryAutoRefresh";
import { DEFAULT_PAGE_SIZE_OPTIONS, emptyPaginatedPage } from "../lib/paginated";
import {
  defaultDiagnosticsListQuery,
  diagnosticsSearchParams,
  isValidDiagnosticsTab,
  parseDiagnosticsListQuery,
  parseDiagnosticsTab,
  PROOF_STATUS_OPTIONS,
  READ_STATUS_OPTIONS,
  WORKFLOW_STATUS_OPTIONS,
  type DiagnosticsListQuery,
  type DiagnosticsTab,
} from "./diagnosticsQuery";

const PAGE_SIZE_OPTIONS = DEFAULT_PAGE_SIZE_OPTIONS.map((size) => ({
  value: String(size),
  label: String(size),
}));

const TAB_DESCRIPTION: Record<DiagnosticsTab, string> = {
  proofs: "Stored Integritas proof requests and their status.",
  reads: "Data-source read logs from polls, webhooks, and device events.",
  "workflow-runs": "Recent automated and manual workflow runs across all workflows.",
};

function applyPaginatedPage<T extends { totalPages: number }>(
  response: T,
  currentPage: number,
  setPage: (page: T) => void,
  clampPage: (page: number) => void,
) {
  if (response.totalPages > 0 && currentPage > response.totalPages) {
    clampPage(response.totalPages);
    return;
  }
  setPage(response);
}

function emptyProofsPage(): IntegritasHistoryPage {
  return { ...emptyPaginatedPage<IntegritasProofRecord>(), pendingTotal: 0 };
}

export function DiagnosticsPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseDiagnosticsTab(searchParams);
  const listQuery = useMemo(
    () => parseDiagnosticsListQuery(searchParams, activeTab),
    [searchParams, activeTab],
  );
  const [proofsPage, setProofsPage] = useState(emptyProofsPage);
  const [readsPage, setReadsPage] = useState(emptyPaginatedPage<DataSourceRead>);
  const [workflowRunsPage, setWorkflowRunsPage] = useState(emptyPaginatedPage<AutomationRun>);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<"download" | "delete" | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const busy = bulkBusy !== null;

  const updateListQuery = useCallback(
    (patch: Partial<DiagnosticsListQuery>) => {
      const current = parseDiagnosticsListQuery(searchParams, activeTab);
      const next = { ...current, ...patch };
      if ("status" in patch || "q" in patch || "pageSize" in patch) {
        next.page = 1;
      }
      setSearchParams(diagnosticsSearchParams({ tab: activeTab, query: next }), { replace: true });
    },
    [activeTab, searchParams, setSearchParams],
  );

  const clampPage = useCallback(
    (page: number) => {
      updateListQuery({ page });
    },
    [updateListQuery],
  );

  useEffect(() => {
    const needsExplicitPager =
      !searchParams.has("tab") || !searchParams.has("page") || !searchParams.has("pageSize");
    if (!needsExplicitPager) return;

    setSearchParams(diagnosticsSearchParams({ tab: activeTab, query: listQuery }), {
      replace: true,
    });
  }, [activeTab, listQuery, searchParams, setSearchParams]);

  useEffect(() => {
    const rawTab = searchParams.get("tab");
    if (rawTab !== null && !isValidDiagnosticsTab(rawTab)) {
      setSearchParams(
        diagnosticsSearchParams({
          tab: "proofs",
          query: parseDiagnosticsListQuery(searchParams, "proofs"),
        }),
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, listQuery.page, listQuery.pageSize, listQuery.status, listQuery.q]);

  const loadActiveTab = useCallback(
    async (query: DiagnosticsListQuery, isCancelled: () => boolean = () => false) => {
      if (activeTab === "proofs") {
        const response = await getHistory(query);
        if (isCancelled()) return;
        applyPaginatedPage(response, query.page, setProofsPage, clampPage);
        return;
      }

      if (activeTab === "reads") {
        const response = await listDataReads(query);
        if (isCancelled()) return;
        applyPaginatedPage(response, query.page, setReadsPage, clampPage);
        return;
      }

      const response = await listAutomationRuns(query);
      if (isCancelled()) return;
      applyPaginatedPage(response, query.page, setWorkflowRunsPage, clampPage);
    },
    [activeTab, clampPage],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        await loadActiveTab(listQuery, () => cancelled);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load diagnostics history.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [listQuery, loadActiveTab]);

  useIntegritasHistoryAutoRefresh(proofsPage.items, undefined, {
    enabled: activeTab === "proofs",
    query: listQuery,
    pendingTotal: proofsPage.pendingTotal,
    onPage: (response) => {
      applyPaginatedPage(response, listQuery.page, setProofsPage, clampPage);
    },
  });

  function selectTab(tab: DiagnosticsTab) {
    setSearchParams(diagnosticsSearchParams({ tab, query: defaultDiagnosticsListQuery() }), {
      replace: true,
    });
  }

  async function run(
    action: () => Promise<unknown>,
    options: {
      refresh?: boolean;
      successTitle?: string;
      successMessage?: string;
      busyAs: "download" | "delete";
    },
  ) {
    setBulkBusy(options.busyAs);
    try {
      await action();
      if (options.refresh !== false) {
        applyPaginatedPage(await getHistory(listQuery), listQuery.page, setProofsPage, clampPage);
      }
      if (options.successTitle) {
        showToast({
          tone: "success",
          title: options.successTitle,
          message: options.successMessage,
          timeoutMs: 4000,
        });
      }
    } catch (err) {
      const { title, message } = integritasErrorToast(err);
      showToast({ tone: "error", title, message, timeoutMs: 9000 });
    } finally {
      setBulkBusy(null);
    }
  }

  async function handleVerify(record: IntegritasProofRecord) {
    setVerifyingId(record.id);
    try {
      const result = await verifyRecord(record.id);
      applyPaginatedPage(await getHistory(listQuery), listQuery.page, setProofsPage, clampPage);
      const isFullMatch = extractVerifyMatch(result.response) === "full_match";
      showToast({
        tone: isFullMatch ? "success" : "warning",
        title: isFullMatch ? "Full match" : "No match",
        message: isFullMatch
          ? "The proof matches the original data."
          : "The proof does not match.",
        timeoutMs: 6000,
      });
    } catch (err) {
      const { title, message } = integritasErrorToast(err);
      showToast({ tone: "error", title, message, timeoutMs: 9000 });
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleDownload(record: IntegritasProofRecord) {
    try {
      await downloadSelected([record.id]);
    } catch (err) {
      const { title, message } = integritasErrorToast(err);
      showToast({ tone: "error", title, message, timeoutMs: 9000 });
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await loadActiveTab(listQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh diagnostics history.");
    } finally {
      setRefreshing(false);
    }
  }

  const activePager =
    activeTab === "proofs" ? proofsPage : activeTab === "reads" ? readsPage : workflowRunsPage;
  const statusOptions =
    activeTab === "proofs"
      ? PROOF_STATUS_OPTIONS
      : activeTab === "reads"
        ? READ_STATUS_OPTIONS
        : WORKFLOW_STATUS_OPTIONS;
  const listFiltered = Boolean(listQuery.status || listQuery.q);

  return (
    <Page
      title="Operational history"
      desc="Inspect stored proof requests and data-source read logs from one diagnostics workspace."
    >
      <Card className="gap-detail-close flex w-full flex-col">
        <TabList
          label="Diagnostics history"
          value={activeTab}
          options={[
            { value: "proofs", label: "Proof history" },
            { value: "reads", label: "Read history" },
            { value: "workflow-runs", label: "Workflow logs" },
          ]}
          onChange={selectTab}
        />

        <p className="type-body text-text-secondary m-0">{TAB_DESCRIPTION[activeTab]}</p>

        <div className="gap-detail-close flex flex-wrap items-end justify-between">
          <div className="min-w-0 flex-1 [&>div]:mb-0">
            <ListFilterBar
              filter={listQuery.status}
              q={listQuery.q}
              filterOptions={statusOptions}
              filterLabel="Status"
              searchPlaceholder="Hash, UID, or source name"
              disabled={refreshing}
              onFilterChange={(status) => updateListQuery({ status })}
              onQueryChange={(q) => updateListQuery({ q })}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {error ? (
          <ErrorAlert title="Couldn't load diagnostics" className="w-full max-w-none">
            {error}
          </ErrorAlert>
        ) : null}

        {activeTab === "proofs" ? (
          <IntegritasHistoryTable
            records={proofsPage.items}
            selectedIds={selectedIds}
            filtered={listFiltered}
            busy={busy}
            bulkBusy={bulkBusy}
            verifyingId={verifyingId}
            onToggle={(id) => {
              setSelectedIds((ids) =>
                ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
              );
            }}
            onToggleAllVisible={() => {
              const pageIds = proofsPage.items.map((record) => record.id);
              const allSelected =
                pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
              setSelectedIds((ids) =>
                allSelected
                  ? ids.filter((id) => !pageIds.includes(id))
                  : [...new Set([...ids, ...pageIds])],
              );
            }}
            onClearSelection={() => setSelectedIds([])}
            onVerify={(record) => {
              void handleVerify(record);
            }}
            onDownload={(record) => {
              void handleDownload(record);
            }}
            onDeleteSelected={() =>
              void run(
                async () => {
                  const count = selectedIds.length;
                  await deleteSelected(selectedIds);
                  setSelectedIds([]);
                  return count;
                },
                {
                  busyAs: "delete",
                  successTitle: "Proofs deleted",
                  successMessage:
                    selectedIds.length === 1
                      ? "1 proof record was deleted."
                      : `${selectedIds.length} proof records were deleted.`,
                },
              )
            }
            onDownloadSelected={() =>
              void run(() => downloadSelected(selectedIds), {
                refresh: false,
                busyAs: "download",
                successTitle: "Download started",
                successMessage:
                  selectedIds.length === 1
                    ? "1 proof file is downloading."
                    : `${selectedIds.length} proofs are downloading.`,
              })
            }
          />
        ) : activeTab === "reads" ? (
          <DataReadsHistoryTable items={readsPage.items} filtered={listFiltered} />
        ) : (
          <AutomationRunsTable runs={workflowRunsPage.items} filtered={listFiltered} />
        )}

        <ListPaginationFooter
          page={listQuery.page}
          pageSize={listQuery.pageSize}
          total={activePager.total}
          totalPages={Math.max(1, activePager.totalPages)}
          disabled={refreshing}
          onPageChange={(page) => updateListQuery({ page })}
          onPageSizeChange={(pageSize) => updateListQuery({ pageSize })}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      </Card>
    </Page>
  );
}
