import { useEffect, useMemo, useState } from "react";
import { Archive, Copy, Eye, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import {
  DataTable,
  RowActions,
  TableWrap,
  tableCellClass,
  tableHeaderCellClass,
  tableHeadRowClass,
  tableRowClass,
} from "../components/DataTable";
import { ErrorAlert } from "../components/ErrorAlert";
import { Page } from "../components/Page";
import { ProgressModal } from "../components/ProgressModal";
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
  formatInterval,
  summarizeBlocks,
  workflowIntervalSeconds,
  workflowMatchesFilter,
  workflowPrimarySourceId,
} from "../features/automation/workflow/workflowHelpers";
import {
  IconAction,
  StatusPill,
  WorkflowStatusPill,
  cardClass,
  errorText,
  formGridClass,
  mutedText,
  statusRowClass,
} from "../features/automation/workflow/workflowWorkspaceUi";
import { AutomationInboxPanel } from "../features/automation/AutomationInboxPanel";
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
import { cx } from "../lib/cx";
import { formatLocalTime } from "../lib/time";

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
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState<
    "active" | "all" | "enabled" | "paused" | "error" | "archived"
  >("active");
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

  useEffect(() => {
    refresh().catch((err: Error) => setLoadError(err.message));
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
        listAutomationInbox({ status: "all", limit: 10 }).catch(() => ({
          items: [] as AutomationInboxItem[],
          total: 0,
          limit: 10,
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

  async function run<T>(action: () => Promise<T>, errorTitle = "Action failed"): Promise<T | undefined> {
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

  async function submitWorkflow(
    blocks: {
      type: AutomationBlockType;
      config: AutomationBlock["config"];
      enabled?: boolean;
      parentBlockId?: string | null;
    }[],
  ) {
    setBusy(true);
    try {
      const response = await createAutomationWorkflow({ name, enabled, blocks });
      setName("");
      await refresh();
      navigateFlow({ mode: "edit", workflowId: response.item.id });
    } catch (err) {
      showToast({
        tone: "error",
        title: "Could not create workflow",
        message: err instanceof Error ? err.message : "Unknown error",
        timeoutMs: 9000,
      });
    } finally {
      setBusy(false);
    }
  }

  const sourceById = (id: string) => sources.find((source) => source.id === id);
  const sourceName = (id: string) => sourceById(id)?.name ?? "Unknown source";
  const activeWorkflowId = flowWorkflowId;
  const workspaceWorkflow = activeWorkflowId
    ? (workflows.find((workflow) => workflow.id === activeWorkflowId) ?? null)
    : null;
  const filteredWorkflows = workflows.filter((workflow) =>
    workflowMatchesFilter(
      workflow,
      workflowSearch,
      workflowFilter,
      sourceName(workflowPrimarySourceId(workflow)),
    ),
  );
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
          <section className={cardClass}>
            <p className={mutedText}>Loading workflow...</p>
          </section>
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
      eyebrow="Automation"
      title="Block automation workspace"
      desc="Build workflows from small start, data, logic, and Integritas blocks."
    >
      <section className={cardClass}>
        <div className={statusRowClass}>
          <div>
            <strong>Workflow builders</strong>
            <p className={mutedText}>
              Create a workflow from a start block, then connect action blocks in the workspace.
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => navigateFlow({ mode: "build" })}>
            Create new workflow
          </Button>
        </div>
      </section>

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
        <ProgressModal
          title="Deleting workflow"
          headline="Deleting in progress"
          message={`Removing ${deletingWorkflow.name}. Large workflow logs can take a few seconds while saved run history is detached from this workflow.`}
        />
      )}

      <section className={cx(cardClass, "grid gap-4")}>
        <div className={statusRowClass}>
          <div>
            <strong>Workflows</strong>
            <p className={mutedText}>
              Search, filter, duplicate, and archive workflows as your test list grows.
            </p>
          </div>
          <StatusPill status="neutral">
            {filteredWorkflows.length}/{workflows.length} shown
          </StatusPill>
        </div>
        <div className={cx(formGridClass, "md:grid-cols-2")}>
          <label>
            Search workflows
            <input
              value={workflowSearch}
              onChange={(event) => setWorkflowSearch(event.target.value)}
              placeholder="Name, block type, device, hash..."
            />
          </label>
          <label>
            Status filter
            <select
              value={workflowFilter}
              onChange={(event) => setWorkflowFilter(event.target.value as typeof workflowFilter)}
            >
              <option value="active">Active list (not archived)</option>
              <option value="all">All workflows</option>
              <option value="enabled">Enabled</option>
              <option value="paused">Paused</option>
              <option value="error">With errors</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        <TableWrap>
          <DataTable className="min-w-[920px]">
            <thead>
              <tr className={tableHeadRowClass}>
                <th className={tableHeaderCellClass}>Name</th>
                <th className={tableHeaderCellClass}>Status</th>
                <th className={tableHeaderCellClass}>Trigger / source</th>
                <th className={tableHeaderCellClass}>Blocks</th>
                <th className={tableHeaderCellClass}>Last run</th>
                <th className={tableHeaderCellClass}>Last hash</th>
                <th className={tableHeaderCellClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkflows.map((workflow) => (
                <tr key={workflow.id} className={tableRowClass}>
                  <td className={tableCellClass}>
                    <strong>{workflow.name}</strong>
                    {workflow.lastError && <p className={errorText}>{workflow.lastError}</p>}
                    {workflow.archived && (
                      <p className={mutedText}>Archived workflows do not run until restored.</p>
                    )}
                  </td>
                  <td className={tableCellClass}>
                    <WorkflowStatusPill workflow={workflow} />
                  </td>
                  <td className={tableCellClass}>
                    {sourceName(workflowPrimarySourceId(workflow))}
                    <p className={mutedText}>
                      {workflowIntervalSeconds(workflow) > 0
                        ? formatInterval(workflowIntervalSeconds(workflow))
                        : "Event driven"}
                    </p>
                  </td>
                  <td className={tableCellClass}>
                    <span>{workflow.blocks.length}</span>
                    <p className={mutedText}>{summarizeBlocks(workflow)}</p>
                  </td>
                  <td className={tableCellClass}>
                    {workflow.lastRunAt ? (
                      formatLocalTime(workflow.lastRunAt)
                    ) : (
                      <span className={mutedText}>Never</span>
                    )}
                  </td>
                  <td className={tableCellClass}>
                    {workflow.lastHash ? (
                      <code>{workflow.lastHash}</code>
                    ) : (
                      <span className={mutedText}>No hash yet</span>
                    )}
                  </td>
                  <td className={tableCellClass}>
                    <RowActions>
                      <IconAction
                        disabled={busy}
                        title="Open and edit"
                        label={`Open and edit ${workflow.name}`}
                        onClick={() => navigateFlow({ mode: "edit", workflowId: workflow.id })}
                      >
                        <Pencil size={16} />
                      </IconAction>
                      <IconAction
                        disabled={busy}
                        title="Watch workflow"
                        label={`Watch ${workflow.name}`}
                        onClick={() => navigateFlow({ mode: "watch", workflowId: workflow.id })}
                      >
                        <Eye size={16} />
                      </IconAction>
                      <IconAction
                        disabled={busy || workflow.archived}
                        title="Run now"
                        label={`Run ${workflow.name} now`}
                        onClick={() =>
                          run(() => runAutomationWorkflow(workflow.id), "Could not run workflow")
                        }
                      >
                        <Play size={16} />
                      </IconAction>
                      <IconAction
                        disabled={busy || workflow.archived}
                        title={workflow.enabled ? "Pause workflow" : "Enable workflow"}
                        label={`${workflow.enabled ? "Pause" : "Enable"} ${workflow.name}`}
                        onClick={() =>
                          run(
                            () =>
                              updateAutomationWorkflow(workflow.id, { enabled: !workflow.enabled }),
                            workflow.enabled
                              ? "Could not pause workflow"
                              : "Could not enable workflow",
                          )
                        }
                      >
                        <RotateCcw size={16} />
                      </IconAction>
                      <IconAction
                        disabled={busy}
                        title="Duplicate workflow"
                        label={`Duplicate ${workflow.name}`}
                        onClick={() =>
                          run(
                            () => duplicateAutomationWorkflow(workflow.id),
                            "Could not duplicate workflow",
                          )
                        }
                      >
                        <Copy size={16} />
                      </IconAction>
                      <IconAction
                        disabled={busy}
                        title={workflow.archived ? "Restore workflow" : "Archive workflow"}
                        label={`${workflow.archived ? "Restore" : "Archive"} ${workflow.name}`}
                        onClick={() =>
                          run(
                            () =>
                              updateAutomationWorkflow(workflow.id, {
                                archived: !workflow.archived,
                              }),
                            workflow.archived
                              ? "Could not restore workflow"
                              : "Could not archive workflow",
                          )
                        }
                      >
                        <Archive size={16} />
                      </IconAction>
                      <IconAction
                        danger
                        disabled={busy}
                        title="Delete workflow"
                        label={`Delete workflow ${workflow.name}`}
                        onClick={() => deleteWorkflow(workflow)}
                      >
                        <Trash2 size={16} />
                      </IconAction>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
        {workflows.length === 0 && <p className={mutedText}>No automation workflows yet.</p>}
        {workflows.length > 0 && filteredWorkflows.length === 0 && (
          <p className={mutedText}>No workflows match this filter.</p>
        )}
      </section>

      <AutomationInboxPanel
        items={inboxItems}
        busy={busy}
        onMarkRead={(item, read) =>
          run(
            () => updateAutomationInboxItem(item.id, { read }),
            read ? "Could not mark preview read" : "Could not mark preview unread",
          )
        }
        onDelete={(item) =>
          run(() => deleteAutomationInboxItem(item.id), "Could not delete preview")
        }
      />
    </Page>
  );
}
