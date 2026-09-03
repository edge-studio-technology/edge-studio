import { describe, expect, it } from "vitest";
import { formatMinimaAmount, formatSize, shortHash } from "../../src/lib/format";

describe("shortHash", () => {
  it("returns short values unchanged", () => {
    expect(shortHash("abc123")).toBe("abc123");
  });

  it("truncates Mx-prefixed values", () => {
    const value = "Mx" + "a".repeat(40);
    expect(shortHash(value)).toBe(`${value.slice(0, 8)}…${value.slice(-6)}`);
  });

  it("truncates 0x-prefixed values", () => {
    const value = "0x" + "b".repeat(40);
    expect(shortHash(value)).toBe(`${value.slice(0, 10)}…${value.slice(-6)}`);
  });

  it("truncates other long values generically", () => {
    const value = "c".repeat(40);
    expect(shortHash(value)).toBe(`${value.slice(0, 8)}…${value.slice(-6)}`);
  });
});

describe("formatSize", () => {
  it("returns empty string for undefined", () => {
    expect(formatSize(undefined)).toBe("");
  });

  it("formats bytes", () => {
    expect(formatSize(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatSize(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("formatMinimaAmount", () => {
  it("returns 0 for empty or bare-dot input", () => {
    expect(formatMinimaAmount("")).toBe("0");
    expect(formatMinimaAmount(".")).toBe("0");
  });

  it("returns non-numeric input unchanged", () => {
    expect(formatMinimaAmount("abc")).toBe("abc");
  });

  it("trims trailing zero decimals", () => {
    expect(formatMinimaAmount("0.006000000")).toBe("0.006");
  });

  it("clips to maxDecimals", () => {
    expect(formatMinimaAmount("1.123456789", 3)).toBe("1.123");
  });

  it("preserves the negative sign", () => {
    expect(formatMinimaAmount("-1.500000", 6)).toBe("-1.5");
  });

  it("drops an all-zero fraction down to the integer part", () => {
    expect(formatMinimaAmount("42.000000")).toBe("42");
  });
});
