import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { InputField } from "../../../components/ui/InputField";
import { ScrollArea } from "../../../components/ui/ScrollArea";
import { Text } from "../../../components/Text";
import type {
  AddressBookEntry,
  CreateAddressBookEntryInput,
} from "../../address-book/addressBookTypes";
import type { DataSource } from "../../data-sources/dataSourceTypes";
import type { WalletStatus } from "../../wallet/walletTypes";
import {
  addAutomationBlock,
  replaceAutomationStartBlock,
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
import {
  WatchRunControls,
  WatchReplayControls,
  WatchRuntimeInspector,
  WatchRunHistory,
  WatchRuntimeOverview,
} from "./WorkflowWatchUi";
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
  missingDeviceLibraryReason,
} from "./workflowHelpers";
import {
  BlockHelpDisclosure,
  SelectedBlockSheet,
  WorkflowValidationPanel,
  errorText,
  isWorkflowValidationVisible,
  mutedText,
} from "./workflowWorkspaceUi";
import { ArrowLeftIcon, Eye, Pencil } from "lucide-react";
import { SpinnerAlt } from "../../../components/ui/SpinnerAlt";

const workflowToggleBaseClass =
  "group h-10 gap-detail-next rounded-full px-detail-next type-body-em disabled:cursor-not-allowed disabled:opacity-60";
