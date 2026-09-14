import { describe, expect, it } from "vitest";
import { formatUtcTime } from "../../src/lib/time";

describe("formatUtcTime", () => {
  it("formats a Date as zero-padded UTC HH:MM:SSZ", () => {
    const date = new Date(Date.UTC(2026, 0, 5, 3, 7, 9));
    expect(formatUtcTime(date)).toBe("03:07:09Z");
  });

  it("accepts an ISO string", () => {
    expect(formatUtcTime("2026-01-05T13:45:02.000Z")).toBe("13:45:02Z");
  });
});
