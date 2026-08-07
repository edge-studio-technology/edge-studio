import { useEffect, useMemo, useState } from "react";
import { Archive, Copy, Eye, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { DataTable, RowActions, TableWrap, tableCellClass, tableHeaderCellClass, tableHeadRowClass, tableRowClass } from "../components/DataTable";
import { ErrorAlert } from "../components/ErrorAlert";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { ProgressModal } from "../components/ProgressModal";
import { useToast } from "../components/ToastProvider";
import { addAutomationBlock, createAutomationWorkflow, deleteAutomationBlock, deleteAutomationInboxItem, deleteAutomationWorkflow, duplicateAutomationWorkflow, getAutomationWorkflowValidation, listAutomationInbox, listAutomationWorkflowRuns, listAutomationWorkflows, reorderAutomationBlocks, runAutomationWorkflow, updateAutomationBlock, updateAutomationInboxItem, updateAutomationWorkflow, validateAutomationDraft } from "../features/automation/automationApi";
import {
  blockLabel,
  blockRunForBlock,
  createDraftBlock,
  defaultEditBlockConfig,
  examplePayload,
  flattenDraftBlocks,
  formatInterval,
  moveBlock,
  runtimeByBlockIdFromRun,
  summarizeBlocks,
  validationIssuesByBlockId,
  workflowIntervalSeconds,
  workflowMatchesFilter,
  workflowPrimarySourceId,
} from "../features/automation/workflow/workflowHelpers";
import {
  IconAction,
  Panel,
  SelectedBlockSheet,
  StatusPill,
  WorkflowStatusPill,
  cardClass,
  errorText,
  formGridClass,
  inspectorClass,
  mutedText,
  statusRowClass,
} from "../features/automation/workflow/workflowWorkspaceUi";
import { AutomationInboxPanel } from "../features/automation/AutomationInboxPanel";
import { DraftBlockInspector, PersistedBlockInspector } from "../features/automation/workflow/WorkflowBlockInspectors";
import {
  WatchRunControls,
  WatchRuntimeInspector,
  WatchRunHistory,
  WorkflowValidationPanel,
} from "../features/automation/workflow/WorkflowWatchUi";
import { automationBlockToCanvasBlock, draftBlockDescription, draftBlockTitle, WorkflowBlockLibrary, WorkflowCanvas, WorkflowWorkspaceShell, type DraftWorkflowBlock } from "../features/automation/workflow/canvas";
import type { AutomationBlock, AutomationBlockType, AutomationInboxItem, AutomationRun, AutomationValidationResult, AutomationWorkflow } from "../features/automation/automationTypes";
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

function automationFlowFromRoute(pathname: string, params: Readonly<Record<string, string | undefined>>): AutomationPageFlow {
  if (!params.workflowId && pathname.endsWith("/automation/new")) return { mode: "build" };
  if (params.workflowId && pathname.includes("/edit")) return { mode: "edit", workflowId: params.workflowId };
  if (params.workflowId && pathname.includes("/watch")) return { mode: "watch", workflowId: params.workflowId, runId: params.runId };
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
  const [enabled, setEnabled] = useState(true);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState<"active" | "all" | "enabled" | "paused" | "error" | "archived">("active");
  const flow = useMemo(() => automationFlowFromRoute(location.pathname, { workflowId: routeWorkflowId, runId: routeRunId }), [location.pathname, routeRunId, routeWorkflowId]);
  const flowWorkflowId = "workflowId" in flow ? flow.workflowId : null;
  const flowRunId = flow.mode === "watch" ? flow.runId : undefined;
  const [workspaceRuns, setWorkspaceRuns] = useState<AutomationRun[]>([]);
  const [workspaceValidation, setWorkspaceValidation] = useState<AutomationValidationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState<AutomationWorkflow | null>(null);

  useEffect(() => {
    refresh().catch((err: Error) => setLoadError(err.message));
  }, []);

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
      if (flowWorkflowId) refreshWorkspace(flowWorkflowId).catch((err: Error) => setLoadError(err.message));
    }, 2000);
    return () => window.clearInterval(interval);
  }, [flow.mode, flowRunId, flowWorkflowId, workspaceRuns]);

  async function refresh() {
    const [sourceResponse, workflowResponse, inboxResponse, addressBookResponse, walletResponse] = await Promise.all([
      listDataSources(),
      listAutomationWorkflows(),
      listAutomationInbox({ status: "all", limit: 10 }).catch(() => ({ items: [] as AutomationInboxItem[], total: 0, limit: 10, offset: 0 })),
      listAddressBookEntries().catch(() => [] as AddressBookEntry[]),
      getWalletStatus().catch(() => null as WalletStatus | null)
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
    const [runs, validation] = await Promise.all([listAutomationWorkflowRuns(workflowId, 10), getAutomationWorkflowValidation(workflowId)]);
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
    if (nextFlow.mode === "build") navigate("/automation/new");
    else if (nextFlow.mode === "edit") navigate(`/automation/${encodeURIComponent(nextFlow.workflowId)}/edit`);
    else navigate(`/automation/${encodeURIComponent(nextFlow.workflowId)}/watch${nextFlow.runId ? `/${encodeURIComponent(nextFlow.runId)}` : ""}`);
  }

  async function run(action: () => Promise<unknown>, errorTitle = "Action failed") {
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (err) {
      showToast({ tone: "error", title: errorTitle, message: err instanceof Error ? err.message : "Unknown error", timeoutMs: 9000 });
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

  async function submitWorkflow(blocks: { type: AutomationBlockType; config: AutomationBlock["config"]; enabled?: boolean; parentBlockId?: string | null }[]) {
    setBusy(true);
    try {
      const response = await createAutomationWorkflow({ name, enabled, blocks });
      setName("");
      await refresh();
      navigateFlow({ mode: "edit", workflowId: response.item.id });
    } catch (err) {
      showToast({ tone: "error", title: "Could not create workflow", message: err instanceof Error ? err.message : "Unknown error", timeoutMs: 9000 });
    } finally {
      setBusy(false);
    }
  }

  const sourceById = (id: string) => sources.find((source) => source.id === id);
  const sourceName = (id: string) => sourceById(id)?.name ?? "Unknown source";
  const activeWorkflowId = flowWorkflowId;
  const workspaceWorkflow = activeWorkflowId ? workflows.find((workflow) => workflow.id === activeWorkflowId) ?? null : null;
  const filteredWorkflows = workflows.filter((workflow) => workflowMatchesFilter(workflow, workflowSearch, workflowFilter, sourceName(workflowPrimarySourceId(workflow))));
  const workspaceMode = flow.mode === "edit" || flow.mode === "watch" ? flow.mode : null;

  if (flow.mode === "build") {
    return <>
      <CreateWorkflowWorkspace
        name={name}
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
      {loadError && <ErrorAlert title="Automation data could not be loaded" className="max-w-none" action={<Button type="button" variant="secondary" size="sm" onClick={() => refresh().catch((err: Error) => setLoadError(err.message))}>Retry</Button>}>{loadError}</ErrorAlert>}
    </>;
  }

  if (workspaceMode) {
    return <>
      {workspaceWorkflow ? <WorkflowWorkspace
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
        onNavigateMode={(nextMode) => navigateFlow({ mode: nextMode, workflowId: workspaceWorkflow.id })}
        onSelectWatchRun={(runId) => navigateFlow({ mode: "watch", workflowId: workspaceWorkflow.id, runId })}
        onAddBlock={(input) => run(() => addAutomationBlock(workspaceWorkflow.id, input), "Could not add block")}
        onDeleteBlock={(blockId) => run(() => deleteAutomationBlock(workspaceWorkflow.id, blockId), "Could not delete block")}
        onUpdateBlock={(blockId, input) => run(() => updateAutomationBlock(workspaceWorkflow.id, blockId, input), "Could not save block")}
        onUpdateWorkflow={(input) => run(() => updateAutomationWorkflow(workspaceWorkflow.id, input), "Could not save workflow")}
        onReorderBlocks={(blockIds) => run(() => reorderAutomationBlocks(workspaceWorkflow.id, blockIds), "Could not move block")}
        onRunNow={() => run(() => runWorkflowAndSelectLatest(workspaceWorkflow.id), "Could not run workflow")}
        onRunWithPayload={(payload) => run(() => runWorkflowAndSelectLatest(workspaceWorkflow.id, payload), "Could not run workflow")}
      /> : <section className={cardClass}><p className={mutedText}>Loading workflow...</p></section>}
      {loadError && <ErrorAlert title="Automation data could not be loaded" className="max-w-none" action={<Button type="button" variant="secondary" size="sm" onClick={() => refresh().catch((err: Error) => setLoadError(err.message))}>Retry</Button>}>{loadError}</ErrorAlert>}
    </>;
  }

  return (
    <Page
      eyebrow="Automation"
      title="Block automation workspace"
      desc="Build workflows from small start, data, logic, and Integritas blocks."
    >
      <section className={cardClass}>
        <div className={statusRowClass}>
          <div><strong>Workflow builders</strong><p className={mutedText}>Create a workflow from a start block, then connect action blocks in the workspace.</p></div>
          <Button type="button" size="sm" onClick={() => navigateFlow({ mode: "build" })}>Create new workflow</Button>
        </div>
      </section>

      {loadError && <ErrorAlert title="Automation data could not be loaded" className="max-w-none" action={<Button type="button" variant="secondary" size="sm" onClick={() => refresh().catch((err: Error) => setLoadError(err.message))}>Retry</Button>}>{loadError}</ErrorAlert>}

      {deletingWorkflow && (
        <ProgressModal
          title="Deleting workflow"
          headline="Deleting in progress"
          message={`Removing ${deletingWorkflow.name}. Large workflow logs can take a few seconds while saved run history is detached from this workflow.`}
        />
      )}

      <section className={cx(cardClass, "grid gap-4")}>
        <div className={statusRowClass}>
          <div><strong>Workflows</strong><p className={mutedText}>Search, filter, duplicate, and archive workflows as your test list grows.</p></div>
          <StatusPill status="neutral">{filteredWorkflows.length}/{workflows.length} shown</StatusPill>
        </div>
        <div className={cx(formGridClass, "md:grid-cols-2")}>
          <label>Search workflows<input value={workflowSearch} onChange={(event) => setWorkflowSearch(event.target.value)} placeholder="Name, block type, device, hash..." /></label>
          <label>Status filter<select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value as typeof workflowFilter)}>
            <option value="active">Active list (not archived)</option>
            <option value="all">All workflows</option>
            <option value="enabled">Enabled</option>
            <option value="paused">Paused</option>
            <option value="error">With errors</option>
            <option value="archived">Archived</option>
          </select></label>
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
                  <td className={tableCellClass}><strong>{workflow.name}</strong>{workflow.lastError && <p className={errorText}>{workflow.lastError}</p>}{workflow.archived && <p className={mutedText}>Archived workflows do not run until restored.</p>}</td>
                  <td className={tableCellClass}><WorkflowStatusPill workflow={workflow} /></td>
                  <td className={tableCellClass}>{sourceName(workflowPrimarySourceId(workflow))}<p className={mutedText}>{workflowIntervalSeconds(workflow) > 0 ? formatInterval(workflowIntervalSeconds(workflow)) : "Event driven"}</p></td>
                  <td className={tableCellClass}><span>{workflow.blocks.length}</span><p className={mutedText}>{summarizeBlocks(workflow)}</p></td>
                  <td className={tableCellClass}>{workflow.lastRunAt ? formatLocalTime(workflow.lastRunAt) : <span className={mutedText}>Never</span>}</td>
                  <td className={tableCellClass}>{workflow.lastHash ? <code>{workflow.lastHash}</code> : <span className={mutedText}>No hash yet</span>}</td>
                  <td className={tableCellClass}>
                    <RowActions>
                      <IconAction disabled={busy} title="Open and edit" label={`Open and edit ${workflow.name}`} onClick={() => navigateFlow({ mode: "edit", workflowId: workflow.id })}><Pencil size={16} /></IconAction>
                      <IconAction disabled={busy} title="Watch workflow" label={`Watch ${workflow.name}`} onClick={() => navigateFlow({ mode: "watch", workflowId: workflow.id })}><Eye size={16} /></IconAction>
                      <IconAction disabled={busy || workflow.archived} title="Run now" label={`Run ${workflow.name} now`} onClick={() => run(() => runAutomationWorkflow(workflow.id), "Could not run workflow")}><Play size={16} /></IconAction>
                      <IconAction disabled={busy || workflow.archived} title={workflow.enabled ? "Pause workflow" : "Enable workflow"} label={`${workflow.enabled ? "Pause" : "Enable"} ${workflow.name}`} onClick={() => run(() => updateAutomationWorkflow(workflow.id, { enabled: !workflow.enabled }), workflow.enabled ? "Could not pause workflow" : "Could not enable workflow")}><RotateCcw size={16} /></IconAction>
                      <IconAction disabled={busy} title="Duplicate workflow" label={`Duplicate ${workflow.name}`} onClick={() => run(() => duplicateAutomationWorkflow(workflow.id), "Could not duplicate workflow")}><Copy size={16} /></IconAction>
                      <IconAction disabled={busy} title={workflow.archived ? "Restore workflow" : "Archive workflow"} label={`${workflow.archived ? "Restore" : "Archive"} ${workflow.name}`} onClick={() => run(() => updateAutomationWorkflow(workflow.id, { archived: !workflow.archived }), workflow.archived ? "Could not restore workflow" : "Could not archive workflow")}><Archive size={16} /></IconAction>
                      <IconAction danger disabled={busy} title="Delete workflow" label={`Delete workflow ${workflow.name}`} onClick={() => deleteWorkflow(workflow)}><Trash2 size={16} /></IconAction>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
        {workflows.length === 0 && <p className={mutedText}>No automation workflows yet.</p>}
        {workflows.length > 0 && filteredWorkflows.length === 0 && <p className={mutedText}>No workflows match this filter.</p>}
      </section>

      <AutomationInboxPanel items={inboxItems} busy={busy} onMarkRead={(item, read) => run(() => updateAutomationInboxItem(item.id, { read }), read ? "Could not mark preview read" : "Could not mark preview unread")} onDelete={(item) => run(() => deleteAutomationInboxItem(item.id), "Could not delete preview")} />
    </Page>
  );
}

function CreateWorkflowWorkspace({ name, enabled, sources, addressBook, walletStatus, busy, onNameChange, onEnabledChange, onCancel, onCreate }: { name: string; enabled: boolean; sources: DataSource[]; addressBook: AddressBookEntry[]; walletStatus: WalletStatus | null; busy: boolean; onNameChange: (value: string) => void; onEnabledChange: (value: boolean) => void; onCancel: () => void; onCreate: (blocks: { type: AutomationBlockType; config: AutomationBlock["config"]; enabled?: boolean; parentBlockId?: string | null; clientId?: string | null }[]) => void }) {
  const [draftBlocks, setDraftBlocks] = useState<DraftWorkflowBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [backendValidation, setBackendValidation] = useState<AutomationValidationResult | null>(null);
  const [backendValidationError, setBackendValidationError] = useState<string | null>(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const selectedBlock = selectedBlockId ? draftBlocks.find((block) => block.id === selectedBlockId) : undefined;
  const toolkitSelectedBlock = selectedBlock ?? draftBlocks[0];
  const localErrors = name.trim() ? [] : ["Workflow name is required."];
  const backendErrors = backendValidation?.errors.map((issue) => issue.message) ?? [];
  const backendWarnings = backendValidation?.warnings.map((issue) => issue.message) ?? [];
  const canCreate = localErrors.length === 0 && Boolean(backendValidation?.ok);
  const hasStartBlock = draftBlocks.some((block) => block.type.endsWith("_start"));
  const draftValidationByBlockId = validationIssuesByBlockId(backendValidation);

  useEffect(() => {
    let cancelled = false;
    setBackendValidationError(null);
    validateAutomationDraft({ blocks: flattenDraftBlocks(draftBlocks) })
      .then((response) => {
        if (!cancelled) setBackendValidation(response.item);
      })
      .catch((error) => {
        if (!cancelled) setBackendValidationError(error instanceof Error ? error.message : "Could not validate draft workflow.");
      });
    return () => {
      cancelled = true;
    };
  }, [draftBlocks]);

  function updateBlock(id: string, patch: Partial<DraftWorkflowBlock>) {
    setDraftBlocks((blocks) => blocks.map((block) => block.id === id ? { ...block, ...patch, config: patch.config ?? block.config } : block));
  }

  function attachStampBlock(parentId: string) {
    setDraftBlocks((blocks) => blocks.map((block) => block.id === parentId ? { ...block, attachedBlocks: [...(block.attachedBlocks ?? []), createDraftBlock("stamp_integritas", sources)] } : block));
  }

  function updateAttachedBlock(parentId: string, attachedId: string, config: AutomationBlock["config"]) {
    setDraftBlocks((blocks) => blocks.map((block) => block.id === parentId ? { ...block, attachedBlocks: (block.attachedBlocks ?? []).map((attached) => attached.id === attachedId ? { ...attached, config } : attached) } : block));
  }

  function removeAttachedBlock(parentId: string, attachedId: string) {
    setDraftBlocks((blocks) => blocks.map((block) => block.id === parentId ? { ...block, attachedBlocks: (block.attachedBlocks ?? []).filter((attached) => attached.id !== attachedId) } : block));
  }

  function addDraftBlock(type: AutomationBlockType) {
    if (!hasStartBlock && !type.endsWith("_start")) return;
    setDraftBlocks((blocks) => [...blocks, createDraftBlock(type, sources)]);
  }

  function removeDraftBlock(id: string) {
    setDraftBlocks((blocks) => {
      const block = blocks.find((item) => item.id === id);
      if (!block || block.type.endsWith("_start")) return blocks;
      const next = blocks.filter((item) => item.id !== id);
      if (selectedBlockId === id) setSelectedBlockId("");
      return next;
    });
  }

  function moveDraftBlock(id: string, direction: -1 | 1) {
    setDraftBlocks((blocks) => {
      const index = blocks.findIndex((block) => block.id === id);
      const nextIndex = index + direction;
      if (index <= 0 || nextIndex <= 0 || nextIndex >= blocks.length) return blocks;
      const next = [...blocks];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function selectStartBlock(type: AutomationBlockType) {
    setDraftBlocks((blocks) => {
      const start = createDraftBlock(type, sources);
      if (blocks.some((block) => block.type.endsWith("_start"))) return blocks;
      return [start];
    });
  }

  function resetCanvas() {
    setDraftBlocks([]);
    setSelectedBlockId("");
  }

  function requestCancel() {
    if (draftBlocks.length > 0 || name.trim()) {
      setConfirmLeaveOpen(true);
      return;
    }
    onCancel();
  }

  return (
    <>
      <WorkflowWorkspaceShell
        breadcrumbLabel="Create workflow"
        nameControl={<input aria-label="Workflow name" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Workflow name" />}
        actions={<>
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={requestCancel}>Back to workflows</Button>
          <Button type="button" variant="secondary" size="sm" disabled={busy || draftBlocks.length === 0} onClick={resetCanvas}>Reset canvas</Button>
          <Button type="button" size="sm" disabled={busy || !canCreate} onClick={() => onCreate(flattenDraftBlocks(draftBlocks))}>Create workflow</Button>
        </>}
        rail={<aside className={cx(inspectorClass, formGridClass)}>
          <Panel>
            <label className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-detail-next type-meta text-text-primary"><input className="w-auto" type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} /> Enabled after create</label>
            <strong>Validation</strong>
            {localErrors.map((issue) => <p key={issue} className={errorText}>{issue}</p>)}
            {backendErrors.map((issue) => <p key={issue} className={errorText}>{issue}</p>)}
            {backendWarnings.map((issue) => <p key={issue} className={mutedText}>{issue}</p>)}
            {backendValidationError && <p className={errorText}>{backendValidationError}</p>}
            {!backendValidation && !backendValidationError && <p className={mutedText}>Checking draft workflow...</p>}
            {canCreate && <p className={mutedText}>No blocking draft errors. Review any warnings before creating.</p>}
          </Panel>
          <WorkflowBlockLibrary hasStartBlock={hasStartBlock} selectedBlock={toolkitSelectedBlock} onSelectStartBlock={selectStartBlock} onAddBlock={addDraftBlock} onAttachStamp={attachStampBlock} />
        </aside>}
        canvas={<WorkflowCanvas mode="build" blocks={draftBlocks} sources={sources} statusLabel={enabled ? "Enabled on create" : "Paused on create"} statusGood={enabled} dimmed={Boolean(selectedBlock)} selectedBlockId={selectedBlock?.id ?? ""} validationByBlockId={draftValidationByBlockId} onSelectBlock={setSelectedBlockId} onMoveBlock={moveDraftBlock} onRemoveBlock={removeDraftBlock} />}
        selectedSheet={selectedBlock ? <SelectedBlockSheet
          title={draftBlockTitle(selectedBlock)}
          description={draftBlockDescription(selectedBlock, sources)}
          onClose={() => setSelectedBlockId("")}
          footer={<Button type="button" size="sm" disabled={busy || !canCreate} onClick={() => onCreate(flattenDraftBlocks(draftBlocks))}>Save and close</Button>}
        >
          <DraftBlockInspector block={selectedBlock} sources={sources} addressBook={addressBook} walletStatus={walletStatus} onChange={(config) => updateBlock(selectedBlock.id, { config })} onAttachedChange={(attachedId, config) => updateAttachedBlock(selectedBlock.id, attachedId, config)} onAttachedRemove={(attachedId) => removeAttachedBlock(selectedBlock.id, attachedId)} />
        </SelectedBlockSheet> : undefined}
      />
      {confirmLeaveOpen && <Modal
        title="Are you sure?"
        description="If you leave without publishing, your progress won't be saved."
        onClose={() => setConfirmLeaveOpen(false)}
        footer={<>
          <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmLeaveOpen(false)}>Cancel</Button>
          <Button type="button" size="sm" onClick={onCancel}>Go to my library</Button>
        </>}
      />}
    </>
  );
}

function WorkflowWorkspace({ workflow, runs, validation, source, sources, addressBook, walletStatus, busy, mode, initialRunId, onBack, onNavigateMode, onSelectWatchRun, onAddBlock, onDeleteBlock, onUpdateBlock, onUpdateWorkflow, onReorderBlocks, onRunNow, onRunWithPayload }: { workflow: AutomationWorkflow; runs: AutomationRun[]; validation: AutomationValidationResult | null; source: DataSource | undefined; sources: DataSource[]; addressBook: AddressBookEntry[]; walletStatus: WalletStatus | null; busy: boolean; mode: "edit" | "watch"; initialRunId?: string; onBack: () => void; onNavigateMode: (mode: "edit" | "watch") => void; onSelectWatchRun: (runId: string) => void; onAddBlock: (input: Parameters<typeof addAutomationBlock>[1]) => void; onDeleteBlock: (blockId: string) => void; onUpdateBlock: (blockId: string, input: Parameters<typeof updateAutomationBlock>[2]) => void; onUpdateWorkflow: (input: Parameters<typeof updateAutomationWorkflow>[1]) => void; onReorderBlocks: (blockIds: string[]) => void; onRunNow: () => void; onRunWithPayload: (payload: unknown) => void }) {
  const [payloadText, setPayloadText] = useState(() => JSON.stringify(examplePayload(workflow), null, 2));
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState(workflow.name);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const mainBlocks = workflow.blocks.filter((block) => !block.parentBlockId);
  const startBlock = mainBlocks[0];
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const selectedBlock = selectedBlockId ? mainBlocks.find((block) => block.id === selectedBlockId) : undefined;
  const selectedDraftBlock = selectedBlock ? { id: selectedBlock.id, type: selectedBlock.type, config: selectedBlock.config, attachedBlocks: workflow.blocks.filter((item) => item.parentBlockId === selectedBlock.id).map((item) => ({ id: item.id, type: item.type, config: item.config })) } : undefined;
  const canvasBlocks = mainBlocks.map((block) => automationBlockToCanvasBlock(block, workflow.blocks));
  const canAddRecordTriggerEvent = Boolean(startBlock && (startBlock.type === "gpio_event_start" || startBlock.type === "webhook_event_start" || startBlock.type === "mqtt_event_start") && !mainBlocks.some((block) => block.type === "record_trigger_event"));
  const hasValidationErrors = Boolean(validation && validation.errors.length > 0);
  const validationByBlockId = validationIssuesByBlockId(validation);
  const selectedRun = mode === "watch" ? runs.find((run) => run.id === selectedRunId) ?? runs[0] : undefined;
  const runtimeByBlockId = mode === "watch" ? runtimeByBlockIdFromRun(selectedRun) : {};
  const watchRunStatusLabel = selectedRun?.status === "running" ? "Live updating" : selectedRun ? "Viewing historic run" : "No run selected";

  useEffect(() => {
    if (selectedBlockId && !mainBlocks.some((block) => block.id === selectedBlockId)) setSelectedBlockId("");
  }, [mainBlocks, selectedBlockId]);

  useEffect(() => {
    setWorkflowName(workflow.name);
  }, [workflow.id, workflow.name]);

  useEffect(() => {
    if (mode !== "watch") return;
    if (runs.length === 0) {
      setSelectedRunId(null);
      return;
    }
    if (initialRunId && runs.some((run) => run.id === initialRunId)) {
      setSelectedRunId(initialRunId);
      return;
    }
    if (!selectedRunId || !runs.some((run) => run.id === selectedRunId)) setSelectedRunId(runs[0].id);
  }, [initialRunId, mode, runs, selectedRunId]);

  function addBlockFromLibrary(type: AutomationBlockType) {
    onAddBlock({ type, config: defaultEditBlockConfig(type, sources, addressBook) });
  }

  const workflowNameDirty = workflowName.trim() !== workflow.name;

  return (
    <WorkflowWorkspaceShell
      breadcrumbLabel={mode === "watch" ? "Watch workflow" : "Edit workflow"}
      nameControl={mode === "edit" ? <input aria-label="Workflow name" value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} placeholder="Workflow name" /> : <input aria-label="Workflow name" value={workflow.name} readOnly />}
      actions={<>
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onBack}>Back to workflows</Button>
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => onNavigateMode(mode === "watch" ? "edit" : "watch")}>{mode === "watch" ? "Open in edit" : "Open in watch"}</Button>
        {mode === "edit" && <Button type="button" size="sm" disabled={busy || !workflowName.trim() || !workflowNameDirty} onClick={() => onUpdateWorkflow({ name: workflowName.trim() })}>Save workflow name</Button>}
        <Button type="button" variant="secondary" size="sm" disabled={busy || hasValidationErrors || workflow.archived} onClick={onRunNow}>Run now</Button>
        <WorkflowStatusPill workflow={workflow} />
        {mode === "watch" && <StatusPill status={selectedRun?.status === "running" ? "good" : "neutral"}>{watchRunStatusLabel}</StatusPill>}
        <StatusPill status="neutral">Blocks {workflow.blocks.length}</StatusPill>
        <StatusPill status="neutral">Last run {workflow.lastRunAt ? formatLocalTime(workflow.lastRunAt) : "Never"}</StatusPill>
        <StatusPill status="neutral">Next {workflow.nextRunAt ? formatLocalTime(workflow.nextRunAt) : workflowIntervalSeconds(workflow) > 0 ? "Paused" : "On incoming data"}</StatusPill>
      </>}
      notices={workflow.archived || workflow.lastError ? <>
        {workflow.archived && <p className={mutedText}>Archived workflows do not run automatically or manually until restored.</p>}
        {workflow.lastError && <p className={errorText}>{workflow.lastError}</p>}
      </> : undefined}
      rail={<aside className={inspectorClass}>
        <WorkflowValidationPanel validation={validation} />
        {mode === "edit" ? <WorkflowBlockLibrary mode="edit" hasStartBlock={Boolean(startBlock)} selectedBlock={selectedDraftBlock} canAddRecordTriggerEvent={canAddRecordTriggerEvent} onSelectStartBlock={() => undefined} onAddBlock={addBlockFromLibrary} onAttachStamp={(parentId) => onAddBlock({ type: "stamp_integritas", config: {}, parentBlockId: parentId })} /> : <WatchRunControls workflow={workflow} busy={busy} hasValidationErrors={hasValidationErrors} payloadText={payloadText} payloadError={payloadError} onPayloadTextChange={(value) => {
            setPayloadText(value);
            setPayloadError(null);
          }} onPayloadError={setPayloadError} onResetPayload={() => {
            setPayloadText(JSON.stringify(examplePayload(workflow), null, 2));
            setPayloadError(null);
          }} onRunNow={onRunNow} onRunWithPayload={onRunWithPayload} />}
      </aside>}
      canvas={<WorkflowCanvas mode={mode} blocks={canvasBlocks} sources={sources} statusLabel={workflow.archived ? "Archived" : workflow.enabled ? "Enabled" : "Paused"} statusGood={!workflow.archived && workflow.enabled} dimmed={Boolean(selectedBlock)} bottomOverlay={mode === "watch"} selectedBlockId={selectedBlock?.id ?? ""} validationByBlockId={validationByBlockId} runtimeByBlockId={runtimeByBlockId} onSelectBlock={setSelectedBlockId} onMoveBlock={(blockId, direction) => {
          const index = mainBlocks.findIndex((block) => block.id === blockId);
          if (index > 0) onReorderBlocks(moveBlock(mainBlocks, index, index + direction));
        }} onRemoveBlock={(blockId) => {
          const block = mainBlocks.find((item) => item.id === blockId);
          if (block && !block.type.endsWith("_start")) onDeleteBlock(block.id);
        }} />}
      selectedSheet={selectedBlock ? <SelectedBlockSheet title={mode === "watch" ? `${blockLabel(selectedBlock)} runtime` : blockLabel(selectedBlock)} description={mode === "watch" ? "Latest run details for this block." : draftBlockDescription(selectedBlock, sources)} onClose={() => setSelectedBlockId("")}>
        {mode === "edit" ? <PersistedBlockInspector
          key={selectedBlock.id}
          block={selectedBlock}
          attachedBlocks={workflow.blocks.filter((item) => item.parentBlockId === selectedBlock.id)}
          sources={sources}
          addressBook={addressBook}
          walletStatus={walletStatus}
          busy={busy}
          canMoveUp={mainBlocks.findIndex((block) => block.id === selectedBlock.id) > 1}
          canMoveDown={mainBlocks.findIndex((block) => block.id === selectedBlock.id) > 0 && mainBlocks.findIndex((block) => block.id === selectedBlock.id) < mainBlocks.length - 1}
          onMoveUp={() => {
            const index = mainBlocks.findIndex((block) => block.id === selectedBlock.id);
            onReorderBlocks(moveBlock(mainBlocks, index, index - 1));
          }}
          onMoveDown={() => {
            const index = mainBlocks.findIndex((block) => block.id === selectedBlock.id);
            onReorderBlocks(moveBlock(mainBlocks, index, index + 1));
          }}
          onAttachStamp={() => onAddBlock({ type: "stamp_integritas", config: {}, parentBlockId: selectedBlock.id })}
          onUpdate={(input) => onUpdateBlock(selectedBlock.id, input)}
          onUpdateAttached={(blockId, input) => onUpdateBlock(blockId, input)}
          onDelete={() => selectedBlock.type.endsWith("_start") ? undefined : onDeleteBlock(selectedBlock.id)}
          onDeleteAttached={onDeleteBlock}
        /> : <WatchRuntimeInspector selectedBlock={selectedBlock} latestBlockRun={blockRunForBlock(selectedRun, selectedBlock.id)} selectedRun={selectedRun} validation={validation} />}
      </SelectedBlockSheet> : undefined}
      bottom={mode === "watch" ? <WatchRunHistory runs={runs} selectedRunId={selectedRun?.id ?? null} onSelectRun={(runId) => {
        setSelectedRunId(runId);
        onSelectWatchRun(runId);
      }} /> : undefined}
    />
  );
}
