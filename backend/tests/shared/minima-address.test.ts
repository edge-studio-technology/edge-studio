import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { isMinimaAddress } from "../../src/shared/minima-address.js";

describe("isMinimaAddress", () => {
  it("accepts Mx-prefixed addresses", () => {
    assert.equal(isMinimaAddress("Mx001234ABCD"), true);
  });

  it("accepts 0x-prefixed addresses", () => {
    assert.equal(isMinimaAddress("0x001234abcd"), true);
  });

  it("is case-insensitive on the prefix", () => {
    assert.equal(isMinimaAddress("mX001234abcd"), true);
    assert.equal(isMinimaAddress("0X001234abcd"), true);
  });

  it("trims surrounding whitespace before checking", () => {
    assert.equal(isMinimaAddress("  Mx001234ABCD  "), true);
  });

  it("rejects strings without a valid prefix", () => {
    assert.equal(isMinimaAddress("not-an-address"), false);
    assert.equal(isMinimaAddress(""), false);
    assert.equal(isMinimaAddress("x001234ABCD"), false);
  });
});
