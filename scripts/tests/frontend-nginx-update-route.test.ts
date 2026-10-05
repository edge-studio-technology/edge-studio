import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";

const repoRoot = process.cwd();
// Must match the runtime stage of frontend/Dockerfile.
const nginxImage = readFileSync(join(repoRoot, "frontend/Dockerfile"), "utf8").match(/^FROM (nginx:\S+) AS runtime$/m)![1];
const containerName = `edge-studio-nginx-update-route-${randomUUID()}`;

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  assert.equal(result.status, 0, `${command} ${args[0]} failed: ${result.stderr}`);
  return `${result.stdout}${result.stderr}`;
}

function containerCurl(path: string) {
  return run("docker", ["exec", containerName, "curl", "-ks", "-o", "/dev/null", "-w", "%{http_code} %{redirect_url}", `https://127.0.0.1${path}`]).trim();
}

let certDir: string;

describe("frontend nginx /update routing", () => {
  beforeAll(() => {
    certDir = mkdtempSync(join(tmpdir(), "nginx-update-route-"));
    run("openssl", ["req", "-x509", "-nodes", "-days", "1", "-newkey", "rsa:2048", "-subj", "/CN=test", "-keyout", join(certDir, "server.key"), "-out", join(certDir, "server.crt")]);
    chmodSync(join(certDir, "server.key"), 0o644);

    // A user-defined network provides Docker's embedded DNS (127.0.0.11), so the unresolvable
    // `update-agent` upstream fails fast instead of waiting for a resolver timeout.
    run("docker", ["network", "create", containerName]);
    run("docker", [
      "run", "-d", "--name", containerName, "--network", containerName,
      "-v", `${join(repoRoot, "frontend/nginx.conf")}:/etc/nginx/templates/default.conf.template:ro`,
      "-v", `${join(repoRoot, "frontend/nginx-snippets/backend-proxy.conf")}:/etc/nginx/snippets/backend-proxy.conf:ro`,
      "-e", "EDGE_STUDIO_UPLOAD_MAX_REQUEST_BYTES=1m",
      "-v", `${certDir}:/etc/nginx/certs:ro`,
      nginxImage
    ]);

    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (spawnSync("docker", ["exec", containerName, "curl", "-ksf", "-o", "/dev/null", "https://127.0.0.1/"]).status === 0) return;
      spawnSync("sleep", ["0.2"]);
    }
    assert.fail(`nginx did not start: ${spawnSync("docker", ["logs", containerName], { encoding: "utf8" }).stderr}`);
  }, 120_000);

  afterAll(() => {
    spawnSync("docker", ["rm", "-f", containerName]);
    spawnSync("docker", ["network", "rm", containerName]);
    if (certDir) rmSync(certDir, { recursive: true, force: true });
  });

  it("serves bare /update as the SPA instead of redirecting to /update/", () => {
    assert.equal(containerCurl("/update"), "200");
  });

  it("still proxies /update/ to update-agent", () => {
    assert.match(containerCurl("/update/"), /^50\d$/);
  });
});
