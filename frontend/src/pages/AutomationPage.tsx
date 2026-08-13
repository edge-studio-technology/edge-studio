import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Button, LinkButton } from "../components/Button";
import { DeleteConfirmModal, DeleteProgressModal } from "../components/patterns/DeleteConfirmModal";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/patterns/LoadingState";
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
import { WorkflowWorkspace } from "../features/automation/workflow/WorkflowWorkspace";
import type {
  AutomationBlock,
  AutomationBlockType,
  AutomationInboxItem,
  AutomationRun,
  AutomationValidationResult,
  AutomationWorkflow,
} from "../features/automation/automationTypes";
import { listAddressBookEntries } from "../features/address-book/addressBookApi";
import type { AddressBookEntry } from "../features/address-book/addressBookTypes";
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
  if (!params.workflowId && pathname.endsWith("/automation/new")) return { mode: "build" };
  if (params.workflowId && pathname.includes("/edit"))
    return { mode: "edit", workflowId: params.workflowId };
  if (params.workflowId && pathname.includes("/watch"))
    return { mode: "watch", workflowId: params.workflowId, runId: params.runId };
  return { mode: "list" };
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
  const [enabled, setEnabled] = useState(true);
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
    refresh()
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => {
        setWorkflowsLoading(false);
        setInboxLoading(false);
      });
  }, []);

  useEffect(() => {
    if (flow.mode !== "build") return;
    const nextName = defaultCreateWorkflowName();
    setCreateInitialName(nextName);
    setName(nextName);
    setEnabled(true);
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
      navigate("/automation");
      return;
    }
    if (nextFlow.mode === "build") {
      const nextName = defaultCreateWorkflowName();
      setCreateInitialName(nextName);
      setName(nextName);
      setEnabled(true);
      navigate("/automation/new");
    } else if (nextFlow.mode === "edit")
      navigate(`/automation/${encodeURIComponent(nextFlow.workflowId)}/edit`);
    else
      navigate(
        `/automation/${encodeURIComponent(nextFlow.workflowId)}/watch${nextFlow.runId ? `/${encodeURIComponent(nextFlow.runId)}` : ""}`,
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
      const response = await createAutomationWorkflow({ name, enabled, blocks });
      setName("");
      await refresh();
      navigateFlow({ mode: "edit", workflowId: response.item.id });
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
          enabled={enabled}
          sources={sources}
          addressBook={addressBook}
          walletStatus={walletStatus}
          busy={busy}
          onNameChange={setName}
          onEnabledChange={setEnabled}
          onCancel={() => navigateFlow({ mode: "list" })}
          onCreate={submitWorkflow}
        />
        {loadError && (
          <ErrorAlert
            title="Automation data could not be loaded"
            className="max-w-none"
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => refresh().catch((err: Error) => setLoadError(err.message))}
              >
                Retry
              </Button>
            }
          >
            {loadError}
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
          />
        ) : (
          <LoadingState
            title="Fetching your workflow"
            description="This should take a few seconds."
          />
        )}
        {loadError && (
          <ErrorAlert
            title="Automation data could not be loaded"
            className="max-w-none"
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => refresh().catch((err: Error) => setLoadError(err.message))}
              >
                Retry
              </Button>
            }
          >
            {loadError}
          </ErrorAlert>
        )}
      </>
    );
  }

  return (
    <Page
      title="Automation"
      desc="Build workflows from small start, data, logic, and Integritas blocks."
      action={
        <LinkButton href="/automation/help" iconStart={<BookOpen size={16} aria-hidden />}>
          Workflow guide
        </LinkButton>
      }
    >
      {loadError && (
        <ErrorAlert
          title="Automation data could not be loaded"
          className="max-w-none"
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => refresh().catch((err: Error) => setLoadError(err.message))}
            >
              Retry
            </Button>
          }
        >
          {loadError}
        </ErrorAlert>
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
    </Page>
  );
}
