import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const existsSyncMock = vi.hoisted(() => vi.fn());
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: existsSyncMock, default: { ...actual, existsSync: existsSyncMock } };
});

type FakeChild = {
  stdout: { setEncoding: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; emit: (event: string, ...args: unknown[]) => void };
  stderr: { setEncoding: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; emit: (event: string, ...args: unknown[]) => void };
  on: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
  emit: (event: string, ...args: unknown[]) => void;
};

function makeStream() {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    setEncoding: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      const list = handlers.get(event) ?? [];
      list.push(cb);
      handlers.set(event, list);
    }),
    emit(event: string, ...args: unknown[]) {
      for (const cb of handlers.get(event) ?? []) cb(...args);
    }
  };
}

function makeFakeChild(): FakeChild {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    stdout: makeStream(),
    stderr: makeStream(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      const list = handlers.get(event) ?? [];
      list.push(cb);
      handlers.set(event, list);
    }),
    kill: vi.fn(),
    emit(event: string, ...args: unknown[]) {
      for (const cb of handlers.get(event) ?? []) cb(...args);
    }
  };
}

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

const automationServiceMock = vi.hoisted(() => ({ recordPushAutomationPayload: vi.fn() }));
vi.mock("../../../src/features/automation/automation.service.js", () => automationServiceMock);

let teardown: () => void;
let db: Awaited<ReturnType<typeof setupTestDatabase>>["db"];
let dataSourcesRepo: typeof import("../../../src/features/data-sources/dataSources.repository.js");
let automationRepo: typeof import("../../../src/features/automation/automation.repository.js");
let gpioIngestion: typeof import("../../../src/features/data-sources/gpioIngestion.service.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  dataSourcesRepo = await import("../../../src/features/data-sources/dataSources.repository.js");
  automationRepo = await import("../../../src/features/automation/automation.repository.js");
  gpioIngestion = await import("../../../src/features/data-sources/gpioIngestion.service.js");
});

afterAll(() => {
  teardown();
});

let children: FakeChild[];

function flush() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

function makeGpioSource(config: Record<string, unknown> = {}) {
  return dataSourcesRepo.createDataSource({
    name: "GPIO Button",
    type: "gpio-input",
    config: { chip: "gpiochip0", pin: 17, profile: "generic", pull: "off", edge: "both", debounceMs: 0, activeState: "high", ...config }
  });
}

function makeGpioWorkflow(sourceId: string, overrides: { enabled?: boolean } = {}) {
  return automationRepo.createAutomationWorkflow({
    name: "GPIO Workflow",
    enabled: overrides.enabled ?? true,
    blocks: [{ type: "gpio_event_start", config: { sourceId } }]
  });
}

beforeEach(() => {
  children = [];
  spawnMock.mockReset();
  spawnMock.mockImplementation(() => {
    const child = makeFakeChild();
    children.push(child);
    return child;
  });
  automationServiceMock.recordPushAutomationPayload.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  gpioIngestion.stopGpioIngestion();
  db.prepare("DELETE FROM automation_blocks").run();
  db.prepare("DELETE FROM automation_workflows").run();
  db.prepare("DELETE FROM data_sources").run();
  vi.restoreAllMocks();
});

describe("getGpioInputCapability", () => {
  it("reports available when the device path exists", () => {
    existsSyncMock.mockReturnValue(true);
    const result = gpioIngestion.getGpioInputCapability();
    assert.deepEqual(result, { available: true, devicePath: "/dev/gpiochip0", reason: null });
  });

  it("reports unavailable with a reason when the device path is missing", () => {
    existsSyncMock.mockReturnValue(false);
    const result = gpioIngestion.getGpioInputCapability();
    assert.equal(result.available, false);
    assert.match(result.reason!, /not mounted in the backend container/);
  });
});

