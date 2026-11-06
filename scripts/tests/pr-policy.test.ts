import { describe, expect, it } from "vitest";
import { checkPrPolicy } from "../dev/check-pr-policy.mjs";

const repository = { full_name: "edge-studio-technology/edge-studio" };
function pr(head = "sensor-support", base = "dev", title = "feat(devices): support a new sensor") {
  return {
    head: { ref: head, repo: repository },
    base: { ref: base, repo: repository },
    user: { type: "User", login: "contributor" },
    title
  };
}

describe("PR release policy", () => {
  it.each([
    "feat(devices): support a sensor", "fix: handle missing devices", "docs: explain setup",
    "feat!: change the device format", "fix(api)!: remove a legacy response", "chore(main): release 0.44.0"
  ])("accepts Conventional title %s", (title) => {
    expect(() => checkPrPolicy(pr("topic", "dev", title), "title")).not.toThrow();
  });

  it.each(["Added sensor support", "feat: ", "feat(): support a sensor", "unknown: change", "fix: first\nsecond"])(
    "rejects non-Conventional title %s", (title) => {
      expect(() => checkPrPolicy(pr("topic", "dev", title), "title")).toThrow("Conventional");
    }
  );

  it("allows same-repository promotion and synchronization with descriptive titles", () => {
    expect(() => checkPrPolicy(pr("dev", "main", "Promote tested changes"), "main")).not.toThrow();
    expect(() => checkPrPolicy(pr("dev", "main", "Promote tested changes"), "title")).not.toThrow();
    expect(() => checkPrPolicy(pr("main", "dev", "Sync released version"), "title")).not.toThrow();
  });

  it("rejects a fork named dev or main impersonating an internal branch", () => {
    for (const [head, base] of [["dev", "main"], ["main", "dev"]]) {
      const fork = pr(head, base, "Not conventional");
      fork.head.repo = { full_name: "outsider/edge-studio" };
      expect(() => checkPrPolicy(fork, "title")).toThrow();
      expect(() => checkPrPolicy(fork, "main")).toThrow();
    }
  });

  it("allows only the configured bot's same-repository release branch into main", () => {
    const release = pr("release-please--branches--main", "main", "chore(main): release 0.44.0");
    release.user = { type: "Bot", login: "studio-release[bot]" };
    expect(() => checkPrPolicy(release, "main", "studio-release[bot]")).not.toThrow();
    expect(() => checkPrPolicy(release, "main")).toThrow();
    expect(() => checkPrPolicy(release, "main", "another[bot]")).toThrow();
    expect(() => checkPrPolicy({ ...release, user: { ...release.user, type: "User" } }, "main", release.user.login)).toThrow();
    expect(() => checkPrPolicy({ ...release, head: { ...release.head, repo: { full_name: "fork/repo" } } }, "main", release.user.login)).toThrow();
    expect(() => checkPrPolicy({ ...release, head: { ...release.head, ref: "release-please--branches--other" } }, "main", release.user.login)).toThrow();
  });

  it("rejects missing/deleted head repositories and arbitrary main branches", () => {
    const deleted = { ...pr("dev", "main"), head: { ref: "dev", repo: null } };
    expect(() => checkPrPolicy(deleted, "main")).toThrow();
    expect(() => checkPrPolicy(pr("topic", "main"), "main")).toThrow();
    expect(() => checkPrPolicy(pr('$(echo unsafe)', "main"), "main")).toThrow();
  });
});
