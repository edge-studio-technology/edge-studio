import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const {
  getDataSourceMock,
  parseGpioOutputConfigMock,
  getAddressBookEntryByIdMock,
  getIntegritasApiKeyMock,
  getWalletStatusMock,
  getCameraCapabilityMock
} = vi.hoisted(() => ({
  getDataSourceMock: vi.fn(),
  parseGpioOutputConfigMock: vi.fn(),
  getAddressBookEntryByIdMock: vi.fn(),
  getIntegritasApiKeyMock: vi.fn(),
  getWalletStatusMock: vi.fn(),
  getCameraCapabilityMock: vi.fn()
}));

vi.mock("../../../src/features/data-sources/dataSources.repository.js", () => ({
  getDataSource: getDataSourceMock
}));

vi.mock("../../../src/features/data-sources/dataSources.service.js", () => ({
  parseGpioOutputConfig: parseGpioOutputConfigMock
}));

vi.mock("../../../src/features/address-book/address-book.repository.js", () => ({
  getAddressBookEntryById: getAddressBookEntryByIdMock
}));

vi.mock("../../../src/features/settings/secrets.service.js", () => ({
  getIntegritasApiKey: getIntegritasApiKeyMock
}));

vi.mock("../../../src/features/wallet/wallet.service.js", () => ({
  getWalletStatus: getWalletStatusMock
}));

vi.mock("../../../src/features/data-sources/cameraCapture.service.js", () => ({
  getCameraCapability: getCameraCapabilityMock
}));

let teardown: () => void;
let validation: typeof import("../../../src/features/automation/automation.validation.js");
let repository: typeof import("../../../src/features/automation/automation.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  validation = await import("../../../src/features/automation/automation.validation.js");
  repository = await import("../../../src/features/automation/automation.repository.js");
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  getDataSourceMock.mockReset();
  parseGpioOutputConfigMock.mockReset();
  getAddressBookEntryByIdMock.mockReset();
  getIntegritasApiKeyMock.mockReset();
  getWalletStatusMock.mockReset();
  getCameraCapabilityMock.mockReset();
  getIntegritasApiKeyMock.mockReturnValue("key");
});

type DraftBlock = Parameters<typeof validation.validateAutomationDraft>[0][number];

function block(overrides: Partial<DraftBlock> & Pick<DraftBlock, "clientId" | "type">): DraftBlock {
  return { enabled: true, parentBlockId: null, config: {}, ...overrides };
}

function manualStart(overrides: Partial<DraftBlock> = {}): DraftBlock {
  return block({ clientId: "start", type: "manual_start", ...overrides });
}

function expectError(result: { errors: { code: string }[] }, code: string) {
  assert.ok(result.errors.some((e) => e.code === code), `expected error ${code}, got: ${JSON.stringify(result.errors)}`);
}

function expectNoError(result: { errors: { code: string }[] }, code: string) {
  assert.ok(!result.errors.some((e) => e.code === code), `did not expect error ${code}, got: ${JSON.stringify(result.errors)}`);
}

describe("validateAutomationDraft — workflow shape", () => {
  it("errors when there are no blocks", async () => {
    const result = await validation.validateAutomationDraft([]);
    expectError(result, "workflow.no_blocks");
    assert.equal(result.ok, false);
  });

  it("errors when the first block is not a start block", async () => {
    const result = await validation.validateAutomationDraft([
      block({ clientId: "1", type: "set_variable", config: { variableName: "x", variableSource: "custom_json", valueJsonText: "1" } })
    ]);
    expectError(result, "workflow.missing_start");
  });

  it("errors on a second top-level start block", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "schedule_start" })
    ]);
    expectError(result, "workflow.multiple_starts");
  });

  it("errors when the start block is disabled", async () => {
    const result = await validation.validateAutomationDraft([manualStart({ enabled: false })]);
    expectError(result, "workflow.start_disabled");
  });

  it("warns when there are no enabled action blocks after the start", async () => {
    const result = await validation.validateAutomationDraft([manualStart()]);
    assert.ok(result.warnings.some((w) => w.code === "workflow.no_enabled_actions"));
    assert.equal(result.ok, true);
  });

  it("does not warn when an enabled action block follows the start", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "set_variable", config: { variableName: "x", variableSource: "custom_json", valueJsonText: "1" } })
    ]);
    assert.ok(!result.warnings.some((w) => w.code === "workflow.no_enabled_actions"));
  });
});

