import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Archive, Copy, Eye, Pencil, Play, RotateCcw, Trash2, X } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button, IconButton } from "../components/Button";
import { DataTable, RowActions, TableIconButton, TableWrap, tableCellClass, tableHeaderCellClass, tableHeadRowClass, tableRowClass } from "../components/DataTable";
import { ErrorAlert } from "../components/ErrorAlert";
import { JsonPreview } from "../components/JsonPreview";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { ProgressModal } from "../components/ProgressModal";
import { Card } from "../components/ui/Card";
import { CheckboxField } from "../components/ui/CheckboxField";
import { InputField } from "../components/ui/InputField";
import { ScrollArea } from "../components/ui/ScrollArea";
import { SelectField } from "../components/ui/SelectField";
import { TextareaField } from "../components/ui/TextareaField";
import { useToast } from "../components/ToastProvider";
import { addAutomationBlock, createAutomationWorkflow, deleteAutomationBlock, deleteAutomationInboxItem, deleteAutomationWorkflow, duplicateAutomationWorkflow, getAutomationWorkflowValidation, listAutomationInbox, listAutomationWorkflowRuns, listAutomationWorkflows, reorderAutomationBlocks, runAutomationWorkflow, updateAutomationBlock, updateAutomationInboxItem, updateAutomationWorkflow, validateAutomationDraft } from "../features/automation/automationApi";
import {
  WORKFLOW_INTERVAL_OPTIONS,
  blockLabel,
  blockRunForBlock,
  bodyModeDescription,
  compareValueInputText,
  conditionOperatorOptions,
  createDraftBlock,
  defaultConditionSourceConfig,
  defaultCustomBodyText,
  defaultEditBlockConfig,
  defaultMultipartJsonText,
  defaultPreviewContentText,
  defaultPreviewFormatConfig,
  defaultVariableSourceConfig,
  diagnosticsLink,
  examplePayload,
  flattenDraftBlocks,
  formatDuration,
  formatInterval,
  groupValidationIssues,
  isImagePreviewContent,
  isOutputTarget,
  isReadableSource,
  moveBlock,
  nativeMinimaTokens,
  operatorHasNoValue,
  outputBodyModeConfig,
  outputBodyModes,
  parseCompareValueInput,
  previewContentModeConfig,
  proofIdFromOutput,
  readIdFromOutput,
  retargetOutputBlockConfig,
  runtimeByBlockIdFromRun,
  sourceLabel,
  sourcesForStart,
  summarizeBlocks,
  textPreviewContent,
  validationIssuesByBlockId,
  workflowIntervalSeconds,
  workflowMatchesFilter,
  workflowPrimarySourceId,
} from "../features/automation/workflowHelpers";
import { automationBlockToCanvasBlock, draftBlockDescription, draftBlockTitle, isDataBlock, WorkflowBlockLibrary, WorkflowCanvas, WorkflowRailHeader, WorkflowRailPanel, WorkflowWorkspaceShell, type DraftWorkflowBlock } from "../features/automation/workflow-canvas";
import type { AutomationBlock, AutomationBlockType, AutomationInboxItem, AutomationRun, AutomationValidationResult, AutomationWorkflow, ConditionOperator } from "../features/automation/automationTypes";
import { listAddressBookEntries } from "../features/address-book/addressBookApi";
import type { AddressBookEntry } from "../features/address-book/addressBookTypes";
import { listDataSources } from "../features/data-sources/dataSourcesApi";
import type { DataSource } from "../features/data-sources/dataSourceTypes";
import { getWalletStatus } from "../features/wallet/walletApi";
import type { WalletStatus } from "../features/wallet/walletTypes";
import { cx } from "../lib/cx";
import { formatLocalTime } from "../lib/time";

const mutedText = "type-body text-text-secondary";
const errorText = "type-body-em text-text-error";
const cardClass = "rounded-soft border border-stroke-secondary bg-surface-always-white p-margin-tight shadow-sm";
const softCardClass = "rounded-soft border border-stroke-secondary bg-surface-always-white p-margin-tight shadow-[0_16px_40px_rgba(0,0,0,0.10)]";
const statusRowClass = "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between";
const formGridClass = "grid gap-detail-close [&_label]:grid [&_label]:gap-detail-next [&_label]:type-meta [&_label]:text-text-primary";
const inspectorClass = "grid content-start gap-detail-close overflow-visible xl:sticky xl:top-margin-tight";

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

function AutomationInboxPanel({ items, busy, onMarkRead, onDelete }: { items: AutomationInboxItem[]; busy: boolean; onMarkRead: (item: AutomationInboxItem, read: boolean) => void; onDelete: (item: AutomationInboxItem) => void }) {
  return <section className={cx(cardClass, "grid gap-4")}>
    <div className={statusRowClass}>
      <div><strong>Automation inbox</strong><p className={mutedText}>Local workflow previews stay here even if no browser was open when the workflow ran.</p></div>
      <StatusPill status={items.some((item) => !item.readAt) ? "warn" : "neutral"}>{items.filter((item) => !item.readAt).length} unread</StatusPill>
    </div>
    {items.length === 0 && <p className={mutedText}>No preview items yet. Add a Show preview block to a workflow.</p>}
    <div className="grid gap-3">
      {items.map((item) => <article key={item.id} className={cx(softCardClass, "grid gap-3")}> 
        <div className={statusRowClass}>
          <div><strong>{item.title}</strong><p className={mutedText}>{item.workflowName} · {item.format} · {formatLocalTime(item.createdAt)}</p></div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => onMarkRead(item, !item.readAt)}>{item.readAt ? "Mark unread" : "Mark read"}</Button>
            <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => onDelete(item)}>Delete</Button>
          </div>
        </div>
        <InboxPreview item={item} />
      </article>)}
    </div>
  </section>;
}

