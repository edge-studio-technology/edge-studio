import { describe, expect, it } from "vitest";
import { cx } from "../../src/lib/cx";

describe("cx", () => {
  it("joins truthy class names with a space", () => {
    expect(cx("a", "b", "c")).toBe("a b c");
  });

  it("filters out false, null, and undefined", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
  });

  it("returns an empty string when nothing is truthy", () => {
    expect(cx(false, null, undefined)).toBe("");
  });
});