describe("validateAutomationDraft — set_variable", () => {
  it("errors on an invalid variable name", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "set_variable", config: { variableName: "1bad", variableSource: "custom_json", valueJsonText: "1" } })
    ]);
    expectError(result, "set_variable.invalid_name");
  });

  it("errors on invalid custom JSON", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "set_variable", config: { variableName: "x", variableSource: "custom_json", valueJsonText: "{bad" } })
    ]);
    expectError(result, "set_variable.invalid_json");
  });

  it("errors when latest_data_field is used before any data block", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "set_variable", config: { variableName: "x", variableSource: "latest_data_field", fieldPath: "a.b" } })
    ]);
    expectError(result, "set_variable.data_before_data_block");
  });

  it("passes when latest_data_field follows a fetch_data_source block", async () => {
    getDataSourceMock.mockReturnValue({ id: "src1", type: "json-api", config: "{}" });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "fetch_data_source", config: { sourceId: "src1" } }),
      block({ clientId: "3", type: "set_variable", config: { variableName: "x", variableSource: "latest_data_field", fieldPath: "a.b" } })
    ]);
    expectNoError(result, "set_variable.data_before_data_block");
  });

  it("errors on an invalid field path", async () => {
    getDataSourceMock.mockReturnValue({ id: "src1", type: "json-api", config: "{}" });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "fetch_data_source", config: { sourceId: "src1" } }),
      block({ clientId: "3", type: "set_variable", config: { variableName: "x", variableSource: "latest_data_field", fieldPath: "a b!" } })
    ]);
    expectError(result, "set_variable.invalid_field_path");
  });
});

describe("validateAutomationDraft — if_payload_field_equals", () => {
  it("errors when a variable condition references an unset variable", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "if_payload_field_equals", config: { source: "variable", variableName: "x", operator: "equals", value: "1" } })
    ]);
    expectError(result, "condition.variable_before_set");
  });

  it("passes when the variable was set earlier by an enabled set_variable block", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "set_variable", config: { variableName: "x", variableSource: "custom_json", valueJsonText: "1" } }),
      block({ clientId: "3", type: "if_payload_field_equals", config: { source: "variable", variableName: "x", operator: "equals", value: "1" } })
    ]);
    expectNoError(result, "condition.variable_before_set");
  });

  it("errors on a missing compare value unless the operator is exists/does_not_exist", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "if_payload_field_equals", config: { source: "trigger", fieldPath: "a", operator: "equals" } })
    ]);
    expectError(result, "condition.missing_value");
  });

  it("does not require a compare value for the exists operator", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "if_payload_field_equals", config: { source: "trigger", fieldPath: "a", operator: "exists" } })
    ]);
    expectNoError(result, "condition.missing_value");
  });

  it("errors on an invalid operator", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "if_payload_field_equals", config: { source: "trigger", fieldPath: "a", operator: "bogus", value: 1 } })
    ]);
    expectError(result, "condition.invalid_operator");
  });
});

describe("validateAutomationDraft — show_preview", () => {
  it("errors on an empty title", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "show_preview", config: { title: "" } })
    ]);
    expectError(result, "show_preview.invalid_title");
  });

  it("errors on a title over 120 characters", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "show_preview", config: { title: "x".repeat(121) } })
    ]);
    expectError(result, "show_preview.invalid_title");
  });

  it("errors when latest_data content mode is used before a data block", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "show_preview", config: { title: "t", contentMode: "latest_data" } })
    ]);
    expectError(result, "show_preview.data_before_data_block");
  });

  it("errors on invalid JSON content for the json format", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "show_preview", config: { title: "t", previewFormat: "json", contentMode: "custom", contentTemplateText: "{bad" } })
    ]);
    expectError(result, "show_preview.invalid_json");
  });

  it("errors on an invalid image source for the image format", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "show_preview", config: { title: "t", previewFormat: "image", imageSource: "ftp" } })
    ]);
    expectError(result, "show_preview.invalid_image_source");
  });
});