const workflowToggleEnabledClass = `${workflowToggleBaseClass} !border-[#009966] !bg-[#dcf7ec] !text-[#006b49] enabled:hover:!border-stroke-primary enabled:hover:!bg-surface-secondary enabled:hover:!text-text-primary`;
const workflowTogglePausedClass = `${workflowToggleBaseClass} !border-stroke-primary !bg-surface-secondary !text-text-primary enabled:hover:!border-[#009966] enabled:hover:!bg-[#dcf7ec] enabled:hover:!text-[#006b49]`;
const workflowToggleEnabledKnobClass = "block size-6 rounded-full bg-[#009966] shadow-sm transition-colors group-hover:bg-grey-04";
const workflowTogglePausedKnobClass = "block size-6 rounded-full bg-grey-04 shadow-sm transition-colors group-hover:bg-[#009966]";

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
  onReplaceStartBlock,
  onDeleteBlock,
  onUpdateBlock,
  onUpdateWorkflow,
  onReorderBlocks,
  onRunNow,
  onRunWithPayload,
  onCreateAddressBookEntry,
  loadingOverlayLabel,
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
  onReplaceStartBlock: (
    input: Parameters<typeof replaceAutomationStartBlock>[1],
  ) => void | Promise<{ item: AutomationBlock } | undefined>;
  onDeleteBlock: (blockId: string) => void;
  onUpdateBlock: (blockId: string, input: Parameters<typeof updateAutomationBlock>[2]) => void;
  onUpdateWorkflow: (input: Parameters<typeof updateAutomationWorkflow>[1]) => void | Promise<unknown>;
  onReorderBlocks: (blockIds: string[]) => void;
  onRunNow: () => void;
  onRunWithPayload: (payload: unknown) => void;
  onCreateAddressBookEntry: (data: CreateAddressBookEntryInput) => Promise<AddressBookEntry>;
  loadingOverlayLabel?: string | null;
}) {
  const [payloadText, setPayloadText] = useState(() =>
    JSON.stringify(examplePayload(workflow), null, 2),
  );
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState(workflow.name);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [followLiveRuns, setFollowLiveRuns] = useState(false);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayHighlightBlockId, setReplayHighlightBlockId] = useState<string | undefined>();
  const [newLiveRunId, setNewLiveRunId] = useState<string | null>(null);
  const previousSelectedRunIdRef = useRef<string | null>(null);
  const suppressNextLiveAutoplayRef = useRef(false);
  const [pendingEditAction, setPendingEditAction] = useState<(() => unknown | Promise<unknown>) | null>(null);
  const mainBlocks = workflow.blocks.filter((block) => !block.parentBlockId);
  const startBlock = mainBlocks[0];
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [draftBlock, setDraftBlock] = useState<DraftWorkflowBlock | null>(null);
  const [draftRevealErrors, setDraftRevealErrors] = useState(false);
  const inspectorRef = useRef<PersistedBlockInspectorHandle>(null);
  const lastSubmittedNameRef = useRef(workflow.name);
  const editPauseConfirmedRef = useRef(false);
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
  const canAddSendPayment = true;
  const uiValidation = withSoftenedInsufficientBalance(validation);
  const hasValidationErrors = Boolean(uiValidation && uiValidation.errors.length > 0);
  const validationByBlockId = {
    ...validationIssuesByBlockId(uiValidation),
    ...(draftBlock && !canPersistSendTransactionConfig(draftBlock.config)
      ? {
          [draftBlock.id]: [
            {
              level: "error" as const,
              message: "Choose an address book recipient and enter a positive amount.",
            },
          ],
        }
      : {}),
  };
  const selectedRun =
    mode === "watch" ? (runs.find((run) => run.id === selectedRunId) ?? runs[0]) : undefined;
  const latestRun = mode === "watch" ? runs[0] : undefined;
  const replaySteps = mode === "watch" && selectedRun ? selectedRun.blocks.filter((block) => block.blockId) : [];
  const replayStepIndex = replaySteps.findIndex((block) => block.blockId === selectedBlockId);
  const playbackMessage = playbackStatusMessage(selectedRun, {
    followingLive: followLiveRuns,
    isNewLiveRun: Boolean(selectedRun && selectedRun.id === newLiveRunId),
    playing: replayPlaying,
  });
  const replayOverlayActive = Boolean(
    mode === "watch" &&
      replayPlaying &&
      newLiveRunId &&
      selectedRun?.id === newLiveRunId,
  );
  const runtimeByBlockId = mode === "watch" ? runtimeByBlockIdFromRun(selectedRun) : {};
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
    lastSubmittedNameRef.current = workflow.name;
    editPauseConfirmedRef.current = false;
  }, [workflow.id]); // eslint-disable-line react-hooks/exhaustive-deps -- workflow.name intentionally omitted

  useEffect(() => {
    if (workflow.enabled) editPauseConfirmedRef.current = false;
  }, [workflow.enabled]);

  useEffect(() => {
    if (mode !== "watch") return;
    if (runs.length === 0) {
      setSelectedRunId(null);
      return;
    }
    if (!selectedRunId && initialRunId && runs.some((run) => run.id === initialRunId)) {
      setSelectedRunId(initialRunId);
      return;
    }
    if (followLiveRuns) {
      if (selectedRunId !== runs[0].id) setSelectedRunId(runs[0].id);
      return;
    }
    if (!selectedRunId || !runs.some((run) => run.id === selectedRunId))
      setSelectedRunId(runs[0].id);
  }, [followLiveRuns, initialRunId, mode, runs, selectedRunId]);

  useEffect(() => {
    if (mode !== "watch") setReplayPlaying(false);
  }, [mode]);

  useEffect(() => {
    if (mode !== "watch" || !replayPlaying || !selectedBlockId) {
      setReplayHighlightBlockId(undefined);
      return;
    }

    setReplayHighlightBlockId(selectedBlockId);
    const timeout = window.setTimeout(() => setReplayHighlightBlockId(undefined), 1500);
    return () => window.clearTimeout(timeout);
  }, [mode, replayPlaying, selectedBlockId]);

  useEffect(() => {
    setReplayPlaying(false);
  }, [selectedRun?.id]);

  useEffect(() => {
    if (mode !== "watch") return;
    const previousRunId = previousSelectedRunIdRef.current;
    previousSelectedRunIdRef.current = selectedRun?.id ?? null;
    if (!selectedRun || !previousRunId || !followLiveRuns || selectedRun.id === previousRunId) return;
    if (suppressNextLiveAutoplayRef.current) {
      suppressNextLiveAutoplayRef.current = false;
      return;
    }
    setNewLiveRunId(selectedRun.id);
    setSelectedBlockId("");
    setReplayPlaying(true);
  }, [followLiveRuns, mode, selectedRun?.id]);

  useEffect(() => {
    if (!replayPlaying || mode !== "watch" || replaySteps.length === 0) return;
    const timeout = window.setTimeout(() => {
      const currentIndex = replaySteps.findIndex((block) => block.blockId === selectedBlockId);
      const nextIndex = currentIndex < 0 ? 0 : currentIndex + 1;
      if (nextIndex >= replaySteps.length) {
        setReplayPlaying(false);
        return;
      }
      const nextBlockId = replaySteps[nextIndex].blockId;
      if (nextBlockId) setSelectedBlockId(nextBlockId);
    }, 1500);
    return () => window.clearTimeout(timeout);
  }, [mode, replayPlaying, replaySteps, selectedBlockId]);

  function selectReplayStep(index: number) {
    const blockId = replaySteps[index]?.blockId;
    if (!blockId) return;
    setReplayPlaying(false);
    setSelectedBlockId(blockId);
  }

  function setReplayPlayingFromControls(playing: boolean) {
    if (!playing) {
      setReplayPlaying(false);
      return;
    }

    const currentIndex = replaySteps.findIndex((block) => block.blockId === selectedBlockId);
    if (currentIndex < 0 || currentIndex >= replaySteps.length - 1) {
      const firstBlockId = replaySteps[0]?.blockId;
      if (firstBlockId) setSelectedBlockId(firstBlockId);
    }
    setReplayPlaying(true);
  }

  async function addBlockFromLibrary(type: AutomationBlockType) {
    flushSelectedInspector();
    // Send payment must be configured before the API will accept it — open a local draft sheet.
    if (type === "send_transaction") {
      requestEditAction(() => {
        const draft = createDraftBlock(type, sources);
        setDraftRevealErrors(false);
        setDraftBlock(draft);
        setSelectedBlockId(draft.id);
      });
      return;
    }
    // Avoid API toast when the toolkit card should already be disabled for missing devices.
    if (missingDeviceLibraryReason(type, sources)) return;
    requestEditAction(async () => {
      setDraftRevealErrors(false);
      setDraftBlock(null);
      const result = await onAddBlock({
        type,
        config: defaultEditBlockConfig(type, sources, addressBook),
      });
      if (result?.item && !result.item.parentBlockId) setSelectedBlockId(result.item.id);
    });
  }

  async function replaceStartBlockFromLibrary(type: AutomationBlockType) {
    if (type === startBlock?.type) return;
    if (missingDeviceLibraryReason(type, sources)) return;
    flushSelectedInspector();
    requestEditAction(async () => {
      setDraftRevealErrors(false);
      setDraftBlock(null);
      const result = await onReplaceStartBlock({
        type,
        config: defaultEditBlockConfig(type, sources, addressBook),
      });
      setSelectedBlockId(result?.item.id ?? "");
    });
  }

  function flushSelectedInspector() {
    if (mode === "edit") inspectorRef.current?.flush();
  }

  function discardDraftBlock() {
    if (draftBlock && selectedBlockId === draftBlock.id) setSelectedBlockId("");
    setDraftBlock(null);
    setDraftRevealErrors(false);
  }

  function closeDraftBlockSheet() {
    setSelectedBlockId("");
    setDraftRevealErrors(false);
  }

  async function saveDraftBlock() {
    if (!draftBlock) return;
    const draft = draftBlock;
    requestEditAction(async () => {
      await onAddBlock({ type: draft.type, config: draft.config });
      setDraftRevealErrors(false);
      setDraftBlock(null);
      // Done means finish adding — don't reopen the persisted inspector for the new block.
      setSelectedBlockId("");
    });
  }

  function closeSelectedSheet() {
    if (draftSelected) {
      closeDraftBlockSheet();
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
    if (id !== selectedBlockId && selectedBlock) flushSelectedInspector();
    if (mode === "watch") setReplayPlaying(false);
    setSelectedBlockId(id);
  }

  function handleSelectedBackdropPointerDown(event: PointerEvent<HTMLDivElement>) {
    const backdrop = event.currentTarget;
    const previousPointerEvents = backdrop.style.pointerEvents;
    backdrop.style.pointerEvents = "none";
    const target = document.elementFromPoint(event.clientX, event.clientY);
    backdrop.style.pointerEvents = previousPointerEvents;

    const blockElement = target instanceof Element ? target.closest<HTMLElement>("[data-workflow-block-id]") : null;
    const blockId = blockElement?.dataset.workflowBlockId;
    if (blockId && canvasBlocks.some((block) => block.id === blockId)) {
      event.preventDefault();
      selectCanvasBlock(blockId);
      return;
    }

    closeSelectedSheet();
  }

  const workflowNameError = !workflowName.trim() ? "Workflow name is required." : undefined;

  function saveWorkflowNameIfNeeded(nextName = workflowName) {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === workflow.name || trimmed === lastSubmittedNameRef.current) return;
    lastSubmittedNameRef.current = trimmed;
    requestEditAction(() => onUpdateWorkflow({ name: trimmed }));
  }

  function requestEditAction(action: () => unknown | Promise<unknown>) {
    if (mode === "edit" && workflow.enabled && !workflow.archived && !editPauseConfirmedRef.current) {
      setPendingEditAction(() => action);
      return;
    }
    void action();
  }

  async function confirmPauseAndEdit() {
    const action = pendingEditAction;
    if (!action) return;
    await onUpdateWorkflow({ enabled: false });
    editPauseConfirmedRef.current = true;
    setPendingEditAction(null);
    await action();
  }

  return (
    <>
    <WorkflowWorkspaceShell
      breadcrumbLabel={mode === "watch" ? "Watch workflow" : "Edit workflow"}
      railToggleLabel={mode === "watch" ? "Watch controls" : "Toolkit"}
      nameControl={
        mode === "edit" ? (
          <InputField
            aria-label="Workflow name"
            value={workflowName}
            onChange={(event) => {
              const next = event.target.value;
              if (next.trim() && next.trim() !== workflow.name) {
                requestEditAction(() => setWorkflowName(next));
                return;
              }
              setWorkflowName(next);
            }}
            onBlur={(event) => saveWorkflowNameIfNeeded(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveWorkflowNameIfNeeded(event.currentTarget.value);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setWorkflowName(workflow.name);
              }
            }}
            placeholder="Workflow name"
            error={workflowNameError}
          />
        ) : (
          <div aria-label="Workflow name">
            <h1 className="type-title text-text-primary m-0 wrap-anywhere">{workflow.name}</h1>
          </div>
        )
      }
      centerActions={
        <>
          <Button
            type="button"
            variant="ghost"
            className={workflow.enabled ? workflowToggleEnabledClass : workflowTogglePausedClass}
            disabled={busy || workflow.archived || (!workflow.enabled && hasValidationErrors)}
            title={workflow.enabled ? "Pause workflow" : workflowStateTitle}
            aria-pressed={workflow.enabled}
            onClick={() => onUpdateWorkflow({ enabled: !workflow.enabled })}
          >
            {!workflow.enabled ? <span className={workflowTogglePausedKnobClass} aria-hidden /> : null}
            <span className="min-w-16 text-center">{workflow.enabled ? "Enabled" : "Paused"}</span>
            {workflow.enabled ? <span className={workflowToggleEnabledKnobClass} aria-hidden /> : null}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            aria-label={mode === "watch" ? "Edit workflow" : "Watch workflow"}
            title={mode === "watch" ? "Edit workflow" : "Watch workflow"}
            onClick={() => onNavigateMode(mode === "watch" ? "edit" : "watch")}
          >
            {mode === "watch" ? <Pencil aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          </Button>
        </>
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
        </>
      }
      notices={
        mode === "edit" || workflow.archived || workflow.lastError ? (
          <>
            {mode === "edit" ? (
              <Text.Body
                className={`${mutedText} min-h-[1.2em] ${workflow.enabled ? "invisible" : ""}`}
                aria-hidden={workflow.enabled}
              >
                Paused while you edit. Resume when you want it to run.
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
        <div className="flex h-full min-h-0 flex-col">
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
                  onSelectStartBlock={(type) => void replaceStartBlockFromLibrary(type)}
                  onAddBlock={addBlockFromLibrary}
                />
              </div>
            </>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="gap-detail-close grid pb-detail-close">
              {isWorkflowValidationVisible(uiValidation) ? (
                <WorkflowValidationPanel validation={uiValidation} />
              ) : null}
              <WatchRuntimeOverview
                workflow={workflow}
                selectedRun={selectedRun}
                latestRun={latestRun}
                hasValidationErrors={hasValidationErrors}
              />
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
              </div>
            </ScrollArea>
          )}
        </div>
      }
      canvas={
        <WorkflowCanvas
          mode={mode}
          blocks={canvasBlocks}
          sources={sources}
          addressBook={addressBook}
           bottomOverlay={mode === "watch" || mode === "edit"}
          selectedBlockId={selectedBlockId}
           replayActiveBlockId={replayHighlightBlockId}
          validationByBlockId={validationByBlockId}
          runtimeByBlockId={runtimeByBlockId}
          onSelectBlock={selectCanvasBlock}
          onMoveBlock={(blockId, direction) => {
            const index = mainBlocks.findIndex((block) => block.id === blockId);
            if (index > 0) {
              requestEditAction(() => onReorderBlocks(moveBlock(mainBlocks, index, index + direction)));
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
              requestEditAction(() => onDeleteBlock(block.id));
            }
          }}
        />
      }
      toolbar={
        mode === "watch" ? (
          <WatchReplayControls
            selectedRun={selectedRun}
            latestRun={latestRun}
            followLiveRuns={followLiveRuns}
            message={playbackMessage}
            stepCount={replaySteps.length}
            currentStepIndex={replayStepIndex}
            playing={replayPlaying}
            onFollowLiveRunsChange={(value) => {
              setFollowLiveRuns(value);
              if (value && latestRun) {
                suppressNextLiveAutoplayRef.current = true;
                setSelectedRunId(latestRun.id);
                setReplayPlaying(false);
              } else {
                setReplayPlaying(false);
              }
            }}
            onPlayingChange={setReplayPlayingFromControls}
            onSelectStep={selectReplayStep}
          />
        ) : undefined
      }
      selectedBackdrop={
        replayOverlayActive ? (
          <div
            className="bg-overlay-light pointer-events-none h-full w-full"
            aria-hidden
            data-testid="workflow-replay-backdrop"
          />
        ) : draftSelected || selectedBlock ? (
          <div
            className="bg-overlay-light pointer-events-auto h-full w-full"
            aria-hidden
            data-testid="workflow-selected-backdrop"
            onPointerDown={handleSelectedBackdropPointerDown}
            onContextMenu={(event) => {
              event.preventDefault();
              closeSelectedSheet();
            }}
          />
        ) : undefined
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
            backdrop={false}
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
                onCreateAddressBookEntry={onCreateAddressBookEntry}
                onChange={(config) => {
                  setDraftBlock((current) => (current ? { ...current, config } : current));
                }}
                onAttachedChange={() => undefined}
                onAttachedRemove={() => undefined}
              />
            </div>
          </SelectedBlockSheet>
        ) : selectedBlock ? (
          <SelectedBlockSheet
            title={
              mode === "watch" ? `${blockLabel(selectedBlock)} runtime` : blockLabel(selectedBlock)
            }
            description={
              mode === "watch"
                ? "Latest run details for this block."
                : draftBlockDescription(selectedBlock, sources, addressBook)
            }
            backdrop={false}
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
                  onCreateAddressBookEntry={onCreateAddressBookEntry}
                  onDirty={() => requestEditAction(() => undefined)}
                  onAttachStamp={() => {
                    requestEditAction(() => onAddBlock({
                      type: "stamp_integritas",
                      config: {},
                      parentBlockId: selectedBlock.id,
                    }));
                  }}
                  onUpdate={(input) => {
                    requestEditAction(() => onUpdateBlock(selectedBlock.id, input));
                  }}
                  onUpdateAttached={(blockId, input) => {
                    requestEditAction(() => onUpdateBlock(blockId, input));
                  }}
                  onDelete={() => {
                    if (selectedBlock.type.endsWith("_start")) return;
                    requestEditAction(() => onDeleteBlock(selectedBlock.id));
                  }}
                  onDeleteAttached={(blockId) => {
                    requestEditAction(() => onDeleteBlock(blockId));
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
      overlay={
        loadingOverlayLabel ? <WorkflowLoadingOverlay label={loadingOverlayLabel} /> : undefined
      }
      bottom={
        mode === "watch" ? (
          <WatchRunHistory
            runs={runs}
            selectedRunId={selectedRun?.id ?? null}
            replayPlaying={replayPlaying}
            onSelectRun={(runId) => {
              setSelectedRunId(runId);
              setFollowLiveRuns(runId === latestRun?.id);
              onSelectWatchRun(runId);
            }}
          />
        ) : undefined
      }
    />
    {pendingEditAction ? (
      <Modal
        title="Editing will pause this workflow."
        description="It will not run until you resume it."
        closeOnOutsideClick={false}
        layer="top"
        onClose={() => setPendingEditAction(null)}
        closeDisabled={busy}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setPendingEditAction(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void confirmPauseAndEdit()}
            >
              Pause and edit
            </Button>
          </>
        }
      />
    ) : null}
    </>
  );
}

export function WorkflowLoadingOverlay({ label }: { label: string }) {
  return (
    <div className="bg-overlay-light grid h-full place-items-center p-pad-relaxed" role="status" aria-live="polite">
      <div className="rounded-soft border-stroke-secondary bg-surface-always-white gap-detail-next grid min-w-[220px] place-items-center border p-margin-tight shadow-[0_24px_60px_rgba(0,0,0,0.16)]">
        <SpinnerAlt size="md" />
        <p className="type-body-em text-text-primary m-0">{label}</p>
      </div>
    </div>
  );
}

function playbackStatusMessage(
  run: AutomationRun | undefined,
  options: { followingLive: boolean; isNewLiveRun: boolean; playing: boolean },
) {
  if (!run) return "No runs yet";
  const started = formatPlaybackDateTime(run.startedAt);
  const finished = run.finishedAt ? formatPlaybackDateTime(run.finishedAt) : null;

  if (options.isNewLiveRun) {
    if (options.playing || !finished) return `New run playing - ${started}`;
    return `New run completed - ${started} - ${finished}`;
  }

  if (!options.followingLive) {
    if (options.playing) return `Replaying run - ${started}`;
    if (finished) return `Run completed - ${started} - ${finished}`;
    return `Run selected - ${started}`;
  }

  if (finished) return `Latest run completed - ${started} - ${finished}`;
  return `Latest run active - ${started}`;
}

function formatPlaybackDateTime(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
