import { describe, expect, it } from "vitest";
import type { AddressBookEntry } from "../../../../src/features/address-book/addressBookTypes";
import type { DataSource } from "../../../../src/features/data-sources/dataSourceTypes";
import type {
  AutomationBlock,
  AutomationRun,
  AutomationValidationResult,
  AutomationWorkflow,
} from "../../../../src/features/automation/automationTypes";
import type { WalletStatus } from "../../../../src/features/wallet/walletTypes";
import {
  bodyModeDescription,
  canPersistSendTransactionConfig,
  compareValueInputText,
  compatibleBodyMode,
  conditionOperatorOptions,
  conditionSourceLabel,
  createDraftBlock,
  defaultConditionSourceConfig,
  defaultCreateWorkflowName,
  defaultCustomBodyText,
  defaultDraftConfig,
  defaultEditBlockConfig,
  defaultMultipartJsonText,
  defaultOutputBlockConfig,
  defaultPreviewContentText,
  defaultPreviewFormatConfig,
  defaultSourceForStart,
  defaultVariableSourceConfig,
  diagnosticsLink,
  examplePayload,
  firstCameraSource,
  firstReadableSource,
  flattenDraftBlocks,
  formatInterval,
  groupValidationIssues,
  isImagePreviewContent,
  isOutputTarget,
  isReadableSource,
  missingDeviceLibraryReason,
  moveBlock,
  nativeMinimaTokens,
  operatorHasNoValue,
  outputActionForTarget,
  outputBodyModeConfig,
  outputBodyModes,
  parseCompareValueInput,
  previewContentModeConfig,
  proofIdFromOutput,
  readIdFromOutput,
  retargetOutputBlockConfig,
  runtimeByBlockIdFromRun,
  sendPaymentFieldErrors,
  sourceLabel,
  sourcesForStart,
  summarizeBlocks,
  textPreviewContent,
  validationIssuesByBlockId,
  withSoftenedInsufficientBalance,
  workflowIntervalSeconds,
  workflowMatchesFilter,
  workflowPrimarySourceId,
  blockLabel,
  blockShortLabel,
  blockRunForBlock,
  WORKFLOW_INTERVAL_OPTIONS,
} from "../../../../src/features/automation/workflow/workflowHelpers";

function source(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: "src-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    name: "HTTP source",
    type: "json-api",
    status: "ok",
    description: null,
    config: {},
    lastReadAt: null,
    lastError: null,
    lastPreview: null,
    lastHash: null,
    ...overrides,
  };
}

