import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const {
  readJsonApiSourceMock,
  readDeviceSystemDataSourceMock,
  sendHttpOutputMock,
  sendMultipartMediaOutputMock,
  serializeDataSourceMock,
  readBmeSensorSourceMock,
  pulseGpioOutputMock,
  publishMqttOutputMock,
  capturePiCameraMock,
  requestProofUidMock,
  getIntegritasApiKeyMock,
  getWalletStatusMock,
  sendPaymentMock
} = vi.hoisted(() => ({
  readJsonApiSourceMock: vi.fn(),
  readDeviceSystemDataSourceMock: vi.fn(),
  sendHttpOutputMock: vi.fn(),
  sendMultipartMediaOutputMock: vi.fn(),
  serializeDataSourceMock: vi.fn(),
  readBmeSensorSourceMock: vi.fn(),
  pulseGpioOutputMock: vi.fn(),
  publishMqttOutputMock: vi.fn(),
  capturePiCameraMock: vi.fn(),
  requestProofUidMock: vi.fn(),
  getIntegritasApiKeyMock: vi.fn(),
  getWalletStatusMock: vi.fn(),
  sendPaymentMock: vi.fn()
}));

vi.mock("../../../src/features/data-sources/dataSources.service.js", () => ({
  parseJsonApiConfig: (value: unknown) => value,
  parseHttpOutputConfig: (value: unknown) => value,
  parseBmeSensorConfig: (value: unknown) => value,
  parseDeviceSystemDataConfig: (value: unknown) => value,
  readJsonApiSource: readJsonApiSourceMock,
  readDeviceSystemDataSource: readDeviceSystemDataSourceMock,
  sendHttpOutput: sendHttpOutputMock,
  sendMultipartMediaOutput: sendMultipartMediaOutputMock,
  serializeDataSource: serializeDataSourceMock
}));

vi.mock("../../../src/features/data-sources/sensorHelper.service.js", () => ({
  readBmeSensorSource: readBmeSensorSourceMock
}));

vi.mock("../../../src/features/data-sources/gpioOutput.service.js", () => ({
  pulseGpioOutput: pulseGpioOutputMock
}));

vi.mock("../../../src/features/data-sources/mqttOutput.service.js", () => ({
  publishMqttOutput: publishMqttOutputMock
}));

vi.mock("../../../src/features/data-sources/cameraCapture.service.js", () => ({
  capturePiCamera: capturePiCameraMock
}));

vi.mock("../../../src/features/integritas/integritas.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/features/integritas/integritas.service.js")>();
  return { ...actual, requestProofUid: requestProofUidMock };
});

vi.mock("../../../src/features/settings/secrets.service.js", () => ({
  getIntegritasApiKey: getIntegritasApiKeyMock
}));

vi.mock("../../../src/features/wallet/wallet.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/features/wallet/wallet.service.js")>();
  return { ...actual, getWalletStatus: getWalletStatusMock, sendPayment: sendPaymentMock };
});

let teardown: () => void;
let service: typeof import("../../../src/features/automation/automation.service.js");
let workflowRepo: typeof import("../../../src/features/automation/automation.repository.js");
let dataSourcesRepo: typeof import("../../../src/features/data-sources/dataSources.repository.js");
let dataReadsRepo: typeof import("../../../src/features/data-reads/dataReads.repository.js");
let integritasRepo: typeof import("../../../src/features/integritas/integritas.repository.js");
let addressBookRepo: typeof import("../../../src/features/address-book/address-book.repository.js");
let walletService: typeof import("../../../src/features/wallet/wallet.service.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  service = await import("../../../src/features/automation/automation.service.js");
  workflowRepo = await import("../../../src/features/automation/automation.repository.js");
  dataSourcesRepo = await import("../../../src/features/data-sources/dataSources.repository.js");
  dataReadsRepo = await import("../../../src/features/data-reads/dataReads.repository.js");
  integritasRepo = await import("../../../src/features/integritas/integritas.repository.js");
  addressBookRepo = await import("../../../src/features/address-book/address-book.repository.js");
  walletService = await import("../../../src/features/wallet/wallet.service.js");
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  readJsonApiSourceMock.mockReset();
  readDeviceSystemDataSourceMock.mockReset();
  sendHttpOutputMock.mockReset();
  sendMultipartMediaOutputMock.mockReset();
  serializeDataSourceMock.mockReset();
  readBmeSensorSourceMock.mockReset();
  pulseGpioOutputMock.mockReset();
  publishMqttOutputMock.mockReset();
  capturePiCameraMock.mockReset();
  requestProofUidMock.mockReset();
  getIntegritasApiKeyMock.mockReset();
  getWalletStatusMock.mockReset();
  sendPaymentMock.mockReset();

  serializeDataSourceMock.mockImplementation((record: { id: string; name: string }) => ({ id: record.id, name: record.name }));
  getIntegritasApiKeyMock.mockReturnValue("api-key");
  sendHttpOutputMock.mockResolvedValue({ status: 200 });
  sendMultipartMediaOutputMock.mockResolvedValue({ status: 200 });
  publishMqttOutputMock.mockResolvedValue({ published: true });
  pulseGpioOutputMock.mockResolvedValue({ pulsed: true });
});

