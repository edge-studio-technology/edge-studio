import type { DemoModule } from "./demoData";

export function averageRating(module: Pick<DemoModule, "ratingTotal" | "ratingCount">) {
  return module.ratingCount ? module.ratingTotal / module.ratingCount : null;
}

export function rateModule(module: DemoModule, score: number): DemoModule {
  if (!Number.isInteger(score) || score < 1 || score > 5) return module;
  return {
    ...module,
    ratingTotal: module.ratingTotal - (module.userRating ?? 0) + score,
    ratingCount: module.ratingCount + (module.userRating === undefined ? 1 : 0),
    userRating: score,
  };
}

export function builderReputation(modules: DemoModule[], author: string) {
  const published = modules.filter((module) => module.author === author && !module.localOnly);
  const ratingCount = published.reduce((sum, module) => sum + module.ratingCount, 0);
  const ratingTotal = published.reduce((sum, module) => sum + module.ratingTotal, 0);
  return {
    modules: published,
    ratingCount,
    average: ratingCount ? ratingTotal / ratingCount : null,
    downloads: published.reduce((sum, module) => sum + module.downloads, 0),
  };
}
