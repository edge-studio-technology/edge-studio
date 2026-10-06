import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "vitest";

const installScript = readFileSync(join(process.cwd(), "install.sh"), "utf8");

function readFunction(name: string): string {
  const match = installScript.match(new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}\\n(?=\\n|$)`, "m"));
  assert.ok(match, `install.sh is missing ${name}()`);
  return match[0];
}

describe("install.sh existing config", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "install-existing-config-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not export the previous install's COMPOSE_PROFILES to compose", () => {
    writeFileSync(join(dir, ".env"), "COMPOSE_PROFILES=mqtt\nFRONTEND_PORT=8081\n");

    const result = spawnSync(
      "bash",
      [
        "-c",
        `log() { :; }
${readFunction("load_existing_config")}
load_existing_config
bash -c 'echo "profiles=\${COMPOSE_PROFILES-unset} port=$FRONTEND_PORT"'`,
      ],
      { encoding: "utf8", env: { PATH: process.env.PATH ?? "", APP_DIR: dir } },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "profiles=unset port=8081");
  });
});