type Block = { type: string; config: unknown; clientId?: string; parentBlockId?: string; enabled?: boolean };

function makeWorkflow(blocks: Block[], overrides: { name?: string; enabled?: boolean } = {}) {
  return workflowRepo.createAutomationWorkflow({
    name: overrides.name ?? "WF",
    enabled: overrides.enabled ?? true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blocks: blocks as any
  });
}

let recipientCounter = 0;
function makeRecipient() {
  recipientCounter += 1;
  return addressBookRepo.insertAddressBookEntry({ label: "R", address: `0xabc${recipientCounter}`, notes: null });
}

function createSource(type: string, config: unknown, name = "Source") {
  return dataSourcesRepo.createDataSource({ name, type, config });
}

describe("automation.service — serializers", () => {
  it("serializes a workflow with its blocks and structured last error", () => {
    const wf = makeWorkflow([{ type: "manual_start", config: {} }]);
    const serialized = service.serializeAutomationWorkflow(workflowRepo.getAutomationWorkflow(wf.id)!);
    assert.equal(serialized.id, wf.id);
    assert.equal(serialized.enabled, true);
    assert.equal(serialized.archived, false);
    assert.equal(serialized.blocks.length, 1);
    assert.equal(serialized.blocks[0].type, "manual_start");
  });

  it("serializes a block's config JSON and error fields", () => {
    const wf = makeWorkflow([{ type: "manual_start", config: { foo: "bar" } }]);
    const block = workflowRepo.listAutomationBlocks(wf.id)[0];
    const serialized = service.serializeAutomationBlock(block);
    assert.deepEqual(serialized.config, { foo: "bar" });
    assert.equal(serialized.lastError, null);
  });
});

