import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { InputField } from "../../../components/ui/InputField";
import { cx } from "../../../lib/cx";
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
  WorkflowBlockLibrary,
  WorkflowCanvas,
  WorkflowWorkspaceShell,
  type DraftWorkflowBlock,
} from "./canvas";
import { createDraftBlock, flattenDraftBlocks, validationIssuesByBlockId } from "./workflowHelpers";
import {
  Panel,
  SelectedBlockSheet,
  WorkflowValidationPanel,
  formGridClass,
  inspectorClass,
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
  const [backendValidation, setBackendValidation] = useState<AutomationValidationResult | null>(
    null,
  );
  const [backendValidationError, setBackendValidationError] = useState<string | null>(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const selectedBlock = selectedBlockId
    ? draftBlocks.find((block) => block.id === selectedBlockId)
    : undefined;
  const toolkitSelectedBlock = selectedBlock ?? draftBlocks[0];
  const localErrors = name.trim() ? [] : ["Workflow name is required."];
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
              onClick={() => onCreate(flattenDraftBlocks(draftBlocks))}
            >
              Create workflow
            </Button>
          </>
        }
        leftRail={
          <aside className={cx(inspectorClass, formGridClass)}>
            <Panel>
              <label className="gap-detail-next type-meta text-text-primary grid grid-cols-[auto_minmax(0,1fr)] items-center">
                <input
                  className="w-auto"
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => onEnabledChange(event.target.checked)}
                />
                Enabled after create
              </label>
            </Panel>
            {draftBlocks.length > 0 && (
              <WorkflowValidationPanel
                validation={backendValidation}
                fetchError={backendValidationError}
                description="Fix errors before creating. Review any warnings before creating."
              />
            )}
          </aside>
        }
        rail={
          <aside className={inspectorClass}>
            <WorkflowBlockLibrary
              hasStartBlock={hasStartBlock}
              selectedBlock={toolkitSelectedBlock}
              onSelectStartBlock={selectStartBlock}
              onAddBlock={addDraftBlock}
              onAttachStamp={attachStampBlock}
            />
          </aside>
        }
        canvas={
          <WorkflowCanvas
            mode="build"
            blocks={draftBlocks}
            sources={sources}
            statusLabel={enabled ? "Enabled on create" : "Paused on create"}
            statusGood={enabled}
            dimmed={Boolean(selectedBlock)}
            selectedBlockId={selectedBlock?.id ?? ""}
            validationByBlockId={draftValidationByBlockId}
            onSelectBlock={setSelectedBlockId}
            onMoveBlock={moveDraftBlock}
            onRemoveBlock={removeDraftBlock}
          />
        }
        selectedSheet={
          selectedBlock ? (
            <SelectedBlockSheet
              title={draftBlockTitle(selectedBlock)}
              description={draftBlockDescription(selectedBlock, sources)}
              onClose={() => setSelectedBlockId("")}
              footer={
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !canCreate}
                  onClick={() => onCreate(flattenDraftBlocks(draftBlocks))}
                >
                  Save and close
                </Button>
              }
            >
              <DraftBlockInspector
                block={selectedBlock}
                sources={sources}
                addressBook={addressBook}
                walletStatus={walletStatus}
                onChange={(config) => updateBlock(selectedBlock.id, { config })}
                onAttachedChange={(attachedId, config) =>
                  updateAttachedBlock(selectedBlock.id, attachedId, config)
                }
                onAttachedRemove={(attachedId) => removeAttachedBlock(selectedBlock.id, attachedId)}
              />
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
