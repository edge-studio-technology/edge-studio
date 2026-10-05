import { beforeEach, describe, expect, it } from "vitest";
import {
  closeModalOnOutsideClickSetting,
  guidedTourSeenSetting,
  sidebarStartCollapsedSetting,
} from "../../src/lib/behaviourSettings";

describe("closeModalOnOutsideClickSetting", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to true", () => {
    expect(closeModalOnOutsideClickSetting.get()).toBe(true);
  });
});

describe("sidebarStartCollapsedSetting", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to false", () => {
    expect(sidebarStartCollapsedSetting.get()).toBe(false);
  });
});

describe("guidedTourSeenSetting", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to false", () => {
    expect(guidedTourSeenSetting.get()).toBe(false);
  });

  it("persists under the guided-tour-seen key", () => {
    guidedTourSeenSetting.set(true);
    expect(window.localStorage.getItem("edge-studio:guided-tour-seen")).toBe("true");
    expect(guidedTourSeenSetting.get()).toBe(true);
  });
});
