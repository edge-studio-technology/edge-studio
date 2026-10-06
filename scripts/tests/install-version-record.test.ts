import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "vitest";

const installScript = readFileSync(join(process.cwd(), "install.sh"), "utf8");

function readFunction(name: string): string {
  const match = installScript.match(new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}\\n(?=\\n|$)`, "m"));
  assert.ok(match, `install.sh is missing ${name}()`);
  return match[0];
}

function runBash(script: string, env: Record<string, string>) {
  const result = spawnSync("bash", ["-euo", "pipefail", "-c", script], { encoding: "utf8", env: { ...process.env, ...env } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function git(cwd: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

describe("install.sh version recording", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "install-version-record-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("records the applied manifest only after start_app", () => {
    const main = readFunction("main");

    assert.ok(main.indexOf("  start_app\n") < main.indexOf("  record_applied_manifest\n"));
  });

  it("writes the running frontend and backend images into the state file", () => {
    runBash(
      `log() { :; }
chown() { :; }
${readFunction("resolve_update_agent_state_dir")}
${readFunction("record_applied_manifest")}
record_applied_manifest`,
      {
        APP_DIR: dir,
        UPDATE_AGENT_STATE_DIR: "./update-agent-state",
        MANIFEST_VERSION: "v1.2.3",
        MANIFEST_CREATED_AT: "2026-08-01T00:00:00.000Z",
        FRONTEND_IMAGE: "ghcr.io/x/edge-studio-frontend@sha256:f",
        BACKEND_IMAGE: "ghcr.io/x/edge-studio-backend@sha256:b",
      },
    );

    assert.deepEqual(JSON.parse(readFileSync(join(dir, "update-agent-state/last-applied-manifest.json"), "utf8")), {
      createdAt: "2026-08-01T00:00:00.000Z",
      version: "v1.2.3",
      images: { frontend: "ghcr.io/x/edge-studio-frontend@sha256:f", backend: "ghcr.io/x/edge-studio-backend@sha256:b" },
    });
  });

  it("derives the DEV_MODE build identity from the cloned package.json and commit", () => {
    const repo = join(dir, "repo");
    mkdirSync(repo);
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "edge-studio", version: "0.42.1" }, null, 2));
    git(repo, "init", "-q", "-b", "main");
    git(repo, "add", "package.json");
    git(repo, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "init");
    const sha = git(repo, "rev-parse", "--short", "HEAD");

    const output = runBash(
      `log() { :; }
prepare_app_directory() { mkdir -p "$APP_DIR"; }
clean_app_directory() { :; }
${readFunction("fetch_package_version")}
${readFunction("download_full_repo")}
download_full_repo >/dev/null 2>&1
echo "$EDGE_STUDIO_BUILD_VERSION $EDGE_STUDIO_BUILD_COMMIT"`,
      { APP_DIR: join(dir, "app"), APP_REPO_URL: `file://${repo}`, APP_BRANCH: "main" },
    );

    assert.equal(output.trim(), `v0.42.1-dev+${sha} ${sha}`);
  });
});
