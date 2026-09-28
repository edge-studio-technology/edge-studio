import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, BookOpen } from "lucide-react";
import { Button, LinkButton } from "../components/Button";
import { DeleteConfirmModal, DeleteProgressModal } from "../components/patterns/DeleteConfirmModal";
import { ErrorAlert } from "../components/ErrorAlert";
import { ErrorContentState } from "../components/patterns/ErrorContentState";
import { describeLoadFailure } from "../lib/errors";
import { Page } from "../components/Page";
import { useToast } from "../components/ToastProvider";
import {
  addAutomationBlock,
  createAutomationWorkflow,
  deleteAutomationBlock,
  deleteAutomationInboxItem,
  deleteAutomationWorkflow,
  duplicateAutomationWorkflow,
  getAutomationWorkflowValidation,
  listAutomationInbox,
  listAutomationWorkflowRuns,
  listAutomationWorkflows,
  reorderAutomationBlocks,
  replaceAutomationStartBlock,
  runAutomationWorkflow,
  updateAutomationBlock,
  updateAutomationInboxItem,
  updateAutomationWorkflow,
} from "../features/automation/automationApi";
import {
  defaultCreateWorkflowName,
  workflowPrimarySourceId,
} from "../features/automation/workflow/workflowHelpers";
import { AutomationInboxTable } from "../features/automation/AutomationInboxTable";
import { AutomationWorkflowsList } from "../features/automation/AutomationWorkflowsList";
import { CreateWorkflowWorkspace } from "../features/automation/workflow/CreateWorkflowWorkspace";
import {
  WorkflowLoadingOverlay,
  WorkflowWorkspace,
} from "../features/automation/workflow/WorkflowWorkspace";
import { WorkflowCanvas } from "../features/automation/workflow/canvas";
import {
  WorkflowRailHeader,
  WorkflowRailPanel,
} from "../features/automation/workflow/chrome/WorkflowRail";
import {
  WatchRunControls,
  WatchRunHistory,
  WatchRuntimeOverview,
} from "../features/automation/workflow/WorkflowWatchUi";
import { WorkflowWorkspaceShell } from "../features/automation/workflow/chrome/WorkflowWorkspaceShell";
import type {
  AutomationBlock,
  AutomationBlockType,
  AutomationInboxItem,
  AutomationRun,
  AutomationValidationResult,
  AutomationWorkflow,
} from "../features/automation/automationTypes";
import {
  createAddressBookEntry,
  listAddressBookEntries,
} from "../features/address-book/addressBookApi";
import type {
  AddressBookEntry,
  CreateAddressBookEntryInput,
} from "../features/address-book/addressBookTypes";
import { listDataSources } from "../features/data-sources/dataSourcesApi";
import type { DataSource } from "../features/data-sources/dataSourceTypes";
import { getWalletStatus } from "../features/wallet/walletApi";
import type { WalletStatus } from "../features/wallet/walletTypes";

type AutomationPageFlow =
  | { mode: "list" }
  | { mode: "build" }
  | { mode: "edit" | "watch"; workflowId: string; runId?: string };

function automationFlowFromRoute(
  pathname: string,
  params: Readonly<Record<string, string | undefined>>,
): AutomationPageFlow {
  if (!params.workflowId && pathname.endsWith("/workflows/new")) return { mode: "build" };
  if (params.workflowId && pathname.includes("/edit"))
    return { mode: "edit", workflowId: params.workflowId };
  if (params.workflowId && pathname.includes("/watch"))
    return { mode: "watch", workflowId: params.workflowId, runId: params.runId };
  return { mode: "list" };
}