function InboxPreview({ item }: { item: AutomationInboxItem }) {
  return <InboxPreviewModal item={item} />;
}

function InboxPreviewModal({ item }: { item: AutomationInboxItem }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="border-0 bg-transparent p-0 text-left font-extrabold text-blue-600 underline" onClick={() => setOpen(true)}>View preview</button>
    {open && <Modal title={item.title} onClose={() => setOpen(false)}>
      <InboxPreviewContent item={item} />
    </Modal>}
  </>;
}

function InboxPreviewContent({ item }: { item: AutomationInboxItem }) {
  if (item.format === "json") return <pre className="m-0 overflow-visible whitespace-pre-wrap rounded-2xl bg-slate-900 p-3.5 text-[0.84rem] text-blue-100 [overflow-wrap:anywhere]">{JSON.stringify(item.content, null, 2)}</pre>;
  if (item.format === "link" && typeof item.content === "string") return <a className="font-bold text-blue-700 underline" href={item.content} target="_blank" rel="noreferrer">{item.content}</a>;
  if (item.format === "image" && isImagePreviewContent(item.content)) {
    const src = item.content.source === "local_path" ? `/api/automation/inbox/${item.id}/image` : item.content.value;
    return <div className="grid gap-3"><img className="max-h-[72vh] max-w-full rounded-2xl border border-slate-200 object-contain" src={src} alt={item.title} /><small className={mutedText}>{item.content.source}: {item.content.value}</small></div>;
  }
  return <p className="whitespace-pre-wrap text-sm text-slate-700">{textPreviewContent(item)}</p>;
}

