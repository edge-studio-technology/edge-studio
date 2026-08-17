import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/Button";
import { InputField } from "../../../components/ui/InputField";
import { Text } from "../../../components/Text";
import type { AddressBookEntry } from "../../address-book/addressBookTypes";
import type { DataSource } from "../../data-sources/dataSourceTypes";
import type { WalletStatus } from "../../wallet/walletTypes";
import {
  addAutomationBlock,
  updateAutomationBlock,
  updateAutomationWorkflow,
} from "../automationApi";
import type {
  AutomationBlock,
  AutomationBlockType,
  AutomationRun,
  AutomationValidationResult,
  AutomationWorkflow,
} from "../automationTypes";
import {
  DraftBlockInspector,
  PersistedBlockInspector,
  type PersistedBlockInspectorHandle,
} from "./WorkflowBlockInspectors";
import { WatchRunControls, WatchRuntimeInspector, WatchRunHistory } from "./WorkflowWatchUi";
import {
  automationBlockToCanvasBlock,
  draftBlockDescription,
  draftBlockTitle,
  WorkflowCanvas,
  type DraftWorkflowBlock,
} from "./canvas";
import { WorkflowWorkspaceShell } from "./chrome/WorkflowWorkspaceShell";
import { WorkflowBlockLibrary } from "./toolkit/WorkflowBlockLibrary";
import {
  blockLabel,
  blockRunForBlock,
  canPersistSendTransactionConfig,
  createDraftBlock,
  defaultEditBlockConfig,
  examplePayload,
  moveBlock,
  runtimeByBlockIdFromRun,
  validationIssuesByBlockId,
  withSoftenedInsufficientBalance,
  workflowIntervalSeconds,
  missingDeviceLibraryReason,
} from "./workflowHelpers";
import {
  BlockHelpDisclosure,
  SelectedBlockSheet,
  StatusPill,
  WorkflowStatusPill,
  WorkflowStatusStrip,
  WorkflowValidationPanel,
  errorText,
  isWorkflowValidationVisible,
  mutedText,
} from "./workflowWorkspaceUi";
import { formatLocalTime } from "../../../lib/time";
import { ArrowLeftIcon } from "lucide-react";