describe("automation.service — executeWorkflow guards", () => {
  it("throws when the workflow does not exist", async () => {
    await assert.rejects(service.runAutomationWorkflow("missing"), /not found/i);
  });

  it("throws when the workflow is archived", async () => {
    const wf = makeWorkflow([{ type: "manual_start", config: {} }]);
    workflowRepo.updateAutomationWorkflow(wf.id, { archived: true });
    await assert.rejects(service.runAutomationWorkflow(wf.id), /archived/i);
  });

  it("throws when the workflow is disabled and the trigger is not manual", async () => {
    const wf = makeWorkflow([{ type: "schedule_start", config: {} }], { enabled: false });
    await assert.rejects(service.executeWorkflow(wf, { type: "schedule" }), /disabled/i);
  });

  it("allows a manual trigger to run a disabled workflow", async () => {
    const wf = makeWorkflow([{ type: "manual_start", config: {} }], { enabled: false });
    const result = await service.runAutomationWorkflow(wf.id);
    assert.equal(result.workflow.lastError, null);
  });

  it("throws when the workflow has no enabled blocks", async () => {
    const wf = makeWorkflow([{ type: "manual_start", config: {}, enabled: false }]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /no blocks/i);
  });

  it("throws when the start block type does not match the trigger type", async () => {
    const wf = makeWorkflow([{ type: "manual_start", config: {} }]);
    await assert.rejects(service.executeWorkflow(wf, { type: "schedule" }), /starts with manual_start, not schedule_start/);
  });

  it("throws when the trigger sourceId does not match the start block's configured source", async () => {
    const wf = makeWorkflow([{ type: "gpio_event_start", config: { sourceId: "src-a" } }]);
    await assert.rejects(
      service.executeWorkflow(wf, { type: "gpio", sourceId: "src-b" }),
      /trigger source did not match/i
    );
  });

  it("throws WORKFLOW_EVENT_INACTIVE when activeOnly is set and the payload is inactive", async () => {
    const wf = makeWorkflow([{ type: "gpio_event_start", config: { sourceId: "src", activeOnly: true } }]);
    await assert.rejects(
      service.executeWorkflow(wf, { type: "gpio", sourceId: "src", payload: { active: false } }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { code?: string }).code, "WORKFLOW_EVENT_INACTIVE");
        return true;
      }
    );
  });

  it("throws WORKFLOW_COOLDOWN_ACTIVE on a second trigger within the cooldown window", async () => {
    const wf = makeWorkflow([{ type: "gpio_event_start", config: { sourceId: "src", cooldownSeconds: 60 } }]);
    await service.executeWorkflow(wf, { type: "gpio", sourceId: "src" });
    await assert.rejects(
      service.executeWorkflow(wf, { type: "gpio", sourceId: "src" }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { code?: string }).code, "WORKFLOW_COOLDOWN_ACTIVE");
        return true;
      }
    );
  });

  it("throws WORKFLOW_ALREADY_RUNNING when the same workflow is triggered concurrently", async () => {
    const wf = makeWorkflow([{ type: "manual_start", config: {} }]);
    const first = service.runAutomationWorkflow(wf.id);
    const second = service.runAutomationWorkflow(wf.id);
    await assert.rejects(second, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal((error as { code?: string }).code, "WORKFLOW_ALREADY_RUNNING");
      return true;
    });
    await first;
  });
});

describe("automation.service — run lifecycle", () => {
  it("marks a successful run and updates the workflow's last run state", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "set_variable", config: { variableName: "x", variableSource: "custom_json", valueJsonText: "42" } }
    ]);
    const result = await service.runAutomationWorkflow(wf.id);
    assert.equal(result.workflow.lastError, null);
    assert.equal(result.dataSource, null);
    const runs = service.listSerializedAutomationRunsForWorkflow(wf.id);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, "success");
    assert.equal(runs[0].blocks.length, 2);
    assert.ok(runs[0].blocks.every((b) => b.status === "success"));
  });

  it("marks a failed run, persists a structured workflow error, and rethrows with details attached", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "control_output", config: { targetId: "missing" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), (error: unknown) => {
      assert.ok(error instanceof Error);
      const withDetails = error as { workflow?: { lastErrorDetails?: unknown }; errorDetails?: { type?: string } };
      assert.ok(withDetails.workflow);
      assert.ok(withDetails.errorDetails);
      return true;
    });
    const runs = service.listSerializedAutomationRunsForWorkflow(wf.id);
    assert.equal(runs[0].status, "failed");
    assert.ok(runs[0].error);
    const updated = workflowRepo.getAutomationWorkflow(wf.id)!;
    assert.ok(updated.last_error);
  });

  it("computes the next schedule run time for a schedule_start block", async () => {
    const wf = makeWorkflow([{ type: "schedule_start", config: { intervalSeconds: 30 } }]);
    const before = Date.now();
    await service.executeWorkflow(wf, { type: "schedule" });
    const updated = workflowRepo.getAutomationWorkflow(wf.id)!;
    assert.ok(updated.next_run_at);
    assert.ok(new Date(updated.next_run_at!).getTime() > before);
  });

  it("runs attached blocks immediately after their parent block", async () => {
    getIntegritasApiKeyMock.mockReturnValue(null);
    const source = createSource("json-api", { url: "https://example.com" }, "API");
    readJsonApiSourceMock.mockResolvedValue({ contentType: "application/json", bytesHash: "hash1", canonicalBytes: "{}\n", preview: { a: 1 } });
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "fetch_data_source", config: { sourceId: source.id }, clientId: "fetch" },
      { type: "stamp_integritas", config: {}, parentBlockId: "fetch" }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /Integritas API key is not configured/);
    const runs = service.listSerializedAutomationRunsForWorkflow(wf.id);
    assert.equal(runs[0].blocks[1].blockType, "fetch_data_source");
    assert.equal(runs[0].blocks[2].blockType, "stamp_integritas");
  });
});

