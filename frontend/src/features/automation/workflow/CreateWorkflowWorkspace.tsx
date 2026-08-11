import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { InputField } from "../../../components/ui/InputField";
import type { AddressBookEntry } from "../../address-book/addressBookTypes";
import type { DataSource } from "../../data-sources/dataSourceTypes";
import type { WalletStatus } from "../../wallet/walletTypes";
import { validateAutomationDraft } from "../automationApi";
import type {
  AutomationBlock,
  AutomationBlockType,
  AutomationValidationResult,
} from "../automationTypes";
import { DraftBlockInspector } from "./WorkflowBlockInspectors";
import {
  draftBlockDescription,
  draftBlockTitle,
  isDataBlock,
  WorkflowCanvas,
  type DraftWorkflowBlock,
} from "./canvas";
import { WorkflowWorkspaceShell } from "./chrome/WorkflowWorkspaceShell";
import { WorkflowBlockLibrary } from "./toolkit/WorkflowBlockLibrary";
import {
  canPersistSendTransactionConfig,
  createDraftBlock,
  flattenDraftBlocks,
  missingDeviceLibraryReason,
  validationIssuesByBlockId,
  withSoftenedInsufficientBalance,
} from "./workflowHelpers";
import {
  BlockHelpDisclosure,
  formGridClass,
  InspectorSection,
  SelectedBlockSheet,
  WorkflowValidationPanel,
  isWorkflowValidationVisible,
} from "./workflowWorkspaceUi";