/** Edit/watch workspace for a persisted automation workflow. */
export function WorkflowWorkspace({
  workflow,
  runs,
  validation,
  source,
  sources,
  addressBook,
  walletStatus,
  busy,
  mode,
  initialRunId,
  onBack,
  onNavigateMode,
  onSelectWatchRun,
  onAddBlock,
  onDeleteBlock,
  onUpdateBlock,
  onUpdateWorkflow,
  onReorderBlocks,
  onRunNow,
  onRunWithPayload,
}: {
  workflow: AutomationWorkflow;
  runs: AutomationRun[];
  validation: AutomationValidationResult | null;
  source: DataSource | undefined;
  sources: DataSource[];
  addressBook: AddressBookEntry[];
  walletStatus: WalletStatus | null;
  busy: boolean;
  mode: "edit" | "watch";
  initialRunId?: string;
  onBack: () => void;
  onNavigateMode: (mode: "edit" | "watch") => void;
  onSelectWatchRun: (runId: string) => void;
  onAddBlock: (
    input: Parameters<typeof addAutomationBlock>[1],
  ) => void | Promise<{ item: AutomationBlock } | undefined>;
  onDeleteBlock: (blockId: string) => void;
  onUpdateBlock: (blockId: string, input: Parameters<typeof updateAutomationBlock>[2]) => void;
  onUpdateWorkflow: (input: Parameters<typeof updateAutomationWorkflow>[1]) => void;
  onReorderBlocks: (blockIds: string[]) => void;
  onRunNow: () => void;
  onRunWithPayload: (payload: unknown) => void;
}) {
  const [payloadText, setPayloadText] = useState(() =>
    JSON.stringify(examplePayload(workflow), null, 2),
  );
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState(workflow.name);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [pausedForEditNotice, setPausedForEditNotice] = useState(false);
  const mainBlocks = workflow.blocks.filter((block) => !block.parentBlockId);
  const startBlock = mainBlocks[0];
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [draftBlock, setDraftBlock] = useState<DraftWorkflowBlock | null>(null);
  const [draftRevealErrors, setDraftRevealErrors] = useState(false);
  const inspectorRef = useRef<PersistedBlockInspectorHandle>(null);
  const nameSaveTimerRef = useRef<number | null>(null);
  /** Edit-session pause: pause once per workflow after the first real edit. */
  const editPauseSessionRef = useRef<{
    workflowId: string;
    didPause: boolean;
  } | null>(null);
  const selectedBlock = selectedBlockId
    ? mainBlocks.find((block) => block.id === selectedBlockId)
    : undefined;
  const draftSelected = draftBlock && selectedBlockId === draftBlock.id ? draftBlock : null;

  // Saved workflow blocks, plus an unsaved Send payment draft while its options sheet is open.
  const persistedCanvasBlocks = mainBlocks.map((block) =>
    automationBlockToCanvasBlock(block, workflow.blocks),
  );
  const canvasBlocks = draftBlock ? [...persistedCanvasBlocks, draftBlock] : persistedCanvasBlocks;
  const canAddRecordTriggerEvent = Boolean(
    startBlock &&
    (startBlock.type === "gpio_event_start" ||
      startBlock.type === "webhook_event_start" ||
      startBlock.type === "mqtt_event_start") &&
    !mainBlocks.some((block) => block.type === "record_trigger_event"),
  );
  const canAddSendPayment = addressBook.length > 0;
  const uiValidation = withSoftenedInsufficientBalance(validation);
  const hasValidationErrors = Boolean(uiValidation && uiValidation.errors.length > 0);
  const validationByBlockId = validationIssuesByBlockId(uiValidation);
  const selectedRun =
    mode === "watch" ? (runs.find((run) => run.id === selectedRunId) ?? runs[0]) : undefined;
  const runtimeByBlockId = mode === "watch" ? runtimeByBlockIdFromRun(selectedRun) : {};
  const watchRunStatusLabel =
    selectedRun?.status === "running"
      ? "Live updating"
      : selectedRun
        ? "Viewing historic run"
        : "No run selected";
  const workflowStateLabel = workflow.archived
    ? "Archived"
    : workflow.enabled
      ? "Workflow active"
      : "Workflow paused";
  const workflowStateTitle = workflow.archived
    ? "Archived workflows cannot run."
    : workflow.enabled
      ? "Workflow is active."
      : hasValidationErrors
        ? "Fix validation errors before activating."
        : "Activate workflow";

  useEffect(() => {
    if (!selectedBlockId) return;
    if (draftBlock?.id === selectedBlockId) return;
    if (!mainBlocks.some((block) => block.id === selectedBlockId)) setSelectedBlockId("");
  }, [mainBlocks, draftBlock, selectedBlockId]);

  // Sync local name when switching workflows only — avoid clobbering in-progress typing after auto-save.
  useEffect(() => {
    setWorkflowName(workflow.name);
  }, [workflow.id]); // eslint-disable-line react-hooks/exhaustive-deps -- workflow.name intentionally omitted

  useEffect(() => {
    return () => {
      if (nameSaveTimerRef.current != null) window.clearTimeout(nameSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setPausedForEditNotice(false);
    editPauseSessionRef.current = { workflowId: workflow.id, didPause: false };
  }, [workflow.id]);

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
    if (!selectedRunId || !runs.some((run) => run.id === selectedRunId))
      setSelectedRunId(runs[0].id);
  }, [initialRunId, mode, runs, selectedRunId]);

  async function addBlockFromLibrary(type: AutomationBlockType) {
    flushSelectedInspector();
    // Send payment must be configured before the API will accept it — open a local draft sheet.
    if (type === "send_transaction") {
      if (!canAddSendPayment) return;
      pauseForEditIfNeeded();
      const draft = createDraftBlock(type, sources);
      setDraftRevealErrors(false);
      setDraftBlock(draft);
      setSelectedBlockId(draft.id);
      return;
    }
    // Avoid API toast when the toolkit card should already be disabled for missing devices.
    if (missingDeviceLibraryReason(type, sources)) return;
    setDraftRevealErrors(false);
    setDraftBlock(null);
    pauseForEditIfNeeded();
    const result = await onAddBlock({
      type,
      config: defaultEditBlockConfig(type, sources, addressBook),
    });
    if (result?.item && !result.item.parentBlockId) setSelectedBlockId(result.item.id);
  }

  function flushSelectedInspector() {
    if (mode === "edit") inspectorRef.current?.flush();
  }

  function discardDraftBlock() {
    if (draftBlock && selectedBlockId === draftBlock.id) setSelectedBlockId("");
    setDraftBlock(null);
    setDraftRevealErrors(false);
  }

  async function saveDraftBlock() {
    if (!draftBlock) return;
    if (!canPersistSendTransactionConfig(draftBlock.config)) {
      setDraftRevealErrors(true);
      return;
    }
    const draft = draftBlock;
    pauseForEditIfNeeded();
    await onAddBlock({ type: draft.type, config: draft.config });
    setDraftRevealErrors(false);
    setDraftBlock(null);
    // Done means finish adding — don't reopen the persisted inspector for the new block.
    setSelectedBlockId("");
  }

  function closeSelectedSheet() {
    if (draftSelected) {
      discardDraftBlock();
      return;
    }
    flushSelectedInspector();
    setSelectedBlockId("");
  }

  async function finishSelectedSheet() {
    if (draftSelected) {
      await saveDraftBlock();
      return;
    }
    closeSelectedSheet();
  }

  function selectCanvasBlock(id: string) {
    if (draftBlock && id !== draftBlock.id) discardDraftBlock();
    const block = mainBlocks.find((item) => item.id === id);
    if (mode !== "watch" && block?.type === "manual_start") {
      closeSelectedSheet();
      return;
    }
    if (id !== selectedBlockId && !draftBlock) flushSelectedInspector();
    setSelectedBlockId(id);
  }

  const workflowNameError = !workflowName.trim() ? "Workflow name is required." : undefined;

  function clearNameSaveTimer() {
    if (nameSaveTimerRef.current == null) return;
    window.clearTimeout(nameSaveTimerRef.current);
    nameSaveTimerRef.current = null;
  }

  function saveWorkflowNameIfNeeded(nextName = workflowName) {
    clearNameSaveTimer();
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === workflow.name) return;
    pauseForEditIfNeeded();
    onUpdateWorkflow({ name: trimmed });
  }

  function scheduleWorkflowNameSave(nextName: string) {
    clearNameSaveTimer();
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === workflow.name) return;
    nameSaveTimerRef.current = window.setTimeout(() => {
      nameSaveTimerRef.current = null;
      pauseForEditIfNeeded();
      onUpdateWorkflow({ name: trimmed });
    }, 500);
  }

  function pauseForEditIfNeeded() {
    if (mode !== "edit" || workflow.archived) return;
    let session = editPauseSessionRef.current;
    if (!session || session.workflowId !== workflow.id) {
      session = { workflowId: workflow.id, didPause: false };
      editPauseSessionRef.current = session;
    }
    if (session.didPause) return;
    session.didPause = true;
    if (!workflow.enabled) return;
    setPausedForEditNotice(true);
    onUpdateWorkflow({ enabled: false });
  }

  return (
    <WorkflowWorkspaceShell
      breadcrumbLabel={mode === "watch" ? "Watch workflow" : "Edit workflow"}
      nameControl={
        mode === "edit" ? (
          <InputField
            aria-label="Workflow name"
            value={workflowName}
            onChange={(event) => {
              const next = event.target.value;
              setWorkflowName(next);
              if (next.trim() && next.trim() !== workflow.name) pauseForEditIfNeeded();
              scheduleWorkflowNameSave(next);
            }}
            onBlur={() => saveWorkflowNameIfNeeded()}
            placeholder="Workflow name"
            error={workflowNameError}
          />
        ) : (
          <InputField aria-label="Workflow name" value={workflow.name} readOnly />
        )
      }
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onBack}
            iconStart={<ArrowLeftIcon />}
          >
            Back
          </Button>
          {mode === "edit" ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy || workflow.archived || workflow.enabled || hasValidationErrors}
              title={workflowStateTitle}
              onClick={() => {
                setPausedForEditNotice(false);
                editPauseSessionRef.current = { workflowId: workflow.id, didPause: false };
                onUpdateWorkflow({ enabled: true });
              }}
            >
              {workflowStateLabel}
            </Button>
          ) : null}
          {/* <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onNavigateMode(mode === "watch" ? "edit" : "watch")}
          >
            {mode === "watch" ? "Open in edit" : "Open in watch"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || hasValidationErrors || workflow.archived}
            onClick={onRunNow}
          >
            Run now
          </Button> */}
        </>
      }
      statusStrip={
        <WorkflowStatusStrip>
          {mode === "watch" ? (
            <>
              <WorkflowStatusPill workflow={workflow} />
              <StatusPill status={selectedRun?.status === "running" ? "good" : "neutral"}>
                {watchRunStatusLabel}
              </StatusPill>
            </>
          ) : null}
          <StatusPill status="neutral">Blocks {workflow.blocks.length}</StatusPill>
          <StatusPill status="neutral">
            Last run {workflow.lastRunAt ? formatLocalTime(workflow.lastRunAt) : "Never"}
          </StatusPill>
          <StatusPill status="neutral">
            Next{" "}
            {workflow.nextRunAt
              ? formatLocalTime(workflow.nextRunAt)
              : workflowIntervalSeconds(workflow) > 0
                ? "Paused"
                : "On incoming data"}
          </StatusPill>
        </WorkflowStatusStrip>
      }
      notices={
        mode === "edit" || workflow.archived || workflow.lastError ? (
          <>
            {mode === "edit" ? (
              <Text.Body className={mutedText}>
                Changes are saved automatically.
                {pausedForEditNotice
                  ? " Workflow is paused while editing, enable it again from the workflow list."
                  : null}
              </Text.Body>
            ) : null}
            {workflow.archived && (
              <p className={mutedText}>
                Archived workflows do not run automatically or manually until restored.
              </p>
            )}
            {workflow.lastError ? (
              <p className={errorText} role="alert">
                Last run failed: {workflow.lastError}
              </p>
            ) : null}
          </>
        ) : undefined
      }
      rail={
        <aside className="gap-detail-close flex h-full min-h-0 flex-col">
          {mode === "edit" ? (
            <>
              {isWorkflowValidationVisible(uiValidation) ? (
                <WorkflowValidationPanel
                  validation={uiValidation}
                  description="Fix errors before running. Warnings are allowed, but should be reviewed before enabling hardware or wallet actions."
                />
              ) : null}
              <div className="min-h-0 flex-1">
                <WorkflowBlockLibrary
                  mode="edit"
                  hasStartBlock={Boolean(startBlock)}
                  selectedStartType={startBlock?.type}
                  canAddRecordTriggerEvent={canAddRecordTriggerEvent}
                  canAddSendPayment={canAddSendPayment}
                  sources={sources}
                  onSelectStartBlock={() => undefined}
                  onAddBlock={addBlockFromLibrary}
                />
              </div>
            </>
          ) : (
            <>
              {isWorkflowValidationVisible(uiValidation) ? (
                <WorkflowValidationPanel validation={uiValidation} />
              ) : null}
              <WatchRunControls
                workflow={workflow}
                busy={busy}
                hasValidationErrors={hasValidationErrors}
                payloadText={payloadText}
                payloadError={payloadError}
                onPayloadTextChange={(value) => {
                  setPayloadText(value);
                  setPayloadError(null);
                }}
                onPayloadError={setPayloadError}
                onResetPayload={() => {
                  setPayloadText(JSON.stringify(examplePayload(workflow), null, 2));
                  setPayloadError(null);
                }}
                onRunNow={onRunNow}
                onRunWithPayload={onRunWithPayload}
              />
            </>
          )}
        </aside>
      }
      canvas={
        <WorkflowCanvas
          mode={mode}
          blocks={canvasBlocks}
          sources={sources}
          addressBook={addressBook}
          bottomOverlay={mode === "watch"}
          selectedBlockId={selectedBlock?.id ?? ""}
          validationByBlockId={validationByBlockId}
          runtimeByBlockId={runtimeByBlockId}
          onSelectBlock={selectCanvasBlock}
          onMoveBlock={(blockId, direction) => {
            const index = mainBlocks.findIndex((block) => block.id === blockId);
            if (index > 0) {
              pauseForEditIfNeeded();
              onReorderBlocks(moveBlock(mainBlocks, index, index + direction));
            }
          }}
          onRemoveBlock={(blockId) => {
            if (draftBlock?.id === blockId) {
              discardDraftBlock();
              return;
            }
            const block = mainBlocks.find((item) => item.id === blockId);
            if (block && !block.type.endsWith("_start")) {
              if (blockId === selectedBlockId) flushSelectedInspector();
              pauseForEditIfNeeded();
              onDeleteBlock(block.id);
            }
          }}
        />
      }
      selectedSheet={
        draftSelected && mode === "edit" ? (
          <SelectedBlockSheet
            title={draftBlockTitle(draftSelected)}
            description={
              <>
                {draftBlockDescription(draftSelected, sources, addressBook)} Set recipient and
                amount, then Done to add this block.
              </>
            }
            onClose={closeSelectedSheet}
            footer={
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void finishSelectedSheet()}
              >
                Done
              </Button>
            }
          >
            <div className="gap-detail-close grid">
              <BlockHelpDisclosure type={draftSelected.type} />
              <DraftBlockInspector
                block={draftSelected}
                sources={sources}
                addressBook={addressBook}
                walletStatus={walletStatus}
                revealSendPaymentErrors={draftRevealErrors}
                onChange={(config) => {
                  setDraftBlock((current) => (current ? { ...current, config } : current));
                }}
                onAttachedChange={() => undefined}
                onAttachedRemove={() => undefined}
              />
            </div>
          </SelectedBlockSheet>
        ) : selectedBlock && (mode === "watch" || selectedBlock.type !== "manual_start") ? (
          <SelectedBlockSheet
            title={
              mode === "watch" ? `${blockLabel(selectedBlock)} runtime` : blockLabel(selectedBlock)
            }
            description={
              mode === "watch"
                ? "Latest run details for this block."
                : draftBlockDescription(selectedBlock, sources, addressBook)
            }
            onClose={closeSelectedSheet}
            footer={
              mode === "edit" ? (
                <div className="gap-detail-next flex w-full items-center justify-between">
                  <p className={`${mutedText} m-0`}>Changes save when you leave this panel.</p>
                  <Button type="button" onClick={() => void finishSelectedSheet()}>
                    Done
                  </Button>
                </div>
              ) : (
                <Button type="button" onClick={() => void finishSelectedSheet()}>
                  Done
                </Button>
              )
            }
          >
            {mode === "edit" ? (
              <div className="gap-detail-close grid">
                <BlockHelpDisclosure type={selectedBlock.type} />
                <PersistedBlockInspector
                  key={selectedBlock.id}
                  ref={inspectorRef}
                  block={selectedBlock}
                  attachedBlocks={workflow.blocks.filter(
                    (item) => item.parentBlockId === selectedBlock.id,
                  )}
                  sources={sources}
                  addressBook={addressBook}
                  walletStatus={walletStatus}
                  busy={busy}
                  onDirty={pauseForEditIfNeeded}
                  onAttachStamp={() => {
                    pauseForEditIfNeeded();
                    onAddBlock({
                      type: "stamp_integritas",
                      config: {},
                      parentBlockId: selectedBlock.id,
                    })
                  }}
                  onUpdate={(input) => {
                    pauseForEditIfNeeded();
                    onUpdateBlock(selectedBlock.id, input);
                  }}
                  onUpdateAttached={(blockId, input) => {
                    pauseForEditIfNeeded();
                    onUpdateBlock(blockId, input);
                  }}
                  onDelete={() => {
                    if (selectedBlock.type.endsWith("_start")) return;
                    pauseForEditIfNeeded();
                    onDeleteBlock(selectedBlock.id);
                  }}
                  onDeleteAttached={(blockId) => {
                    pauseForEditIfNeeded();
                    onDeleteBlock(blockId);
                  }}
                />
              </div>
            ) : (
              <WatchRuntimeInspector
                selectedBlock={selectedBlock}
                latestBlockRun={blockRunForBlock(selectedRun, selectedBlock.id)}
                selectedRun={selectedRun}
              />
            )}
          </SelectedBlockSheet>
        ) : undefined
      }
      bottom={
        mode === "watch" ? (
          <WatchRunHistory
            runs={runs}
            selectedRunId={selectedRun?.id ?? null}
            onSelectRun={(runId) => {
              setSelectedRunId(runId);
              onSelectWatchRun(runId);
            }}
          />
        ) : undefined
      }
    />
  );
}