describe("automation.service — if_payload_field_equals", () => {
  it("stops the workflow and skips remaining blocks when the condition does not match", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "if_payload_field_equals", config: { source: "trigger", fieldPath: "go", operator: "equals", value: true } },
      { type: "set_variable", config: { variableName: "reached", variableSource: "custom_json", valueJsonText: "true" } }
    ]);
    await service.runAutomationWorkflow(wf.id, { type: "manual", payload: { go: false } });
    const runs = service.listSerializedAutomationRunsForWorkflow(wf.id);
    assert.equal(runs[0].status, "success");
    assert.equal(runs[0].blocks.length, 2);
  });

  it("continues the workflow when the condition matches", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "if_payload_field_equals", config: { source: "trigger", fieldPath: "go", operator: "equals", value: true } },
      { type: "set_variable", config: { variableName: "reached", variableSource: "custom_json", valueJsonText: "true" } }
    ]);
    await service.runAutomationWorkflow(wf.id, { type: "manual", payload: { go: true } });
    const runs = service.listSerializedAutomationRunsForWorkflow(wf.id);
    assert.equal(runs[0].blocks.length, 3);
    const lastOutput = runs[0].blocks[2].output as { variables: Record<string, unknown> };
    assert.equal(lastOutput.variables.reached, true);
  });
});

describe("automation.service — set_variable", () => {
  it("throws on an invalid variable name", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "set_variable", config: { variableName: "1bad", variableSource: "custom_json", valueJsonText: "1" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /valid variable name/);
  });

  it("throws on invalid custom JSON", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "set_variable", config: { variableName: "x", variableSource: "custom_json", valueJsonText: "{bad" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /valid JSON/);
  });

  it("throws when a required field path is missing from the source", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "set_variable", config: { variableName: "x", variableSource: "trigger_field", fieldPath: "missing.path" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /Trigger field was not found/);
  });

  it("resolves custom_json/trigger_field/latest_data_field/context_field sources", async () => {
    const source = createSource("json-api", { url: "https://example.com" }, "API");
    readJsonApiSourceMock.mockResolvedValue({ contentType: "application/json", bytesHash: "hash1", canonicalBytes: "{}\n", preview: { count: 5 } });
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "fetch_data_source", config: { sourceId: source.id } },
      { type: "set_variable", config: { variableName: "a", variableSource: "custom_json", valueJsonText: "1" } },
      { type: "set_variable", config: { variableName: "b", variableSource: "trigger_field", fieldPath: "foo" } },
      { type: "set_variable", config: { variableName: "c", variableSource: "latest_data_field", fieldPath: "count" } },
      { type: "set_variable", config: { variableName: "d", variableSource: "context_field", fieldPath: "hash" } }
    ]);
    await service.runAutomationWorkflow(wf.id, { type: "manual", payload: { foo: "bar" } });
    const runs = service.listSerializedAutomationRunsForWorkflow(wf.id);
    const lastOutput = runs[0].blocks[runs[0].blocks.length - 1].output as { variables: Record<string, unknown> };
    assert.equal(lastOutput.variables.a, 1);
    assert.equal(lastOutput.variables.b, "bar");
    assert.equal(lastOutput.variables.c, 5);
    assert.equal(lastOutput.variables.d, "hash1");
  });
});

describe("automation.service — wait", () => {
  it("throws when the duration is out of range", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "wait", config: { durationMs: 70000 } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /Wait duration must be between/);
  });

  it("succeeds for a short duration", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "wait", config: { durationMs: 5 } }
    ]);
    const result = await service.runAutomationWorkflow(wf.id);
    assert.equal(result.workflow.lastError, null);
  });
});

