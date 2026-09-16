import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, it } from "vitest";

const installScript = readFileSync(join(process.cwd(), "install.sh"), "utf8");

function readHeredoc(marker: string): string {
  const match = installScript.match(new RegExp(`<<'${marker}'\\n([\\s\\S]*?)\\n${marker}\\n`));
  assert.ok(match, `install.sh is missing the ${marker} heredoc`);
  return `${match[1]}\n`;
}

describe("install.sh bootstrap trust set", () => {
  it("pins the verifier runtime image by digest", () => {
    const match = installScript.match(/^VERIFIER_IMAGE="([^"]+)"$/m);

    assert.ok(match, "install.sh is missing VERIFIER_IMAGE");
    assert.match(match[1], /^node:[^@\s]+@sha256:[0-9a-f]{64}$/);
  });

  it("embeds the same public key update-agent verifies manifests with", () => {
    const committedKey = readFileSync(
      join(process.cwd(), "update-agent/manifest-public-key.pem"),
      "utf8",
    );

    assert.equal(readHeredoc("MANIFEST_PUBLIC_KEY_PEM"), committedKey);
  });

  it("does not ship the verifier or the public key inside the runtime bundle", () => {
    const bundleFiles: string[] = JSON.parse(
      readFileSync(join(process.cwd(), "scripts/release/runtime-bundle-files.json"), "utf8"),
    );

    assert.ok(!bundleFiles.includes("scripts/verify-manifest.mjs"));
    assert.ok(!bundleFiles.includes("update-agent/manifest-public-key.pem"));
  });
});

describe("install.sh embedded verifier", () => {
  let dir: string;
  let verifierPath: string;
  let artifactPath: string;
  let signaturePath: string;
  let publicKeyPath: string;

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bootstrap-verifier-"));
    verifierPath = join(dir, "verify-manifest.mjs");
    artifactPath = join(dir, "artifact");
    signaturePath = join(dir, "artifact.sig");
    publicKeyPath = join(dir, "public-key.pem");

    writeFileSync(verifierPath, readHeredoc("VERIFY_MANIFEST_MJS"));
    writeFileSync(artifactPath, Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x42, 0x00, 0xff]));
    writeFileSync(
      signaturePath,
      cryptoSign(null, readFileSync(artifactPath), privateKey).toString("base64"),
    );
    writeFileSync(publicKeyPath, publicKey.export({ type: "spki", format: "pem" }).toString());
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function runVerifier(argv: string[] = [artifactPath, signaturePath, publicKeyPath]) {
    return spawnSync(process.execPath, [verifierPath, ...argv], { encoding: "utf8" });
  }

  it("accepts a binary artifact signed by the matching key", () => {
    assert.equal(runVerifier().status, 0);
  });

  it("rejects an artifact modified after signing", () => {
    writeFileSync(artifactPath, Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x43, 0x00, 0xff]));

    const result = runVerifier();

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /signature verification failed/);
  });

  it("rejects a signature made by a different key", () => {
    const attacker = generateKeyPairSync("ed25519");
    writeFileSync(
      signaturePath,
      cryptoSign(null, readFileSync(artifactPath), attacker.privateKey).toString("base64"),
    );

    const result = runVerifier();

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /signature verification failed/);
  });

  it("exits non-zero when arguments are missing", () => {
    const result = runVerifier([artifactPath]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: verify-manifest\.mjs/);
  });

  it("exits non-zero instead of throwing when a file is unreadable", () => {
    const result = runVerifier([join(dir, "missing"), signaturePath, publicKeyPath]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Manifest verification error/);
  });
});

describe("install.sh embedded manifest parser", () => {
  let dir: string;
  let parserPath: string;
  let manifestPath: string;
  let outputDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bootstrap-manifest-parser-"));
    parserPath = join(dir, "parse-manifest.mjs");
    manifestPath = join(dir, "manifest.json");
    outputDir = join(dir, "fields");
    mkdirSync(outputDir);
    writeFileSync(parserPath, readHeredoc("PARSE_MANIFEST_MJS"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function runParser(hostRuntime: unknown) {
    writeFileSync(
      manifestPath,
      JSON.stringify({
        frontend: "ghcr.io/example/frontend@sha256:frontend",
        backend: "ghcr.io/example/backend@sha256:backend",
        updateAgent: "ghcr.io/example/update-agent@sha256:update-agent",
        hostRuntime,
        version: "1.2.3",
        createdAt: "2026-09-16T00:00:00.000Z",
      }),
    );
    return spawnSync(process.execPath, [parserPath, manifestPath, outputDir], { encoding: "utf8" });
  }

  it("writes validated manifest fields and normalizes the runtime metadata", () => {
    const result = runParser({
      url: "https://example.com/runtime.tar.gz?token=test",
      sha256: "A".repeat(64),
    });

    assert.equal(result.status, 0);
    assert.equal(
      readFileSync(join(outputDir, "host-runtime-url"), "utf8"),
      "https://example.com/runtime.tar.gz?token=test",
    );
    assert.equal(readFileSync(join(outputDir, "host-runtime-sha256"), "utf8"), "a".repeat(64));
  });

  it("rejects a malformed host runtime URL", () => {
    const result = runParser({ url: "file:///tmp/runtime.tar.gz", sha256: "a".repeat(64) });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /hostRuntime\.url/);
  });

  it("rejects a malformed host runtime SHA-256", () => {
    const result = runParser({ url: "https://example.com/runtime.tar.gz", sha256: "not-a-sha" });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /hostRuntime\.sha256/);
  });
});