function contact(overrides: Partial<AddressBookEntry> = {}): AddressBookEntry {
  return {
    id: "c1",
    label: "Alice",
    address: "Mx1234",
    notes: null,
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function block(overrides: Partial<AutomationBlock> = {}): AutomationBlock {
  return {
    id: "b1",
    workflowId: "w1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    type: "manual_start",
    enabled: true,
    order: 0,
    parentBlockId: null,
    config: {},
    lastRunAt: null,
    lastError: null,
    ...overrides,
  };
}

function workflow(overrides: Partial<AutomationWorkflow> = {}): AutomationWorkflow {
  return {
    id: "w1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    name: "My workflow",
    enabled: true,
    archived: false,
    lastRunAt: null,
    nextRunAt: null,
    lastHash: null,
    lastProofId: null,
    lastError: null,
    blocks: [],
    ...overrides,
  };
}

function run(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: "r1",
    workflowId: "w1",
    workflowName: "My workflow",
    startedAt: "2026-08-01T00:00:00.000Z",
    finishedAt: null,
    status: "running",
    triggerType: "manual",
    triggerSourceId: null,
    triggerPayload: null,
    durationMs: null,
    blockCount: 0,
    error: null,
    blocks: [],
    ...overrides,
  };
}

describe("workflowHelpers", () => {
  it("WORKFLOW_INTERVAL_OPTIONS lists the supported schedule intervals", () => {
    expect(WORKFLOW_INTERVAL_OPTIONS).toEqual([10, 30, 60, 300, 900, 3600]);
  });

  it("conditionOperatorOptions covers all condition operators", () => {
    expect(conditionOperatorOptions.map((option) => option.value)).toEqual([
      "equals",
      "not_equals",
      "greater_than",
      "greater_than_or_equals",
      "less_than",
      "less_than_or_equals",
      "exists",
      "does_not_exist",
    ]);
  });

  describe("defaultCreateWorkflowName", () => {
    it("formats a name with today's date", () => {
      const now = new Date("2026-08-07T12:00:00.000Z");
      const expectedDate = now.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      expect(defaultCreateWorkflowName(now)).toBe(`New workflow - ${expectedDate}`);
    });
  });

  describe("flattenDraftBlocks", () => {
    it("flattens main blocks and attached blocks with parentBlockId set", () => {
      const result = flattenDraftBlocks([
        {
          id: "main-1",
          type: "fetch_data_source",
          config: { sourceId: "src-1" },
          attachedBlocks: [{ id: "stamp-1", type: "stamp_integritas", config: {} }],
        },
      ]);
      expect(result).toEqual([
        { type: "fetch_data_source", config: { sourceId: "src-1" }, clientId: "main-1" },
        {
          type: "stamp_integritas",
          config: {},
          clientId: "stamp-1",
          parentBlockId: "main-1",
        },
      ]);
    });

    it("returns an empty array for an empty draft", () => {
      expect(flattenDraftBlocks([])).toEqual([]);
    });
  });

  describe("createDraftBlock", () => {
    it("creates a draft block with a type-prefixed id and default config", () => {
      const draft = createDraftBlock("wait", []);
      expect(draft.type).toBe("wait");
      expect(draft.id.startsWith("wait-")).toBe(true);
      expect(draft.config).toEqual({ durationMs: 1000 });
    });
  });

  describe("defaultDraftConfig", () => {
    it("schedule_start defaults to the given polling interval", () => {
      expect(defaultDraftConfig("schedule_start", [], 120)).toEqual({ intervalSeconds: 120 });
    });

    it("manual_start has no config", () => {
      expect(defaultDraftConfig("manual_start", [])).toEqual({});
    });

    it("fetch_data_source picks the first readable source", () => {
      const readable = source({ id: "s1", type: "bme-sensor" });
      const unreadable = source({ id: "s0", type: "gpio-output" });
      expect(defaultDraftConfig("fetch_data_source", [unreadable, readable])).toEqual({
        sourceId: "s1",
      });
    });

    it("fetch_data_source defaults to an empty sourceId with no readable sources", () => {
      expect(defaultDraftConfig("fetch_data_source", [])).toEqual({ sourceId: "" });
    });

    it("capture_camera picks the first pi-camera source", () => {
      const camera = source({ id: "cam-1", type: "pi-camera" });
      expect(defaultDraftConfig("capture_camera", [camera])).toEqual({ sourceId: "cam-1" });
    });

    it("gpio_event_start defaults active-only and a 60s cooldown for PIR motion sources", () => {
      const pir = source({ id: "gpio-1", type: "gpio-input", config: { profile: "pir-motion" } });
      expect(defaultDraftConfig("gpio_event_start", [pir])).toEqual({
        sourceId: "gpio-1",
        activeOnly: true,
        cooldownSeconds: 60,
      });
    });

    it("gpio_event_start defaults to no cooldown for a non-PIR source", () => {
      const generic = source({ id: "gpio-1", type: "gpio-input", config: { profile: "generic" } });
      expect(defaultDraftConfig("gpio_event_start", [generic])).toEqual({
        sourceId: "gpio-1",
        activeOnly: undefined,
        cooldownSeconds: 0,
      });
    });

    it("if_payload_field_equals defaults to trigger/active/equals/true", () => {
      expect(defaultDraftConfig("if_payload_field_equals", [])).toEqual({
        source: "trigger",
        fieldPath: "active",
        operator: "equals",
        value: true,
      });
    });

    it("wait defaults to a 1000ms duration", () => {
      expect(defaultDraftConfig("wait", [])).toEqual({ durationMs: 1000 });
    });

    it("show_preview defaults to a text preview", () => {
      expect(defaultDraftConfig("show_preview", [])).toEqual({
        title: "Workflow preview",
        previewFormat: "text",
        contentMode: "custom",
        contentTemplateText: "Workflow preview",
      });
    });

    it("set_variable defaults to a custom JSON message", () => {
      expect(defaultDraftConfig("set_variable", [])).toEqual({
        variableName: "message",
        variableSource: "custom_json",
        valueJsonText: '"Button pressed"',
      });
    });

    it("control_output defaults to the first output target", () => {
      const led = source({ id: "led-1", type: "gpio-output" });
      expect(defaultDraftConfig("control_output", [led])).toEqual({
        targetId: "led-1",
        action: "pulse",
        durationMs: 500,
      });
    });

    it("send_transaction defaults to empty recipient/amount", () => {
      expect(defaultDraftConfig("send_transaction", [])).toEqual({
        recipientAddressBookId: "",
        tokenId: "0x00",
        amount: "",
      });
    });

    it("stamp_integritas defaults to no condition", () => {
      expect(defaultDraftConfig("stamp_integritas", [])).toEqual({ condition: null });
    });

    it("record_trigger_event has no default config", () => {
      expect(defaultDraftConfig("record_trigger_event", [])).toEqual({});
    });
  });

  describe("defaultEditBlockConfig", () => {
    it("adds the first address book recipient for send_transaction", () => {
      const config = defaultEditBlockConfig("send_transaction", [], [contact({ id: "c9" })]);
      expect(config).toEqual({
        recipientAddressBookId: "c9",
        tokenId: "0x00",
        amount: "",
      });
    });

    it("falls back to an empty recipient with no address book entries", () => {
      const config = defaultEditBlockConfig("send_transaction", [], []);
      expect(config.recipientAddressBookId).toBe("");
    });

    it("delegates to defaultDraftConfig for other block types", () => {
      expect(defaultEditBlockConfig("wait", [], [])).toEqual({ durationMs: 1000 });
    });
  });

  describe("sendPaymentFieldErrors / canPersistSendTransactionConfig", () => {
    it("does not require fields until revealRequired is set", () => {
      const errors = sendPaymentFieldErrors({});
      expect(errors).toEqual({ recipient: undefined, amount: undefined });
    });

    it("reports missing recipient and amount when revealRequired", () => {
      const errors = sendPaymentFieldErrors({}, { revealRequired: true });
      expect(errors.recipient).toBe("Choose an address book recipient.");
      expect(errors.amount).toBe("Enter a positive amount.");
    });

    it("rejects a non-positive or non-numeric amount", () => {
      expect(sendPaymentFieldErrors({ amount: "0" }).amount).toBe(
        "Enter a positive amount (for example 1 or 0.5).",
      );
      expect(sendPaymentFieldErrors({ amount: "abc" }).amount).toBe(
        "Enter a positive amount (for example 1 or 0.5).",
      );
    });

    it("accepts a positive integer or decimal amount", () => {
      expect(sendPaymentFieldErrors({ amount: "1" }).amount).toBeUndefined();
      expect(sendPaymentFieldErrors({ amount: "0.5" }).amount).toBeUndefined();
    });

    it("canPersistSendTransactionConfig is true only when recipient and amount are both valid", () => {
      expect(
        canPersistSendTransactionConfig({ recipientAddressBookId: "c1", amount: "1" }),
      ).toBe(true);
      expect(canPersistSendTransactionConfig({ recipientAddressBookId: "c1" })).toBe(false);
      expect(canPersistSendTransactionConfig({ amount: "1" })).toBe(false);
    });
  });

  describe("groupValidationIssues", () => {
    it("groups identical issues and counts duplicates", () => {
      const issues: AutomationValidationResult["errors"] = [
        { level: "error", code: "x", message: "Missing source", blockType: "fetch_data_source" },
        { level: "error", code: "x", message: "Missing source", blockType: "fetch_data_source" },
        { level: "warning", code: "y", message: "Different issue" },
      ];
      const grouped = groupValidationIssues(issues);
      expect(grouped).toHaveLength(2);
      expect(grouped[0].count).toBe(2);
      expect(grouped[1].count).toBe(1);
    });
  });

  describe("validationIssuesByBlockId", () => {
    it("returns an empty object for null validation", () => {
      expect(validationIssuesByBlockId(null)).toEqual({});
    });

    it("indexes errors and warnings by blockId, skipping issues without one", () => {
      const validation: AutomationValidationResult = {
        ok: false,
        errors: [{ level: "error", code: "e", message: "Bad block", blockId: "b1" }],
        warnings: [
          { level: "warning", code: "w", message: "Heads up", blockId: "b1" },
          { level: "warning", code: "w2", message: "No block" },
        ],
      };
      expect(validationIssuesByBlockId(validation)).toEqual({
        b1: [
          { level: "error", message: "Bad block" },
          { level: "warning", message: "Heads up" },
        ],
      });
    });
  });

  describe("withSoftenedInsufficientBalance", () => {
    it("returns null unchanged", () => {
      expect(withSoftenedInsufficientBalance(null)).toBeNull();
    });

    it("returns validation unchanged when there is no insufficient-balance error", () => {
      const validation: AutomationValidationResult = { ok: true, errors: [], warnings: [] };
      expect(withSoftenedInsufficientBalance(validation)).toBe(validation);
    });

    it("demotes insufficient_balance errors to warnings and recomputes ok", () => {
      const validation: AutomationValidationResult = {
        ok: false,
        errors: [
          { level: "error", code: "send_transaction.insufficient_balance", message: "Not enough funds" },
        ],
        warnings: [],
      };
      const result = withSoftenedInsufficientBalance(validation);
      expect(result?.ok).toBe(true);
      expect(result?.errors).toEqual([]);
      expect(result?.warnings).toEqual([
        { level: "warning", code: "send_transaction.insufficient_balance", message: "Not enough funds" },
      ]);
    });

    it("leaves other errors as errors alongside a demoted balance warning", () => {
      const validation: AutomationValidationResult = {
        ok: false,
        errors: [
          { level: "error", code: "send_transaction.insufficient_balance", message: "Not enough funds" },
          { level: "error", code: "other", message: "Other problem" },
        ],
        warnings: [],
      };
      const result = withSoftenedInsufficientBalance(validation);
      expect(result?.ok).toBe(false);
      expect(result?.errors).toEqual([
        { level: "error", code: "other", message: "Other problem" },
      ]);
      expect(result?.warnings).toHaveLength(1);
    });
  });

  describe("runtimeByBlockIdFromRun / blockRunForBlock", () => {
    it("returns an empty object for an undefined run", () => {
      expect(runtimeByBlockIdFromRun(undefined)).toEqual({});
    });

    it("indexes block runtime state by blockId, skipping null blockIds", () => {
      const theRun = run({
        blocks: [
          {
            id: "br1",
            runId: "r1",
            workflowId: "w1",
            blockId: "b1",
            order: 0,
            blockType: "wait",
            blockLabel: "Wait",
            startedAt: "2026-08-01T00:00:00.000Z",
            finishedAt: "2026-08-01T00:00:01.000Z",
            status: "success",
            durationMs: 1000,
            input: null,
            output: null,
            error: null,
          },
          {
            id: "br2",
            runId: "r1",
            workflowId: "w1",
            blockId: null,
            order: 1,
            blockType: "wait",
            blockLabel: "Wait",
            startedAt: "2026-08-01T00:00:00.000Z",
            finishedAt: null,
            status: "running",
            durationMs: null,
            input: null,
            output: null,
            error: null,
          },
        ],
      });
      expect(runtimeByBlockIdFromRun(theRun)).toEqual({
        b1: { status: "success", durationMs: 1000, error: null },
      });
    });

    it("blockRunForBlock finds the matching block run or null", () => {
      const theRun = run({
        blocks: [
          {
            id: "br1",
            runId: "r1",
            workflowId: "w1",
            blockId: "b1",
            order: 0,
            blockType: "wait",
            blockLabel: "Wait",
            startedAt: "2026-08-01T00:00:00.000Z",
            finishedAt: null,
            status: "running",
            durationMs: null,
            input: null,
            output: null,
            error: null,
          },
        ],
      });
      expect(blockRunForBlock(theRun, "b1")?.id).toBe("br1");
      expect(blockRunForBlock(theRun, "missing")).toBeNull();
      expect(blockRunForBlock(undefined, "b1")).toBeNull();
      expect(blockRunForBlock(theRun, null)).toBeNull();
    });
  });

  describe("diagnosticsLink", () => {
    it("builds a diagnostics URL with tab/page/pageSize/q", () => {
      expect(diagnosticsLink("proofs", "abc123")).toBe(
        "/diagnostics?tab=proofs&page=1&pageSize=25&q=abc123",
      );
    });
  });

  describe("readIdFromOutput / proofIdFromOutput", () => {
    it("readIdFromOutput reads a top-level readId", () => {
      expect(readIdFromOutput({ readId: "r1" })).toBe("r1");
    });

    it("readIdFromOutput reads a nested data.readId", () => {
      expect(readIdFromOutput({ data: { readId: "r2" } })).toBe("r2");
    });

    it("readIdFromOutput returns null for missing or non-object output", () => {
      expect(readIdFromOutput(null)).toBeNull();
      expect(readIdFromOutput("string")).toBeNull();
      expect(readIdFromOutput({})).toBeNull();
    });

    it("proofIdFromOutput reads a top-level proofId or null", () => {
      expect(proofIdFromOutput({ proofId: "p1" })).toBe("p1");
      expect(proofIdFromOutput({})).toBeNull();
      expect(proofIdFromOutput(null)).toBeNull();
    });
  });

  describe("workflowMatchesFilter", () => {
    it("filter=active excludes archived workflows", () => {
      expect(workflowMatchesFilter(workflow({ archived: true }), "", "active", "")).toBe(false);
      expect(workflowMatchesFilter(workflow({ archived: false }), "", "active", "")).toBe(true);
    });

    it("filter=enabled requires enabled and not archived", () => {
      expect(workflowMatchesFilter(workflow({ enabled: true }), "", "enabled", "")).toBe(true);
      expect(workflowMatchesFilter(workflow({ enabled: false }), "", "enabled", "")).toBe(false);
      expect(
        workflowMatchesFilter(workflow({ enabled: true, archived: true }), "", "enabled", ""),
      ).toBe(false);
    });

    it("filter=paused requires disabled and not archived", () => {
      expect(workflowMatchesFilter(workflow({ enabled: false }), "", "paused", "")).toBe(true);
      expect(workflowMatchesFilter(workflow({ enabled: true }), "", "paused", "")).toBe(false);
    });

    it("filter=error requires a lastError", () => {
      expect(workflowMatchesFilter(workflow({ lastError: "boom" }), "", "error", "")).toBe(true);
      expect(workflowMatchesFilter(workflow({ lastError: null }), "", "error", "")).toBe(false);
    });

    it("filter=archived requires archived", () => {
      expect(workflowMatchesFilter(workflow({ archived: true }), "", "archived", "")).toBe(true);
      expect(workflowMatchesFilter(workflow({ archived: false }), "", "archived", "")).toBe(false);
    });

    it("filter=all ignores archived/enabled state", () => {
      expect(workflowMatchesFilter(workflow({ archived: true }), "", "all", "")).toBe(true);
    });

    it("search matches name, source name, hash, proof id, error, or block config, case-insensitively", () => {
      const wf = workflow({ name: "Front gate flow", lastHash: "deadbeef" });
      expect(workflowMatchesFilter(wf, "FRONT GATE", "all", "")).toBe(true);
      expect(workflowMatchesFilter(wf, "deadbeef", "all", "")).toBe(true);
      expect(workflowMatchesFilter(wf, "nomatch", "all", "")).toBe(false);
      expect(workflowMatchesFilter(wf, "  ", "all", "")).toBe(true);
    });

    it("search matches a provided source name", () => {
      const wf = workflow({ name: "Flow" });
      expect(workflowMatchesFilter(wf, "front gate camera", "all", "Front Gate Camera")).toBe(true);
    });
  });

  describe("moveBlock", () => {
    it("reorders block ids from one index to another", () => {
      const blocks: AutomationBlock[] = [block({ id: "a" }), block({ id: "b" }), block({ id: "c" })];
      expect(moveBlock(blocks, 0, 2)).toEqual(["b", "c", "a"]);
      expect(moveBlock(blocks, 2, 0)).toEqual(["c", "a", "b"]);
    });
  });

  describe("summarizeBlocks", () => {
    it("returns 'No blocks' for a workflow with no main blocks", () => {
      expect(summarizeBlocks(workflow({ blocks: [] }))).toBe("No blocks");
    });

    it("chains main block short labels with an arrow, marking attached stamps", () => {
      const wf = workflow({
        blocks: [
          block({ id: "b1", type: "manual_start" }),
          block({ id: "b2", type: "fetch_data_source", parentBlockId: null }),
          block({ id: "b3", type: "stamp_integritas", parentBlockId: "b2" }),
        ],
      });
      expect(summarizeBlocks(wf)).toBe("Start -> Fetch source (+Stamp)");
    });
  });

  describe("blockLabel / blockShortLabel", () => {
    it("blockLabel describes if_payload_field_equals by its source", () => {
      expect(blockLabel(block({ type: "if_payload_field_equals", config: { source: "trigger" } }))).toBe(
        "If trigger field matches",
      );
      expect(
        blockLabel(block({ type: "if_payload_field_equals", config: { source: "variable" } })),
      ).toBe("If variable field matches");
    });

    it("blockLabel falls back to the block help short title otherwise", () => {
      expect(blockLabel(block({ type: "wait" }))).toBe("Wait");
    });

    it("blockShortLabel labels any *_start block as 'Start'", () => {
      expect(blockShortLabel(block({ type: "schedule_start" }))).toBe("Start");
      expect(blockShortLabel(block({ type: "wait" }))).toBe("Wait");
    });
  });

  describe("conditionSourceLabel / operatorHasNoValue", () => {
    it("labels the condition source", () => {
      expect(conditionSourceLabel("trigger")).toBe("trigger");
      expect(conditionSourceLabel("variable")).toBe("variable");
    });

    it("flags exists/does_not_exist as needing no value", () => {
      expect(operatorHasNoValue("exists")).toBe(true);
      expect(operatorHasNoValue("does_not_exist")).toBe(true);
      expect(operatorHasNoValue("equals")).toBe(false);
    });
  });

  describe("compareValueInputText / parseCompareValueInput", () => {
    it("renders a string value as-is and stringifies other JSON values", () => {
      expect(compareValueInputText("hello")).toBe("hello");
      expect(compareValueInputText(true)).toBe("true");
      expect(compareValueInputText(25)).toBe("25");
    });

    it("parses valid JSON and falls back to the raw string otherwise", () => {
      expect(parseCompareValueInput("true")).toBe(true);
      expect(parseCompareValueInput("25")).toBe(25);
      expect(parseCompareValueInput("not json")).toBe("not json");
    });
  });

  describe("sourcesForStart / defaultSourceForStart", () => {
    it("filters sources by the matching start block type", () => {
      const gpio = source({ id: "g1", type: "gpio-input" });
      const webhook = source({ id: "w1", type: "webhook" });
      const mqtt = source({ id: "m1", type: "mqtt" });
      const all = [gpio, webhook, mqtt];
      expect(sourcesForStart("gpio_event_start", all)).toEqual([gpio]);
      expect(sourcesForStart("webhook_event_start", all)).toEqual([webhook]);
      expect(sourcesForStart("mqtt_event_start", all)).toEqual([mqtt]);
      expect(sourcesForStart("manual_start", all)).toEqual([]);
    });

    it("defaultSourceForStart returns the first matching source or null", () => {
      const gpio = source({ id: "g1", type: "gpio-input" });
      expect(defaultSourceForStart("gpio_event_start", [gpio])).toBe(gpio);
      expect(defaultSourceForStart("gpio_event_start", [])).toBeNull();
    });
  });

  describe("workflowPrimarySourceId / workflowIntervalSeconds", () => {
    it("prefers a fetch block sourceId, then capture, then start block", () => {
      const wf = workflow({
        blocks: [
          block({ id: "b1", type: "fetch_data_source", config: { sourceId: "fetch-src" } }),
          block({ id: "b2", type: "capture_camera", config: { sourceId: "camera-src" } }),
        ],
      });
      expect(workflowPrimarySourceId(wf)).toBe("fetch-src");
    });

    it("falls back to empty string with no matching block", () => {
      expect(workflowPrimarySourceId(workflow({ blocks: [block({ type: "wait" })] }))).toBe("");
    });

    it("workflowIntervalSeconds reads the schedule_start interval or 0", () => {
      const wf = workflow({
        blocks: [block({ type: "schedule_start", config: { intervalSeconds: 120 } })],
      });
      expect(workflowIntervalSeconds(wf)).toBe(120);
      expect(workflowIntervalSeconds(workflow({ blocks: [] }))).toBe(0);
    });
  });

  describe("firstReadableSource / firstCameraSource", () => {
    it("finds the first readable source by type", () => {
      const bme = source({ id: "bme-1", type: "bme-sensor" });
      expect(firstReadableSource([source({ type: "gpio-output" }), bme])).toBe(bme);
      expect(firstReadableSource([])).toBeNull();
    });

    it("finds the first pi-camera source", () => {
      const cam = source({ id: "cam-1", type: "pi-camera" });
      expect(firstCameraSource([cam])).toBe(cam);
      expect(firstCameraSource([])).toBeNull();
    });
  });

  describe("missingDeviceLibraryReason", () => {
    it("returns a device-specific reason when a required device type is missing", () => {
      expect(missingDeviceLibraryReason("gpio_event_start", [])).toBe(
        "Add a GPIO input on Devices first.",
      );
      expect(missingDeviceLibraryReason("webhook_event_start", [])).toBe(
        "Add a webhook source on Devices first.",
      );
      expect(missingDeviceLibraryReason("mqtt_event_start", [])).toBe(
        "Add an MQTT source on Devices first.",
      );
      expect(missingDeviceLibraryReason("fetch_data_source", [])).toBe(
        "Add a readable input device on Devices first.",
      );
      expect(missingDeviceLibraryReason("capture_camera", [])).toBe(
        "Add a Pi Camera on Devices first.",
      );
      expect(missingDeviceLibraryReason("control_output", [])).toBe(
        "Add an output target on Devices first.",
      );
    });

    it("returns undefined once the required device exists", () => {
      const gpio = source({ type: "gpio-input" });
      expect(missingDeviceLibraryReason("gpio_event_start", [gpio])).toBeUndefined();
    });

    it("returns undefined for block types with no device prerequisite", () => {
      expect(missingDeviceLibraryReason("wait", [])).toBeUndefined();
    });
  });

  describe("nativeMinimaTokens", () => {
    it("filters to native or 0x00 tokens, tolerating null status", () => {
      const status: WalletStatus = {
        checkedAt: "now",
        tokens: [
          { tokenId: "0x00", name: "Minima", confirmed: "1", unconfirmed: "0", sendable: "1", isNative: true },
          { tokenId: "0xabc", name: "Custom", confirmed: "1", unconfirmed: "0", sendable: "1", isNative: false },
        ],
      };
      expect(nativeMinimaTokens(status)).toHaveLength(1);
      expect(nativeMinimaTokens(null)).toEqual([]);
    });
  });

  describe("examplePayload", () => {
    it("builds a gpio example payload for a gpio_event_start workflow", () => {
      const wf = workflow({ blocks: [block({ type: "gpio_event_start" })] });
      const payload = examplePayload(wf) as Record<string, unknown>;
      expect(payload.event).toBe("motion_detected");
      expect(payload.workflowId).toBe(wf.id);
    });

    it("builds a webhook example payload for a webhook_event_start workflow", () => {
      const wf = workflow({ blocks: [block({ type: "webhook_event_start" })] });
      const payload = examplePayload(wf) as Record<string, unknown>;
      expect(payload.event).toBe("test-webhook");
    });

    it("builds an mqtt example payload for an mqtt_event_start workflow", () => {
      const wf = workflow({ blocks: [block({ type: "mqtt_event_start" })] });
      const payload = examplePayload(wf) as Record<string, unknown>;
      expect(payload.topic).toBe("test/topic");
    });

    it("falls back to a generic manual test payload otherwise", () => {
      const wf = workflow({ blocks: [block({ type: "manual_start" })] });
      const payload = examplePayload(wf) as Record<string, unknown>;
      expect(payload.note).toBe("Manual workflow test run with custom payload");
    });
  });

  describe("sourceLabel", () => {
    it("labels each source type distinctly", () => {
      expect(sourceLabel(source({ type: "webhook" }))).toBe("Webhook receive URL");
      expect(
        sourceLabel(source({ type: "mqtt", config: { brokerUrl: "mqtt://x", topic: "t" } })),
      ).toBe("mqtt://x t");
      expect(
        sourceLabel(source({ type: "gpio-input", config: { chip: "gpiochip0", pin: 4 } })),
      ).toBe("gpiochip0 GPIO4");
      expect(
        sourceLabel(
          source({
            type: "gpio-input",
            config: { profile: "pir-motion", chip: "gpiochip0", pin: 4 },
          }),
        ),
      ).toBe("PIR motion gpiochip0 GPIO4");
      expect(
        sourceLabel(
          source({ type: "gpio-output", config: { profile: "led", chip: "gpiochip0", pin: 5, activeState: "high" } }),
        ),
      ).toBe("led gpiochip0 GPIO5 active:high");
      expect(
        sourceLabel(source({ type: "http-output", config: { method: "POST", url: "https://x" } })),
      ).toBe("POST https://x");
      expect(sourceLabel(source({ type: "pi-camera", config: { mode: "video", width: 640, height: 480 } }))).toBe(
        "video 640x480",
      );
      expect(
        sourceLabel(source({ type: "bme-sensor", config: { sensor: "bme680", bus: 1, address: "0x77" } })),
      ).toBe("bme680 i2c-1 0x77");
      expect(sourceLabel(source({ type: "device-system-data" }))).toBe("device-system-data:local");
      expect(sourceLabel(source({ type: "json-api", config: { url: "https://api" } }))).toBe(
        "https://api",
      );
    });
  });

  describe("isReadableSource / isOutputTarget", () => {
    it("classifies readable source types", () => {
      expect(isReadableSource(source({ type: "json-api" }))).toBe(true);
      expect(isReadableSource(source({ type: "bme-sensor" }))).toBe(true);
      expect(isReadableSource(source({ type: "device-system-data" }))).toBe(true);
      expect(isReadableSource(source({ type: "gpio-output" }))).toBe(false);
    });

    it("classifies output target types", () => {
      expect(isOutputTarget(source({ type: "gpio-output" }))).toBe(true);
      expect(isOutputTarget(source({ type: "http-output" }))).toBe(true);
      expect(isOutputTarget(source({ type: "mqtt-output" }))).toBe(true);
      expect(isOutputTarget(source({ type: "json-api" }))).toBe(false);
    });
  });

  describe("outputActionForTarget / defaultOutputBlockConfig", () => {
    it("chooses the right action for each target type", () => {
      expect(outputActionForTarget(source({ type: "http-output" }))).toBe("send_request");
      expect(outputActionForTarget(source({ type: "mqtt-output" }))).toBe("publish");
      expect(outputActionForTarget(source({ type: "gpio-output" }))).toBe("pulse");
      expect(outputActionForTarget(undefined)).toBe("pulse");
    });

    it("builds default config per target type", () => {
      expect(defaultOutputBlockConfig(source({ id: "g1", type: "gpio-output" }), 500)).toEqual({
        targetId: "g1",
        action: "pulse",
        durationMs: 500,
      });
      expect(defaultOutputBlockConfig(source({ id: "h1", type: "http-output" }), 500)).toEqual({
        targetId: "h1",
        action: "send_request",
        bodyMode: "custom",
        bodyTemplateText: defaultCustomBodyText(),
      });
      expect(defaultOutputBlockConfig(undefined, 500)).toEqual({
        targetId: "",
        action: "pulse",
        durationMs: 500,
      });
    });
  });

  describe("retargetOutputBlockConfig", () => {
    it("clears targetId with no target given", () => {
      expect(retargetOutputBlockConfig({ targetId: "x" }, undefined)).toEqual({ targetId: "" });
    });

    it("resets to a pulse config when retargeting to gpio-output", () => {
      const result = retargetOutputBlockConfig(
        { targetId: "h1", action: "send_request" },
        source({ id: "g1", type: "gpio-output" }),
      );
      expect(result).toEqual({ targetId: "g1", action: "pulse", durationMs: 500 });
    });

    it("keeps a compatible body mode when retargeting between http/mqtt outputs", () => {
      const result = retargetOutputBlockConfig(
        { targetId: "h1", action: "send_request", bodyMode: "custom", bodyTemplateText: "{}" },
        source({ id: "m1", type: "mqtt-output" }),
      );
      expect(result.targetId).toBe("m1");
      expect(result.action).toBe("publish");
      expect(result.bodyMode).toBe("custom");
    });
  });

  describe("compatibleBodyMode", () => {
    it("defaults to custom when no body mode is set", () => {
      expect(compatibleBodyMode(undefined, "http-output")).toBe("custom");
    });

    it("demotes none/multipart_media to workflow_context for mqtt targets", () => {
      expect(compatibleBodyMode("none", "mqtt-output")).toBe("workflow_context");
      expect(compatibleBodyMode("multipart_media", "mqtt-output")).toBe("workflow_context");
      expect(compatibleBodyMode("none", "http-output")).toBe("none");
    });

    it("keeps other body modes unchanged", () => {
      expect(compatibleBodyMode("latest_data", "http-output")).toBe("latest_data");
    });
  });

  describe("outputBodyModeConfig", () => {
    it("fills in a default body template text for custom mode", () => {
      const result = outputBodyModeConfig({}, "custom", "http-output");
      expect(result.bodyTemplateText).toBe(defaultCustomBodyText());
    });

    it("clears bodyTemplateText for non-custom modes", () => {
      const result = outputBodyModeConfig({ bodyTemplateText: "{}" }, "latest_data", "http-output");
      expect(result.bodyTemplateText).toBeUndefined();
    });

    it("fills multipart fields for multipart_media mode and clears them otherwise", () => {
      const withMultipart = outputBodyModeConfig({}, "multipart_media", "http-output");
      expect(withMultipart.multipartFileField).toBe("file");
      expect(withMultipart.multipartJsonField).toBe("metadata");
      expect(withMultipart.multipartJsonText).toBe(defaultMultipartJsonText());

      const withoutMultipart = outputBodyModeConfig(
        { multipartFileField: "file", multipartJsonField: "metadata", multipartJsonText: "{}" },
        "custom",
        "http-output",
      );
      expect(withoutMultipart.multipartFileField).toBeUndefined();
    });

    it("forces workflow_context for mqtt targets set to none", () => {
      const result = outputBodyModeConfig({}, "none", "mqtt-output");
      expect(result.bodyMode).toBe("workflow_context");
    });
  });

  describe("defaultVariableSourceConfig", () => {
    it("defaults custom_json to a JSON string value", () => {
      expect(defaultVariableSourceConfig({}, "custom_json")).toEqual({
        variableName: "message",
        variableSource: "custom_json",
        valueJsonText: '"Button pressed"',
      });
    });

    it("defaults trigger_field/latest_data_field/context_field to a matching field path", () => {
      expect(defaultVariableSourceConfig({}, "trigger_field").fieldPath).toBe("pin");
      expect(defaultVariableSourceConfig({}, "latest_data_field").fieldPath).toBe("temperature");
      expect(defaultVariableSourceConfig({}, "context_field").fieldPath).toBe("hash");
    });
  });

  describe("defaultConditionSourceConfig", () => {
    it("sets a variableName default when switching to variable source", () => {
      const result = defaultConditionSourceConfig({ fieldPath: "active" }, "variable");
      expect(result).toEqual({ fieldPath: undefined, source: "variable", variableName: "temp" });
    });

    it("sets a fieldPath default when switching to trigger source", () => {
      const result = defaultConditionSourceConfig({ variableName: "temp" }, "trigger");
      expect(result).toEqual({ variableName: undefined, source: "trigger", fieldPath: "active" });
    });
  });

  describe("defaultPreviewFormatConfig / previewContentModeConfig / defaultPreviewContentText", () => {
    it("sets contentTemplateText per format and clears imageSource for non-image formats", () => {
      expect(defaultPreviewFormatConfig({}, "json").contentTemplateText).toBe("{}");
      expect(defaultPreviewFormatConfig({}, "link").contentTemplateText).toBe(
        "https://integritas.technology",
      );
      const image = defaultPreviewFormatConfig({}, "image");
      expect(image.imageSource).toBe("url");
      expect(image.contentTemplateText).toBe("https://integritas.technology/favicon.ico");
    });

    it("defaultPreviewContentText uses a local-path example for local image source", () => {
      expect(defaultPreviewContentText("image", "local_path")).toBe("camera/snapshot.jpg");
    });

    it("previewContentModeConfig fills custom content and clears it for non-custom modes", () => {
      const custom = previewContentModeConfig({ previewFormat: "text" }, "custom");
      expect(custom.contentTemplateText).toBe("Workflow preview");

      const nonCustom = previewContentModeConfig({ contentTemplateText: "x" }, "latest_data");
      expect(nonCustom.contentTemplateText).toBeUndefined();
    });
  });

  describe("outputBodyModes / bodyModeDescription", () => {
    it("includes multipart_media and none only for http-output", () => {
      const httpModes = outputBodyModes("http-output").map((mode) => mode.value);
      expect(httpModes).toContain("multipart_media");
      expect(httpModes).toContain("none");

      const mqttModes = outputBodyModes("mqtt-output").map((mode) => mode.value);
      expect(mqttModes).not.toContain("multipart_media");
      expect(mqttModes).not.toContain("none");
    });

    it("describes every body mode", () => {
      expect(bodyModeDescription("custom", "http-output")).toMatch(/request body/);
      expect(bodyModeDescription("custom", "mqtt-output")).toMatch(/message payload/);
      expect(bodyModeDescription("trigger_payload", "http-output")).toMatch(/event payload/);
      expect(bodyModeDescription("latest_data", "http-output")).toMatch(/recorded or fetched/);
      expect(bodyModeDescription("latest_data_with_media", "http-output")).toMatch(/media bytes/);
      expect(bodyModeDescription("multipart_media", "http-output")).toMatch(/multipart file/);
      expect(bodyModeDescription("none", "http-output")).toMatch(/without a body/);
      expect(bodyModeDescription("workflow_context", "http-output")).toMatch(/trigger, data, output/);
    });
  });

  describe("formatInterval", () => {
    it("formats seconds, minutes, and hours with correct pluralization", () => {
      expect(formatInterval(10)).toBe("Every 10 seconds");
      expect(formatInterval(60)).toBe("Every 1 minute");
      expect(formatInterval(120)).toBe("Every 2 minutes");
      expect(formatInterval(3600)).toBe("Every 1 hour");
      expect(formatInterval(7200)).toBe("Every 2 hours");
    });
  });

  describe("textPreviewContent / isImagePreviewContent", () => {
    it("returns string content as-is", () => {
      expect(
        textPreviewContent({
          id: "1",
          workflowId: null,
          workflowName: "w",
          runId: null,
          blockId: null,
          title: "t",
          format: "text",
          content: "hello",
          renderedText: null,
          createdAt: "now",
          readAt: null,
        }),
      ).toBe("hello");
    });

    it("falls back to renderedText for null content, and stringifies objects", () => {
      expect(
        textPreviewContent({
          id: "1",
          workflowId: null,
          workflowName: "w",
          runId: null,
          blockId: null,
          title: "t",
          format: "text",
          content: null,
          renderedText: "rendered",
          createdAt: "now",
          readAt: null,
        }),
      ).toBe("rendered");
      expect(
        textPreviewContent({
          id: "1",
          workflowId: null,
          workflowName: "w",
          runId: null,
          blockId: null,
          title: "t",
          format: "json",
          content: { a: 1 },
          renderedText: null,
          createdAt: "now",
          readAt: null,
        }),
      ).toBe(JSON.stringify({ a: 1 }, null, 2));
    });

    it("isImagePreviewContent recognizes a source/value shape", () => {
      expect(isImagePreviewContent({ source: "url", value: "https://x" })).toBe(true);
      expect(isImagePreviewContent({ source: "url" })).toBe(false);
      expect(isImagePreviewContent("not an object")).toBe(false);
      expect(isImagePreviewContent(null)).toBe(false);
    });
  });
});
