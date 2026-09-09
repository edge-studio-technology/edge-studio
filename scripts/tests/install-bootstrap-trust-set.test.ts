import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    const committedKey = readFileSync(join(process.cwd(), "update-agent/manifest-public-key.pem"), "utf8");

    assert.equal(readHeredoc("MANIFEST_PUBLIC_KEY_PEM"), committedKey);
  });

  it("does not ship the verifier or the public key inside the runtime bundle", () => {
    const bundleFiles: string[] = JSON.parse(
      readFileSync(join(process.cwd(), "scripts/release/runtime-bundle-files.json"), "utf8")
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
    writeFileSync(signaturePath, cryptoSign(null, readFileSync(artifactPath), privateKey).toString("base64"));
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
    writeFileSync(signaturePath, cryptoSign(null, readFileSync(artifactPath), attacker.privateKey).toString("base64"));

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
