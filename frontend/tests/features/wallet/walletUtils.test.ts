import { describe, expect, it } from "vitest";
import {
  compareDecimalStrings,
  isNativeTokenId,
  isPositiveDecimal,
} from "../../../src/features/wallet/walletUtils";

describe("compareDecimalStrings", () => {
  it("returns 0 for equal values with different formatting", () => {
    expect(compareDecimalStrings("1", "1.0")).toBe(0);
    expect(compareDecimalStrings("01.50", "1.5")).toBe(0);
    expect(compareDecimalStrings("0", "0.000")).toBe(0);
  });

  it("returns 1 when a is greater than b", () => {
    expect(compareDecimalStrings("2", "1.999")).toBe(1);
    expect(compareDecimalStrings("1.1", "1.05")).toBe(1);
    expect(compareDecimalStrings("10", "9")).toBe(1);
  });

  it("returns -1 when a is less than b", () => {
    expect(compareDecimalStrings("1.999", "2")).toBe(-1);
    expect(compareDecimalStrings("0.5", "1")).toBe(-1);
  });

  it("treats blank/dot-only input as 0", () => {
    expect(compareDecimalStrings("", "0")).toBe(0);
    expect(compareDecimalStrings(".", "0")).toBe(0);
    expect(compareDecimalStrings("  ", "0")).toBe(0);
  });

  it("handles differing fractional-part lengths by padding", () => {
    expect(compareDecimalStrings("1.2", "1.20000")).toBe(0);
    expect(compareDecimalStrings("1.20001", "1.2")).toBe(1);
  });
});

describe("isPositiveDecimal", () => {
  it("accepts positive integers and decimals", () => {
    expect(isPositiveDecimal("1")).toBe(true);
    expect(isPositiveDecimal("0.5")).toBe(true);
    expect(isPositiveDecimal("  10.25  ")).toBe(true);
  });

  it("rejects zero, negative, blank, and non-numeric input", () => {
    expect(isPositiveDecimal("0")).toBe(false);
    expect(isPositiveDecimal("0.0")).toBe(false);
    expect(isPositiveDecimal("-1")).toBe(false);
    expect(isPositiveDecimal("")).toBe(false);
    expect(isPositiveDecimal("abc")).toBe(false);
    expect(isPositiveDecimal("1.2.3")).toBe(false);
    expect(isPositiveDecimal("1e5")).toBe(false);
  });
});

describe("isNativeTokenId", () => {
  it("matches the native token id case-insensitively and trims whitespace", () => {
    expect(isNativeTokenId("0x00")).toBe(true);
    expect(isNativeTokenId("0X00")).toBe(true);
    expect(isNativeTokenId("  0x00  ")).toBe(true);
  });

  it("returns false for any other token id", () => {
    expect(isNativeTokenId("0x01")).toBe(false);
    expect(isNativeTokenId("")).toBe(false);
  });
});