describe("syncGpioDataSources", () => {
  it("spawns a gpiomon watcher for each source with an enabled workflow", () => {
    const source = makeGpioSource({ edge: "rising", pull: "up" });
    makeGpioWorkflow(source.id);

    gpioIngestion.startGpioIngestion();

    assert.equal(spawnMock.mock.calls.length, 1);
    const [cmd, args] = spawnMock.mock.calls[0] as [string, string[]];
    assert.equal(cmd, "stdbuf");
    assert.deepEqual(args, ["-oL", "-eL", "gpiomon", "--rising-edge", "--num-events=0", "--bias=pull-up", "gpiochip0", "17"]);
  });

  it("does not respawn when the source/workflow config is unchanged", () => {
    const source = makeGpioSource();
    makeGpioWorkflow(source.id);

    gpioIngestion.syncGpioDataSources();
    gpioIngestion.syncGpioDataSources();

    assert.equal(spawnMock.mock.calls.length, 1);
  });

  it("kills the watcher when its workflow is disabled", () => {
    const source = makeGpioSource();
    const workflow = makeGpioWorkflow(source.id);
    gpioIngestion.syncGpioDataSources();
    const child = children[0];

    automationRepo.updateAutomationWorkflow(workflow.id, { enabled: false });
    gpioIngestion.syncGpioDataSources();

    assert.equal(child.kill.mock.calls[0][0], "SIGTERM");
    assert.equal(spawnMock.mock.calls.length, 1);
  });

  it("records a configuration_invalid error and does not spawn for an invalid config", () => {
    const source = dataSourcesRepo.createDataSource({ name: "Bad GPIO", type: "gpio-input", config: { chip: "not-a-chip", pin: 99 } });
    makeGpioWorkflow(source.id);

    gpioIngestion.syncGpioDataSources();

    assert.equal(spawnMock.mock.calls.length, 0);
    const updated = dataSourcesRepo.getDataSource(source.id)!;
    const error = JSON.parse(updated.last_error!) as { type: string };
    assert.equal(error.type, "configuration_invalid");
  });
});

describe("GPIO line handling", () => {
  it("processes a gpiomon line and forwards it to the workflow", async () => {
    const source = makeGpioSource();
    const workflow = makeGpioWorkflow(source.id);
    gpioIngestion.syncGpioDataSources();
    const child = children[0];

    child.stdout.emit("data", "gpiochip0 17 RISING\n");
    await flush();

    assert.equal(automationServiceMock.recordPushAutomationPayload.mock.calls.length, 1);
    const call = automationServiceMock.recordPushAutomationPayload.mock.calls[0][0] as { workflow: { id: string }; dataSource: { id: string }; triggerType: string; result: { preview: Record<string, unknown> } };
    assert.equal(call.workflow.id, workflow.id);
    assert.equal(call.dataSource.id, source.id);
    assert.equal(call.triggerType, "gpio");
    assert.equal(call.result.preview.edge, "rising");
    assert.equal(call.result.preview.state, "high");
    assert.equal(call.result.preview.event, "gpio_edge");
  });

  it("uses pir-motion event naming for pir-motion profile sources", async () => {
    const source = makeGpioSource({ profile: "pir-motion" });
    makeGpioWorkflow(source.id);
    gpioIngestion.syncGpioDataSources();
    const child = children[0];

    child.stdout.emit("data", "gpiochip0 17 FALLING\n");
    await flush();

    const call = automationServiceMock.recordPushAutomationPayload.mock.calls[0][0] as { result: { preview: Record<string, unknown> } };
    assert.equal(call.result.preview.event, "motion_cleared");
    assert.equal(call.result.preview.edge, "falling");
  });

  it("debounces rapid successive lines", async () => {
    const source = makeGpioSource({ debounceMs: 60000 });
    makeGpioWorkflow(source.id);
    gpioIngestion.syncGpioDataSources();
    const child = children[0];

    child.stdout.emit("data", "gpiochip0 17 RISING\n");
    await flush();
    child.stdout.emit("data", "gpiochip0 17 FALLING\n");
    await flush();

    assert.equal(automationServiceMock.recordPushAutomationPayload.mock.calls.length, 1);
  });

  it("skips processing when the source has been deleted", async () => {
    const source = makeGpioSource();
    makeGpioWorkflow(source.id);
    gpioIngestion.syncGpioDataSources();
    const child = children[0];

    dataSourcesRepo.deleteDataSource(source.id);
    child.stdout.emit("data", "gpiochip0 17 RISING\n");
    await flush();

    assert.equal(automationServiceMock.recordPushAutomationPayload.mock.calls.length, 0);
  });

  it("swallows workflow-busy errors without logging", async () => {
    const source = makeGpioSource();
    makeGpioWorkflow(source.id);
    automationServiceMock.recordPushAutomationPayload.mockReset().mockImplementation(() => {
      const error = new Error("busy") as Error & { code: string };
      error.code = "WORKFLOW_COOLDOWN_ACTIVE";
      return Promise.reject(error);
    });
    gpioIngestion.syncGpioDataSources();
    const child = children[0];

    child.stdout.emit("data", "gpiochip0 17 RISING\n");
    await flush();

    assert.equal((console.error as ReturnType<typeof vi.fn>).mock.calls.length, 0);
  });

  it("logs unexpected workflow errors", async () => {
    const source = makeGpioSource();
    const workflow = makeGpioWorkflow(source.id);
    automationServiceMock.recordPushAutomationPayload.mockReset().mockRejectedValue(new Error("boom"));
    gpioIngestion.syncGpioDataSources();
    const child = children[0];

    child.stdout.emit("data", "gpiochip0 17 RISING\n");
    await flush();

    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls;
    assert.equal(calls.length, 1);
    assert.match(calls[0][0] as string, new RegExp(`GPIO workflow ${workflow.id} failed for source ${source.id}: boom`));
  });
});

