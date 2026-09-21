import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/release/build-docker-compose.mjs");

describe("build-docker-compose.mjs", () => {
  let dir: string;
  let manifestPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "build-docker-compose-"));
    manifestPath = join(dir, "manifest.json");
    writeFileSync(
      manifestPath,
      JSON.stringify({
        frontend: "ghcr.io/example/frontend@sha256:frontend",
        backend: "ghcr.io/example/backend@sha256:backend",
        updateAgent: "ghcr.io/example/update-agent@sha256:update-agent"
      })
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes network protection settings, update-agent host-agent wiring, and the public manifest URL", () => {
    const result = spawnSync(process.execPath, [scriptPath, manifestPath, "development", dir], { encoding: "utf8" });

    assert.equal(result.status, 0);
    const compose = readFileSync(join(dir, "docker-compose.yml"), "utf8");
    const envExample = readFileSync(join(dir, ".env.example"), "utf8");
    assert.match(
      compose,
      /EDGE_STUDIO_DOCKER_SUBNET: \$\{EDGE_STUDIO_DOCKER_SUBNET:-172\.30\.0\.0\/24\}/,
    );
    assert.match(
      compose,
      /EDGE_STUDIO_DOCKER_GATEWAY: \$\{EDGE_STUDIO_DOCKER_GATEWAY:-172\.30\.0\.1\}/,
    );
    assert.match(
      compose,
      /ipam:\n      config:\n        - subnet: \$\{EDGE_STUDIO_DOCKER_SUBNET:-172\.30\.0\.0\/24\}\n          gateway: \$\{EDGE_STUDIO_DOCKER_GATEWAY:-172\.30\.0\.1\}/,
    );
    assert.match(compose, /HOST_AGENT_URL: \$\{HOST_AGENT_URL:-http:\/\/host\.docker\.internal:38182\}/);
    assert.match(compose, /HOST_AGENT_TOKEN: \$\{HOST_AGENT_TOKEN:-\}/);
    assert.match(envExample, /MANIFEST_URL=https:\/\/edgestudio\.technology\/manifest\/development\/manifest\.json/);
    assert.match(envExample, /HOST_AGENT_URL=http:\/\/host\.docker\.internal:38182/);
    assert.match(envExample, /^EDGE_STUDIO_DOCKER_SUBNET=172\.30\.0\.0\/24$/m);
    assert.match(envExample, /^EDGE_STUDIO_DOCKER_GATEWAY=172\.30\.0\.1$/m);
    assert.match(compose, /APP_SECRET: \$\{APP_SECRET:-\}/);
    assert.match(envExample, /^APP_SECRET=$/m);
    assert.doesNotMatch(compose, /dev-change-me/);
    assert.doesNotMatch(envExample, /dev-change-me/);
  });
});
