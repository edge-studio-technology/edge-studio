import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";
import type { DataSourceRecord } from "../../../src/features/data-sources/dataSources.repository.js";

const repoMock = vi.hoisted(() => ({ getDataSource: vi.fn() }));
vi.mock("../../../src/features/data-sources/dataSources.repository.js", () => repoMock);

type FakeChild = {
  stderr: { setEncoding: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };
  on: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
  emit: (event: string, ...args: unknown[]) => void;
};

function makeFakeChild(): FakeChild {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  const on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    const list = handlers.get(event) ?? [];
    list.push(cb);
    handlers.set(event, list);
  });
  return {
    stderr: { setEncoding: vi.fn(), on },
    on,
    kill: vi.fn(),
    emit(event: string, ...args: unknown[]) {
      for (const cb of handlers.get(event) ?? []) cb(...args);
    }
  };
}

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

function makeRecord(overrides: Partial<DataSourceRecord> = {}): DataSourceRecord {
  return {
    id: "src-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    name: "LED",
    type: "gpio-output",
    status: "active",
    description: null,
    config: JSON.stringify({ chip: "gpiochip0", pin: 17, profile: "led", activeState: "high" }),
    last_read_at: null,
    last_error: null,
    last_preview: null,
    last_hash: null,
    ...overrides
  };
}

let children: FakeChild[];

beforeEach(() => {
  repoMock.getDataSource.mockReset();
  spawnMock.mockReset();
  children = [];
  spawnMock.mockImplementation((_cmd: string, args: string[]) => {
    const child = makeFakeChild();
    children.push(child);
    if (!args.includes("--mode=signal")) void Promise.resolve().then(() => child.emit("exit", 0));
    return child;
  });
});