describe("automation.service — record_trigger_event", () => {
  it("throws when the trigger has no sourceId", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "record_trigger_event", config: {} }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /Trigger source is required/);
  });

  it("throws when the trigger source does not exist", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "record_trigger_event", config: {} }
    ]);
    await assert.rejects(
      service.executeWorkflow(wf, { type: "manual", sourceId: "missing" }),
      /Trigger data source not found/
    );
  });

  it("hashes and persists the trigger payload on success", async () => {
    const source = createSource("webhook", { webhookToken: "tok" }, "Hook");
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "record_trigger_event", config: {} }
    ]);
    const result = await service.executeWorkflow(wf, { type: "manual", sourceId: source.id, payload: { a: 1 } });
    assert.ok(result.dataSource);
    const updatedSource = dataSourcesRepo.getDataSource(source.id)!;
    assert.ok(updatedSource.last_hash);
    const reads = dataReadsRepo.listDataSourceReads({ page: 1, pageSize: 50, q: "Hook" });
    assert.ok(reads.some((r) => r.data_source_id === source.id && r.status === "success"));
  });
});

describe("automation.service — recordPushAutomationPayload", () => {
  it("executes the workflow using the push trigger metadata", async () => {
    const source = createSource("webhook", { webhookToken: "tok" }, "PushHook");
    const wf = makeWorkflow([{ type: "webhook_event_start", config: { sourceId: source.id } }]);
    const result = await service.recordPushAutomationPayload({
      workflow: wf,
      dataSource: { id: source.id, name: source.name },
      sourceUrl: "https://example.com/hook",
      triggerType: "webhook",
      result: { bytesHash: "h1", preview: { ok: true }, canonicalBytes: "{}\n" }
    });
    assert.equal(result.workflow.lastError, null);
  });
});

describe("automation.service — fetch_data_source", () => {
  it("throws when the source type is not readable", async () => {
    const source = createSource("gpio-input", { chip: "gpiochip0", pin: 4 }, "GPIO");
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "fetch_data_source", config: { sourceId: source.id } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /requires a readable data source/);
  });

  it("persists a successful read and updates the source", async () => {
    const source = createSource("json-api", { url: "https://example.com" }, "API Source");
    readJsonApiSourceMock.mockResolvedValue({ contentType: "application/json", bytesHash: "hash1", canonicalBytes: "{}\n", preview: { ok: true } });
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "fetch_data_source", config: { sourceId: source.id } }
    ]);
    const result = await service.runAutomationWorkflow(wf.id);
    assert.equal(result.dataSource?.id, source.id);
    const updated = dataSourcesRepo.getDataSource(source.id)!;
    assert.equal(updated.last_hash, "hash1");
  });

  it("persists a failed read and rethrows on fetch failure", async () => {
    const source = createSource("json-api", { url: "https://example.com" }, "Failing Source");
    readJsonApiSourceMock.mockRejectedValue(new Error("network down"));
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "fetch_data_source", config: { sourceId: source.id } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /network down/);
    const updated = dataSourcesRepo.getDataSource(source.id)!;
    assert.match(updated.last_error ?? "", /network down/);
    const reads = dataReadsRepo.listDataSourceReads({ page: 1, pageSize: 50, status: "failed", q: "Failing Source" });
    assert.ok(reads.length >= 1);
  });
});

describe("automation.service — capture_camera", () => {
  it("throws when the source is not a pi-camera device", async () => {
    const source = createSource("json-api", { url: "https://example.com" }, "NotCam");
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "capture_camera", config: { sourceId: source.id } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /requires a Pi Camera device/);
  });

  it("throws when the camera device is missing", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "capture_camera", config: { sourceId: "missing" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /Camera device not found/);
  });

  it("persists a successful capture", async () => {
    const cam = createSource("pi-camera", { mode: "photo" }, "Cam");
    capturePiCameraMock.mockResolvedValue({
      contentType: "image/jpeg",
      bytesHash: "camhash",
      canonicalBytes: "x",
      sizeBytes: 10,
      preview: {
        source: "pi-camera-helper",
        mode: "photo",
        fileName: "f.jpg",
        path: "/tmp/f.jpg",
        mediaType: "image/jpeg",
        sizeBytes: 10,
        sha3: "camhash",
        capturedAt: "now",
        width: 1,
        height: 1,
        durationMs: 0
      }
    });
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "capture_camera", config: { sourceId: cam.id } }
    ]);
    const result = await service.runAutomationWorkflow(wf.id);
    assert.equal(result.dataSource?.id, cam.id);
    assert.equal(dataSourcesRepo.getDataSource(cam.id)!.last_hash, "camhash");
  });

  it("persists a failed read when capture fails", async () => {
    const cam = createSource("pi-camera", { mode: "photo" }, "FailCam");
    capturePiCameraMock.mockRejectedValue(new Error("camera busy"));
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "capture_camera", config: { sourceId: cam.id } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /camera busy/);
    assert.match(dataSourcesRepo.getDataSource(cam.id)!.last_error ?? "", /camera busy/);
  });
});

