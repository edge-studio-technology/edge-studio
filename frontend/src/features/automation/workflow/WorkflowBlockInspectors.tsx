import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "../../../components/Button";
import { CheckboxField } from "../../../components/ui/CheckboxField";
import { InputField } from "../../../components/ui/InputField";
import { SelectField } from "../../../components/ui/SelectField";
import { SwitchField } from "../../../components/ui/SwitchField";
import { Text } from "../../../components/ui/Text";
import { TextareaField } from "../../../components/ui/TextareaField";
import type { AddressBookEntry } from "../../address-book/addressBookTypes";
import type { DataSource } from "../../data-sources/dataSourceTypes";
import type { WalletStatus } from "../../wallet/walletTypes";
import { updateAutomationBlock } from "../automationApi";
import type { AutomationBlock, ConditionOperator } from "../automationTypes";
import {
  WORKFLOW_INTERVAL_OPTIONS,
  bodyModeDescription,
  compareValueInputText,
  conditionOperatorOptions,
  defaultConditionSourceConfig,
  defaultCustomBodyText,
  defaultMultipartJsonText,
  defaultPreviewContentText,
  defaultPreviewFormatConfig,
  defaultVariableSourceConfig,
  formatInterval,
  isOutputTarget,
  isReadableSource,
  nativeMinimaTokens,
  operatorHasNoValue,
  outputBodyModeConfig,
  outputBodyModes,
  parseCompareValueInput,
  previewContentModeConfig,
  retargetOutputBlockConfig,
  sendPaymentFieldErrors,
  sourceLabel,
  sourcesForStart,
} from "./workflowHelpers";
import { InspectorSection, errorText, formGridClass, mutedText } from "./workflowWorkspaceUi";
import { draftBlockDescription, isDataBlock, type DraftWorkflowBlock } from "./canvas";

export type PersistedBlockInspectorHandle = {
  /** Persist dirty block config before leaving the options sheet. */
  flush: () => void;
};

