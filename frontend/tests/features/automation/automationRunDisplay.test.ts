import { describe, expect, it } from "vitest";
import { formatRunDuration, RUN_STATUS } from "../../../src/features/automation/automationRunDisplay";

describe("automationRunDisplay", () => {
  describe("RUN_STATUS", () => {
    it("maps each run status to a tone and label", () => {
      expect(RUN_STATUS.success).toEqual({ tone: "good", label: "Success" });
      expect(RUN_STATUS.failed).toEqual({ tone: "error", label: "Failed" });
      expect(RUN_STATUS.running).toEqual({ tone: "neutral", label: "Running" });
    });
  });

  describe("formatRunDuration", () => {
    it("returns 'Running' when duration is null", () => {
      expect(formatRunDuration(null)).toBe("Running");
    });

    it("formats sub-second durations in milliseconds", () => {
      expect(formatRunDuration(0)).toBe("0 ms");
      expect(formatRunDuration(999)).toBe("999 ms");
    });

    it("formats durations of a second or more in seconds with one decimal", () => {
      expect(formatRunDuration(1000)).toBe("1.0 s");
      expect(formatRunDuration(1500)).toBe("1.5 s");
      expect(formatRunDuration(12345)).toBe("12.3 s");
    });
  });
});