describe("install.sh embedded signature URL resolver", () => {
  it("appends the signature suffix to the URL pathname", () => {
    const dir = mkdtempSync(join(tmpdir(), "bootstrap-signature-url-"));
    const resolverPath = join(dir, "signature-url.mjs");
    writeFileSync(resolverPath, readHeredoc("SIGNATURE_URL_MJS"));

    const result = spawnSync(
      process.execPath,
      [resolverPath, "https://example.com/runtime.tar.gz?token=test"],
      {
        encoding: "utf8",
      },
    );

    rmSync(dir, { recursive: true, force: true });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "https://example.com/runtime.tar.gz.sig?token=test");
  });
});

describe("install.sh release runtime trust chain", () => {
  let dir: string;
  let appDir: string;
  let fixtureDir: string;
  let harnessPath: string;
  let shimDir: string;

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "installer-release-trust-"));
    appDir = join(dir, "existing-installation");
    fixtureDir = join(dir, "fixtures");
    shimDir = join(dir, "bin");
    harnessPath = join(dir, "install-release-harness.sh");

    mkdirSync(join(appDir, "backend"), { recursive: true });
    chmodSync(appDir, 0o700);
    mkdirSync(fixtureDir);
    mkdirSync(shimDir);
    writeFileSync(join(appDir, ".env"), "APP_SECRET=existing-secret\n");
    writeFileSync(join(appDir, "existing.txt"), "keep this installation\n");
    writeFileSync(join(appDir, "backend", "existing.js"), "existing backend\n");

    const sourceableInstaller = installScript
      .replace(
        /(cat > "\$BOOTSTRAP_DIR\/manifest-public-key\.pem" <<'MANIFEST_PUBLIC_KEY_PEM'\n)[\s\S]*?(\nMANIFEST_PUBLIC_KEY_PEM)/,
        `$1${publicKeyPem.trim()}$2`,
      )
      .replace(
        /\nmain "\$@"\s*$/,
        "\n\nwrite_bootstrap_trust_set\nload_existing_config\nresolve_images\ndownload_app\n",
      );
    writeFileSync(harnessPath, sourceableInstaller);

    const curlShim = join(shimDir, "curl");
    writeFileSync(
      curlShim,
      `#!/usr/bin/env bash
set -euo pipefail

url=""
output=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done

path="\${url%%\\?*}"
name="\${path##*/}"
[ -n "$output" ]
cp "$INSTALL_FIXTURE_DIR/$name" "$output"
`,
    );
    chmodSync(curlShim, 0o755);

    const dockerShim = join(shimDir, "docker");
    writeFileSync(
      dockerShim,
      `#!/usr/bin/env bash
set -euo pipefail

[ "$1" = "run" ]
shift
declare -A mounts=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --rm) shift ;;
    --network) shift 2 ;;
    -v)
      spec="$2"
      host_path="\${spec%%:*}"
      container_spec="\${spec#*:}"
      container_path="\${container_spec%%:*}"
      mounts["$container_path"]="$host_path"
      shift 2
      ;;
    *) shift; break ;;
  esac
done

[ "$1" = "node" ]
shift
translated=()
for argument in "$@"; do
  if [ -n "\${mounts[$argument]+set}" ]; then
    translated+=("\${mounts[$argument]}")
  else
    translated+=("$argument")
  fi
done
exec "$INSTALL_NODE_BINARY" "\${translated[@]}"
`,
    );
    chmodSync(dockerShim, 0o755);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function sha256(path: string): string {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  }

  function signFixture(path: string): void {
    writeFileSync(
      `${path}.sig`,
      cryptoSign(null, readFileSync(path), privateKey).toString("base64"),
    );
  }

  function createBundle(name: string, marker: string): string {
    const stageDir = join(dir, `${name}-contents`);
    const bundlePath = join(fixtureDir, name);
    mkdirSync(stageDir);
    writeFileSync(join(stageDir, "package.json"), JSON.stringify({ version: "test-runtime" }));
    writeFileSync(join(stageDir, "runtime-marker.txt"), marker);

    const result = spawnSync("tar", ["-czf", bundlePath, "-C", stageDir, "."], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    signFixture(bundlePath);
    return bundlePath;
  }

  function publishManifest(hostRuntime: unknown): void {
    const manifestPath = join(fixtureDir, "manifest.json");
    writeFileSync(
      manifestPath,
      JSON.stringify({
        frontend: "ghcr.io/example/frontend@sha256:frontend",
        backend: "ghcr.io/example/backend@sha256:backend",
        updateAgent: "ghcr.io/example/update-agent@sha256:update-agent",
        hostRuntime,
        version: "v1.2.3-test.1",
        createdAt: "2026-09-16T00:00:00.000Z",
      }),
    );
    signFixture(manifestPath);
  }

  function installationSnapshot(): string[] {
    const entries: string[] = [`directory:.:${statSync(appDir).mode & 0o777}`];
    const visit = (current: string) => {
      for (const name of readdirSync(current).sort()) {
        const path = join(current, name);
        const key = relative(appDir, path);
        const stats = statSync(path);
        if (stats.isDirectory()) {
          entries.push(`directory:${key}:${stats.mode & 0o777}`);
          visit(path);
        } else {
          entries.push(
            `file:${key}:${stats.mode & 0o777}:${readFileSync(path).toString("base64")}`,
          );
        }
      }
    };
    visit(appDir);
    return entries;
  }

  function runInstaller(runtimeBundleUrl?: string) {
    return spawnSync("bash", [harnessPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        APP_DIR: appDir,
        DATA_DIR: "./data",
        DEV_MODE: "false",
        INSTALL_FIXTURE_DIR: fixtureDir,
        INSTALL_NODE_BINARY: process.execPath,
        MANIFEST_URL: "https://fixtures.test/manifest.json",
        MINIMA_DATA_DIR: "./minima",
        PATH: `${shimDir}:${process.env.PATH ?? ""}`,
        RUNTIME_BUNDLE_URL: runtimeBundleUrl ?? "",
        UPDATE_AGENT_STATE_DIR: "./update-agent-state",
      },
    });
  }

  function assertRejectedWithoutMutation(
    result: ReturnType<typeof runInstaller>,
    before: string[],
  ): void {
    assert.notEqual(
      result.status,
      0,
      `installer unexpectedly succeeded:\n${result.stdout}\n${result.stderr}`,
    );
    assert.deepEqual(installationSnapshot(), before);
    assert.equal(existsSync(join(appDir, "runtime-marker.txt")), false);
  }

  it("installs a bundle whose signature and SHA-256 match the signed manifest", () => {
    const bundleA = createBundle("runtime-a.tar.gz", "bundle A\n");
    publishManifest({ url: "https://fixtures.test/runtime-a.tar.gz", sha256: sha256(bundleA) });

    const result = runInstaller();

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(readFileSync(join(appDir, "runtime-marker.txt"), "utf8"), "bundle A\n");
    assert.equal(readFileSync(join(appDir, ".env"), "utf8"), "APP_SECRET=existing-secret\n");
    assert.equal(existsSync(join(appDir, "existing.txt")), false);
  });

  it("rejects a manifest modified after it was signed without changing the installation", () => {
    const bundleA = createBundle("runtime-a.tar.gz", "bundle A\n");
    publishManifest({ url: "https://fixtures.test/runtime-a.tar.gz", sha256: sha256(bundleA) });
    appendFileSync(join(fixtureDir, "manifest.json"), "\n");
    const before = installationSnapshot();

    const result = runInstaller();

    assertRejectedWithoutMutation(result, before);
    assert.match(`${result.stdout}\n${result.stderr}`, /Manifest signature verification failed/);
  });

  it("rejects signed bundle A when the signed manifest names bundle B's SHA-256", () => {
    const bundleA = createBundle("runtime-a.tar.gz", "bundle A\n");
    const bundleB = createBundle("runtime-b.tar.gz", "bundle B\n");
    publishManifest({ url: "https://fixtures.test/runtime-a.tar.gz", sha256: sha256(bundleB) });
    const before = installationSnapshot();

    const result = runInstaller();

    assertRejectedWithoutMutation(result, before);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /SHA-256 does not match the signed manifest/,
    );
    assert.notEqual(sha256(bundleA), sha256(bundleB));
  });

  it("rejects a bundle modified after it was signed", () => {
    const bundle = createBundle("runtime-modified.tar.gz", "original bundle\n");
    appendFileSync(bundle, "modified after signing");
    publishManifest({
      url: "https://fixtures.test/runtime-modified.tar.gz",
      sha256: sha256(bundle),
    });
    const before = installationSnapshot();

    const result = runInstaller();

    assertRejectedWithoutMutation(result, before);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /Runtime bundle signature verification failed/,
    );
  });

  it("rejects an unsigned explicit bundle URL without falling back", () => {
    const bundle = createBundle("runtime-unsigned.tar.gz", "unsigned bundle\n");
    rmSync(`${bundle}.sig`);
    publishManifest({
      url: "https://fixtures.test/runtime-unsigned.tar.gz",
      sha256: sha256(bundle),
    });
    const before = installationSnapshot();

    const result = runInstaller("https://fixtures.test/runtime-unsigned.tar.gz");

    assertRejectedWithoutMutation(result, before);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /Failed to download runtime bundle or its signature/,
    );
  });

  it.each([
    ["missing", { url: "https://fixtures.test/runtime-a.tar.gz" }],
    ["malformed", { url: "https://fixtures.test/runtime-a.tar.gz", sha256: "not-a-sha256" }],
  ])("rejects a signed manifest with a %s hostRuntime.sha256", (_label, hostRuntime) => {
    publishManifest(hostRuntime);
    const before = installationSnapshot();

    const result = runInstaller();

    assertRejectedWithoutMutation(result, before);
    assert.match(`${result.stdout}\n${result.stderr}`, /hostRuntime\.sha256/);
  });

  it("accepts an explicit bundle URL only when its bytes match the signed manifest SHA-256", () => {
    const bundleA = createBundle("runtime-a.tar.gz", "bundle A override\n");
    createBundle("runtime-b.tar.gz", "bundle B manifest URL\n");
    createBundle("runtime-stale.tar.gz", "stale persisted override\n");
    publishManifest({ url: "https://fixtures.test/runtime-b.tar.gz", sha256: sha256(bundleA) });
    writeFileSync(
      join(appDir, ".env"),
      "APP_SECRET=existing-secret\nRUNTIME_BUNDLE_URL=https://fixtures.test/runtime-stale.tar.gz\n",
    );

    const result = runInstaller("https://fixtures.test/runtime-a.tar.gz");

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(readFileSync(join(appDir, "runtime-marker.txt"), "utf8"), "bundle A override\n");
  });

  it("rejects an explicit bundle URL when its bytes do not match the signed manifest SHA-256", () => {
    const bundleA = createBundle("runtime-a.tar.gz", "bundle A override\n");
    const bundleB = createBundle("runtime-b.tar.gz", "bundle B manifest digest\n");
    publishManifest({ url: "https://fixtures.test/runtime-b.tar.gz", sha256: sha256(bundleB) });
    const before = installationSnapshot();

    const result = runInstaller("https://fixtures.test/runtime-a.tar.gz");

    assertRejectedWithoutMutation(result, before);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /SHA-256 does not match the signed manifest/,
    );
    assert.notEqual(sha256(bundleA), sha256(bundleB));
  });

  it("leaves every existing installation file untouched when manifest validation fails", () => {
    publishManifest({ url: "https://fixtures.test/runtime-a.tar.gz", sha256: "bad" });
    const before = installationSnapshot();

    const result = runInstaller();

    assertRejectedWithoutMutation(result, before);
  });

  it("uses a signed, hash-matching fallback bundle when the manifest-selected URL cannot be downloaded", () => {
    const fallbackBundle = createBundle("edge-studio-runtime.tar.gz", "fallback bundle\n");
    publishManifest({
      url: "https://fixtures.test/missing-runtime.tar.gz",
      sha256: sha256(fallbackBundle),
    });

    const result = runInstaller();

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(readFileSync(join(appDir, "runtime-marker.txt"), "utf8"), "fallback bundle\n");
  });

  it("rejects a signed fallback bundle that does not match the signed manifest SHA-256", () => {
    const fallbackBundle = createBundle("edge-studio-runtime.tar.gz", "fallback bundle\n");
    const expectedBundle = createBundle("runtime-b.tar.gz", "expected bundle\n");
    publishManifest({
      url: "https://fixtures.test/missing-runtime.tar.gz",
      sha256: sha256(expectedBundle),
    });
    const before = installationSnapshot();

    const result = runInstaller();

    assertRejectedWithoutMutation(result, before);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /SHA-256 does not match the signed manifest/,
    );
    assert.notEqual(sha256(fallbackBundle), sha256(expectedBundle));
  });
});
