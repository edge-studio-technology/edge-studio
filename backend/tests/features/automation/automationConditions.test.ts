import { describe, expect, it } from "vitest";
import { conditionBaselineKey, evaluateNumericChange } from "../../../src/features/automation/automationConditions.js";

describe("numeric change conditions", () => {
  it("passes the first reading, including zero, and compares both directions to the accepted baseline", () => {
    expect(evaluateNumericChange(0, 1, null)).toMatchObject({ matched: true, firstReading: true });
    expect(evaluateNumericChange(10.83, 1, 10)).toMatchObject({ matched: false, previousValue: 10 });
    expect(evaluateNumericChange(11.67, 1, 10).matched).toBe(true);
    expect(evaluateNumericChange(9, 1, 10).matched).toBe(true);
    expect(evaluateNumericChange(0, 1, 0).matched).toBe(false);
  });

  it("handles the inclusive decimal boundary without treating unchanged values as a change", () => {
    expect(evaluateNumericChange(0.3, 0.2, 0.1).matched).toBe(true);
    expect(evaluateNumericChange(0, 1e-20, 0).matched).toBe(false);
    expect(evaluateNumericChange(0.29, 0.2, 0.1).matched).toBe(false);
  });

  it.each(["1", null, true, NaN, Infinity])("rejects non-finite/non-numeric input %j", (input) => {
    expect(() => evaluateNumericChange(input, 1, null)).toThrow(/finite numeric/);
  });

  it.each([0, -1, "1", NaN, Infinity])("rejects invalid threshold %j", (threshold) => {
    expect(() => evaluateNumericChange(10, threshold, null)).toThrow(/threshold/);
  });

  it("uses a stable condition identity while separating threshold and source changes", () => {
    const original = { source: "variable", variableName: "lux", operator: "changed_by_at_least", value: 1 };
    expect(conditionBaselineKey(original)).toBe(conditionBaselineKey({ value: 1, operator: "changed_by_at_least", variableName: "lux", source: "variable", unused: true }));
    expect(conditionBaselineKey(original)).not.toBe(conditionBaselineKey({ ...original, value: 2 }));
    expect(conditionBaselineKey(original)).not.toBe(conditionBaselineKey({ ...original, variableName: "temperature" }));
    expect(conditionBaselineKey(original)).not.toBe(conditionBaselineKey({ ...original, operator: "equals" }));
  });
});