describe("validateAutomationDraft — block references", () => {
  it("errors when an event start block references a missing source", async () => {
    getDataSourceMock.mockReturnValue(undefined);
    const result = await validation.validateAutomationDraft([
      block({ clientId: "start", type: "gpio_event_start", config: { sourceId: "missing", cooldownSeconds: 0 } })
    ]);
    expectError(result, "gpio_event_start.missing_source");
  });

  it("errors when a gpio_event_start source is not a gpio-input type", async () => {
    getDataSourceMock.mockReturnValue({ id: "src1", type: "webhook", config: "{}" });
    const result = await validation.validateAutomationDraft([
      block({ clientId: "start", type: "gpio_event_start", config: { sourceId: "src1", cooldownSeconds: 0 } })
    ]);
    expectError(result, "gpio_event_start.invalid_source");
  });

  it("errors on an out-of-range event start cooldown", async () => {
    getDataSourceMock.mockReturnValue({ id: "src1", type: "gpio-input", config: "{}" });
    const result = await validation.validateAutomationDraft([
      block({ clientId: "start", type: "gpio_event_start", config: { sourceId: "src1", cooldownSeconds: 999999 } })
    ]);
    expectError(result, "gpio_event_start.invalid_cooldown");
  });

  it("errors when control_output targets a missing device", async () => {
    getDataSourceMock.mockReturnValue(undefined);
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "control_output", config: { targetId: "missing" } })
    ]);
    expectError(result, "control_output.missing_target");
  });

  it("warns and validates an HTTP output body", async () => {
    getDataSourceMock.mockReturnValue({ id: "t1", type: "http-output", config: "{}" });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "control_output", config: { targetId: "t1", bodyMode: "custom", bodyTemplateText: "{bad" } })
    ]);
    assert.ok(result.warnings.some((w) => w.code === "control_output.http"));
    expectError(result, "control_output.invalid_custom_body");
  });

  it("errors when MQTT output body mode is none", async () => {
    getDataSourceMock.mockReturnValue({ id: "t1", type: "mqtt-output", config: "{}" });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "control_output", config: { targetId: "t1", bodyMode: "none" } })
    ]);
    expectError(result, "control_output.mqtt_body_required");
  });

  it("errors when multipart_media is used against a non-http target", async () => {
    getDataSourceMock.mockReturnValue({ id: "t1", type: "mqtt-output", config: "{}" });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "control_output", config: { targetId: "t1", bodyMode: "multipart_media" } })
    ]);
    expectError(result, "control_output.multipart_http_required");
  });

  it("errors when multipart file field is blank", async () => {
    getDataSourceMock.mockReturnValue({ id: "t1", type: "http-output", config: "{}" });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "control_output", config: { targetId: "t1", bodyMode: "multipart_media", multipartFileField: "  " } })
    ]);
    expectError(result, "control_output.multipart_file_field_required");
  });

  it("flags a non-led GPIO output profile", async () => {
    getDataSourceMock.mockReturnValue({ id: "t1", type: "gpio-output", config: "{}" });
    parseGpioOutputConfigMock.mockReturnValue({ profile: "servo" });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "control_output", config: { targetId: "t1" } })
    ]);
    expectError(result, "control_output.unsupported_profile");
  });

  it("errors when send_transaction has no recipient", async () => {
    getAddressBookEntryByIdMock.mockReturnValue(null);
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "send_transaction", config: { recipientAddressBookId: "missing", tokenId: "0x00", amount: "1" } })
    ]);
    expectError(result, "send_transaction.missing_recipient");
  });

  it("errors when send_transaction uses a non-native token", async () => {
    getAddressBookEntryByIdMock.mockReturnValue({ id: "r1", label: "R", address: "0xabc" });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "send_transaction", config: { recipientAddressBookId: "r1", tokenId: "0xFF", amount: "1" } })
    ]);
    expectError(result, "send_transaction.unsupported_token");
  });

  it("errors when send_transaction amount is not a positive decimal", async () => {
    getAddressBookEntryByIdMock.mockReturnValue({ id: "r1", label: "R", address: "0xabc" });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "send_transaction", config: { recipientAddressBookId: "r1", tokenId: "0x00", amount: "0" } })
    ]);
    expectError(result, "send_transaction.invalid_amount");
  });
});

describe("validateAutomationDraft — attached stamp_integritas blocks", () => {
  it("errors when a non-stamp block is attached to another block", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "set_variable", config: { variableName: "x", variableSource: "custom_json", valueJsonText: "1" } }),
      block({ clientId: "3", type: "show_preview", parentBlockId: "2", config: { title: "t" } })
    ]);
    expectError(result, "attached.unsupported");
  });

  it("errors when a stamp is attached to an unsupported parent type", async () => {
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "set_variable", config: { variableName: "x", variableSource: "custom_json", valueJsonText: "1" } }),
      block({ clientId: "3", type: "stamp_integritas", parentBlockId: "2", config: {} })
    ]);
    expectError(result, "stamp_integritas.invalid_parent");
    expectError(result, "stamp_integritas.no_hash");
  });

  it("passes a stamp attached to a fetch_data_source block with an API key configured", async () => {
    getDataSourceMock.mockReturnValue({ id: "src1", type: "json-api", config: "{}" });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "fetch_data_source", config: { sourceId: "src1" } }),
      block({ clientId: "3", type: "stamp_integritas", parentBlockId: "2", config: {} })
    ]);
    expectNoError(result, "stamp_integritas.invalid_parent");
    expectNoError(result, "stamp_integritas.no_hash");
    assert.ok(!result.warnings.some((w) => w.code === "stamp_integritas.no_api_key"));
  });

  it("warns when the Integritas API key is not configured", async () => {
    getIntegritasApiKeyMock.mockReturnValue(null);
    getDataSourceMock.mockReturnValue({ id: "src1", type: "json-api", config: "{}" });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "fetch_data_source", config: { sourceId: "src1" } }),
      block({ clientId: "3", type: "stamp_integritas", parentBlockId: "2", config: {} })
    ]);
    assert.ok(result.warnings.some((w) => w.code === "stamp_integritas.no_api_key"));
  });
});