describe("watcher process events", () => {
  it("records a hardware_unavailable error on stderr output", () => {
    const source = makeGpioSource();
    makeGpioWorkflow(source.id);
    gpioIngestion.syncGpioDataSources();
    const child = children[0];

    child.stderr.emit("data", "gpiomon: error opening chip\n");

    const updated = dataSourcesRepo.getDataSource(source.id)!;
    const error = JSON.parse(updated.last_error!) as { type: string; nativeMessage: string };
    assert.equal(error.type, "hardware_unavailable");
    assert.equal(error.nativeMessage, "gpiomon: error opening chip");
  });

  it("records a hardware_unavailable error when the process cannot start", () => {
    const source = makeGpioSource();
    makeGpioWorkflow(source.id);
    gpioIngestion.syncGpioDataSources();
    const child = children[0];

    child.emit("error", new Error("ENOENT"));

    const updated = dataSourcesRepo.getDataSource(source.id)!;
    const error = JSON.parse(updated.last_error!) as { type: string; message: string };
    assert.equal(error.type, "hardware_unavailable");
    assert.equal(error.message, "GPIO watcher could not start");
  });

  it("removes the watcher and records source_unavailable on exit, allowing a respawn", () => {
    const source = makeGpioSource();
    makeGpioWorkflow(source.id);
    gpioIngestion.syncGpioDataSources();
    const child = children[0];

    child.emit("exit", null, "SIGTERM");

    const updated = dataSourcesRepo.getDataSource(source.id)!;
    const error = JSON.parse(updated.last_error!) as { type: string };
    assert.equal(error.type, "source_unavailable");

    gpioIngestion.syncGpioDataSources();
    assert.equal(spawnMock.mock.calls.length, 2);
  });

  it("ignores a stale exit event from a replaced watcher", () => {
    const source = makeGpioSource();
    const workflow = makeGpioWorkflow(source.id);
    gpioIngestion.syncGpioDataSources();
    const staleChild = children[0];

    db.prepare("UPDATE automation_workflows SET updated_at = ? WHERE id = ?").run(new Date(Date.now() + 1000).toISOString(), workflow.id);
    gpioIngestion.syncGpioDataSources();
    assert.equal(spawnMock.mock.calls.length, 2);

    staleChild.emit("exit", null, "SIGTERM");

    const updated = dataSourcesRepo.getDataSource(source.id)!;
    assert.equal(updated.last_error, null);
  });
});

describe("stopGpioIngestion", () => {
  it("kills all active watchers and clears them", () => {
    const source = makeGpioSource();
    makeGpioWorkflow(source.id);
    gpioIngestion.syncGpioDataSources();
    const child = children[0];

    gpioIngestion.stopGpioIngestion();

    assert.equal(child.kill.mock.calls[0][0], "SIGTERM");
    gpioIngestion.syncGpioDataSources();
    assert.equal(spawnMock.mock.calls.length, 2);
  });
});
