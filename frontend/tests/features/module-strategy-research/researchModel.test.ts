import { describe, expect, it } from "vitest";
import { newWorkshop } from "../../../src/features/module-strategy-research/researchData";
import {
  compareApproach,
  parseWorkshop,
  rankApproaches,
  serializeWorkshop,
  workshopReport,
} from "../../../src/features/module-strategy-research/researchModel";

describe("strategy research comparison", () => {
  it("can exclude independent executable contributions without excluding reviewed core work", () => {
    const workshop = newWorkshop();
    workshop.policies.code = "excluded";
    expect(
      rankApproaches(workshop)
        .filter((result) => result.status === "eligible")
        .map((result) => result.approach.id)
        .sort(),
    ).toEqual(["core-prs", "internal", "profiles"]);
  });
  it("does not invent team answers or a fit score", () => {
    const workshop = newWorkshop();
    expect(rankApproaches(workshop)).toHaveLength(7);
    expect(
      rankApproaches(workshop).every((result) => result.distance === null && result.answered === 0),
    ).toBe(true);
  });
  it("distinguishes a minimum requirement from an exact target", () => {
    const workshop = newWorkshop();
    workshop.answers.breadth.value = 3;
    const full = workshop.approaches.find((approach) => approach.id === "full-builder")!;
    expect(compareApproach(workshop, full).distance).toBe(0);
    workshop.answers.breadth.mode = "target";
    expect(compareApproach(workshop, full).distance).toBe(2);
  });
  it("weights only included questions and excludes unresolved votes", () => {
    const workshop = newWorkshop();
    workshop.answers.breadth.value = 5;
    workshop.answers.breadth.importance = 3;
    workshop.answers.guidance.value = 5;
    workshop.answers.guidance.importance = 1;
    const profiles = workshop.approaches.find((approach) => approach.id === "profiles")!;
    expect(compareApproach(workshop, profiles).distance).toBe(2.5);
    workshop.answers.breadth.unresolved = true;
    expect(compareApproach(workshop, profiles).distance).toBe(1);
    expect(compareApproach(workshop, profiles).answered).toBe(1);
  });
  it("does not let a zero priority gap override a policy conflict", () => {
    const workshop = newWorkshop();
    workshop.answers.breadth.value = 5;
    workshop.policies.host = "excluded";
    const full = compareApproach(
      workshop,
      workshop.approaches.find((approach) => approach.id === "full-builder")!,
    );
    expect(full.distance).toBe(0);
    expect(full.status).toBe("conflict");
    expect(rankApproaches(workshop)[0].status).toBe("eligible");
    expect(
      rankApproaches(workshop).findIndex((result) => result.approach.id === "full-builder"),
    ).toBeGreaterThan(0);
  });
  it("distinguishes unknown support from unsupported capability", () => {
    const workshop = newWorkshop();
    workshop.policies.host = "required";
    const packages = compareApproach(
      workshop,
      workshop.approaches.find((approach) => approach.id === "packages")!,
    );
    expect(packages.status).toBe("review");
    expect(packages.unknowns).toHaveLength(1);
    expect(packages.conflicts).toHaveLength(0);
    expect(compareApproach(workshop, workshop.approaches[0]).status).toBe("conflict");
  });
  it("enforces resource ceilings without blending them into capability scores", () => {
    const workshop = newWorkshop();
    workshop.limits.investment = 2;
    const full = compareApproach(
      workshop,
      workshop.approaches.find((approach) => approach.id === "full-builder")!,
    );
    expect(full.status).toBe("conflict");
    expect(full.distance).toBeNull();
    expect(full.conflicts[0]).toContain("exceeds");
  });
  it("round-trips context, unanswered choices, and edited profiles", () => {
    const workshop = newWorkshop();
    workshop.participants = "Product and engineering";
    workshop.answers.breadth.note = "Keep the disagreement visible";
    workshop.approaches[0].scores.validation = 2;
    expect(parseWorkshop(serializeWorkshop(workshop))).toEqual(workshop);
    expect(newWorkshop().approaches[0].scores.validation).toBe(4);
  });
  it("rejects malformed exports and duplicate paths", () => {
    const exportData = JSON.parse(serializeWorkshop(newWorkshop()));
    exportData.workshop.approaches[1].id = exportData.workshop.approaches[0].id;
    expect(() => parseWorkshop(JSON.stringify(exportData))).toThrow("seven approach profiles");
    const invalidScores = JSON.parse(serializeWorkshop(newWorkshop()));
    invalidScores.workshop.answers.breadth.value = 6;
    expect(() => parseWorkshop(JSON.stringify(invalidScores))).toThrow("Every dimension");
    expect(() => parseWorkshop('{"schemaVersion":99}')).toThrow("version 1");
  });
  it("exports model assumptions and uncertainty with the results", () => {
    const workshop = newWorkshop();
    workshop.name = "A real team discussion";
    workshop.decisions = "No decision on host access yet.";
    const report = workshopReport(workshop);
    expect(report).toContain("# A real team discussion");
    expect(report).toContain("not a probability");
    expect(report).toContain("Not scored");
    expect(report).toContain("No decision on host access yet.");
    expect(report).toContain("Unspecified");
  });
});
