import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { isMinimaAddress } from "../../src/shared/minima-address.js";

const OFFICIAL_HEX_ADDRESS = "0xDE111E13DBA5054DFF657969BF3A76BFB6CE196F95F6EBEFE1B70FED0115EF1A";
const OFFICIAL_MX_ADDRESS = "MxG086U24F17MT50Y6VUPBPD6VJKTYVMR71WRSYURYUVZDN1VMG25FF39M0458A";

describe("isMinimaAddress", () => {
  it("accepts the official matching 0x and Mx address fixtures", () => {
    assert.equal(isMinimaAddress(OFFICIAL_HEX_ADDRESS), true);
    assert.equal(isMinimaAddress(OFFICIAL_MX_ADDRESS), true);
  });

  it("accepts trimmed and case-insensitive addresses", () => {
    assert.equal(isMinimaAddress(`  ${OFFICIAL_HEX_ADDRESS.toLowerCase()}  `), true);
    assert.equal(isMinimaAddress(`  ${OFFICIAL_MX_ADDRESS.toLowerCase()}  `), true);
  });

  it("accepts odd-length and variable-length hexadecimal addresses", () => {
    assert.equal(isMinimaAddress("0x1"), true);
    assert.equal(isMinimaAddress("0Xabc"), true);
    assert.equal(isMinimaAddress("0x001234abcd"), true);
  });

  it("rejects empty, prefix-only, and non-hexadecimal values", () => {
    assert.equal(isMinimaAddress(""), false);
    assert.equal(isMinimaAddress("0x"), false);
    assert.equal(isMinimaAddress("Mx"), false);
    assert.equal(isMinimaAddress("0x12xz"), false);
    assert.equal(isMinimaAddress("not-an-address"), false);
  });

  it("rejects invalid Mx alphabet and structure", () => {
    assert.equal(isMinimaAddress(OFFICIAL_MX_ADDRESS.replace("G", "X")), false);
    assert.equal(isMinimaAddress("Mx1234"), false);
  });

  it("rejects truncated and checksum-corrupted Mx addresses", () => {
    assert.equal(isMinimaAddress(OFFICIAL_MX_ADDRESS.slice(0, -1)), false);
    assert.equal(isMinimaAddress(`${OFFICIAL_MX_ADDRESS.slice(0, -1)}B`), false);
  });
});
