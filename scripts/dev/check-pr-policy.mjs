import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const conventionalTitle = /^(feat|fix|perf|refactor|docs|test|build|ci|chore|style|revert)(\([^()\r\n]+\))?!?: \S[^\r\n]*$/;

export function checkPrPolicy(pr, mode, releaseBotLogin = "") {
  const sameRepository = Boolean(pr.head.repo?.full_name) && pr.head.repo.full_name === pr.base.repo?.full_name;
  const promotion = sameRepository && pr.base.ref === "main" && pr.head.ref === "dev";
  const synchronization = sameRepository && pr.base.ref === "dev" && pr.head.ref === "main";
  const release = sameRepository && pr.base.ref === "main"
    && pr.head.ref === "release-please--branches--main"
    && Boolean(releaseBotLogin) && pr.user.type === "Bot" && pr.user.login === releaseBotLogin;

  if (mode === "main") {
    if (promotion || release) return;
    throw new Error("PRs to main must come from this repository's dev branch or the configured release bot.");
  }
  if (mode !== "title") throw new Error(`Unknown PR policy: ${mode}`);
  if (promotion || synchronization) return;
  if (!conventionalTitle.test(pr.title)) {
    throw new Error("Use a Conventional PR title, for example: feat(devices): support a new sensor or fix(workflows): handle an unavailable device");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  checkPrPolicy(event.pull_request, process.argv[2], process.env.RELEASE_APP_BOT_LOGIN);
  console.log("PR policy: ok");
}