describe("pulseGpioOutput", () => {
  it("throws when the target does not exist", async () => {
    const { pulseGpioOutput } = await import("../../../src/features/data-sources/gpioOutput.service.js");
    repoMock.getDataSource.mockReturnValue(undefined);
    await assert.rejects(pulseGpioOutput({ targetId: "missing", durationMs: 100 }), /GPIO output target not found/);
  });

  it("throws when the target is not a gpio-output source", async () => {
    const { pulseGpioOutput } = await import("../../../src/features/data-sources/gpioOutput.service.js");
    repoMock.getDataSource.mockReturnValue(makeRecord({ type: "mqtt" }));
    await assert.rejects(pulseGpioOutput({ targetId: "src-1", durationMs: 100 }), /Control output block requires a GPIO output target/);
  });

  it("rejects durations outside 1-60000ms", async () => {
    const { pulseGpioOutput } = await import("../../../src/features/data-sources/gpioOutput.service.js");
    repoMock.getDataSource.mockReturnValue(makeRecord());
    await assert.rejects(pulseGpioOutput({ targetId: "src-1", durationMs: 0 }), /Pulse duration must be between 1 and 60000 ms/);
    await assert.rejects(pulseGpioOutput({ targetId: "src-1", durationMs: 60001 }), /Pulse duration must be between 1 and 60000 ms/);
  });

  it("drives inactive then active then holds inactive, resolving with the pulse summary", async () => {
    const { pulseGpioOutput } = await import("../../../src/features/data-sources/gpioOutput.service.js");
    repoMock.getDataSource.mockReturnValue(makeRecord());
    const result = await pulseGpioOutput({ targetId: "src-1", durationMs: 200 });

    assert.equal(result.targetId, "src-1");
    assert.equal(result.targetName, "LED");
    assert.equal(result.action, "pulse");
    assert.equal(result.durationMs, 200);
    assert.equal(result.activeValue, 1);
    assert.equal(result.inactiveValue, 0);

    assert.equal(spawnMock.mock.calls.length, 4);
    const [, inactiveArgs] = spawnMock.mock.calls[0] as [string, string[]];
    assert.deepEqual(inactiveArgs, ["--mode=time", "--usec=1000", "gpiochip0", "17=0"]);
    const [, activeArgs] = spawnMock.mock.calls[1] as [string, string[]];
    assert.deepEqual(activeArgs, ["--mode=time", "--usec=200000", "gpiochip0", "17=1"]);
    const [, driveInactiveArgs] = spawnMock.mock.calls[2] as [string, string[]];
    assert.deepEqual(driveInactiveArgs, ["--mode=time", "--usec=1000", "gpiochip0", "17=0"]);
    const [, holderArgs] = spawnMock.mock.calls[3] as [string, string[]];
    assert.deepEqual(holderArgs, ["--mode=signal", "gpiochip0", "17=0"]);
  });

  it("inverts active and inactive values for an active-low output", async () => {
    const { pulseGpioOutput } = await import("../../../src/features/data-sources/gpioOutput.service.js");
    repoMock.getDataSource.mockReturnValue(makeRecord({
      config: JSON.stringify({ chip: "gpiochip0", pin: 17, profile: "led", activeState: "low" })
    }));

    const result = await pulseGpioOutput({ targetId: "src-1", durationMs: 200 });

    assert.equal(result.activeValue, 0);
    assert.equal(result.inactiveValue, 1);
    assert.deepEqual(spawnMock.mock.calls[1]?.[1], ["--mode=time", "--usec=200000", "gpiochip0", "17=0"]);
    assert.deepEqual(spawnMock.mock.calls[3]?.[1], ["--mode=signal", "gpiochip0", "17=1"]);
  });

  it("still drives the inactive holder and rejects when a gpioset call exits non-zero", async () => {
    const { pulseGpioOutput } = await import("../../../src/features/data-sources/gpioOutput.service.js");
    repoMock.getDataSource.mockReturnValue(makeRecord());
    let call = 0;
    spawnMock.mockImplementation(() => {
      const child = makeFakeChild();
      children.push(child);
      call += 1;
      if (call === 2) {
        void Promise.resolve().then(() => child.emit("exit", 1));
      } else {
        void Promise.resolve().then(() => child.emit("exit", 0));
      }
      return child;
    });

    await assert.rejects(pulseGpioOutput({ targetId: "src-1", durationMs: 200 }), /GPIO output failed/);
    assert.equal(spawnMock.mock.calls.length, 4);
  });

  it("includes gpioset stderr in a non-zero exit error", async () => {
    const { pulseGpioOutput } = await import("../../../src/features/data-sources/gpioOutput.service.js");
    repoMock.getDataSource.mockReturnValue(makeRecord());
    spawnMock.mockImplementationOnce(() => {
      const child = makeFakeChild();
      children.push(child);
      void Promise.resolve().then(() => {
        child.emit("data", "permission denied\n");
        child.emit("exit", 1);
      });
      return child;
    });

    await assert.rejects(pulseGpioOutput({ targetId: "src-1", durationMs: 200 }), /GPIO output failed: permission denied/);
  });

  it("logs an inactive-drive failure and still starts the holder", async () => {
    const { pulseGpioOutput } = await import("../../../src/features/data-sources/gpioOutput.service.js");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    repoMock.getDataSource.mockReturnValue(makeRecord());
    let call = 0;
    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      const child = makeFakeChild();
      children.push(child);
      call += 1;
      if (!args.includes("--mode=signal")) void Promise.resolve().then(() => child.emit("exit", call === 3 ? 1 : 0));
      return child;
    });

    await pulseGpioOutput({ targetId: "src-1", durationMs: 200 });
    assert.equal(spawnMock.mock.calls.length, 4);
    assert.ok(consoleError.mock.calls.some(([message]) => String(message).includes("could not drive inactive state")));
  });

  it("rejects when gpioset cannot start", async () => {
    const { pulseGpioOutput } = await import("../../../src/features/data-sources/gpioOutput.service.js");
    repoMock.getDataSource.mockReturnValue(makeRecord());
    spawnMock.mockImplementationOnce(() => {
      const child = makeFakeChild();
      children.push(child);
      void Promise.resolve().then(() => child.emit("error", new Error("ENOENT")));
      return child;
    });

    await assert.rejects(pulseGpioOutput({ targetId: "src-1", durationMs: 200 }), /GPIO output could not start: ENOENT/);
  });
});

describe("stopGpioOutputHolders", () => {
  it("kills any running inactive holder processes", async () => {
    const { pulseGpioOutput, stopGpioOutputHolders } = await import("../../../src/features/data-sources/gpioOutput.service.js");
    repoMock.getDataSource.mockReturnValue(makeRecord());
    await pulseGpioOutput({ targetId: "src-1", durationMs: 200 });

    const holder = children[3];
    stopGpioOutputHolders();
    assert.equal(holder.kill.mock.calls[0][0], "SIGTERM");
  });

  it("logs stderr and startup errors from an inactive holder", async () => {
    const { pulseGpioOutput, stopGpioOutputHolders } = await import("../../../src/features/data-sources/gpioOutput.service.js");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    repoMock.getDataSource.mockReturnValue(makeRecord());
    await pulseGpioOutput({ targetId: "src-1", durationMs: 200 });

    const holder = children[3];
    holder.emit("data", "holder failed\n");
    holder.emit("error", new Error("ENOENT"));

    assert.ok(consoleError.mock.calls.some(([message]) => String(message).includes("inactive holder error: holder failed")));
    assert.ok(consoleError.mock.calls.some(([message]) => String(message).includes("inactive holder could not start: ENOENT")));
    stopGpioOutputHolders();
  });
});
