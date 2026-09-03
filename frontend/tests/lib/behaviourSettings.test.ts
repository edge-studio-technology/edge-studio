import { beforeEach, describe, expect, it } from "vitest";
import { closeModalOnOutsideClickSetting, sidebarStartCollapsedSetting } from "../../src/lib/behaviourSettings";

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