function sortAddressBook(entries: AddressBookEntry[]): AddressBookEntry[] {
  return [...entries].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

const LOADING_DATE = "2026-01-01T00:00:00.000Z";

const loadingSource: DataSource = {
  id: "loading-source",
  createdAt: LOADING_DATE,
  updatedAt: LOADING_DATE,
  name: "Loading data source",
  type: "device-system-data",
  status: "unknown",
  description: null,
  config: {},
  lastReadAt: null,
  lastError: null,
  lastPreview: null,
  lastHash: null,
};

const loadingWorkflow: AutomationWorkflow = {
  id: "loading-workflow",
  createdAt: LOADING_DATE,
  updatedAt: LOADING_DATE,
  name: "Loading workflow",
  enabled: true,
  archived: false,
  lastRunAt: LOADING_DATE,
  nextRunAt: null,
  lastHash: null,
  lastProofId: null,
  lastError: null,
  blocks: [
    {
      id: "loading-start",
      workflowId: "loading-workflow",
      createdAt: LOADING_DATE,
      updatedAt: LOADING_DATE,
      type: "manual_start",
      enabled: true,
      order: 0,
      parentBlockId: null,
      config: {},
      lastRunAt: LOADING_DATE,
      lastError: null,
    },
    {
      id: "loading-fetch",
      workflowId: "loading-workflow",
      createdAt: LOADING_DATE,
      updatedAt: LOADING_DATE,
      type: "fetch_data_source",
      enabled: true,
      order: 1,
      parentBlockId: null,
      config: { sourceId: loadingSource.id },
      lastRunAt: LOADING_DATE,
      lastError: null,
    },
    {
      id: "loading-preview",
      workflowId: "loading-workflow",
      createdAt: LOADING_DATE,
      updatedAt: LOADING_DATE,
      type: "show_preview",
      enabled: true,
      order: 2,
      parentBlockId: null,
      config: {
        title: "Loading preview",
        previewFormat: "json",
        contentMode: "latest_data",
      },
      lastRunAt: LOADING_DATE,
      lastError: null,
    },
  ],
};

const loadingRun: AutomationRun = {
  id: "loading-run",
  workflowId: loadingWorkflow.id,
  workflowName: loadingWorkflow.name,
  startedAt: LOADING_DATE,
  finishedAt: LOADING_DATE,
  status: "success",
  triggerType: "manual",
  triggerSourceId: null,
  triggerPayload: null,
  durationMs: 301,
  blockCount: 3,
  error: null,
  blocks: [
    {
      id: "loading-run-start",
      runId: "loading-run",
      workflowId: loadingWorkflow.id,
      blockId: "loading-start",
      order: 0,
      blockType: "manual_start",
      blockLabel: "Manual run",
      startedAt: LOADING_DATE,
      finishedAt: LOADING_DATE,
      status: "success",
      durationMs: 9,
      input: null,
      output: null,
      error: null,
    },
    {
      id: "loading-run-fetch",
      runId: "loading-run",
      workflowId: loadingWorkflow.id,
      blockId: "loading-fetch",
      order: 1,
      blockType: "fetch_data_source",
      blockLabel: "Fetch data source",
      startedAt: LOADING_DATE,
      finishedAt: LOADING_DATE,
      status: "success",
      durationMs: 208,
      input: null,
      output: null,
      error: null,
    },
    {
      id: "loading-run-preview",
      runId: "loading-run",
      workflowId: loadingWorkflow.id,
      blockId: "loading-preview",
      order: 2,
      blockType: "show_preview",
      blockLabel: "Show preview",
      startedAt: LOADING_DATE,
      finishedAt: LOADING_DATE,
      status: "success",
      durationMs: 75,
      input: null,
      output: null,
      error: null,
    },
  ],
};

function WorkflowInitialLoadingShell({
  mode,
  onBack,
}: {
  mode: "edit" | "watch";
  onBack: () => void;
}) {
  return (
    <WorkflowWorkspaceShell
      breadcrumbLabel={mode === "watch" ? "Watch workflow" : "Edit workflow"}
      railToggleLabel={mode === "watch" ? "Watch controls" : "Toolkit"}
      nameControl={
        <div aria-label="Workflow name loading">
          <h1 className="type-title text-text-primary m-0 wrap-anywhere">
            <span className="bg-surface-secondary inline-block h-5 w-56 rounded-full align-middle" />
          </h1>
          <span className="sr-only">Loading workflow name</span>
        </div>
      }
      actions={
        <Button type="button" variant="ghost" iconStart={<ArrowLeftIcon />} onClick={onBack}>
          Back
        </Button>
      }
      canvas={<WorkflowLoadingCanvas />}
      rail={<WorkflowRailLoadingSkeleton mode={mode} />}
      bottom={mode === "watch" ? <WorkflowHistoryLoadingSkeleton /> : undefined}
      overlay={<WorkflowLoadingOverlay label="Fetching workflow..." />}
    />
  );
}

function WorkflowLoadingCanvas() {
  return (
    <div className="opacity-60">
      <WorkflowCanvas
        mode="watch"
        blocks={loadingWorkflow.blocks.map((block) => ({
          id: block.id,
          type: block.type,
          config: block.config,
          enabled: block.enabled,
          lastRunAt: block.lastRunAt,
          lastError: block.lastError,
        }))}
        sources={[loadingSource]}
        addressBook={[]}
        selectedBlockId=""
        bottomOverlay
        runtimeByBlockId={Object.fromEntries(
          loadingRun.blocks
            .filter((block) => block.blockId)
            .map((block) => [
              block.blockId!,
              { status: block.status, durationMs: block.durationMs, error: block.error },
            ]),
        )}
        onSelectBlock={() => undefined}
        onMoveBlock={() => undefined}
        onRemoveBlock={() => undefined}
      />
    </div>
  );
}

function WorkflowRailLoadingSkeleton({ mode }: { mode: "edit" | "watch" }) {
  if (mode === "watch") {
    return (
      <div className="gap-detail-close grid opacity-60">
        <WatchRuntimeOverview
          workflow={loadingWorkflow}
          selectedRun={loadingRun}
          latestRun={loadingRun}
          followLiveRuns
          hasValidationErrors={false}
          onFollowLiveRunsChange={() => undefined}
        />
        <WatchRunControls
          workflow={loadingWorkflow}
          busy
          hasValidationErrors={false}
          payloadText="{}"
          payloadError={null}
          onPayloadTextChange={() => undefined}
          onPayloadError={() => undefined}
          onResetPayload={() => undefined}
          onRunNow={() => undefined}
          onRunWithPayload={() => undefined}
        />
      </div>
    );
  }

  return (
    <div className="gap-detail-close grid opacity-60">
      {["Validation", "Toolkit"].map((title) => (
        <WorkflowRailPanel key={title}>
          <WorkflowRailHeader title={title} description={<span className="bg-surface-secondary inline-block h-4 w-56 max-w-full rounded-full" />} />
          <span className="bg-surface-secondary h-4 w-40 max-w-full rounded-full" />
        </WorkflowRailPanel>
      ))}
    </div>
  );
}

function WorkflowHistoryLoadingSkeleton() {
  return (
    <div className="opacity-60">
      <WatchRunHistory
        runs={[loadingRun]}
        selectedRunId={loadingRun.id}
        onSelectRun={() => undefined}
      />
    </div>
  );
}

export function AutomationPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const routeWorkflowId = params.workflowId;
  const routeRunId = params.runId;
  const [sources, setSources] = useState<DataSource[]>([]);
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [inboxItems, setInboxItems] = useState<AutomationInboxItem[]>([]);
  const [name, setName] = useState("");
  const [createInitialName, setCreateInitialName] = useState("");
  const flow = useMemo(
    () =>
      automationFlowFromRoute(location.pathname, {
        workflowId: routeWorkflowId,
        runId: routeRunId,
      }),
    [location.pathname, routeRunId, routeWorkflowId],
  );
  const flowWorkflowId = "workflowId" in flow ? flow.workflowId : null;
  const flowRunId = flow.mode === "watch" ? flow.runId : undefined;
  const [workspaceRuns, setWorkspaceRuns] = useState<AutomationRun[]>([]);
  const [workspaceValidation, setWorkspaceValidation] = useState<AutomationValidationResult | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState<AutomationWorkflow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationWorkflow | null>(null);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [deletingInboxItem, setDeletingInboxItem] = useState<AutomationInboxItem | null>(null);
  const [deleteInboxTarget, setDeleteInboxTarget] = useState<AutomationInboxItem | null>(null);
  const [inboxLoading, setInboxLoading] = useState(true);

  useEffect(() => {
    void loadPage();
  }, []);

  useEffect(() => {
    if (flow.mode !== "build") return;
    const nextName = defaultCreateWorkflowName();
    setCreateInitialName(nextName);
    setName(nextName);
  }, [flow.mode]);

  useEffect(() => {
    if (!flowWorkflowId) {
      setWorkspaceRuns([]);
      setWorkspaceValidation(null);
      return;
    }
    refreshWorkspace(flowWorkflowId).catch((err: Error) => setLoadError(err.message));
  }, [flowWorkflowId]);

  useEffect(() => {
    if (flow.mode !== "watch") return;
    const selectedRun = workspaceRuns.find((run) => run.id === flowRunId) ?? workspaceRuns[0];
    const shouldPoll = selectedRun?.status === "running" || workspaceRuns[0]?.status === "running";
    if (!shouldPoll) return;

    const interval = window.setInterval(() => {
      if (flowWorkflowId)
        refreshWorkspace(flowWorkflowId).catch((err: Error) => setLoadError(err.message));
    }, 2000);
    return () => window.clearInterval(interval);
  }, [flow.mode, flowRunId, flowWorkflowId, workspaceRuns]);

  async function refresh() {
    const [sourceResponse, workflowResponse, inboxResponse, addressBookResponse, walletResponse] =
      await Promise.all([
        listDataSources(),
        listAutomationWorkflows(),
        listAutomationInbox({ status: "all", limit: 500 }).catch(() => ({
          items: [] as AutomationInboxItem[],
          total: 0,
          limit: 500,
          offset: 0,
        })),
        listAddressBookEntries().catch(() => [] as AddressBookEntry[]),
        getWalletStatus().catch(() => null as WalletStatus | null),
      ]);
    setSources(sourceResponse.items);
    setWorkflows(workflowResponse.items);
    setInboxItems(inboxResponse.items);
    setAddressBook(addressBookResponse);
    setWalletStatus(walletResponse);
    setLoadError(null);
    const workflowId = "workflowId" in flow ? flow.workflowId : null;
    if (workflowId) {
      await refreshWorkspace(workflowId);
    }
  }

  async function loadPage() {
    setWorkflowsLoading(true);
    setInboxLoading(true);
    setLoadError(null);
    try {
      await refresh();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Workflow data could not be loaded.");
    } finally {
      setWorkflowsLoading(false);
      setInboxLoading(false);
    }
  }

  async function refreshWorkspace(workflowId: string) {
    const [runs, validation] = await Promise.all([
      listAutomationWorkflowRuns(workflowId, 10),
      getAutomationWorkflowValidation(workflowId),
    ]);
    setWorkspaceRuns(runs.items);
    setWorkspaceValidation(validation.item);
    setLoadError(null);
    return runs.items;
  }

  async function runWorkflowAndSelectLatest(workflowId: string, payload?: unknown) {
    await runAutomationWorkflow(workflowId, payload);
    const runs = await refreshWorkspace(workflowId);
    if (runs[0]) navigateFlow({ mode: "watch", workflowId, runId: runs[0].id });
  }

  function navigateFlow(nextFlow: AutomationPageFlow) {
    if (nextFlow.mode === "list") {
      navigate("/workflows");
      return;
    }
    if (nextFlow.mode === "build") {
      const nextName = defaultCreateWorkflowName();
      setCreateInitialName(nextName);
      setName(nextName);
      navigate("/workflows/new");
    } else if (nextFlow.mode === "edit")
      navigate(`/workflows/${encodeURIComponent(nextFlow.workflowId)}/edit`);
    else
      navigate(
        `/workflows/${encodeURIComponent(nextFlow.workflowId)}/watch${nextFlow.runId ? `/${encodeURIComponent(nextFlow.runId)}` : ""}`,
      );
  }

  async function run<T>(
    action: () => Promise<T>,
    errorTitle = "Action failed",
  ): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await action();
      await refresh();
      return result;
    } catch (err) {
      showToast({
        tone: "error",
        title: errorTitle,
        message: err instanceof Error ? err.message : "Unknown error",
        timeoutMs: 9000,
      });
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function deleteWorkflow(workflow: AutomationWorkflow) {
    setDeletingWorkflow(workflow);
    try {
      await run(() => deleteAutomationWorkflow(workflow.id), "Could not delete workflow");
    } finally {
      setDeletingWorkflow(null);
    }
  }

  async function confirmDeleteWorkflow() {
    if (!deleteTarget) return;
    const workflow = deleteTarget;
    setDeleteTarget(null);
    await deleteWorkflow(workflow);
  }

  async function deleteInboxItem(item: AutomationInboxItem) {
    setDeletingInboxItem(item);
    try {
      await run(() => deleteAutomationInboxItem(item.id), "Could not delete preview");
    } finally {
      setDeletingInboxItem(null);
    }
  }

  async function confirmDeleteInboxItem() {
    if (!deleteInboxTarget) return;
    const item = deleteInboxTarget;
    setDeleteInboxTarget(null);
    await deleteInboxItem(item);
  }

  async function submitWorkflow(
    blocks: {
      type: AutomationBlockType;
      config: AutomationBlock["config"];
      enabled?: boolean;
      parentBlockId?: string | null;
    }[],
  ): Promise<boolean> {
    setBusy(true);
    try {
      await createAutomationWorkflow({ name, enabled: false, blocks });
      setName("");
      await refresh();
      showToast({ tone: "success", title: "Workflow created" });
      navigateFlow({ mode: "list" });
      return true;
    } catch (err) {
      showToast({
        tone: "error",
        title: "Could not create workflow",
        message: err instanceof Error ? err.message : "Unknown error",
        timeoutMs: 9000,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createWorkflowRecipient(data: CreateAddressBookEntryInput) {
    const entry = await createAddressBookEntry(data);
    setAddressBook((current) =>
      sortAddressBook([...current.filter((item) => item.id !== entry.id), entry]),
    );
    showToast({ tone: "success", title: "Contact added" });
    return entry;
  }

  const sourceById = (id: string) => sources.find((source) => source.id === id);
  const activeWorkflowId = flowWorkflowId;
  const workspaceWorkflow = activeWorkflowId
    ? (workflows.find((workflow) => workflow.id === activeWorkflowId) ?? null)
    : null;
  const workspaceMode = flow.mode === "edit" || flow.mode === "watch" ? flow.mode : null;

  if (flow.mode === "build") {
    return (
      <>
        <CreateWorkflowWorkspace
          name={name}
          initialName={createInitialName}
          sources={sources}
          addressBook={addressBook}
          walletStatus={walletStatus}
          busy={busy}
          onNameChange={setName}
          onCancel={() => navigateFlow({ mode: "list" })}
          onCreate={submitWorkflow}
          onCreateAddressBookEntry={createWorkflowRecipient}
        />
        {loadError && (
          <ErrorAlert
            title="Some workflow data couldn't be loaded"
            className="max-w-none"
            action={
              <Button type="button" variant="secondary" size="sm" onClick={() => void loadPage()}>
                Retry
              </Button>
            }
          >
            {describeLoadFailure(loadError)}
          </ErrorAlert>
        )}
      </>
    );
  }

  if (workspaceMode) {
    return (
      <>
        {workspaceWorkflow ? (
          <WorkflowWorkspace
            workflow={workspaceWorkflow}
            runs={workspaceRuns}
            validation={workspaceValidation}
            source={sourceById(workflowPrimarySourceId(workspaceWorkflow))}
            sources={sources}
            addressBook={addressBook}
            walletStatus={walletStatus}
            busy={busy}
            mode={workspaceMode}
            initialRunId={flow.mode === "watch" ? flow.runId : undefined}
            onBack={() => navigateFlow({ mode: "list" })}
            onNavigateMode={(nextMode) =>
              navigateFlow({ mode: nextMode, workflowId: workspaceWorkflow.id })
            }
            onSelectWatchRun={(runId) =>
              navigateFlow({ mode: "watch", workflowId: workspaceWorkflow.id, runId })
            }
            onAddBlock={(input) =>
              run(() => addAutomationBlock(workspaceWorkflow.id, input), "Could not add block")
            }
            onReplaceStartBlock={(input) =>
              run(
                () => replaceAutomationStartBlock(workspaceWorkflow.id, input),
                "Could not change start block",
              )
            }
            onDeleteBlock={(blockId) =>
              run(
                () => deleteAutomationBlock(workspaceWorkflow.id, blockId),
                "Could not delete block",
              )
            }
            onUpdateBlock={(blockId, input) =>
              run(
                () => updateAutomationBlock(workspaceWorkflow.id, blockId, input),
                "Could not save block",
              )
            }
            onUpdateWorkflow={(input) =>
              run(
                () => updateAutomationWorkflow(workspaceWorkflow.id, input),
                "Could not save workflow",
              )
            }
            onReorderBlocks={(blockIds) =>
              run(
                () => reorderAutomationBlocks(workspaceWorkflow.id, blockIds),
                "Could not move block",
              )
            }
            onRunNow={() =>
              run(() => runWorkflowAndSelectLatest(workspaceWorkflow.id), "Could not run workflow")
            }
            onRunWithPayload={(payload) =>
              run(
                () => runWorkflowAndSelectLatest(workspaceWorkflow.id, payload),
                "Could not run workflow",
              )
            }
            onCreateAddressBookEntry={createWorkflowRecipient}
            loadingOverlayLabel={busy ? "Updating workflow..." : null}
          />
        ) : loadError ? (
          <ErrorContentState
            title="This workflow isn't available"
            description={describeLoadFailure(loadError)}
            onRetry={() => void loadPage()}
          />
        ) : (
          <WorkflowInitialLoadingShell
            mode={workspaceMode}
            onBack={() => navigateFlow({ mode: "list" })}
          />
        )}
        {workspaceWorkflow && loadError ? (
          <ErrorAlert
            title="Some workflow data couldn't be loaded"
            className="max-w-none"
            action={
              <Button type="button" variant="secondary" size="sm" onClick={() => void loadPage()}>
                Retry
              </Button>
            }
          >
            {describeLoadFailure(loadError)}
          </ErrorAlert>
        ) : null}
      </>
    );
  }

  return (
    <Page
      title="Workflows"
      desc="Build workflows connecting data, logic, and secure data automatically with Integritas."
      action={
        <LinkButton href="/workflows/help" iconStart={<BookOpen size={16} aria-hidden />}>
          Workflow guide
        </LinkButton>
      }
    >
      {loadError && (
        <ErrorContentState
          title="Workflows aren't available"
          description={describeLoadFailure(loadError)}
          onRetry={() => void loadPage()}
        />
      )}

      {deletingWorkflow && (
        <DeleteProgressModal
          title="Deleting workflow"
          description={`Removing ${deletingWorkflow.name}. Large workflow logs can take a few seconds while saved run history is detached from this workflow.`}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="Delete workflow"
          itemLabel={deleteTarget.name}
          confirmLabel="Delete workflow"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDeleteWorkflow()}
        />
      )}

      {deletingInboxItem && (
        <DeleteProgressModal
          title="Deleting preview"
          description={`Removing ${deletingInboxItem.title}.`}
        />
      )}

      {deleteInboxTarget && (
        <DeleteConfirmModal
          title="Delete preview"
          itemLabel={deleteInboxTarget.title}
          confirmLabel="Delete preview"
          onCancel={() => setDeleteInboxTarget(null)}
          onConfirm={() => void confirmDeleteInboxItem()}
        />
      )}

      {!loadError ? (
        <AutomationWorkflowsList
          workflows={workflows}
          sources={sources}
          busy={busy}
          loading={workflowsLoading}
          onCreate={() => navigateFlow({ mode: "build" })}
          onEdit={(workflow) => navigateFlow({ mode: "edit", workflowId: workflow.id })}
          onWatch={(workflow) => navigateFlow({ mode: "watch", workflowId: workflow.id })}
          onRunNow={(workflow) =>
            run(() => runAutomationWorkflow(workflow.id), "Could not run workflow")
          }
          onToggleEnabled={(workflow) =>
            run(
              () => updateAutomationWorkflow(workflow.id, { enabled: !workflow.enabled }),
              workflow.enabled ? "Could not pause workflow" : "Could not enable workflow",
            )
          }
          onDuplicate={(workflow) =>
            run(() => duplicateAutomationWorkflow(workflow.id), "Could not duplicate workflow")
          }
          onToggleArchive={(workflow) =>
            run(
              () => updateAutomationWorkflow(workflow.id, { archived: !workflow.archived }),
              workflow.archived ? "Could not restore workflow" : "Could not archive workflow",
            )
          }
          onDelete={setDeleteTarget}
        />
      ) : null}

      {!loadError ? (
        <AutomationInboxTable
          items={inboxItems}
          busy={busy}
          loading={inboxLoading}
          onMarkRead={(item, read) =>
            run(
              () => updateAutomationInboxItem(item.id, { read }),
              read ? "Could not mark preview read" : "Could not mark preview unread",
            )
          }
          onDelete={setDeleteInboxTarget}
        />
      ) : null}
    </Page>
  );
}
