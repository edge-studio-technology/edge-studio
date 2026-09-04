import { beforeEach, describe, expect, it } from "vitest";
import { createLocalBooleanSetting } from "../../src/lib/localSettings";

describe("createLocalBooleanSetting", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns the default value when nothing is stored", () => {
    const setting = createLocalBooleanSetting("test-key-1", true);
    expect(setting.get()).toBe(true);
  });

  it("reads a previously stored value on creation", () => {
    window.localStorage.setItem("edge-studio:test-key-2", "true");
    const setting = createLocalBooleanSetting("test-key-2", false);
    expect(setting.get()).toBe(true);
  });

  it("updates the value and persists it to localStorage", () => {
    const setting = createLocalBooleanSetting("test-key-3", false);
    setting.set(true);
    expect(setting.get()).toBe(true);
    expect(window.localStorage.getItem("edge-studio:test-key-3")).toBe("true");
  });

  it("notifies subscribers on set and returns an unsubscribe function", () => {
    const setting = createLocalBooleanSetting("test-key-4", false);
    let calls = 0;
    const unsubscribe = setting.subscribe(() => {
      calls += 1;
    });

    setting.set(true);
    expect(calls).toBe(1);

    unsubscribe();
    setting.set(false);
    expect(calls).toBe(1);
  });
});
