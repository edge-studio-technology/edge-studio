import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { ErrorAlert } from "../components/patterns/ErrorAlert";
import { ListFilterBar } from "../components/patterns/ListFilterBar";
import { ListPaginationFooter } from "../components/patterns/ListPaginationFooter";
import { Page } from "../components/patterns/Page";
import {
  applyColumnFilters,
  TableColumnFilterSummary,
  TableColumnVisibilityButton,
} from "../components/patterns/TableColumnVisibility";
import { TableControls } from "../components/patterns/TableControls";
import { Button, LinkButton } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { TabList } from "../components/ui/TabList";
import { useToast } from "../components/ToastProvider";
import { listAutomationRuns } from "../features/automation/automationApi";
import {
  AutomationRunsTable,
  WORKFLOW_RUN_COLUMNS,
} from "../features/automation/AutomationRunsTable";
import type { AutomationRun } from "../features/automation/automationTypes";
import { listDataReads } from "../features/data-reads/dataReadsApi";
import { DataReadsHistoryTable, READ_COLUMNS } from "../features/data-reads/DataReadsHistoryTable";
import type { DataSourceRead } from "../features/data-reads/dataReadTypes";
import {
  deleteSelected,
  downloadProofZip,
  downloadSelected,
  getHistory,
  verifyRecord,
  verificationReportUrl,
} from "../features/integritas/integritasApi";
import { integritasErrorToast } from "../features/integritas/integritasErrors";
import {
  IntegritasHistoryTable,
  PROOF_COLUMNS,
} from "../features/integritas/IntegritasHistoryTable";
import type {
  IntegritasHistoryPage,
  IntegritasProofRecord,
} from "../features/integritas/integritasTypes";
import { extractVerifyMatch } from "../features/integritas/VerifyResult";
import { useIntegritasHistoryAutoRefresh } from "../features/integritas/useIntegritasHistoryAutoRefresh";
import { useTableColumnVisibility } from "../features/preferences/useTableColumnVisibility";
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

