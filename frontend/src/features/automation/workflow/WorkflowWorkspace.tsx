import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/Button";
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
  PersistedBlockInspector,
  type PersistedBlockInspectorHandle,
} from "./WorkflowBlockInspectors";
import { WatchRunControls, WatchRuntimeInspector, WatchRunHistory } from "./WorkflowWatchUi";
import {
  automationBlockToCanvasBlock,
  draftBlockDescription,
  WorkflowBlockLibrary,
  WorkflowCanvas,
  WorkflowWorkspaceShell,
} from "./canvas";
import {
  blockLabel,
  blockRunForBlock,
  defaultEditBlockConfig,
  examplePayload,
  moveBlock,
  runtimeByBlockIdFromRun,
  validationIssuesByBlockId,
  workflowIntervalSeconds,
} from "./workflowHelpers";
import {
  SelectedBlockSheet,
  StatusPill,
  WorkflowStatusPill,
  WorkflowValidationPanel,
  errorText,
  isWorkflowValidationVisible,
  mutedText,
} from "./workflowWorkspaceUi";
import { Text } from "../../../components/Text";
import { formatLocalTime } from "../../../lib/time";

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
  const inspectorRef = useRef<PersistedBlockInspectorHandle>(null);
  /** Edit-session pause: pause once per workflow while editing. */
  const editPauseSessionRef = useRef<{
    workflowId: string;
    didPause: boolean;
  } | null>(null);
  const selectedBlock = selectedBlockId
    ? mainBlocks.find((block) => block.id === selectedBlockId)
    : undefined;
  const selectedDraftBlock = selectedBlock
    ? {
        id: selectedBlock.id,
        type: selectedBlock.type,
        config: selectedBlock.config,
        attachedBlocks: workflow.blocks
          .filter((item) => item.parentBlockId === selectedBlock.id)
          .map((item) => ({ id: item.id, type: item.type, config: item.config })),
      }
    : undefined;
  const canvasBlocks = mainBlocks.map((block) =>
    automationBlockToCanvasBlock(block, workflow.blocks),
  );
  const canAddRecordTriggerEvent = Boolean(
    startBlock &&
    (startBlock.type === "gpio_event_start" ||
      startBlock.type === "webhook_event_start" ||
      startBlock.type === "mqtt_event_start") &&
    !mainBlocks.some((block) => block.type === "record_trigger_event"),
  );
  const hasValidationErrors = Boolean(validation && validation.errors.length > 0);
  const validationByBlockId = validationIssuesByBlockId(validation);
  const selectedRun =
    mode === "watch" ? (runs.find((run) => run.id === selectedRunId) ?? runs[0]) : undefined;
  const runtimeByBlockId = mode === "watch" ? runtimeByBlockIdFromRun(selectedRun) : {};
  const watchRunStatusLabel =
    selectedRun?.status === "running"
      ? "Live updating"
      : selectedRun
        ? "Viewing historic run"
        : "No run selected";

  useEffect(() => {
    if (selectedBlockId && !mainBlocks.some((block) => block.id === selectedBlockId))
      setSelectedBlockId("");
  }, [mainBlocks, selectedBlockId]);

  useEffect(() => {
    setWorkflowName(workflow.name);
  }, [workflow.id, workflow.name]);

  // Auto-pause while editing so schedule/event triggers cannot run mid-change.
  useEffect(() => {
    if (mode !== "edit" || workflow.archived) return;

    let session = editPauseSessionRef.current;
    if (!session || session.workflowId !== workflow.id) {
      session = {
        workflowId: workflow.id,
        didPause: false,
      };
      editPauseSessionRef.current = session;
    }
    if (session.didPause) return;

    session.didPause = true;
    if (workflow.enabled) {
      setPausedForEditNotice(true);
      onUpdateWorkflow({ enabled: false });
    }
  }, [mode, workflow.archived, workflow.enabled, workflow.id, onUpdateWorkflow]);

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
    const result = await onAddBlock({
      type,
      config: defaultEditBlockConfig(type, sources, addressBook),
    });
    if (result?.item && !result.item.parentBlockId) setSelectedBlockId(result.item.id);
  }

  function flushSelectedInspector() {
    if (mode === "edit") inspectorRef.current?.flush();
  }

  function closeSelectedSheet() {
    flushSelectedInspector();
    setSelectedBlockId("");
  }

  function selectCanvasBlock(id: string) {
    const block = mainBlocks.find((item) => item.id === id);
    if (mode !== "watch" && block?.type === "manual_start") {
      closeSelectedSheet();
      return;
    }
    if (id !== selectedBlockId) flushSelectedInspector();
    setSelectedBlockId(id);
  }

  const workflowNameDirty = workflowName.trim() !== workflow.name;

  return (
    <WorkflowWorkspaceShell
      breadcrumbLabel={mode === "watch" ? "Watch workflow" : "Edit workflow"}
      nameControl={
        mode === "edit" ? (
          <input
            aria-label="Workflow name"
            value={workflowName}
            onChange={(event) => setWorkflowName(event.target.value)}
            placeholder="Workflow name"
          />
        ) : (
          <input aria-label="Workflow name" value={workflow.name} readOnly />
        )
      }
      actions={
        <>
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onBack}>
            Back to workflows
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => onNavigateMode(mode === "watch" ? "edit" : "watch")}
          >
            {mode === "watch" ? "Open in edit" : "Open in watch"}
          </Button>
          {mode === "edit" && (
            <Button
              type="button"
              size="sm"
              disabled={busy || !workflowName.trim() || !workflowNameDirty}
              onClick={() => onUpdateWorkflow({ name: workflowName.trim() })}
            >
              Save workflow name
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || hasValidationErrors || workflow.archived}
            onClick={onRunNow}
          >
            Run now
          </Button>
          {mode === "watch" && (
            <>
              <WorkflowStatusPill workflow={workflow} />
              <StatusPill status={selectedRun?.status === "running" ? "good" : "neutral"}>
                {watchRunStatusLabel}
              </StatusPill>
            </>
          )}
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
        </>
      }
      notices={
        (mode === "edit" && pausedForEditNotice) || workflow.archived || workflow.lastError ? (
          <>
            {mode === "edit" && pausedForEditNotice && (
              <Text.Body className={mutedText}>
                Paused while editing to prevent it from running with unfinished changes. Turn on{" "}
                <strong className="text-text-primary">Run automatically</strong> in the toolkit when
                you want it live again.
              </Text.Body>
            )}
            {workflow.archived && (
              <p className={mutedText}>
                Archived workflows do not run automatically or manually until restored.
              </p>
            )}
            {workflow.lastError && <p className={errorText}>{workflow.lastError}</p>}
          </>
        ) : undefined
      }
      rail={
        <aside className="gap-detail-close flex h-full min-h-0 flex-col">
          {mode === "edit" ? (
            <>
              {isWorkflowValidationVisible(validation) ? (
                <WorkflowValidationPanel
                  validation={validation}
                  description="Fix errors before running. Warnings are allowed, but should be reviewed before enabling hardware or wallet actions."
                />
              ) : null}
              <div className="min-h-0 flex-1">
                <WorkflowBlockLibrary
                  mode="edit"
                  hasStartBlock={Boolean(startBlock)}
                  selectedStartType={startBlock?.type}
                  canAddRecordTriggerEvent={canAddRecordTriggerEvent}
                  enabled={workflow.enabled}
                  enabledDisabled={busy || workflow.archived}
                  onEnabledChange={(value) => onUpdateWorkflow({ enabled: value })}
                  onSelectStartBlock={() => undefined}
                  onAddBlock={addBlockFromLibrary}
                />
              </div>
            </>
          ) : (
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
          )}
        </aside>
      }
      canvas={
        <WorkflowCanvas
          mode={mode}
          blocks={canvasBlocks}
          sources={sources}
          statusLabel={workflow.archived ? "Archived" : workflow.enabled ? "Enabled" : "Paused"}
          statusGood={!workflow.archived && workflow.enabled}
          bottomOverlay={mode === "watch"}
          selectedBlockId={selectedBlock?.id ?? ""}
          validationByBlockId={validationByBlockId}
          runtimeByBlockId={runtimeByBlockId}
          onSelectBlock={selectCanvasBlock}
          onMoveBlock={(blockId, direction) => {
            const index = mainBlocks.findIndex((block) => block.id === blockId);
            if (index > 0) onReorderBlocks(moveBlock(mainBlocks, index, index + direction));
          }}
          onRemoveBlock={(blockId) => {
            const block = mainBlocks.find((item) => item.id === blockId);
            if (block && !block.type.endsWith("_start")) {
              if (blockId === selectedBlockId) flushSelectedInspector();
              onDeleteBlock(block.id);
            }
          }}
        />
      }
      selectedSheet={
        selectedBlock && (mode === "watch" || selectedBlock.type !== "manual_start") ? (
          <SelectedBlockSheet
            title={
              mode === "watch" ? `${blockLabel(selectedBlock)} runtime` : blockLabel(selectedBlock)
            }
            description={
              mode === "watch"
                ? "Latest run details for this block."
                : draftBlockDescription(selectedBlock, sources)
            }
            onClose={closeSelectedSheet}
            footer={
              <Button type="button" size="sm" onClick={closeSelectedSheet}>
                Done
              </Button>
            }
          >
            {mode === "edit" ? (
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
                onAttachStamp={() =>
                  onAddBlock({
                    type: "stamp_integritas",
                    config: {},
                    parentBlockId: selectedBlock.id,
                  })
                }
                onUpdate={(input) => onUpdateBlock(selectedBlock.id, input)}
                onUpdateAttached={(blockId, input) => onUpdateBlock(blockId, input)}
                onDelete={() =>
                  selectedBlock.type.endsWith("_start")
                    ? undefined
                    : onDeleteBlock(selectedBlock.id)
                }
                onDeleteAttached={onDeleteBlock}
              />
            ) : (
              <WatchRuntimeInspector
                selectedBlock={selectedBlock}
                latestBlockRun={blockRunForBlock(selectedRun, selectedBlock.id)}
                selectedRun={selectedRun}
                validation={validation}
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
