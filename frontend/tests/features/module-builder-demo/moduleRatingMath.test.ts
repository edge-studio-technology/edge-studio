import { describe, expect, it } from "vitest";
import { demoModules, type DemoModule } from "../../../src/features/module-builder-demo/demoData";
import {
  averageRating,
  builderReputation,
  rateModule,
} from "../../../src/features/module-builder-demo/moduleRatingMath";

function sample(patch: Partial<DemoModule>): DemoModule {
  return { ...demoModules[0], ...patch };
}

describe("module reputation", () => {
  it("weights a builder's aggregate by individual ratings, not by module averages", () => {
    const modules = [
      sample({ id: "one", ratingCount: 1, ratingTotal: 1 }),
      sample({ id: "two", ratingCount: 9, ratingTotal: 45 }),
    ];
    const reputation = builderReputation(modules, "Edge Studio");
    expect(reputation.average).toBe(4.6);
    expect(reputation.ratingCount).toBe(10);
  });

  it("replaces an existing user's vote without counting them twice", () => {
    const initial = sample({ ratingCount: 2, ratingTotal: 8 });
    const rated = rateModule(initial, 5);
    expect(rated.ratingCount).toBe(3);
    expect(rated.ratingTotal).toBe(13);
    const edited = rateModule(rated, 1);
    expect(edited.ratingCount).toBe(3);
    expect(edited.ratingTotal).toBe(9);
    expect(edited.userRating).toBe(1);
    expect(averageRating(edited)).toBe(3);
    expect(initial.ratingTotal).toBe(8);
  });

  it("does not treat unrated modules as zero-star ratings", () => {
    const modules = [
      sample({ ratingCount: 0, ratingTotal: 0 }),
      sample({ ratingCount: 1, ratingTotal: 5 }),
    ];
    expect(averageRating(modules[0])).toBeNull();
    expect(builderReputation(modules, "Edge Studio").average).toBe(5);
    expect(builderReputation([], "New builder").average).toBeNull();
  });

  it("excludes other builders and private drafts from reputation and downloads", () => {
    const modules = [
      sample({ ratingCount: 2, ratingTotal: 8, downloads: 10 }),
      sample({ author: "Other builder", downloads: 900 }),
      sample({ localOnly: true, downloads: 1000 }),
    ];
    const reputation = builderReputation(modules, "Edge Studio");
    expect(reputation.modules).toHaveLength(1);
    expect(reputation.downloads).toBe(10);
    expect(reputation.average).toBe(4);
  });

  it("ignores invalid votes", () => {
    const module = demoModules[0];
    for (const score of [0, 6, 2.5, Number.NaN]) expect(rateModule(module, score)).toBe(module);
  });
});