const TAB_SEARCH_PLACEHOLDER: Record<DiagnosticsTab, string> = {
  proofs: "UID, hash, or file name",
  reads: "Source, hash, or proof ID",
  "workflow-runs": "Workflow name or trigger",
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
  const [tabLoading, setTabLoading] = useState(true);
  const proofColumns = useTableColumnVisibility("diagnostics-proofs", PROOF_COLUMNS);
  const readColumns = useTableColumnVisibility("diagnostics-reads", READ_COLUMNS);
  const workflowRunColumns = useTableColumnVisibility("workflow-runs", WORKFLOW_RUN_COLUMNS);
  const busy = bulkBusy !== null;
  const filteredProofItems = applyColumnFilters(proofsPage.items, proofColumns.filters, {
    uid: (record) => record.proof_uid,
    hash: (record) => record.hash,
    fileName: (record) => record.file_name,
  });
  const filteredReadItems = applyColumnFilters(readsPage.items, readColumns.filters, {
    source: (item) => [item.sourceName, item.sourceUrl].join(" "),
    hash: (item) => item.hash,
    proof: (item) => item.integritasProofId,
  });
  const filteredWorkflowRuns = applyColumnFilters(workflowRunsPage.items, workflowRunColumns.filters, {
    workflow: (run) => run.workflowName,
    trigger: (run) => run.triggerType,
    triggerSource: (run) => run.triggerSourceId,
    error: (run) => run.error,
    runId: (run) => run.id,
  });

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
      setTabLoading(true);
      try {
        await loadActiveTab(listQuery, () => cancelled);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load diagnostics history.");
        }
      } finally {
        if (!cancelled) setTabLoading(false);
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
      const reportUrl = result.verificationReportUrl;
      showToast({
        tone: isFullMatch ? "success" : "warning",
        title: isFullMatch ? "Full match" : "No match",
        message: reportUrl
          ? `${isFullMatch ? "The proof matches the original data." : "The proof does not match."} Verification report saved on this Pi.`
          : isFullMatch
            ? "The proof matches the original data."
            : "The proof does not match.",
        action: reportUrl ? (
          <LinkButton size="sm" href={reportUrl} target="_blank" rel="noopener noreferrer">
            Open report
          </LinkButton>
        ) : undefined,
        timeoutMs: reportUrl ? 10000 : 6000,
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

  async function handleDownloadZip(record: IntegritasProofRecord) {
    try {
      await downloadProofZip(record.id);
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
  const columnControl =
    activeTab === "proofs" ? (
      <TableColumnVisibilityButton
        tableLabel="Proof history"
        columns={PROOF_COLUMNS}
        visibility={proofColumns.visibility}
        columnOrder={proofColumns.columnOrder}
        filters={proofColumns.filters}
        onChange={proofColumns.setVisibility}
        onOrderChange={proofColumns.setColumnOrder}
        onFiltersChange={proofColumns.setFilters}
      />
    ) : activeTab === "reads" ? (
      <TableColumnVisibilityButton
        tableLabel="Read history"
        columns={READ_COLUMNS}
        visibility={readColumns.visibility}
        columnOrder={readColumns.columnOrder}
        filters={readColumns.filters}
        onChange={readColumns.setVisibility}
        onOrderChange={readColumns.setColumnOrder}
        onFiltersChange={readColumns.setFilters}
      />
    ) : (
      <TableColumnVisibilityButton
        tableLabel="Workflow logs"
        columns={WORKFLOW_RUN_COLUMNS}
        visibility={workflowRunColumns.visibility}
        columnOrder={workflowRunColumns.columnOrder}
        filters={workflowRunColumns.filters}
        onChange={workflowRunColumns.setVisibility}
        onOrderChange={workflowRunColumns.setColumnOrder}
        onFiltersChange={workflowRunColumns.setFilters}
      />
    );

  return (
    <Page
      title="Diagnostics"
      desc="Inspect stored proof requests, data-source read logs, and workflow runs from one diagnostics workspace."
    >
      <Card className="gap-detail-close flex w-full flex-col">
        <TabList
          label="Diagnostics"
          value={activeTab}
          options={[
            // { value: "proofs", label: "Proof history" },
            // { value: "reads", label: "Read history" },
            // { value: "workflow-runs", label: "Workflow logs" },
            { value: "proofs", label: "Integritas" },
            { value: "reads", label: "Devices" },
            { value: "workflow-runs", label: "Workflow Logs" },
          ]}
          onChange={selectTab}
        />

        <p className="type-body text-text-secondary m-0">{TAB_DESCRIPTION[activeTab]}</p>

        <TableControls utilities={columnControl}>
          <ListFilterBar
            filter={listQuery.status}
            q={listQuery.q}
            filterOptions={statusOptions}
            searchPlaceholder={TAB_SEARCH_PLACEHOLDER[activeTab]}
            disabled={refreshing || tabLoading || (!listFiltered && activePager.items.length === 0)}
            onFilterChange={(status) => updateListQuery({ status })}
            onQueryChange={(q) => updateListQuery({ q })}
            actions={
              <Button
                type="button"
                iconStart={<RefreshCw aria-hidden />}
                onClick={() => {
                  void handleRefresh();
                }}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </Button>
            }
          />
        </TableControls>

        {error ? (
          <ErrorAlert title="Couldn't load diagnostics" className="w-full max-w-none">
            {error}
          </ErrorAlert>
        ) : null}

        {activeTab === "proofs" ? (
          <TableColumnFilterSummary
            columns={PROOF_COLUMNS}
            filters={proofColumns.filters}
            onRemove={(columnId) => proofColumns.setFilters({ ...proofColumns.filters, [columnId]: undefined })}
            onClear={() => proofColumns.setFilters({})}
          />
        ) : activeTab === "reads" ? (
          <TableColumnFilterSummary
            columns={READ_COLUMNS}
            filters={readColumns.filters}
            onRemove={(columnId) => readColumns.setFilters({ ...readColumns.filters, [columnId]: undefined })}
            onClear={() => readColumns.setFilters({})}
          />
        ) : (
          <TableColumnFilterSummary
            columns={WORKFLOW_RUN_COLUMNS}
            filters={workflowRunColumns.filters}
            onRemove={(columnId) => workflowRunColumns.setFilters({ ...workflowRunColumns.filters, [columnId]: undefined })}
            onClear={() => workflowRunColumns.setFilters({})}
          />
        )}

        {activeTab === "proofs" ? (
          <IntegritasHistoryTable
            records={filteredProofItems}
            selectedIds={selectedIds}
            filtered={listFiltered}
            loading={tabLoading}
            columnVisibility={proofColumns.visibility}
            columnOrder={proofColumns.columnOrder}
            columnFilters={proofColumns.filters}
            onColumnVisibilityChange={proofColumns.setVisibility}
            onColumnOrderChange={proofColumns.setColumnOrder}
            onColumnFiltersChange={proofColumns.setFilters}
            showColumnControls={false}
            onClearFilters={() => updateListQuery({ status: "", q: "" })}
            busy={busy}
            bulkBusy={bulkBusy}
            verifyingId={verifyingId}
            onToggle={(id) => {
              setSelectedIds((ids) =>
                ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
              );
            }}
            onToggleAllVisible={() => {
              const pageIds = filteredProofItems.map((record) => record.id);
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
            onDownloadZip={(record) => {
              void handleDownloadZip(record);
            }}
            onOpenVerificationReport={(record) => {
              const reportUrl = verificationReportUrl(record);
              if (reportUrl) window.open(reportUrl, "_blank", "noopener,noreferrer");
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
          <DataReadsHistoryTable
            items={filteredReadItems}
            filtered={listFiltered}
            loading={tabLoading}
            columnVisibility={readColumns.visibility}
            columnOrder={readColumns.columnOrder}
            columnFilters={readColumns.filters}
            onColumnVisibilityChange={readColumns.setVisibility}
            onColumnOrderChange={readColumns.setColumnOrder}
            onColumnFiltersChange={readColumns.setFilters}
            showColumnControls={false}
            onClearFilters={() => updateListQuery({ status: "", q: "" })}
          />
        ) : (
          <AutomationRunsTable
            runs={filteredWorkflowRuns}
            filtered={listFiltered}
            loading={tabLoading}
            columnVisibility={workflowRunColumns.visibility}
            columnOrder={workflowRunColumns.columnOrder}
            columnFilters={workflowRunColumns.filters}
            onColumnVisibilityChange={workflowRunColumns.setVisibility}
            onColumnOrderChange={workflowRunColumns.setColumnOrder}
            onColumnFiltersChange={workflowRunColumns.setFilters}
            showColumnControls={false}
            onClearFilters={() => updateListQuery({ status: "", q: "" })}
          />
        )}

        <ListPaginationFooter
          page={listQuery.page}
          pageSize={listQuery.pageSize}
          total={activePager.total}
          totalPages={Math.max(1, activePager.totalPages)}
          disabled={refreshing || tabLoading}
          onPageChange={(page) => updateListQuery({ page })}
          onPageSizeChange={(pageSize) => updateListQuery({ pageSize })}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      </Card>
    </Page>
  );
}
