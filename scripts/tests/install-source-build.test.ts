import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "vitest";

const installer = readFileSync(join(process.cwd(), "install.sh"), "utf8").replaceAll("\r\n", "\n");
const bash = process.platform === "win32" && existsSync("C:/Program Files/Git/bin/bash.exe")
  ? "C:/Program Files/Git/bin/bash.exe"
  : "bash";
const readFunction = (name: string) => {
  const match = installer.match(new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}\\n(?=\\n|$)`, "m"));
  assert.ok(match, `missing installer function ${name}`);
  return match[0];
};

describe("documented contributor source-build route", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "edge-source-build-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  const run = (body: string) => {
    const result = spawnSync(bash, ["-c", `set -eu
is_truthy() { [ "$1" = true ]; }
log() { :; }
${body}`], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim().split(/\r?\n/);
  };

  it("uses the fork checkout in source mode and the runtime bundle in release mode", () => {
    assert.deepEqual(run(`${readFunction("download_app")}
download_full_repo() { printf 'source %s %s\\n' "$APP_REPO_URL" "$APP_BRANCH"; }
download_runtime_bundle() { echo signed-runtime; }
APP_REPO_URL=https://github.com/example/edge-studio.git
APP_BRANCH=my-device
DEV_MODE=true
download_app
DEV_MODE=false
download_app`), ["source https://github.com/example/edge-studio.git my-device", "signed-runtime"]);
  });

  it("does not fetch a signed manifest in source mode but retains it for official releases", () => {
    assert.deepEqual(run(`${readFunction("resolve_images")}
fetch_and_verify_manifest() { echo verified-manifest; }
DEV_MODE=true
resolve_images
printf '%s %s %s\\n' "$FRONTEND_IMAGE" "$BACKEND_IMAGE" "$MANIFEST_VERSION"
DEV_MODE=false
resolve_images`), ["edge-studio-frontend:dev edge-studio-backend:dev ", "verified-manifest"]);
  });

  it("builds changed source and removes stale release identity and the updater only in source mode", () => {
    const lines = run(`${readFunction("start_app")}
APP_DIR="$PWD"
mkdir state
echo old > state/last-applied-manifest.json
compose() { printf 'compose %s\\n' "$*"; }
ensure_compose_network() { echo network; }
resolve_update_agent_state_dir() { printf '%s/state' "$APP_DIR"; }
DEV_MODE=true
start_app
test ! -e state/last-applied-manifest.json
echo old > state/last-applied-manifest.json
DEV_MODE=false
start_app
test -e state/last-applied-manifest.json`);
    assert.deepEqual(lines, [
      "compose build frontend backend", "network", "compose up -d",
      "compose --profile update-agent rm -sf update-agent",
      "compose pull frontend backend", "network", "compose up -d",
    ]);
  });
});