describe("automation.service — show_preview", () => {
  it("creates an inbox item for custom text content", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "show_preview", config: { title: "Hello", previewFormat: "text", contentMode: "custom", contentTemplateText: "World" } }
    ]);
    await service.runAutomationWorkflow(wf.id);
    const runs = service.listSerializedAutomationRunsForWorkflow(wf.id);
    const summary = runs[0].blocks[1].output as { output: { action: string; format: string } };
    assert.equal(summary.output.action, "show_preview");
    assert.equal(summary.output.format, "text");
  });

  it("throws on invalid JSON content for the json format", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "show_preview", config: { title: "t", previewFormat: "json", contentMode: "custom", contentTemplateText: "{bad" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /Expected property name/);
  });

  it("throws on an invalid link URL", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "show_preview", config: { title: "t", previewFormat: "link", contentMode: "custom", contentTemplateText: "not-a-url" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /requires an http:\/\/ or https:\/\/ URL/);
  });

  it("throws when latest_data mode is used without prior data", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "show_preview", config: { title: "t", contentMode: "latest_data" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /requires a prior record\/fetch block/);
  });

  it("uses workflow_context and trigger_payload content modes", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "show_preview", config: { title: "ctx", contentMode: "workflow_context" } },
      { type: "show_preview", config: { title: "trig", contentMode: "trigger_payload" } }
    ]);
    const result = await service.runAutomationWorkflow(wf.id, { type: "manual", payload: { a: 1 } });
    assert.equal(result.workflow.lastError, null);
  });

  it("throws when interpolation references an unknown variable", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "show_preview", config: { title: "t", contentTemplateText: "{{missingVar}}" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /unknown variable: missingVar/);
  });
});

describe("automation.service — stamp_integritas", () => {
  it("throws when no hash has been collected", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "stamp_integritas", config: {} }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /No collected hash/);
  });

  it("throws when the Integritas API key is not configured", async () => {
    getIntegritasApiKeyMock.mockReturnValue(null);
    const source = createSource("webhook", { webhookToken: "tok" }, "Hook");
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "record_trigger_event", config: {} },
      { type: "stamp_integritas", config: {} }
    ]);
    await assert.rejects(
      service.executeWorkflow(wf, { type: "manual", sourceId: source.id, payload: { a: 1 } }),
      /Integritas API key is not configured/
    );
  });

  it.each([
    ["rate_limited", /retry on the next run/],
    ["unauthorized", /API key rejected/],
    ["payment_required", /plan limit reached/],
    ["stamp_failed", /HTTP 500/]
  ])("formats a %s stamp failure", async (errorCode, expected) => {
    requestProofUidMock.mockResolvedValue({
      ok: false,
      status: errorCode === "payment_required" ? 402 : errorCode === "unauthorized" ? 401 : errorCode === "rate_limited" ? 429 : 500,
      error: "Stamp failed",
      errorCode,
      responseBody: { detail: "x" }
    });
    const source = createSource("webhook", { webhookToken: "tok" }, "Hook");
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "record_trigger_event", config: {} },
      { type: "stamp_integritas", config: {} }
    ]);
    await assert.rejects(
      service.executeWorkflow(wf, { type: "manual", sourceId: source.id, payload: { a: 1 } }),
      expected
    );
  });

  it("creates a proof record and links it to the data read on success", async () => {
    requestProofUidMock.mockResolvedValue({ ok: true, hash: "h", proofUid: "uid-1", proofStatus: "pending", response: {} });
    const source = createSource("webhook", { webhookToken: "tok" }, "Hook");
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "record_trigger_event", config: {} },
      { type: "stamp_integritas", config: {} }
    ]);
    const result = await service.executeWorkflow(wf, { type: "manual", sourceId: source.id, payload: { a: 1 } });
    assert.ok(result.proofId);
    const proof = integritasRepo.getProofRecord(result.proofId!);
    assert.equal(proof?.proof_uid, "uid-1");
  });

  it("skips stamping when the condition does not match", async () => {
    const source = createSource("webhook", { webhookToken: "tok" }, "Hook");
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "record_trigger_event", config: {} },
      { type: "stamp_integritas", config: { condition: { fieldPath: "a", operator: "equals", value: 999 } } }
    ]);
    const result = await service.executeWorkflow(wf, { type: "manual", sourceId: source.id, payload: { a: 1 } });
    assert.equal(result.proofId, null);
    assert.equal(requestProofUidMock.mock.calls.length, 0);
  });
});