describe("validateAutomationDraft — capture_camera", () => {
  it("errors when camera capture is disabled", async () => {
    getDataSourceMock.mockReturnValue({ id: "cam1", type: "pi-camera", config: "{}" });
    getCameraCapabilityMock.mockResolvedValue({ enabled: false, available: false, reason: "Camera support is disabled." });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "capture_camera", config: { sourceId: "cam1" } })
    ]);
    expectError(result, "capture_camera.disabled");
  });

  it("warns when camera capture is enabled but unavailable", async () => {
    getDataSourceMock.mockReturnValue({ id: "cam1", type: "pi-camera", config: "{}" });
    getCameraCapabilityMock.mockResolvedValue({ enabled: true, available: false, reason: "not ready" });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "capture_camera", config: { sourceId: "cam1" } })
    ]);
    assert.ok(result.warnings.some((w) => w.code === "capture_camera.unavailable"));
  });

  it("always warns about camera privacy when referencing a valid camera source", async () => {
    getDataSourceMock.mockReturnValue({ id: "cam1", type: "pi-camera", config: "{}" });
    getCameraCapabilityMock.mockResolvedValue({ enabled: true, available: true });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "capture_camera", config: { sourceId: "cam1" } })
    ]);
    assert.ok(result.warnings.some((w) => w.code === "capture_camera.privacy"));
  });
});

describe("validateAutomationDraft — send_transaction wallet balance", () => {
  it("errors when the wallet has no native token", async () => {
    getAddressBookEntryByIdMock.mockReturnValue({ id: "r1", label: "R", address: "0xabc" });
    getWalletStatusMock.mockResolvedValue({ checkedAt: "now", tokens: [] });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "send_transaction", config: { recipientAddressBookId: "r1", tokenId: "0x00", amount: "1" } })
    ]);
    expectError(result, "send_transaction.no_native_balance");
  });

  it("errors when the amount exceeds the sendable balance", async () => {
    getAddressBookEntryByIdMock.mockReturnValue({ id: "r1", label: "R", address: "0xabc" });
    getWalletStatusMock.mockResolvedValue({
      checkedAt: "now",
      tokens: [{ tokenId: "0x00", name: "Minima", confirmed: "1", unconfirmed: "0", sendable: "1", isNative: true }]
    });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "send_transaction", config: { recipientAddressBookId: "r1", tokenId: "0x00", amount: "5" } })
    ]);
    expectError(result, "send_transaction.insufficient_balance");
  });

  it("passes when the amount is within the sendable balance", async () => {
    getAddressBookEntryByIdMock.mockReturnValue({ id: "r1", label: "R", address: "0xabc" });
    getWalletStatusMock.mockResolvedValue({
      checkedAt: "now",
      tokens: [{ tokenId: "0x00", name: "Minima", confirmed: "10", unconfirmed: "0", sendable: "10", isNative: true }]
    });
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "send_transaction", config: { recipientAddressBookId: "r1", tokenId: "0x00", amount: "5" } })
    ]);
    expectNoError(result, "send_transaction.insufficient_balance");
  });

  it("errors when the wallet balance check throws", async () => {
    getAddressBookEntryByIdMock.mockReturnValue({ id: "r1", label: "R", address: "0xabc" });
    getWalletStatusMock.mockRejectedValue(new Error("RPC down"));
    const result = await validation.validateAutomationDraft([
      manualStart(),
      block({ clientId: "2", type: "send_transaction", config: { recipientAddressBookId: "r1", tokenId: "0x00", amount: "5" } })
    ]);
    expectError(result, "send_transaction.wallet_unavailable");
    assert.match(result.errors.find((e) => e.code === "send_transaction.wallet_unavailable")?.message ?? "", /RPC down/);
  });
});

describe("validateAutomationWorkflow", () => {
  it("validates blocks stored on a persisted workflow", async () => {
    const workflow = repository.createAutomationWorkflow({
      name: "Test workflow",
      enabled: true,
      blocks: [
        { type: "manual_start", config: {}, clientId: "start" },
        { type: "set_variable", config: { variableName: "1bad", variableSource: "custom_json", valueJsonText: "1" } }
      ]
    });

    const result = await validation.validateAutomationWorkflow(workflow.id);

    expectError(result, "set_variable.invalid_name");
  });

  it("returns ok:true for a minimal valid persisted workflow", async () => {
    const workflow = repository.createAutomationWorkflow({
      name: "Minimal workflow",
      enabled: true,
      blocks: [{ type: "manual_start", config: {}, clientId: "start" }]
    });

    const result = await validation.validateAutomationWorkflow(workflow.id);

    assert.equal(result.ok, true);
  });
});
