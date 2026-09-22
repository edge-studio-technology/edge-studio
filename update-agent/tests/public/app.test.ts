import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const script = readFileSync(new URL("../../public/app.js", import.meta.url), "utf8");

type FakeElement = {
  classList: {
    contains: (name: string) => boolean;
    toggle: (name: string, force?: boolean) => void;
  };
  textContent: string;
  addEventListener: (name: string, listener: () => void) => void;
  click: () => void;
};

function fakeElement(initiallyHidden = false): FakeElement {
  const classes = new Set(initiallyHidden ? ["hidden"] : []);
  const listeners = new Map<string, () => void>();
  return {
    classList: {
      contains: (name) => classes.has(name),
      toggle: (name, force) => {
        const enabled = force ?? !classes.has(name);
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    textContent: "",
    addEventListener: (name, listener) => listeners.set(name, listener),
    click: () => listeners.get("click")?.(),
  };
}

function createHarness(fetchMock: ReturnType<typeof vi.fn>) {
  const elements = new Map<string, FakeElement>([
    ["view-checking", fakeElement()],
    ["view-updating", fakeElement(true)],
    ["view-success", fakeElement(true)],
    ["view-failure", fakeElement(true)],
    ["view-idle", fakeElement(true)],
    ["failure-title", fakeElement()],
    ["failure-message", fakeElement()],
    ["retry-status", fakeElement()],
  ]);
  const timers: Array<() => void> = [];
  const assign = vi.fn();

  runInNewContext(script, {
    document: {
      getElementById: (id: string) => elements.get(id),
    },
    fetch: fetchMock,
    setTimeout: (callback: () => void) => {
      timers.push(callback);
      return timers.length;
    },
    window: { location: { assign } },
  });

  return { elements, timers, assign };
}

async function flushPromises() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function response(body: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe("update progress page", () => {
  it("shows checking until the first status request confirms an update", async () => {
    let resolveFetch!: (value: ReturnType<typeof response>) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const { elements } = createHarness(fetchMock);

    expect(elements.get("view-checking")?.classList.contains("hidden")).toBe(false);
    expect(elements.get("view-updating")?.classList.contains("hidden")).toBe(true);

    resolveFetch(response({ state: "running" }));
    await flushPromises();

    expect(elements.get("view-checking")?.classList.contains("hidden")).toBe(true);
    expect(elements.get("view-updating")?.classList.contains("hidden")).toBe(false);
  });

  it("settles repeated request failures into a persistent retryable error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    const { elements, timers, assign } = createHarness(fetchMock);

    await flushPromises();
    for (let attempt = 1; attempt < 10; attempt += 1) {
      timers.shift()?.();
      await flushPromises();
    }

    expect(elements.get("view-failure")?.classList.contains("hidden")).toBe(false);
    expect(elements.get("failure-title")?.textContent).toBe("Couldn't check update status");
    expect(elements.get("failure-message")?.textContent).toContain("Lost contact");
    expect(assign).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(response({ state: "idle" }));
    elements.get("retry-status")?.click();
    await flushPromises();

    expect(elements.get("view-idle")?.classList.contains("hidden")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });
});