function StatusPill({ status, children }: { status: "good" | "warn" | "neutral"; children: ReactNode }) {
  return (
    <span className={cx("inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide", status === "good" ? "bg-emerald-100 text-emerald-700" : status === "warn" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>
      {children}
    </span>
  );
}

function WorkflowStatusPill({ workflow }: { workflow: AutomationWorkflow }) {
  const label = workflow.archived ? "Archived" : workflow.lastError ? "Error" : workflow.enabled ? "Enabled" : "Paused";
  const status = workflow.archived ? "neutral" : workflow.lastError ? "warn" : workflow.enabled ? "good" : "neutral";
  return <StatusPill status={status}>{label}</StatusPill>;
}

function IconAction({ children, title, label, disabled, danger, onClick }: { children: ReactNode; title: string; label: string; disabled?: boolean; danger?: boolean; onClick: () => void }) {
  return (
    <TableIconButton danger={danger} type="button" disabled={disabled} title={title} aria-label={label} onClick={onClick}>
      {children}
    </TableIconButton>
  );
}

function Panel({ children, soft = true, className }: { children: ReactNode; soft?: boolean; className?: string }) {
  return <section className={cx(soft ? softCardClass : cardClass, className)}>{children}</section>;
}

function SelectedBlockSheet({ title, description, children, onClose, footer }: { title: string; description?: ReactNode; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="bg-overlay-light min-h-0" />
      <aside className="bg-surface-always-white border-stroke-secondary grid h-screen min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] border-l shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <div className="px-margin-tight pt-margin-tight pb-detail-close flex items-start justify-between gap-detail-close">
          <div className="grid gap-detail-tight">
            <h2 className="type-title text-text-primary m-0">{title}</h2>
            {description ? <p className="type-meta text-text-secondary m-0">{description}</p> : null}
          </div>
          <IconButton type="button" variant="ghost" size="compact" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><X aria-hidden /></IconButton>
        </div>
        <ScrollArea className="min-h-0 px-margin-tight py-detail-close">{children}</ScrollArea>
        {footer && <div className="px-margin-tight pt-detail-close pb-margin-tight flex justify-end">{footer}</div>}
      </aside>
    </div>,
    document.body
  );
}

function InspectorSection({ title, description, children, className }: { title: string; description?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <Card size="Compact" className={cx("border-stroke-secondary grid gap-detail-close border", className)}>
      <div className="grid gap-detail-tight">
        <h3 className="type-body-em text-text-primary m-0">{title}</h3>
        {description ? <p className="type-meta text-text-secondary m-0">{description}</p> : null}
      </div>
      {children}
    </Card>
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

function DraftBlockInspector({ block, sources, addressBook, walletStatus, onChange, onAttachedChange, onAttachedRemove }: { block: DraftWorkflowBlock; sources: DataSource[]; addressBook: AddressBookEntry[]; walletStatus: WalletStatus | null; onChange: (config: AutomationBlock["config"]) => void; onAttachedChange: (attachedId: string, config: AutomationBlock["config"]) => void; onAttachedRemove: (attachedId: string) => void }) {
  const startSources = sourcesForStart(block.type, sources);
  const readableSources = sources.filter(isReadableSource);
  const cameraSources = sources.filter((source) => source.type === "pi-camera");
  const outputTargets = sources.filter((source) => isOutputTarget(source));
  const nativeTokens = nativeMinimaTokens(walletStatus);

  if (block.type.endsWith("_start")) {
    const selectedStartSource = startSources.find((source) => source.id === block.config.sourceId);
    const isEventStart = block.type === "gpio_event_start" || block.type === "webhook_event_start" || block.type === "mqtt_event_start";
    return (
      <InspectorSection title="Configuration" description="To choose a different start block, reset the canvas." className={formGridClass}>
        {block.type === "schedule_start" ? <SelectField label="Interval" value={String(block.config.intervalSeconds ?? 60)} options={WORKFLOW_INTERVAL_OPTIONS.map((interval) => ({ value: String(interval), label: formatInterval(interval) }))} onChange={(event) => onChange({ intervalSeconds: Number(event.target.value) })} /> : block.type === "manual_start" ? <p className={mutedText}>Manual workflows run only when you click Run now.</p> : <SelectField label="Start source" value={block.config.sourceId ?? ""} placeholder="Select source..." options={startSources.map((source) => ({ value: source.id, label: `${source.name} - ${sourceLabel(source)}` }))} onChange={(event) => {
          const source = startSources.find((item) => item.id === event.target.value);
          onChange({ ...block.config, sourceId: event.target.value, activeOnly: source?.config.profile === "pir-motion" ? true : block.config.activeOnly, cooldownSeconds: source?.config.profile === "pir-motion" && !block.config.cooldownSeconds ? 60 : block.config.cooldownSeconds ?? 0 });
        }} />}
        {isEventStart && <>
          <InputField label="Cooldown between runs, seconds" value={String(block.config.cooldownSeconds ?? 0)} inputMode="numeric" description="Cooldown ignores extra events for this workflow without creating run-log rows. Use 30-60 seconds for noisy motion sensors or notification outputs." onChange={(event) => onChange({ ...block.config, cooldownSeconds: Number(event.target.value) })} />
        </>}
        {block.type === "gpio_event_start" && <>
          <CheckboxField label="Only run when the GPIO event is active" checked={Boolean(block.config.activeOnly)} description={selectedStartSource?.config.profile === "pir-motion" ? "Useful when this PIR watches both rising and falling edges: ignore motion_cleared and run only on motion_detected." : "Use this when inactive GPIO edges should not trigger the workflow."} onChange={(event) => onChange({ ...block.config, activeOnly: event.target.checked })} />
        </>}
      </InspectorSection>
    );
  }

  if (block.type === "fetch_data_source") {
    return (
      <InspectorSection title="Source" description="Fetch JSON from a readable device/source such as HTTP JSON or a BME sensor." className={formGridClass}>
        <SelectField label="Readable source" value={block.config.sourceId ?? ""} placeholder="Select source..." options={readableSources.map((source) => ({ value: source.id, label: `${source.name} - ${sourceLabel(source)}` }))} onChange={(event) => onChange({ ...block.config, sourceId: event.target.value })} />
        <AttachedStampSettings block={block} onAttachedChange={onAttachedChange} onAttachedRemove={onAttachedRemove} />
      </InspectorSection>
    );
  }

  if (block.type === "capture_camera") {
    const selectedCamera = cameraSources.find((source) => source.id === block.config.sourceId);
    return (
      <InspectorSection title="Camera" description="Capture a photo or video clip from a configured Raspberry Pi Camera. The media bytes are hashed; read history stores capture metadata." className={formGridClass}>
        <SelectField label="Camera device" value={block.config.sourceId ?? ""} placeholder="Select camera..." options={cameraSources.map((source) => ({ value: source.id, label: `${source.name} - ${sourceLabel(source)}` }))} onChange={(event) => onChange({ ...block.config, sourceId: event.target.value })} />
        {selectedCamera?.config.mode === "video" && <InputField label="Capture duration ms" value={String(block.config.durationMs ?? selectedCamera.config.durationMs ?? 5000)} inputMode="numeric" onChange={(event) => onChange({ ...block.config, durationMs: Number(event.target.value) })} />}
        {selectedCamera?.config.mode === "photo" && <p className={mutedText}>Photo captures use the camera device warmup timeout configured on Devices.</p>}
        <AttachedStampSettings block={block} onAttachedChange={onAttachedChange} onAttachedRemove={onAttachedRemove} />
      </InspectorSection>
    );
  }

  if (block.type === "set_variable") {
    const variableSource = block.config.variableSource ?? "custom_json";
    return (
      <InspectorSection title="Variable" description="Save a per-run value that later condition and output blocks can use." className={formGridClass}>
        <InputField label="Variable name" value={block.config.variableName ?? "message"} placeholder="discordMessage" onChange={(event) => onChange({ ...block.config, variableName: event.target.value })} />
        <SelectField label="Value source" value={variableSource} options={[{ value: "custom_json", label: "Custom JSON" }, { value: "trigger_field", label: "Trigger field" }, { value: "latest_data_field", label: "Latest data field" }, { value: "context_field", label: "Workflow context field" }]} onChange={(event) => onChange(defaultVariableSourceConfig(block.config, event.target.value as NonNullable<AutomationBlock["config"]["variableSource"]>))} />
        {variableSource === "custom_json" ? <TextareaField label="Custom JSON" rows={5} value={block.config.valueJsonText ?? '"Button pressed"'} onChange={(event) => onChange({ ...block.config, variableSource: "custom_json", valueJsonText: event.target.value })} /> : <InputField label="Field path" value={block.config.fieldPath ?? ""} placeholder={variableSource === "trigger_field" ? "pin" : variableSource === "latest_data_field" ? "temperature" : "hash"} onChange={(event) => onChange({ ...block.config, variableSource, fieldPath: event.target.value })} />}
      </InspectorSection>
    );
  }

  if (block.type === "if_payload_field_equals") {
    const conditionSource = block.config.source ?? "trigger";
    return (
      <InspectorSection title="Condition" description="Stop the workflow unless this comparison passes." className={formGridClass}>
        <SelectField label="Condition source" value={conditionSource} options={[{ value: "trigger", label: "Trigger event" }, { value: "variable", label: "Variable" }]} onChange={(event) => onChange(defaultConditionSourceConfig(block.config, event.target.value as "trigger" | "variable"))} />
        {conditionSource === "variable" ? <InputField label="Variable name" value={block.config.variableName ?? "temp"} placeholder="temp" onChange={(event) => onChange({ ...block.config, source: "variable", variableName: event.target.value })} /> : <InputField label="Field path" value={block.config.fieldPath ?? "active"} onChange={(event) => onChange({ ...block.config, source: "trigger", fieldPath: event.target.value })} />}
        <SelectField label="Operator" value={block.config.operator ?? "equals"} options={conditionOperatorOptions.map((option) => ({ value: option.value, label: option.label }))} onChange={(event) => onChange({ ...block.config, operator: event.target.value as ConditionOperator })} />
        {!operatorHasNoValue(block.config.operator ?? "equals") && <InputField label="Compare value" value={compareValueInputText(block.config.value ?? true)} onChange={(event) => onChange({ ...block.config, value: parseCompareValueInput(event.target.value) })} />}
      </InspectorSection>
    );
  }

  if (block.type === "wait") {
    return (
      <InspectorSection title="Timing" description="Pause before the next block runs." className={formGridClass}>
        <InputField label="Wait duration ms" value={String(block.config.durationMs ?? 1000)} inputMode="numeric" onChange={(event) => onChange({ durationMs: Number(event.target.value) })} />
      </InspectorSection>
    );
  }

  if (block.type === "show_preview") {
    const format = block.config.previewFormat ?? "text";
    const contentMode = block.config.contentMode ?? "custom";
    return (
      <InspectorSection title="Preview content" description="Write a durable preview item into the Automation inbox." className={formGridClass}>
        <InputField label="Title" value={block.config.title ?? "Workflow preview"} onChange={(event) => onChange({ ...block.config, title: event.target.value })} />
        <SelectField label="Preview format" value={format} options={[{ value: "text", label: "Text" }, { value: "json", label: "JSON" }, { value: "link", label: "Link" }, { value: "image", label: "Image" }]} onChange={(event) => onChange(defaultPreviewFormatConfig(block.config, event.target.value as NonNullable<AutomationBlock["config"]["previewFormat"]>))} />
        {format === "image" && <SelectField label="Image source" value={block.config.imageSource ?? "url"} options={[{ value: "url", label: "URL" }, { value: "local_path", label: "Local file path" }]} onChange={(event) => onChange({ ...block.config, previewFormat: "image", imageSource: event.target.value as "url" | "local_path" })} />}
        <SelectField label="Content source" value={contentMode} options={[{ value: "custom", label: "Custom" }, { value: "workflow_context", label: "Workflow context" }, { value: "trigger_payload", label: "Trigger payload" }, { value: "latest_data", label: "Latest data" }]} onChange={(event) => onChange(previewContentModeConfig(block.config, event.target.value as NonNullable<AutomationBlock["config"]["contentMode"]>))} />
        {contentMode === "custom" && <TextareaField label={format === "json" ? "Custom JSON" : format === "image" && block.config.imageSource === "local_path" ? "Local file path" : "Content"} rows={format === "text" ? 4 : 6} value={block.config.contentTemplateText ?? defaultPreviewContentText(format, block.config.imageSource)} onChange={(event) => onChange({ ...block.config, contentMode: "custom", contentTemplateText: event.target.value })} />}
      </InspectorSection>
    );
  }

  if (block.type === "control_output") {
    const selectedOutput = outputTargets.find((source) => source.id === block.config.targetId);
    const selectedAction = selectedOutput?.type === "gpio-output" ? "pulse" : selectedOutput?.type === "http-output" ? "send_request" : selectedOutput?.type === "mqtt-output" ? "publish" : "pulse";
    const selectedBodyTargetType = selectedOutput?.type === "http-output" || selectedOutput?.type === "mqtt-output" ? selectedOutput.type : null;
    const bodyMode = block.config.bodyMode ?? "workflow_context";
    return (
      <InspectorSection title="Output" description="Send a command to a configured output target." className={formGridClass}>
        <SelectField label="Output target" value={block.config.targetId ?? ""} placeholder="Select output target..." options={outputTargets.map((source) => ({ value: source.id, label: `${source.name} - ${sourceLabel(source)}` }))} onChange={(event) => {
          const target = outputTargets.find((source) => source.id === event.target.value);
          onChange(retargetOutputBlockConfig(block.config, target));
        }} />
        {selectedOutput?.type === "gpio-output" && <InputField label="Pulse duration ms" value={String(block.config.durationMs ?? 500)} inputMode="numeric" onChange={(event) => onChange({ ...block.config, action: "pulse", durationMs: Number(event.target.value) })} />}
        {selectedOutput?.type === "gpio-output" && <p className={mutedText}>Selected device active state: <strong>{selectedOutput.config.activeState ?? "high"}</strong>. Use High for common GPIO to resistor to LED to GND wiring. Change this from Devices by editing the GPIO LED target.</p>}
        {selectedBodyTargetType && <>
          <SelectField label={selectedBodyTargetType === "http-output" ? "Request body" : "Message payload"} value={bodyMode} options={outputBodyModes(selectedBodyTargetType).map((mode) => ({ value: mode.value, label: mode.label }))} onChange={(event) => onChange(outputBodyModeConfig(block.config, event.target.value as NonNullable<AutomationBlock["config"]["bodyMode"]>, selectedBodyTargetType))} />
          {bodyMode === "custom" && <TextareaField label="Custom JSON" rows={6} value={block.config.bodyTemplateText ?? defaultCustomBodyText()} onChange={(event) => onChange({ ...block.config, bodyMode: "custom", bodyTemplateText: event.target.value })} />}
          {bodyMode === "multipart_media" && <>
            <InputField label="File field name" value={block.config.multipartFileField ?? "file"} placeholder="file" onChange={(event) => onChange({ ...block.config, bodyMode: "multipart_media", multipartFileField: event.target.value })} />
            <InputField label="JSON field name" value={block.config.multipartJsonField ?? ""} placeholder="metadata" onChange={(event) => onChange({ ...block.config, bodyMode: "multipart_media", multipartJsonField: event.target.value })} />
            <TextareaField label="JSON field payload" rows={6} value={block.config.multipartJsonText ?? defaultMultipartJsonText()} onChange={(event) => onChange({ ...block.config, bodyMode: "multipart_media", multipartJsonText: event.target.value })} />
            <p className={mutedText}>Template values: <code>{"{{hash}}"}</code>, <code>{"{{readId}}"}</code>, <code>{"{{sourceName}}"}</code>, <code>{"{{fileName}}"}</code>, <code>{"{{mediaType}}"}</code>, <code>{"{{sizeBytes}}"}</code>.</p>
          </>}
          <p className={mutedText}>{bodyModeDescription(bodyMode, selectedBodyTargetType)}</p>
        </>}
        {!selectedOutput && <p className={mutedText}>Choose a configured output target from Devices.</p>}
        {selectedAction === "pulse" && <p className={mutedText}>Verify resistor wiring and test pulse before enabling GPIO output workflows.</p>}
      </InspectorSection>
    );
  }

  if (block.type === "send_transaction") {
    return (
      <InspectorSection title="Payment" description="This spends wallet funds automatically when the workflow runs. Consider creating paused until you are ready to test." className={formGridClass}>
        <SelectField label="Recipient" value={block.config.recipientAddressBookId ?? ""} placeholder="Select address book recipient..." options={addressBook.map((entry) => ({ value: entry.id, label: entry.label }))} onChange={(event) => onChange({ ...block.config, recipientAddressBookId: event.target.value, tokenId: "0x00" })} />
        <SelectField label="Token" value={block.config.tokenId ?? "0x00"} options={nativeTokens.length > 0 ? nativeTokens.map((token) => ({ value: "0x00", label: `Minima (native) - ${token.sendable} sendable` })) : [{ value: "0x00", label: "Minima (native)" }]} onChange={() => onChange({ ...block.config, tokenId: "0x00" })} />
        <InputField label="Amount" value={block.config.amount ?? ""} inputMode="decimal" onChange={(event) => onChange({ ...block.config, tokenId: "0x00", amount: event.target.value })} />
      </InspectorSection>
    );
  }

  if (isDataBlock(block.type) && block.attachedBlocks?.some((attached) => attached.type === "stamp_integritas")) {
    return (
      <InspectorSection title="Data" description={draftBlockDescription(block, sources)} className={formGridClass}>
        <AttachedStampSettings block={block} onAttachedChange={onAttachedChange} onAttachedRemove={onAttachedRemove} />
      </InspectorSection>
    );
  }

  return <InspectorSection title="Configuration" description={draftBlockDescription(block, sources)} />;
}

function AttachedStampSettings({ block, onAttachedChange, onAttachedRemove }: { block: DraftWorkflowBlock; onAttachedChange: (attachedId: string, config: AutomationBlock["config"]) => void; onAttachedRemove: (attachedId: string) => void }) {
  const stamp = block.attachedBlocks?.find((attached) => attached.type === "stamp_integritas");
  if (!stamp) return null;
  const condition = stamp.config.condition;
  const conditionObject = condition && typeof condition === "object" && !Array.isArray(condition) ? condition as NonNullable<AutomationBlock["config"]["condition"]> : null;

  return (
    <InspectorSection title="Stamp data" description="Create an Integritas proof from this block's produced data." className={formGridClass}>
      <CheckboxField label="Only stamp when this block's data matches" checked={Boolean(conditionObject)} onChange={(event) => onAttachedChange(stamp.id, { condition: event.target.checked ? { source: "data", fieldPath: "active", operator: "equals", value: true } : null })} />
      {conditionObject && <>
        <p className={mutedText}>The condition checks the data produced by the Record/Fetch block this stamp is attached to.</p>
        <InputField label="This block's data field path" value={conditionObject.fieldPath ?? "active"} onChange={(event) => onAttachedChange(stamp.id, { condition: { ...conditionObject, source: "data", fieldPath: event.target.value } })} />
        <SelectField label="Operator" value={conditionObject.operator ?? "equals"} options={conditionOperatorOptions.map((option) => ({ value: option.value, label: option.label }))} onChange={(event) => onAttachedChange(stamp.id, { condition: { ...conditionObject, source: "data", operator: event.target.value as ConditionOperator } })} />
        {!operatorHasNoValue(conditionObject.operator ?? "equals") && <InputField label="Compare value" value={compareValueInputText(conditionObject.value ?? true)} onChange={(event) => onAttachedChange(stamp.id, { condition: { ...conditionObject, source: "data", value: parseCompareValueInput(event.target.value) } })} />}
      </>}
      <Button type="button" variant="danger" size="sm" onClick={() => onAttachedRemove(stamp.id)}>Remove attached stamp</Button>
    </InspectorSection>
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

function WorkflowValidationPanel({ validation }: { validation: AutomationValidationResult | null }) {
  if (!validation) return <Panel><p className={mutedText}>Checking workflow validation...</p></Panel>;
  if (validation.errors.length === 0 && validation.warnings.length === 0) {
    return <Panel><StatusPill status="good">Workflow validation passed</StatusPill></Panel>;
  }
  const groupedIssues = groupValidationIssues([...validation.errors, ...validation.warnings]);

  return (
    <Panel className="max-h-[280px] overflow-hidden">
      <div className={statusRowClass}>
        <div>
          <strong>Workflow validation</strong>
          <p className={mutedText}>Fix errors before running. Warnings are allowed, but should be reviewed before enabling hardware or wallet actions.</p>
        </div>
        <StatusPill status={validation.errors.length > 0 ? "warn" : "neutral"}>{validation.errors.length} error(s), {validation.warnings.length} warning(s)</StatusPill>
      </div>
      {groupedIssues.map((issue) => <ValidationIssueRow key={`${issue.issue.level}-${issue.issue.code}-${issue.issue.message}-${issue.issue.blockType ?? "workflow"}`} issue={issue.issue} count={issue.count} />)}
    </Panel>
  );
}

function PersistedBlockInspector({ block, attachedBlocks, sources, addressBook, walletStatus, busy, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onAttachStamp, onUpdate, onUpdateAttached, onDelete, onDeleteAttached }: { block: AutomationBlock; attachedBlocks: AutomationBlock[]; sources: DataSource[]; addressBook: AddressBookEntry[]; walletStatus: WalletStatus | null; busy: boolean; canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void; onAttachStamp: () => void; onUpdate: (input: Parameters<typeof updateAutomationBlock>[2]) => void; onUpdateAttached: (blockId: string, input: Parameters<typeof updateAutomationBlock>[2]) => void; onDelete: () => void; onDeleteAttached: (blockId: string) => void }) {
  const [config, setConfig] = useState(block.config);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const draftBlock: DraftWorkflowBlock = { id: block.id, type: block.type, config, attachedBlocks: attachedBlocks.map((attached) => ({ id: attached.id, type: attached.type, config: attached.config })) };
  const dirty = JSON.stringify(config) !== JSON.stringify(block.config);
  const removable = !block.type.endsWith("_start");
  const canAttachStamp = isDataBlock(block.type) && !attachedBlocks.some((attached) => attached.type === "stamp_integritas");

  useEffect(() => {
    setConfig(block.config);
    setSaveNotice(null);
  }, [block.id, block.config]);

  return (
    <div className={formGridClass}>
      <DraftBlockInspector block={draftBlock} sources={sources} addressBook={addressBook} walletStatus={walletStatus} onChange={(nextConfig) => {
        setConfig(nextConfig);
        setSaveNotice(null);
      }} onAttachedChange={(attachedId, nextConfig) => onUpdateAttached(attachedId, { config: nextConfig })} onAttachedRemove={onDeleteAttached} />
      {block.lastError && <p className={errorText}>{block.lastError}</p>}
      <InspectorSection title="Actions">
        <SaveState dirty={dirty} saved={saveNotice === "Block saved"} />
        <RowActions>
          <Button type="button" size="sm" disabled={busy || !dirty} onClick={() => {
            onUpdate({ config });
            setSaveNotice("Block saved");
          }}>Save changes</Button>
          {removable && <Button type="button" variant="secondary" size="sm" disabled={busy || !canMoveUp} onClick={onMoveUp}>Move up</Button>}
          {removable && <Button type="button" variant="secondary" size="sm" disabled={busy || !canMoveDown} onClick={onMoveDown}>Move down</Button>}
          {removable && canAttachStamp && <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onAttachStamp}>Attach stamp</Button>}
          {removable && <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => onUpdate({ enabled: !block.enabled })}>{block.enabled ? "Disable" : "Enable"}</Button>}
          {removable && <Button type="button" variant="danger" size="sm" disabled={busy} onClick={onDelete}>Remove block</Button>}
        </RowActions>
      </InspectorSection>
    </div>
  );
}

function WatchRunControls({ workflow, busy, hasValidationErrors, payloadText, payloadError, onPayloadTextChange, onPayloadError, onResetPayload, onRunNow, onRunWithPayload }: { workflow: AutomationWorkflow; busy: boolean; hasValidationErrors: boolean; payloadText: string; payloadError: string | null; onPayloadTextChange: (value: string) => void; onPayloadError: (value: string | null) => void; onResetPayload: () => void; onRunNow: () => void; onRunWithPayload: (payload: unknown) => void }) {
  return (
    <WorkflowRailPanel className={formGridClass}>
      <WorkflowRailHeader title="Run controls" description="Run this workflow or test it with a manual trigger payload." />
      {workflow.archived && <p className={mutedText}>Archived workflows cannot run until restored from the workflow list.</p>}
      {hasValidationErrors && <p className={errorText}>Fix validation errors before running.</p>}
      <Button type="button" size="sm" disabled={busy || hasValidationErrors || workflow.archived} onClick={onRunNow}>Run now</Button>
      <div className="grid gap-detail-next">
        <strong className="type-body-em text-text-primary">Test payload</strong>
        <p className={mutedText}>This payload is used only for a manual test run.</p>
      </div>
      <label>Trigger payload<textarea rows={12} value={payloadText} onChange={(event) => onPayloadTextChange(event.target.value)} /></label>
      {payloadError && <p className={errorText}>{payloadError}</p>}
      <RowActions>
        <Button type="button" variant="secondary" size="xs" disabled={busy} onClick={onResetPayload}>Reset example</Button>
        <Button type="button" size="xs" disabled={busy || hasValidationErrors || workflow.archived} onClick={() => {
          try {
            onRunWithPayload(JSON.parse(payloadText) as unknown);
          } catch (error) {
            onPayloadError(error instanceof Error ? error.message : "Payload must be valid JSON");
          }
        }}>Run with payload</Button>
      </RowActions>
    </WorkflowRailPanel>
  );
}

function WatchRuntimeInspector({ selectedBlock, latestBlockRun, selectedRun, validation, onCloseSelectedBlock }: { selectedBlock: AutomationBlock | undefined; latestBlockRun: AutomationRun["blocks"][number] | null; selectedRun: AutomationRun | undefined; validation: AutomationValidationResult | null; onCloseSelectedBlock?: () => void }) {
  const readId = readIdFromOutput(latestBlockRun?.output);
  const proofId = proofIdFromOutput(latestBlockRun?.output);
  const blockRunStatus = latestBlockRun ? latestBlockRun.status : selectedBlock?.lastRunAt ? "No run details" : "Not run yet";
  const blockRunTone = latestBlockRun?.status === "success" ? "good" : latestBlockRun?.status === "failed" ? "warn" : "neutral";
  const runTone = selectedRun?.status === "success" ? "good" : selectedRun?.status === "failed" ? "warn" : "neutral";

  return (
    <div className="grid gap-detail-close">
      <WorkflowValidationPanel validation={validation} />
      <InspectorSection title="Run summary" description="The selected workflow run currently visualized on the canvas.">
        {selectedRun ? <div className="grid gap-detail-next">
          <RuntimeStat label="Status" value={<StatusPill status={runTone}>{selectedRun.status}</StatusPill>} />
          <RuntimeStat label="Started" value={formatLocalTime(selectedRun.startedAt)} />
          <RuntimeStat label="Duration" value={formatDuration(selectedRun.durationMs)} />
          <RuntimeStat label="Trigger" value={selectedRun.triggerType} />
        </div> : <p className={mutedText}>No run selected yet. Run the workflow or choose a historic run below.</p>}
        {selectedRun?.error && <p className={errorText}>{selectedRun.error}</p>}
      </InspectorSection>
      <InspectorSection title="Block status" description="Latest stored status for the selected block in this run.">
        {!selectedBlock && <p className={mutedText}>Select a block on the canvas to inspect its latest run output.</p>}
        {selectedBlock && <>
          <div className="grid gap-detail-next">
            <RuntimeStat label="Block" value={blockLabel(selectedBlock)} />
            <RuntimeStat label="Status" value={<StatusPill status={blockRunTone}>{blockRunStatus}</StatusPill>} />
            <RuntimeStat label="Duration" value={latestBlockRun ? formatDuration(latestBlockRun.durationMs) : "No timing"} />
          </div>
          {selectedBlock.lastError && <p className={errorText}>{selectedBlock.lastError}</p>}
          {latestBlockRun?.error && <p className={errorText}>{latestBlockRun.error}</p>}
        </>}
      </InspectorSection>
      <InspectorSection title="Output" description="Payload saved by this block during the selected run.">
        {latestBlockRun?.output !== null && latestBlockRun?.output !== undefined ? <JsonPreview value={latestBlockRun.output} label="View output JSON" variant="button" className="w-full" /> : <p className={mutedText}>No output recorded for the latest selected-block run.</p>}
      </InspectorSection>
      {(readId || proofId || onCloseSelectedBlock) && <InspectorSection title="Diagnostics">
        <RowActions>
          {readId && <Link className="type-meta rounded-loose bg-surface-secondary px-detail-close inline-flex h-8 items-center border border-transparent text-text-primary no-underline hover:border-stroke-primary" to={diagnosticsLink("reads", readId)}>Open read</Link>}
          {proofId && <Link className="type-meta rounded-loose bg-surface-secondary px-detail-close inline-flex h-8 items-center border border-transparent text-text-primary no-underline hover:border-stroke-primary" to={diagnosticsLink("proofs", proofId)}>Open proof</Link>}
          {onCloseSelectedBlock && <Button type="button" variant="secondary" size="sm" onClick={onCloseSelectedBlock}>Close inspector</Button>}
        </RowActions>
      </InspectorSection>}
    </div>
  );
}

function RuntimeStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-stroke-secondary flex items-center justify-between gap-detail-close border-b py-detail-tight last:border-b-0">
      <span className="type-meta text-text-secondary">{label}</span>
      <strong className="type-meta text-text-primary text-right">{value}</strong>
    </div>
  );
}

function WatchRunHistory({ runs, selectedRunId, onSelectRun }: { runs: AutomationRun[]; selectedRunId: string | null; onSelectRun: (runId: string) => void }) {
  const [rawRunId, setRawRunId] = useState<string | null>(null);
  const rawRun = runs.find((run) => run.id === rawRunId);

  return (
    <Panel>
      <div className={statusRowClass}>
        <div>
          <strong>Historic runs</strong>
          <p className={mutedText}>Choose a run to visualize on the canvas, or expand raw JSON for diagnostics.</p>
        </div>
        <StatusPill status="neutral">{runs.length} run(s)</StatusPill>
      </div>
      {runs.length === 0 ? <p className={mutedText}>No workflow runs recorded yet.</p> : <ScrollArea className="max-h-[150px] rounded-soft border border-stroke-secondary bg-surface-always-white">
        <TableWrap>
          <DataTable>
            <thead>
              <tr className={tableHeadRowClass}>
                <th className={tableHeaderCellClass}>Started</th>
                <th className={tableHeaderCellClass}>Trigger</th>
                <th className={tableHeaderCellClass}>Status</th>
                <th className={tableHeaderCellClass}>Duration</th>
                <th className={tableHeaderCellClass}>Blocks</th>
                <th className={tableHeaderCellClass}>Details</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className={tableRowClass}>
                  <td className={tableCellClass}>{formatLocalTime(run.startedAt)}</td>
                  <td className={tableCellClass}>{run.triggerType}</td>
                  <td className={tableCellClass}><StatusPill status={run.status === "success" ? "good" : run.status === "failed" ? "warn" : "neutral"}>{run.status}</StatusPill></td>
                  <td className={tableCellClass}>{formatDuration(run.durationMs)}</td>
                  <td className={tableCellClass}>{run.blocks.filter((block) => block.status === "success").length}/{run.blockCount}</td>
                  <td className={tableCellClass}><RowActions><Button type="button" variant="secondary" size="xs" disabled={selectedRunId === run.id} onClick={() => onSelectRun(run.id)}>{selectedRunId === run.id ? "Showing" : "Show on canvas"}</Button><Button type="button" variant="secondary" size="xs" onClick={() => setRawRunId(rawRunId === run.id ? null : run.id)}>{rawRunId === run.id ? "Hide raw" : "Raw details"}</Button></RowActions></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      </ScrollArea>}
      {rawRun && <Panel>
        <div className={statusRowClass}>
          <div><strong>Raw workflow run JSON</strong><p className={mutedText}>Full stored run payload for diagnostics.</p></div>
          <StatusPill status={rawRun.status === "success" ? "good" : rawRun.status === "failed" ? "warn" : "neutral"}>{rawRun.status}</StatusPill>
        </div>
        <JsonPreview value={rawRun} />
      </Panel>}
    </Panel>
  );
}

function ValidationIssueRow({ issue, count = 1 }: { issue: AutomationValidationResult["errors"][number]; count?: number }) {
  return (
    <p className={issue.level === "error" ? errorText : mutedText}>
      <StatusPill status={issue.level === "error" ? "warn" : "neutral"}>{issue.level}</StatusPill> {issue.message}{issue.blockType ? ` (${issue.blockType})` : ""}{count > 1 ? ` · ${count} blocks` : ""}
    </p>
  );
}

function SaveState({ dirty, saved }: { dirty: boolean; saved: boolean }) {
  if (dirty) return <p className={mutedText}><StatusPill status="warn">Unsaved changes</StatusPill> Use this block's save button to apply edits.</p>;
  if (saved) return <p className={mutedText}><StatusPill status="good">Saved</StatusPill></p>;
  return <p className={mutedText}><StatusPill status="neutral">No unsaved changes</StatusPill></p>;
}

function RulePart({ title, value }: { title: string; value: string }) {
  return <div><span className={mutedText}>{title}</span><strong>{value}</strong></div>;
}
