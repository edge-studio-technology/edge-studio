import { describe, expect, it } from "vitest";
import { joinPath, parentPath } from "../../src/lib/paths";

describe("joinPath", () => {
  it("joins onto root without doubling the slash", () => {
    expect(joinPath("/", "foo")).toBe("/foo");
  });

  it("joins onto a nested path", () => {
    expect(joinPath("/foo", "bar")).toBe("/foo/bar");
  });
});

describe("parentPath", () => {
  it("returns root for root", () => {
    expect(parentPath("/")).toBe("/");
  });

  it("returns root for a single-segment path", () => {
    expect(parentPath("/foo")).toBe("/");
  });

  it("returns the parent of a nested path", () => {
    expect(parentPath("/foo/bar/baz")).toBe("/foo/bar");
  });
});