describe("automation.service — control_output", () => {
  it("throws when targetId is missing", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "control_output", config: {} }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /requires a targetId/);
  });

  it("throws when the target does not exist", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "control_output", config: { targetId: "missing" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /target was not found/);
  });

  it("throws when the target type is not a supported output", async () => {
    const target = createSource("gpio-input", { chip: "gpiochip0", pin: 4 }, "NotOutput");
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "control_output", config: { targetId: target.id } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /requires an output target/);
  });

  it("pulses a gpio-output target", async () => {
    const target = createSource("gpio-output", { chip: "gpiochip0", pin: 4 }, "LED");
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "control_output", config: { targetId: target.id, durationMs: 500 } }
    ]);
    await service.runAutomationWorkflow(wf.id);
    assert.equal(pulseGpioOutputMock.mock.calls[0][0].targetId, target.id);
    assert.equal(pulseGpioOutputMock.mock.calls[0][0].durationMs, 500);
  });

  it("sends a custom body to an http-output target", async () => {
    const target = createSource("http-output", { url: "https://example.com" }, "HTTP");
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      {
        type: "control_output",
        config: { targetId: target.id, bodyMode: "custom", bodyTemplateText: JSON.stringify({ hello: "world" }) }
      }
    ]);
    await service.runAutomationWorkflow(wf.id);
    assert.deepEqual(sendHttpOutputMock.mock.calls[0][1], { hello: "world" });
  });

  it("publishes to an mqtt-output target", async () => {
    const target = createSource("mqtt-output", { brokerUrl: "mqtt://broker", topic: "t" }, "MQTT");
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "control_output", config: { targetId: target.id, bodyMode: "trigger_payload" } }
    ]);
    await service.runAutomationWorkflow(wf.id, { type: "manual", payload: { x: 1 } });
    assert.equal(publishMqttOutputMock.mock.calls[0][0].targetId, target.id);
    assert.deepEqual(publishMqttOutputMock.mock.calls[0][0].payload, { x: 1 });
  });

  it("sends captured media bytes for multipart_media output", async () => {
    const tmpFile = path.join(os.tmpdir(), `automation-test-${Date.now()}.jpg`);
    fs.writeFileSync(tmpFile, Buffer.from("fake-image-bytes"));
    try {
      const source = createSource("json-api", { url: "https://example.com" }, "CamData");
      readJsonApiSourceMock.mockResolvedValue({
        contentType: "application/json",
        bytesHash: "camhash",
        canonicalBytes: "{}\n",
        preview: {
          source: "pi-camera-helper",
          path: tmpFile,
          mediaType: "image/jpeg",
          fileName: "f.jpg",
          sizeBytes: 17,
          sha3: "camhash"
        }
      });
      const target = createSource("http-output", { url: "https://example.com" }, "HTTP");
      const wf = makeWorkflow([
        { type: "manual_start", config: {} },
        { type: "fetch_data_source", config: { sourceId: source.id } },
        { type: "control_output", config: { targetId: target.id, bodyMode: "multipart_media", multipartFileField: "file" } }
      ]);
      await service.runAutomationWorkflow(wf.id);
      assert.equal(sendMultipartMediaOutputMock.mock.calls.length, 1);
      const payload = sendMultipartMediaOutputMock.mock.calls[0][1];
      assert.equal(payload.fileFieldName, "file");
      assert.ok(Buffer.isBuffer(payload.bytes));
    } finally {
      fs.rmSync(tmpFile, { force: true });
    }
  });
});