/** Block config inspectors for create/edit workflow workspaces. */
export function DraftBlockInspector({
  block,
  sources,
  addressBook,
  walletStatus,
  onChange,
  onAttachedChange,
  onAttachedRemove,
  revealSendPaymentErrors = false,
}: {
  block: DraftWorkflowBlock;
  sources: DataSource[];
  addressBook: AddressBookEntry[];
  walletStatus: WalletStatus | null;
  onChange: (config: AutomationBlock["config"]) => void;
  onAttachedChange: (attachedId: string, config: AutomationBlock["config"]) => void;
  onAttachedRemove: (attachedId: string) => void;
  /** After Done on incomplete Send payment, show required-field errors. */
  revealSendPaymentErrors?: boolean;
}) {
  const startSources = sourcesForStart(block.type, sources);
  const readableSources = sources.filter(isReadableSource);
  const cameraSources = sources.filter((source) => source.type === "pi-camera");
  const outputTargets = sources.filter((source) => isOutputTarget(source));
  const nativeTokens = nativeMinimaTokens(walletStatus);
  const paymentErrors = sendPaymentFieldErrors(block.config, {
    revealRequired: revealSendPaymentErrors,
  });

  if (block.type.endsWith("_start")) {
    const selectedStartSource = startSources.find((source) => source.id === block.config.sourceId);
    const isEventStart =
      block.type === "gpio_event_start" ||
      block.type === "webhook_event_start" ||
      block.type === "mqtt_event_start";
    return (
      <InspectorSection title="Configuration" className={formGridClass}>
        {block.type === "schedule_start" ? (
          <SelectField
            label="Interval"
            value={String(block.config.intervalSeconds ?? 60)}
            options={WORKFLOW_INTERVAL_OPTIONS.map((interval) => ({
              value: String(interval),
              label: formatInterval(interval),
            }))}
            onChange={(event) => onChange({ intervalSeconds: Number(event.target.value) })}
          />
        ) : block.type === "manual_start" ? (
          <p className={mutedText}>Manual workflows run only when you click Run now.</p>
        ) : (
          <SelectField
            label="Start source"
            value={block.config.sourceId ?? ""}
            placeholder="Select source..."
            options={startSources.map((source) => ({
              value: source.id,
              label: `${source.name} - ${sourceLabel(source)}`,
            }))}
            onChange={(event) => {
              const source = startSources.find((item) => item.id === event.target.value);
              onChange({
                ...block.config,
                sourceId: event.target.value,
                activeOnly:
                  source?.config.profile === "pir-motion" ? true : block.config.activeOnly,
                cooldownSeconds:
                  source?.config.profile === "pir-motion" && !block.config.cooldownSeconds
                    ? 60
                    : (block.config.cooldownSeconds ?? 0),
              });
            }}
          />
        )}
        {isEventStart && (
          <>
            <InputField
              label="Cooldown between runs, seconds"
              value={String(block.config.cooldownSeconds ?? 0)}
              inputMode="numeric"
              description="Cooldown ignores extra events for this workflow without creating run-log rows. Use 30-60 seconds for noisy motion sensors or notification outputs."
              onChange={(event) =>
                onChange({ ...block.config, cooldownSeconds: Number(event.target.value) })
              }
            />
          </>
        )}
        {block.type === "gpio_event_start" && (
          <>
            <CheckboxField
              label="Only run when the GPIO event is active"
              checked={Boolean(block.config.activeOnly)}
              description={
                selectedStartSource?.config.profile === "pir-motion"
                  ? "Useful when this PIR watches both rising and falling edges: ignore motion_cleared and run only on motion_detected."
                  : "Use this when inactive GPIO edges should not trigger the workflow."
              }
              onChange={(event) => onChange({ ...block.config, activeOnly: event.target.checked })}
            />
          </>
        )}
      </InspectorSection>
    );
  }

  if (block.type === "fetch_data_source") {
    return (
      <>
        <InspectorSection
          title="Source"
          description="Fetch JSON from a readable device/source such as HTTP JSON or a BME sensor."
          className={formGridClass}
        >
          <SelectField
            label="Readable source"
            value={block.config.sourceId ?? ""}
            placeholder="Select source..."
            options={readableSources.map((source) => ({
              value: source.id,
              label: `${source.name} - ${sourceLabel(source)}`,
            }))}
            onChange={(event) => onChange({ ...block.config, sourceId: event.target.value })}
          />
        </InspectorSection>
        <AttachedStampSettings
          block={block}
          onAttachedChange={onAttachedChange}
          onAttachedRemove={onAttachedRemove}
        />
      </>
    );
  }

  if (block.type === "capture_camera") {
    const selectedCamera = cameraSources.find((source) => source.id === block.config.sourceId);
    return (
      <>
        <InspectorSection
          title="Camera"
          description="Capture a photo or video clip from a configured Raspberry Pi Camera. The media bytes are hashed; read history stores capture metadata."
          className={formGridClass}
        >
          <SelectField
            label="Camera device"
            value={block.config.sourceId ?? ""}
            placeholder="Select camera..."
            options={cameraSources.map((source) => ({
              value: source.id,
              label: `${source.name} - ${sourceLabel(source)}`,
            }))}
            onChange={(event) => onChange({ ...block.config, sourceId: event.target.value })}
          />
          {selectedCamera?.config.mode === "video" && (
            <InputField
              label="Capture duration ms"
              value={String(block.config.durationMs ?? selectedCamera.config.durationMs ?? 5000)}
              inputMode="numeric"
              onChange={(event) =>
                onChange({ ...block.config, durationMs: Number(event.target.value) })
              }
            />
          )}
          {selectedCamera?.config.mode === "photo" && (
            <p className={mutedText}>
              Photo captures use the camera device warmup timeout configured on Devices.
            </p>
          )}
        </InspectorSection>
        <AttachedStampSettings
          block={block}
          onAttachedChange={onAttachedChange}
          onAttachedRemove={onAttachedRemove}
        />
      </>
    );
  }

  if (block.type === "set_variable") {
    const variableSource = block.config.variableSource ?? "custom_json";
    return (
      <InspectorSection
        title="Variable"
        description="Save a per-run value that later condition and output blocks can use."
        className={formGridClass}
      >
        <InputField
          label="Variable name"
          value={block.config.variableName ?? "message"}
          placeholder="discordMessage"
          onChange={(event) => onChange({ ...block.config, variableName: event.target.value })}
        />
        <SelectField
          label="Value source"
          value={variableSource}
          options={[
            { value: "custom_json", label: "Custom JSON" },
            { value: "trigger_field", label: "Trigger field" },
            { value: "latest_data_field", label: "Latest data field" },
            { value: "context_field", label: "Workflow context field" },
          ]}
          onChange={(event) =>
            onChange(
              defaultVariableSourceConfig(
                block.config,
                event.target.value as NonNullable<AutomationBlock["config"]["variableSource"]>,
              ),
            )
          }
        />
        {variableSource === "custom_json" ? (
          <TextareaField
            label="Custom JSON"
            rows={5}
            value={block.config.valueJsonText ?? '"Button pressed"'}
            onChange={(event) =>
              onChange({
                ...block.config,
                variableSource: "custom_json",
                valueJsonText: event.target.value,
              })
            }
          />
        ) : (
          <InputField
            label="Field path"
            value={block.config.fieldPath ?? ""}
            placeholder={
              variableSource === "trigger_field"
                ? "pin"
                : variableSource === "latest_data_field"
                  ? "temperature"
                  : "hash"
            }
            onChange={(event) =>
              onChange({ ...block.config, variableSource, fieldPath: event.target.value })
            }
          />
        )}
      </InspectorSection>
    );
  }

  if (block.type === "if_payload_field_equals") {
    const conditionSource = block.config.source ?? "trigger";
    return (
      <InspectorSection
        title="Condition"
        description="Stop the workflow unless this comparison passes."
        className={formGridClass}
      >
        <SelectField
          label="Condition source"
          value={conditionSource}
          options={[
            { value: "trigger", label: "Trigger event" },
            { value: "variable", label: "Variable" },
          ]}
          onChange={(event) =>
            onChange(
              defaultConditionSourceConfig(
                block.config,
                event.target.value as "trigger" | "variable",
              ),
            )
          }
        />
        {conditionSource === "variable" ? (
          <InputField
            label="Variable name"
            value={block.config.variableName ?? "temp"}
            placeholder="temp"
            onChange={(event) =>
              onChange({ ...block.config, source: "variable", variableName: event.target.value })
            }
          />
        ) : (
          <InputField
            label="Field path"
            value={block.config.fieldPath ?? "active"}
            onChange={(event) =>
              onChange({ ...block.config, source: "trigger", fieldPath: event.target.value })
            }
          />
        )}
        <SelectField
          label="Operator"
          value={block.config.operator ?? "equals"}
          options={conditionOperatorOptions.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onChange={(event) =>
            onChange({ ...block.config, operator: event.target.value as ConditionOperator })
          }
        />
        {!operatorHasNoValue(block.config.operator ?? "equals") && (
          <InputField
            label="Compare value"
            value={compareValueInputText(block.config.value ?? true)}
            onChange={(event) =>
              onChange({ ...block.config, value: parseCompareValueInput(event.target.value) })
            }
          />
        )}
      </InspectorSection>
    );
  }

  if (block.type === "wait") {
    return (
      <InspectorSection
        title="Timing"
        description="Pause before the next block runs."
        className={formGridClass}
      >
        <InputField
          label="Wait duration ms"
          value={String(block.config.durationMs ?? 1000)}
          inputMode="numeric"
          onChange={(event) => onChange({ durationMs: Number(event.target.value) })}
        />
      </InspectorSection>
    );
  }

  if (block.type === "show_preview") {
    const format = block.config.previewFormat ?? "text";
    const contentMode = block.config.contentMode ?? "custom";
    return (
      <InspectorSection
        title="Preview content"
        description="Write a durable preview item into the Workflow inbox."
        className={formGridClass}
      >
        <InputField
          label="Title"
          value={block.config.title ?? "Workflow preview"}
          onChange={(event) => onChange({ ...block.config, title: event.target.value })}
        />
        <SelectField
          label="Preview format"
          value={format}
          options={[
            { value: "text", label: "Text" },
            { value: "json", label: "JSON" },
            { value: "link", label: "Link" },
            { value: "image", label: "Image" },
          ]}
          onChange={(event) =>
            onChange(
              defaultPreviewFormatConfig(
                block.config,
                event.target.value as NonNullable<AutomationBlock["config"]["previewFormat"]>,
              ),
            )
          }
        />
        {format === "image" && (
          <SelectField
            label="Image source"
            value={block.config.imageSource ?? "url"}
            options={[
              { value: "url", label: "URL" },
              { value: "local_path", label: "Local file path" },
            ]}
            onChange={(event) =>
              onChange({
                ...block.config,
                previewFormat: "image",
                imageSource: event.target.value as "url" | "local_path",
              })
            }
          />
        )}
        <SelectField
          label="Content source"
          value={contentMode}
          options={[
            { value: "custom", label: "Custom" },
            { value: "workflow_context", label: "Workflow context" },
            { value: "trigger_payload", label: "Trigger payload" },
            { value: "latest_data", label: "Latest data" },
          ]}
          onChange={(event) =>
            onChange(
              previewContentModeConfig(
                block.config,
                event.target.value as NonNullable<AutomationBlock["config"]["contentMode"]>,
              ),
            )
          }
        />
        {contentMode === "custom" && (
          <TextareaField
            label={
              format === "json"
                ? "Custom JSON"
                : format === "image" && block.config.imageSource === "local_path"
                  ? "Local file path"
                  : "Content"
            }
            rows={format === "text" ? 4 : 6}
            value={
              block.config.contentTemplateText ??
              defaultPreviewContentText(format, block.config.imageSource)
            }
            onChange={(event) =>
              onChange({
                ...block.config,
                contentMode: "custom",
                contentTemplateText: event.target.value,
              })
            }
          />
        )}
      </InspectorSection>
    );
  }

  if (block.type === "control_output") {
    const selectedOutput = outputTargets.find((source) => source.id === block.config.targetId);
    const selectedAction =
      selectedOutput?.type === "gpio-output"
        ? "pulse"
        : selectedOutput?.type === "http-output"
          ? "send_request"
          : selectedOutput?.type === "mqtt-output"
            ? "publish"
            : "pulse";
    const selectedBodyTargetType =
      selectedOutput?.type === "http-output" || selectedOutput?.type === "mqtt-output"
        ? selectedOutput.type
        : null;
    const bodyMode = block.config.bodyMode ?? "workflow_context";
    return (
      <InspectorSection
        title="Output"
        description="Send a command to a configured output target."
        className={formGridClass}
      >
        <SelectField
          label="Output target"
          value={block.config.targetId ?? ""}
          placeholder="Select output target..."
          options={outputTargets.map((source) => ({
            value: source.id,
            label: `${source.name} - ${sourceLabel(source)}`,
          }))}
          onChange={(event) => {
            const target = outputTargets.find((source) => source.id === event.target.value);
            onChange(retargetOutputBlockConfig(block.config, target));
          }}
        />
        {selectedOutput?.type === "gpio-output" && (
          <InputField
            label="Pulse duration ms"
            value={String(block.config.durationMs ?? 500)}
            inputMode="numeric"
            onChange={(event) =>
              onChange({ ...block.config, action: "pulse", durationMs: Number(event.target.value) })
            }
          />
        )}
        {selectedOutput?.type === "gpio-output" && (
          <p className={mutedText}>
            Selected device active state:{" "}
            <strong>{selectedOutput.config.activeState ?? "high"}</strong>. Use High for common GPIO
            to resistor to LED to GND wiring. Change this from Devices by editing the GPIO LED
            target.
          </p>
        )}
        {selectedBodyTargetType && (
          <>
            <SelectField
              label={selectedBodyTargetType === "http-output" ? "Request body" : "Message payload"}
              value={bodyMode}
              options={outputBodyModes(selectedBodyTargetType).map((mode) => ({
                value: mode.value,
                label: mode.label,
              }))}
              onChange={(event) =>
                onChange(
                  outputBodyModeConfig(
                    block.config,
                    event.target.value as NonNullable<AutomationBlock["config"]["bodyMode"]>,
                    selectedBodyTargetType,
                  ),
                )
              }
            />
            {bodyMode === "custom" && (
              <TextareaField
                label="Custom JSON"
                rows={6}
                value={block.config.bodyTemplateText ?? defaultCustomBodyText()}
                onChange={(event) =>
                  onChange({
                    ...block.config,
                    bodyMode: "custom",
                    bodyTemplateText: event.target.value,
                  })
                }
              />
            )}
            {bodyMode === "multipart_media" && (
              <>
                <InputField
                  label="File field name"
                  value={block.config.multipartFileField ?? "file"}
                  placeholder="file"
                  onChange={(event) =>
                    onChange({
                      ...block.config,
                      bodyMode: "multipart_media",
                      multipartFileField: event.target.value,
                    })
                  }
                />
                <InputField
                  label="JSON field name"
                  value={block.config.multipartJsonField ?? ""}
                  placeholder="metadata"
                  onChange={(event) =>
                    onChange({
                      ...block.config,
                      bodyMode: "multipart_media",
                      multipartJsonField: event.target.value,
                    })
                  }
                />
                <TextareaField
                  label="JSON field payload"
                  rows={6}
                  value={block.config.multipartJsonText ?? defaultMultipartJsonText()}
                  onChange={(event) =>
                    onChange({
                      ...block.config,
                      bodyMode: "multipart_media",
                      multipartJsonText: event.target.value,
                    })
                  }
                />
                <p className={mutedText}>
                  Template values: <code>{"{{hash}}"}</code>, <code>{"{{readId}}"}</code>,{" "}
                  <code>{"{{sourceName}}"}</code>, <code>{"{{fileName}}"}</code>,{" "}
                  <code>{"{{mediaType}}"}</code>, <code>{"{{sizeBytes}}"}</code>.
                </p>
              </>
            )}
            <p className={mutedText}>{bodyModeDescription(bodyMode, selectedBodyTargetType)}</p>
          </>
        )}
        {!selectedOutput && (
          <p className={mutedText}>Choose a configured output target from Devices.</p>
        )}
        {selectedAction === "pulse" && (
          <p className={mutedText}>
            Verify resistor wiring and test pulse before enabling GPIO output workflows.
          </p>
        )}
      </InspectorSection>
    );
  }

  if (block.type === "send_transaction") {
    return (
      <InspectorSection
        title="Payment"
        description="This spends wallet funds automatically when the workflow runs."
        className={formGridClass}
      >
        {addressBook.length === 0 ? (
          <p className={mutedText}>You need to create an address book contact first. </p>
        ) : null}
        <SelectField
          label="Address book recipient"
          value={block.config.recipientAddressBookId ?? ""}
          placeholder="Select address book recipient..."
          options={addressBook.map((entry) => ({ value: entry.id, label: entry.label }))}
          error={paymentErrors.recipient}
          disabled={addressBook.length === 0}
          onChange={(event) =>
            onChange({
              ...block.config,
              recipientAddressBookId: event.target.value,
              tokenId: "0x00",
            })
          }
        />
        <SelectField
          label="Token"
          value={block.config.tokenId ?? "0x00"}
          options={
            nativeTokens.length > 0
              ? nativeTokens.map((token) => ({
                  value: "0x00",
                  label: `Minima (native) - ${token.sendable} sendable`,
                }))
              : [{ value: "0x00", label: "Minima (native)" }]
          }
          onChange={() => onChange({ ...block.config, tokenId: "0x00" })}
        />
        <InputField
          label="Amount"
          value={block.config.amount ?? ""}
          inputMode="decimal"
          error={paymentErrors.amount}
          onChange={(event) =>
            onChange({ ...block.config, tokenId: "0x00", amount: event.target.value })
          }
        />
      </InspectorSection>
    );
  }

  if (isDataBlock(block.type)) {
    return (
      <>
        <InspectorSection
          title="Data"
          description={draftBlockDescription(block, sources, addressBook)}
          className={formGridClass}
        />
        <AttachedStampSettings
          block={block}
          onAttachedChange={onAttachedChange}
          onAttachedRemove={onAttachedRemove}
        />
      </>
    );
  }

  return (
    <InspectorSection
      title="Configuration"
      description={draftBlockDescription(block, sources, addressBook)}
    />
  );
}

export function AttachedStampSettings({
  block,
  onAttachedChange,
  onAttachedRemove,
}: {
  block: DraftWorkflowBlock;
  onAttachedChange: (attachedId: string, config: AutomationBlock["config"]) => void;
  onAttachedRemove: (attachedId: string) => void;
}) {
  const stamp = block.attachedBlocks?.find((attached) => attached.type === "stamp_integritas");
  if (!stamp) return null;
  const condition = stamp.config.condition;
  const conditionObject =
    condition && typeof condition === "object" && !Array.isArray(condition)
      ? (condition as NonNullable<AutomationBlock["config"]["condition"]>)
      : null;

  return (
    <InspectorSection
      title="Stamp data"
      description="An Integritas proof is created from this block's data when the workflow runs."
      className={formGridClass}
    >
      <SwitchField
        label="Only stamp when data matches"
        description="Compare a field from this block's produced data before creating the proof."
        checked={Boolean(conditionObject)}
        onChange={(event) =>
          onAttachedChange(stamp.id, {
            condition: event.target.checked
              ? { source: "data", fieldPath: "active", operator: "equals", value: true }
              : null,
          })
        }
      />
      {conditionObject ? (
        <>
          <InputField
            label="Field path"
            description="Path in this block's data (for example active)."
            value={conditionObject.fieldPath ?? "active"}
            onChange={(event) =>
              onAttachedChange(stamp.id, {
                condition: { ...conditionObject, source: "data", fieldPath: event.target.value },
              })
            }
          />
          <SelectField
            label="Operator"
            value={conditionObject.operator ?? "equals"}
            options={conditionOperatorOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            onChange={(event) =>
              onAttachedChange(stamp.id, {
                condition: {
                  ...conditionObject,
                  source: "data",
                  operator: event.target.value as ConditionOperator,
                },
              })
            }
          />
          {!operatorHasNoValue(conditionObject.operator ?? "equals") ? (
            <InputField
              label="Compare value"
              value={compareValueInputText(conditionObject.value ?? true)}
              onChange={(event) =>
                onAttachedChange(stamp.id, {
                  condition: {
                    ...conditionObject,
                    source: "data",
                    value: parseCompareValueInput(event.target.value),
                  },
                })
              }
            />
          ) : null}
        </>
      ) : null}
      <Button type="button" size="sm" variant="danger" onClick={() => onAttachedRemove(stamp.id)}>
        Remove stamp
      </Button>
    </InspectorSection>
  );
}

export const PersistedBlockInspector = forwardRef<
  PersistedBlockInspectorHandle,
  {
    block: AutomationBlock;
    attachedBlocks: AutomationBlock[];
    sources: DataSource[];
    addressBook: AddressBookEntry[];
    walletStatus: WalletStatus | null;
    busy: boolean;
    onDirty: () => void;
    onAttachStamp: () => void;
    onUpdate: (input: Parameters<typeof updateAutomationBlock>[2]) => void;
    onUpdateAttached: (blockId: string, input: Parameters<typeof updateAutomationBlock>[2]) => void;
    onDelete: () => void;
    onDeleteAttached: (blockId: string) => void;
  }
>(function PersistedBlockInspector(
  {
    block,
    attachedBlocks,
    sources,
    addressBook,
    walletStatus,
    busy,
    onDirty,
    onAttachStamp,
    onUpdate,
    onUpdateAttached,
    onDelete,
    onDeleteAttached,
  },
  ref,
) {
  const [config, setConfig] = useState(block.config);
  const [enabled, setEnabled] = useState(block.enabled);
  const configRef = useRef(config);
  const blockIdRef = useRef(block.id);
  const draftBlock: DraftWorkflowBlock = {
    id: block.id,
    type: block.type,
    config,
    attachedBlocks: attachedBlocks.map((attached) => ({
      id: attached.id,
      type: attached.type,
      config: attached.config,
    })),
  };
  const dirty = JSON.stringify(config) !== JSON.stringify(block.config);
  const dirtyRef = useRef(dirty);
  const removable = !block.type.endsWith("_start");
  const canAttachStamp =
    isDataBlock(block.type) &&
    !attachedBlocks.some((attached) => attached.type === "stamp_integritas");

  useEffect(() => {
    if (blockIdRef.current !== block.id) {
      blockIdRef.current = block.id;
      setConfig(block.config);
      return;
    }
    if (dirtyRef.current) return;
    setConfig(block.config);
  }, [block.id, block.config]);

  useEffect(() => {
    setEnabled(block.enabled);
  }, [block.id, block.enabled]);

  useEffect(() => {
    configRef.current = config;
    dirtyRef.current = dirty;
  }, [config, dirty]);

  useImperativeHandle(ref, () => ({
    flush() {
      if (!dirtyRef.current) return;
      onUpdate({ config: configRef.current });
    },
  }));

  return (
    <div className={formGridClass}>
      {!enabled ? (
        <p className={`${mutedText} m-0`}>
          This block is disabled and will be skipped when the workflow runs.
        </p>
      ) : null}
      <DraftBlockInspector
        block={draftBlock}
        sources={sources}
        addressBook={addressBook}
        walletStatus={walletStatus}
        revealSendPaymentErrors
        onChange={(nextConfig) => {
          if (JSON.stringify(nextConfig) !== JSON.stringify(block.config)) onDirty();
          setConfig(nextConfig);
        }}
        onAttachedChange={(attachedId, nextConfig) =>
          onUpdateAttached(attachedId, { config: nextConfig })
        }
        onAttachedRemove={onDeleteAttached}
      />
      {block.lastError && <p className={errorText}>{block.lastError}</p>}
      {canAttachStamp ? (
        <InspectorSection
          title="Stamp data"
          description="Create an Integritas proof for this block's data."
        >
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={onAttachStamp}
          >
            Attach stamp
          </Button>
        </InspectorSection>
      ) : null}
      {removable ? (
        <InspectorSection
          title="Block actions"
          description="Enable or remove this block."
          className={formGridClass}
        >
          <SwitchField
            label={enabled ? "Enabled" : "Disabled"}
            description="Disabled blocks are skipped when the workflow runs."
            checked={enabled}
            onChange={(event) => {
              const nextEnabled = event.target.checked;
              setEnabled(nextEnabled);
              onUpdate(dirty ? { config, enabled: nextEnabled } : { enabled: nextEnabled });
            }}
          />
          <Button type="button" size="sm" variant="danger" onClick={onDelete}>
            Remove block
          </Button>
        </InspectorSection>
      ) : null}
    </div>
  );
});