/** Create-mode workflow editor (draft blocks + leave confirmation). */
export function CreateWorkflowWorkspace({
  name,
  initialName,
  enabled,
  sources,
  addressBook,
  walletStatus,
  busy,
  onNameChange,
  onEnabledChange,
  onCancel,
  onCreate,
}: {
  name: string;
  initialName: string;
  enabled: boolean;
  sources: DataSource[];
  addressBook: AddressBookEntry[];
  walletStatus: WalletStatus | null;
  busy: boolean;
  onNameChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
  onCancel: () => void;
  onCreate: (
    blocks: {
      type: AutomationBlockType;
      config: AutomationBlock["config"];
      enabled?: boolean;
      parentBlockId?: string | null;
      clientId?: string | null;
    }[],
  ) => void;
}) {
  const [draftBlocks, setDraftBlocks] = useState<DraftWorkflowBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [revealSendPaymentErrors, setRevealSendPaymentErrors] = useState(false);
  const [backendValidation, setBackendValidation] = useState<AutomationValidationResult | null>(
    null,
  );
  const [backendValidationError, setBackendValidationError] = useState<string | null>(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const selectedBlock = selectedBlockId
    ? draftBlocks.find((block) => block.id === selectedBlockId)
    : undefined;
  const localErrors = name.trim() ? [] : ["Workflow name is required."];
  const uiValidation = withSoftenedInsufficientBalance(backendValidation);
  const canCreate = localErrors.length === 0 && Boolean(uiValidation?.ok);
  const createBlockedReason = !name.trim()
    ? "Workflow name is required."
    : uiValidation && !uiValidation.ok
      ? "Fix validation errors before creating."
      : backendValidationError
        ? "Validation is unavailable."
        : !backendValidation
          ? "Checking workflow…"
          : undefined;
  const hasStartBlock = draftBlocks.some((block) => block.type.endsWith("_start"));
  const selectedStartType = draftBlocks.find((block) => block.type.endsWith("_start"))?.type;
  const canAddRecordTriggerEvent = Boolean(
    selectedStartType &&
    (selectedStartType === "gpio_event_start" ||
      selectedStartType === "webhook_event_start" ||
      selectedStartType === "mqtt_event_start") &&
    !draftBlocks.some((block) => block.type === "record_trigger_event"),
  );
  const draftValidationByBlockId = validationIssuesByBlockId(uiValidation);

  useEffect(() => {
    let cancelled = false;
    setBackendValidationError(null);
    validateAutomationDraft({ blocks: flattenDraftBlocks(draftBlocks) })
      .then((response) => {
        if (!cancelled) setBackendValidation(response.item);
      })
      .catch((error) => {
        if (!cancelled)
          setBackendValidationError(
            error instanceof Error ? error.message : "Could not validate draft workflow.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [draftBlocks]);

  function updateBlock(id: string, patch: Partial<DraftWorkflowBlock>) {
    setDraftBlocks((blocks) =>
      blocks.map((block) =>
        block.id === id ? { ...block, ...patch, config: patch.config ?? block.config } : block,
      ),
    );
  }

  function attachStampBlock(parentId: string) {
    setDraftBlocks((blocks) =>
      blocks.map((block) =>
        block.id === parentId
          ? {
              ...block,
              attachedBlocks: [
                ...(block.attachedBlocks ?? []),
                createDraftBlock("stamp_integritas", sources),
              ],
            }
          : block,
      ),
    );
    setSelectedBlockId(parentId);
  }

  function updateAttachedBlock(
    parentId: string,
    attachedId: string,
    config: AutomationBlock["config"],
  ) {
    setDraftBlocks((blocks) =>
      blocks.map((block) =>
        block.id === parentId
          ? {
              ...block,
              attachedBlocks: (block.attachedBlocks ?? []).map((attached) =>
                attached.id === attachedId ? { ...attached, config } : attached,
              ),
            }
          : block,
      ),
    );
  }

  function removeAttachedBlock(parentId: string, attachedId: string) {
    setDraftBlocks((blocks) =>
      blocks.map((block) =>
        block.id === parentId
          ? {
              ...block,
              attachedBlocks: (block.attachedBlocks ?? []).filter(
                (attached) => attached.id !== attachedId,
              ),
            }
          : block,
      ),
    );
  }

  function addDraftBlock(type: AutomationBlockType) {
    if (!hasStartBlock && !type.endsWith("_start")) return;
    if (type === "send_transaction" && addressBook.length === 0) return;
    if (missingDeviceLibraryReason(type, sources)) return;
    const block = createDraftBlock(type, sources);
    setDraftBlocks((blocks) => [...blocks, block]);
    setSelectedBlockId(block.id);
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
    if (missingDeviceLibraryReason(type, sources)) return;
    const start = createDraftBlock(type, sources);
    const startIndex = draftBlocks.findIndex((block) => block.type.endsWith("_start"));
    if (startIndex < 0) {
      setDraftBlocks([start]);
      setSelectedBlockId(type === "manual_start" ? "" : start.id);
      return;
    }
    if (draftBlocks[startIndex].type === type) {
      // Re-open options for starts that have configuration.
      if (type !== "manual_start") setSelectedBlockId(draftBlocks[startIndex].id);
      return;
    }
    const next = [...draftBlocks];
    next[startIndex] = start;
    setDraftBlocks(next);
    setSelectedBlockId(type === "manual_start" ? "" : start.id);
  }

  function resetCanvas() {
    setDraftBlocks([]);
    setSelectedBlockId("");
  }

  function requestCancel() {
    const nameDirty = name.trim() !== initialName.trim();
    if (draftBlocks.length > 0 || nameDirty) {
      setConfirmLeaveOpen(true);
      return;
    }
    onCancel();
  }

  return (
    <>
      <WorkflowWorkspaceShell
        breadcrumbLabel="Create workflow"
        nameControl={
          <InputField
            aria-label="Workflow name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Workflow name"
            error={localErrors[0]}
          />
        }
        actions={
          <>
            <Button type="button" variant="ghost" disabled={busy} onClick={requestCancel}>
              Back
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || draftBlocks.length === 0}
              onClick={resetCanvas}
            >
              Reset canvas
            </Button>
            <Button
              type="button"
              disabled={busy || !canCreate}
              title={createBlockedReason}
              onClick={() => onCreate(flattenDraftBlocks(draftBlocks))}
            >
              Create workflow
            </Button>
          </>
        }
        rail={
          <aside className="gap-detail-close flex h-full min-h-0 flex-col">
            {draftBlocks.length > 0 &&
            isWorkflowValidationVisible(uiValidation, [], backendValidationError) ? (
              <WorkflowValidationPanel
                validation={uiValidation}
                fetchError={backendValidationError}
                description="Fix errors before creating. Review any warnings before creating."
              />
            ) : null}
            <div className="min-h-0 flex-1">
              <WorkflowBlockLibrary
                hasStartBlock={hasStartBlock}
                selectedStartType={selectedStartType}
                canAddRecordTriggerEvent={canAddRecordTriggerEvent}
                canAddSendPayment={addressBook.length > 0}
                sources={sources}
                enabled={enabled}
                onEnabledChange={onEnabledChange}
                onSelectStartBlock={selectStartBlock}
                onAddBlock={addDraftBlock}
              />
            </div>
          </aside>
        }
        canvas={
          <WorkflowCanvas
            mode="build"
            blocks={draftBlocks}
            sources={sources}
            statusLabel={enabled ? "Enabled on create" : "Paused on create"}
            statusGood={enabled}
            selectedBlockId={selectedBlock?.id ?? ""}
            validationByBlockId={draftValidationByBlockId}
            onSelectBlock={(id) => {
              const block = draftBlocks.find((item) => item.id === id);
              // Manual run has nothing to configure — don't open the options sheet.
              setRevealSendPaymentErrors(false);
              setSelectedBlockId(block?.type === "manual_start" ? "" : id);
            }}
            onMoveBlock={moveDraftBlock}
            onRemoveBlock={removeDraftBlock}
          />
        }
        selectedSheet={
          selectedBlock && selectedBlock.type !== "manual_start" ? (
            <SelectedBlockSheet
              title={draftBlockTitle(selectedBlock)}
              description={draftBlockDescription(selectedBlock, sources)}
              onClose={() => {
                setRevealSendPaymentErrors(false);
                setSelectedBlockId("");
              }}
              footer={
                <Button
                  type="button"
                  onClick={() => {
                    if (
                      selectedBlock.type === "send_transaction" &&
                      !canPersistSendTransactionConfig(selectedBlock.config)
                    ) {
                      setRevealSendPaymentErrors(true);
                      return;
                    }
                    setRevealSendPaymentErrors(false);
                    setSelectedBlockId("");
                  }}
                >
                  Done
                </Button>
              }
            >
              <div className={formGridClass}>
                <BlockHelpDisclosure type={selectedBlock.type} />
                <DraftBlockInspector
                  block={selectedBlock}
                  sources={sources}
                  addressBook={addressBook}
                  walletStatus={walletStatus}
                  revealSendPaymentErrors={revealSendPaymentErrors}
                  onChange={(config) => updateBlock(selectedBlock.id, { config })}
                  onAttachedChange={(attachedId, config) =>
                    updateAttachedBlock(selectedBlock.id, attachedId, config)
                  }
                  onAttachedRemove={(attachedId) =>
                    removeAttachedBlock(selectedBlock.id, attachedId)
                  }
                />
                {isDataBlock(selectedBlock.type) &&
                !selectedBlock.attachedBlocks?.some(
                  (attached) => attached.type === "stamp_integritas",
                ) ? (
                  <InspectorSection
                    title="Stamp data"
                    description="Create an Integritas proof for this block's data."
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => attachStampBlock(selectedBlock.id)}
                    >
                      Attach stamp
                    </Button>
                  </InspectorSection>
                ) : null}
              </div>
            </SelectedBlockSheet>
          ) : undefined
        }
      />
      {confirmLeaveOpen && (
        <Modal
          title="Are you sure?"
          description="If you leave without publishing, your progress won't be saved."
          onClose={() => setConfirmLeaveOpen(false)}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setConfirmLeaveOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={onCancel}>
                Go to my library
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