describe("automation.service — send_transaction", () => {
  it("throws when the recipient is not found", async () => {
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "send_transaction", config: { recipientAddressBookId: "missing", tokenId: "0x00", amount: "1" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /recipient was not found/);
  });

  it("throws on a non-native token", async () => {
    const recipient = makeRecipient();
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "send_transaction", config: { recipientAddressBookId: recipient.id, tokenId: "0xFF", amount: "1" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /only native MINIMA tokenid 0x00/);
  });

  it("throws on a non-positive amount", async () => {
    const recipient = makeRecipient();
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "send_transaction", config: { recipientAddressBookId: recipient.id, tokenId: "0x00", amount: "0" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /positive decimal/);
  });

  it("throws when the wallet has no native token", async () => {
    const recipient = makeRecipient();
    getWalletStatusMock.mockResolvedValue({ checkedAt: "now", tokens: [] });
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "send_transaction", config: { recipientAddressBookId: recipient.id, tokenId: "0x00", amount: "1" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /does not report a native MINIMA balance/);
  });

  it("throws when the amount exceeds the sendable balance", async () => {
    const recipient = makeRecipient();
    getWalletStatusMock.mockResolvedValue({
      checkedAt: "now",
      tokens: [{ tokenId: "0x00", name: "Minima", confirmed: "1", unconfirmed: "0", sendable: "1", isNative: true }]
    });
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "send_transaction", config: { recipientAddressBookId: recipient.id, tokenId: "0x00", amount: "5" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /exceeds available balance/);
  });

  it("sends a payment and records history on success", async () => {
    const recipient = makeRecipient();
    getWalletStatusMock.mockResolvedValue({
      checkedAt: "now",
      tokens: [{ tokenId: "0x00", name: "Minima", confirmed: "10", unconfirmed: "0", sendable: "10", isNative: true }]
    });
    sendPaymentMock.mockResolvedValue({ ok: true, txpowId: "tx-1", status: "sent" });
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "send_transaction", config: { recipientAddressBookId: recipient.id, tokenId: "0x00", amount: "5" } }
    ]);
    const result = await service.runAutomationWorkflow(wf.id);
    assert.equal(result.workflow.lastError, null);
    const history = walletService.listWalletSendHistory();
    assert.ok(history.some((h) => h.txpowId === "tx-1" && h.status === "submitted"));
  });

  it("throws when the payment fails", async () => {
    const recipient = makeRecipient();
    getWalletStatusMock.mockResolvedValue({
      checkedAt: "now",
      tokens: [{ tokenId: "0x00", name: "Minima", confirmed: "10", unconfirmed: "0", sendable: "10", isNative: true }]
    });
    sendPaymentMock.mockResolvedValue({ ok: false, txpowId: null, status: "failed", message: "insufficient fee" });
    const wf = makeWorkflow([
      { type: "manual_start", config: {} },
      { type: "send_transaction", config: { recipientAddressBookId: recipient.id, tokenId: "0x00", amount: "5" } }
    ]);
    await assert.rejects(service.runAutomationWorkflow(wf.id), /insufficient fee/);
  });
});

describe("automation.service — scheduler", () => {
  afterEach(() => {
    service.stopAutomationScheduler();
    vi.useRealTimers();
  });

  it("does not start a second interval when already running", () => {
    service.startAutomationScheduler();
    service.startAutomationScheduler();
    service.stopAutomationScheduler();
  });

  it("runs a due schedule workflow when the interval fires", async () => {
    vi.useFakeTimers();
    const wf = makeWorkflow(
      [{ type: "schedule_start", config: { intervalSeconds: 60 } }],
      { name: "DueWorkflow" }
    );
    workflowRepo.updateAutomationWorkflow(wf.id, { nextRunAt: new Date(Date.now() - 1000).toISOString() });

    service.startAutomationScheduler();
    await vi.advanceTimersByTimeAsync(1100);

    const updated = workflowRepo.getAutomationWorkflow(wf.id)!;
    assert.ok(updated.last_run_at);
  });
});
